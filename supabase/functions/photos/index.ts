// Photos gateway to the private R2 bucket (14-security: presigned PUT ≤ 300 KB, 5 min).
//   upload {id, cardId, kind, bytes}  → registers the photo (quota, rate, cap) → signed PUT URL
//   read   {ids}                      → signed GET URLs (1 h) for the caller's own photos
//   purge  (daily pg_cron, x-cron-secret) → deletes removed photos' objects from R2
// verify_jwt is off (config.toml): the cron call has no user JWT, so users are checked here.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { presign } from '../_shared/sigv4.ts';

const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`missing env ${k}`);
  return v;
};
const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});
const r2 = {
  accessKeyId: env('R2_ACCESS_KEY_ID'),
  secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
  region: 'auto',
};
// EU jurisdiction buckets have their own endpoint.
const objectUrl = (key: string) =>
  `https://${env('R2_ACCOUNT_ID')}.eu.r2.cloudflarestorage.com/${env('R2_BUCKET')}/${key}`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = ['scan', 'condition_front', 'condition_back'];
const MAX_BYTES = 300 * 1024;
const REFUSED: Record<string, number> = {
  quota: 403,
  rate: 429,
  paused: 503,
  conflict: 409,
  removed: 409,
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function upload(userId: string, b: Record<string, unknown>) {
  const { id, cardId, kind, bytes } = b;
  if (
    typeof id !== 'string' ||
    !UUID.test(id) ||
    typeof cardId !== 'string' ||
    cardId.length < 1 ||
    cardId.length > 100 ||
    typeof kind !== 'string' ||
    !KINDS.includes(kind) ||
    !Number.isInteger(bytes) ||
    (bytes as number) < 1 ||
    (bytes as number) > MAX_BYTES
  )
    return json(400, { error: 'invalid' });

  const { data, error } = await admin.rpc('begin_photo_upload', {
    p_user: userId,
    p_id: id.toLowerCase(),
    p_card: cardId,
    p_kind: kind,
    p_bytes: bytes,
  });
  if (error) return json(error.code === '23503' ? 400 : 500, { error: error.code ?? 'db' });
  if (data !== 'ok') return json(REFUSED[data as string] ?? 500, { error: data });

  // Signed headers: R2 rejects the PUT if the size or type differ from what was registered.
  const headers = { 'content-type': 'image/webp', 'content-length': String(bytes) };
  const url = await presign({
    ...r2,
    method: 'PUT',
    url: objectUrl(`u/${userId}/${id.toLowerCase()}.webp`),
    expires: 300,
    headers,
  });
  return json(200, { url, headers });
}

async function read(userId: string, b: Record<string, unknown>) {
  const ids = b.ids;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || !ids.every((x) => UUID.test(x)))
    return json(400, { error: 'invalid' });
  const { data, error } = await admin
    .from('photos')
    .select('id, r2_key')
    .in('id', ids)
    .eq('user_id', userId)
    .is('removed_at', null);
  if (error) return json(500, { error: error.code ?? 'db' });
  const urls: Record<string, string> = {};
  for (const p of data) {
    urls[p.id] = await presign({ ...r2, method: 'GET', url: objectUrl(p.r2_key), expires: 3600 });
  }
  return json(200, { urls });
}

async function purge() {
  let total = 0;
  for (;;) {
    const { data, error } = await admin.rpc('photos_to_purge', { p_limit: 100 });
    if (error) return json(500, { error: error.code ?? 'db' });
    const rows = data as { id: string; r2_key: string }[];
    if (!rows.length) return json(200, { purged: total });
    const done: string[] = [];
    await Promise.all(
      rows.map(async (p) => {
        const url = await presign({
          ...r2,
          method: 'DELETE',
          url: objectUrl(p.r2_key),
          expires: 60,
        });
        const res = await fetch(url, { method: 'DELETE' });
        // 404: never uploaded (or already gone) — nothing left to delete either way.
        if (res.ok || res.status === 404) done.push(p.id);
      }),
    );
    if (!done.length) return json(502, { error: 'r2' }); // R2 down: try again tomorrow
    const marked = await admin.rpc('mark_photos_purged', { p_ids: done });
    if (marked.error) return json(500, { error: marked.error.code ?? 'db' });
    total += done.length;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid' });
  }

  if (body.action === 'purge') {
    const secret = req.headers.get('x-cron-secret');
    return secret && secret === env('PHOTOS_CRON_SECRET') ? purge() : json(401, { error: 'auth' });
  }

  const token = req.headers.get('authorization')?.replace(/^Bearer /i, '');
  if (!token) return json(401, { error: 'auth' });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json(401, { error: 'auth' });

  if (body.action === 'upload') return upload(data.user.id, body);
  if (body.action === 'read') return read(data.user.id, body);
  return json(400, { error: 'invalid' });
});
