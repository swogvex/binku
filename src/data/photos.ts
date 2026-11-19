// The user's card photos (08-spec-scanner): the original stays on the phone, only a small WebP
// thumbnail goes to the cloud (R2 via the `photos` Edge Function). Works without an account or
// network: rows wait in the outbox like any other change.
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { SQLiteDatabase } from 'expo-sqlite';

import { dataVersion, type UserMark } from '@/data/catalog';
import { enqueue } from '@/data/outbox';
import { setMark } from '@/data/userCards';
import { checkImage } from '@/lib/imageFilter';
import { supabase } from '@/lib/supabase';
import { uuid } from '@/lib/uuid';

export type PhotoKind = 'scan' | 'condition_front' | 'condition_back';
export type Photo = {
  id: string;
  kind: PhotoKind;
  /** Best local file to show: the original if this phone took it, else the thumbnail. */
  uri: string | null;
  thumb: string | null;
  state: 'local' | 'synced' | 'quota';
};
/** cardId → its photos by kind */
export type PhotoMap = Map<string, Partial<Record<PhotoKind, Photo>>>;

const RATIO = 55 / 85;
const ORIGINAL_MAX_H = 1800; // plenty for the card screen, far below a camera's full size
// Thumbnails: ≈40 KB scans (binder grids), ≈100 KB condition photos (offers). 300 KB is the
// server's hard limit.
const THUMB = {
  scan: { height: 600, compress: [0.6, 0.4], target: 60_000 },
  condition: { height: 1000, compress: [0.7, 0.5], target: 150_000 },
};
const MAX_UPLOAD = 300 * 1024;

const dir = () => {
  const d = new Directory(Paths.document, 'photos');
  if (!d.exists) d.create({ intermediates: true });
  return d;
};
const remove = (uri: string | null) => {
  if (!uri) return;
  const f = new File(uri);
  if (f.exists) f.delete();
};
const now = () => new Date().toISOString();

export function loadPhotos(db: SQLiteDatabase): PhotoMap {
  const rows = db.getAllSync<{
    id: string;
    card_id: string;
    kind: PhotoKind;
    original: string | null;
    thumb: string | null;
    state: Photo['state'];
  }>('select id, card_id, kind, original, thumb, state from photos');
  const map: PhotoMap = new Map();
  for (const r of rows) {
    const entry = map.get(r.card_id) ?? {};
    entry[r.kind] = {
      id: r.id,
      kind: r.kind,
      uri: r.original ?? r.thumb,
      thumb: r.thumb ?? r.original,
      state: r.state,
    };
    map.set(r.card_id, entry);
  }
  return map;
}

/** Centre crop to the 55:85 card shape (the scanner already found the edges). */
export function cardCrop(w: number, h: number) {
  const width = w / h > RATIO ? Math.round(h * RATIO) : w;
  const height = w / h > RATIO ? h : Math.round(w / RATIO);
  return {
    originX: Math.round((w - width) / 2),
    originY: Math.round((h - height) / 2),
    width,
    height,
  };
}

/**
 * Turns a scanner / gallery image into the saved original (JPEG) + thumbnail (WebP). Re-encoding
 * drops all metadata (EXIF, location). No filters: scans are already corrected by the system
 * scanner and condition photos must stay unedited.
 */
async function process(source: string, rotation: number, kind: PhotoKind) {
  const rotated = await ImageManipulator.manipulate(source).rotate(rotation).renderAsync();
  const crop = cardCrop(rotated.width, rotated.height);
  const card = ImageManipulator.manipulate(rotated).crop(crop);
  if (crop.height > ORIGINAL_MAX_H) card.resize({ height: ORIGINAL_MAX_H });
  const original = await card.renderAsync();
  await checkImage(original); // before anything is written to disk
  const savedOriginal = await original.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });

  const spec = kind === 'scan' ? THUMB.scan : THUMB.condition;
  const small = await ImageManipulator.manipulate(original)
    .resize({ height: Math.min(spec.height, original.height) })
    .renderAsync();
  let thumb = new File(
    (await small.saveAsync({ format: SaveFormat.WEBP, compress: spec.compress[0] })).uri,
  );
  if ((thumb.size ?? 0) > spec.target) {
    remove(thumb.uri);
    thumb = new File(
      (await small.saveAsync({ format: SaveFormat.WEBP, compress: spec.compress[1] })).uri,
    );
  }
  if ((thumb.size ?? 0) > MAX_UPLOAD) throw new Error('thumbnail too big');
  return { original: new File(savedOriginal.uri), thumb };
}

/**
 * Saves a photo for a card (replacing that card's previous one of the same kind). A scan also
 * marks the card as Tengo if it was not owned. Returns the new photo id.
 */
export async function savePhoto(
  db: SQLiteDatabase,
  p: { source: string; rotation: number; cardId: string; kind: PhotoKind; mark?: UserMark },
) {
  const id = uuid();
  const files = await process(p.source, p.rotation, p.kind);
  const d = dir();
  const original = new File(d, `${id}.jpg`);
  const thumb = new File(d, `${id}.webp`);
  files.original.move(original);
  const bytes = files.thumb.size ?? 0; // read before the move: the target object has no size yet
  files.thumb.move(thumb);

  db.withTransactionSync(() => {
    const old = db.getFirstSync<{ id: string; original: string | null; thumb: string | null }>(
      'select id, original, thumb from photos where card_id = ? and kind = ?',
      p.cardId,
      p.kind,
    );
    if (old) {
      db.runSync('delete from photos where id = ?', old.id);
      remove(old.original);
      remove(old.thumb);
      enqueue(db, 'photo', old.id); // the server replaces it anyway; this covers offline order
    }
    db.runSync(
      'insert into photos (id, card_id, kind, original, thumb, bytes, state, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      p.cardId,
      p.kind,
      original.uri,
      thumb.uri,
      bytes,
      'local',
      now(),
    );
    enqueue(db, 'photo', id);
    if (p.kind === 'scan' && p.mark?.status !== 'have' && p.mark?.status !== 'dupe')
      setMark(db, p.cardId, { status: 'have', qty: 1 });
  });
  dataVersion.bump();
  return id;
}

export function removePhoto(db: SQLiteDatabase, cardId: string, kind: PhotoKind) {
  const row = db.getFirstSync<{ id: string; original: string | null; thumb: string | null }>(
    'select id, original, thumb from photos where card_id = ? and kind = ?',
    cardId,
    kind,
  );
  if (!row) return;
  db.runSync('delete from photos where id = ?', row.id);
  remove(row.original);
  remove(row.thumb);
  enqueue(db, 'photo', row.id);
  dataVersion.bump();
}

/** Forgets every photo on this phone (account deleted, or "Empezar de cero"). */
export function clearPhotos(db: SQLiteDatabase) {
  db.execSync('delete from photos');
  const d = new Directory(Paths.document, 'photos');
  if (d.exists) d.delete();
}

/** Photos to queue when this phone is linked to an account. */
export const unsyncedPhotoIds = (db: SQLiteDatabase) =>
  db.getAllSync<{ id: string }>("select id from photos where state = 'local'").map((r) => r.id);

export const pendingPhotoCount = (db: SQLiteDatabase) =>
  db.getFirstSync<{ n: number }>("select count(*) n from photos where state = 'local'")?.n ?? 0;

type PushError = { code?: string; message?: string } | null;

/** Function errors carry the HTTP response; no response = offline. */
async function functionError(error: unknown): Promise<{ status: number; code?: string } | null> {
  const res = (error as { context?: Response } | null)?.context;
  if (!res || typeof res.status !== 'number') return null;
  const body = await res.json().catch(() => ({}));
  return { status: res.status, code: body?.error };
}

/** Outbox handler for one photo: upload it, or tell the server it was removed. */
export async function pushPhoto(db: SQLiteDatabase, id: string): Promise<PushError> {
  const p = db.getFirstSync<{
    card_id: string;
    kind: PhotoKind;
    thumb: string | null;
    state: string;
  }>('select card_id, kind, thumb, state from photos where id = ?', id);
  if (!p) {
    const res = await supabase
      .from('photos')
      .update({ removed_at: now() })
      .eq('id', id)
      .is('removed_at', null);
    return res.error;
  }
  if (p.state !== 'local' || !p.thumb) return null;
  const file = new File(p.thumb);
  if (!file.exists) return null; // removed meanwhile; its own outbox row handles it

  const { data, error } = await supabase.functions.invoke('photos', {
    body: { action: 'upload', id, cardId: p.card_id, kind: p.kind, bytes: file.size },
  });
  if (error) {
    const e = await functionError(error);
    if (!e || e.status === 503) return { message: e ? 'paused' : 'offline' }; // retry, not counted
    if (e.status === 403) {
      // Quota: the photo stays on this phone only.
      db.runSync("update photos set state = 'quota' where id = ?", id);
      dataVersion.bump();
      return null;
    }
    if (e.status === 409) return null; // removed or replaced elsewhere: nothing to upload
    if (e.status === 400) return { code: '22023', message: e.code }; // permanent
    return { code: String(e.status), message: e.code };
  }

  const { url, headers } = data as { url: string; headers: Record<string, string> };
  const put = await file.upload(url, { httpMethod: 'PUT', headers }).catch(() => null);
  if (!put) return { message: 'offline' };
  if (put.status < 200 || put.status >= 300) return { code: `r2-${put.status}` };
  db.runSync("update photos set state = 'synced' where id = ?", id);
  dataVersion.bump();
  return null;
}

/** Thumbnails of photos taken on another device: fetched once, then shown offline. */
export async function downloadMissingThumbs(db: SQLiteDatabase) {
  const ids = db
    .getAllSync<{ id: string }>(
      "select id from photos where thumb is null and state = 'synced' limit 100",
    )
    .map((r) => r.id);
  if (!ids.length) return;
  const { data, error } = await supabase.functions.invoke('photos', {
    body: { action: 'read', ids },
  });
  if (error) throw error;
  const d = dir();
  let changed = false;
  for (const [id, url] of Object.entries((data as { urls: Record<string, string> }).urls)) {
    const target = new File(d, `${id}.webp`);
    const file = await File.downloadFileAsync(url, target).catch(() => null);
    if (!file) continue;
    db.runSync('update photos set thumb = ? where id = ?', file.uri, id);
    changed = true;
  }
  if (changed) dataVersion.bump();
}

export type ServerPhoto = {
  id: string;
  card_id: string;
  kind: PhotoKind;
  bytes: number;
  updated_at: string;
  removed_at: string | null;
};

/** Applies pulled server rows (inside the pull's transaction). */
export function applyServerPhotos(
  db: SQLiteDatabase,
  rows: ServerPhoto[],
  pending: (id: string) => boolean,
) {
  for (const s of rows) {
    if (pending(s.id)) continue;
    const local = db.getFirstSync<{ id: string; original: string | null; thumb: string | null }>(
      'select id, original, thumb from photos where card_id = ? and kind = ?',
      s.card_id,
      s.kind,
    );
    if (s.removed_at) {
      if (local?.id === s.id) {
        db.runSync('delete from photos where id = ?', s.id);
        remove(local.original);
        remove(local.thumb);
      }
      continue;
    }
    if (local?.id === s.id) {
      db.runSync("update photos set state = 'synced' where id = ?", s.id);
      continue;
    }
    if (local && pending(local.id)) continue; // a newer local photo is on its way up
    if (local) {
      db.runSync('delete from photos where id = ?', local.id);
      remove(local.original);
      remove(local.thumb);
    }
    db.runSync(
      "insert into photos (id, card_id, kind, original, thumb, bytes, state, updated_at) values (?, ?, ?, null, null, ?, 'synced', ?)",
      s.id,
      s.card_id,
      s.kind,
      s.bytes,
      s.updated_at,
    );
  }
}
