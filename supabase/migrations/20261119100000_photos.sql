-- Photos (M4): small WebP thumbnails of the user's scans and condition photos live in a private
-- Cloudflare R2 bucket (EU jurisdiction); originals never leave the phone. This table is the
-- index. Rows are created only by the `photos` Edge Function through begin_photo_upload(), which
-- applies the per-user quota, a rate limit and the global free-tier cap before an upload URL is
-- signed. Removed photos keep their row (so other devices learn about it on the next pull) until
-- the daily purge deletes the R2 object.

create type public.photo_kind as enum ('scan', 'condition_front', 'condition_back');

create table public.photos (
  id uuid primary key, -- generated on the device: retries of the same upload reuse it
  -- null once the account is purged; the row then only waits for its R2 object to be deleted
  user_id uuid references auth.users (id) on delete set null,
  card_id text not null references public.cards (id),
  kind public.photo_kind not null,
  r2_key text not null unique,
  bytes integer not null check (bytes between 1 and 307200), -- 300 KB hard limit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_reason text check (removed_reason in ('user', 'replaced', 'takedown', 'account')),
  purged_at timestamptz -- R2 object deleted
);

create unique index photos_one_active on public.photos (user_id, card_id, kind) where removed_at is null;
create index on public.photos (user_id, updated_at);
create index on public.photos (user_id, created_at);
create index photos_to_purge on public.photos (removed_at) where removed_at is not null and purged_at is null;

-- Fills removed_reason and marks the photos of purged accounts as removed (the FK's
-- `set null` runs this trigger too).
create function public.photo_removed() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.user_id is null and old.user_id is not null then
    new.removed_at := coalesce(new.removed_at, now());
    new.removed_reason := coalesce(new.removed_reason, 'account');
  elsif new.removed_at is not null and old.removed_at is null then
    new.removed_reason := coalesce(new.removed_reason, 'user');
  end if;
  return new;
end $$;

create trigger photo_removed before update on public.photos
  for each row execute function public.photo_removed();
create trigger set_updated_at before update on public.photos
  for each row execute function public.set_updated_at();

alter table public.photos enable row level security;
create policy "own photos" on public.photos for select to authenticated
  using (user_id = (select auth.uid()));
-- The only client write: removing one of its own photos (never un-removing it).
create policy "remove own photos" on public.photos for update to authenticated
  using (user_id = (select auth.uid()) and removed_at is null)
  with check (user_id = (select auth.uid()) and removed_at is not null);

revoke all on public.photos from anon, authenticated;
grant select on public.photos to authenticated;
grant update (removed_at) on public.photos to authenticated;

/**
 * Registers an upload before its URL is signed. Returns 'ok', or why not: 'quota' (1,000 cards
 * with photo per user), 'rate' (120 new photos per hour), 'paused' (R2 free tier at 90 %),
 * 'conflict' (id used for something else) or 'removed' (that photo was deleted meanwhile).
 * A retry with the same id is always 'ok'. A new photo for a card replaces the previous one.
 */
create function public.begin_photo_upload(
  p_user uuid, p_id uuid, p_card text, p_kind public.photo_kind, p_bytes integer
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  existing public.photos;
begin
  select * into existing from public.photos where id = p_id;
  if found then
    if existing.user_id is distinct from p_user or existing.card_id <> p_card or existing.kind <> p_kind then
      return 'conflict';
    end if;
    if existing.removed_at is not null then
      return 'removed';
    end if;
    update public.photos set bytes = p_bytes where id = p_id; -- re-encoded file on retry
    return 'ok';
  end if;

  if (select count(*) from public.photos
      where user_id = p_user and created_at > now() - interval '1 hour') >= 120 then
    return 'rate';
  end if;
  -- Quota counts cards, not files: a card's scan + condition photos are one.
  if not exists (select 1 from public.photos where user_id = p_user and card_id = p_card and removed_at is null)
    and (select count(distinct card_id) from public.photos where user_id = p_user and removed_at is null) >= 1000 then
    return 'quota';
  end if;
  -- R2 free tier: 10 GB stored, 1M class A operations (uploads) per month. Stop at 90 %.
  -- shortcut: full-table sums on every upload; move to a daily metrics_daily row (M9) when photos > ~200k.
  if (select coalesce(sum(bytes), 0) from public.photos where purged_at is null) >= 9000000000
    or (select count(*) from public.photos where created_at >= date_trunc('month', now())) >= 900000 then
    return 'paused';
  end if;

  update public.photos set removed_at = now(), removed_reason = 'replaced'
    where user_id = p_user and card_id = p_card and kind = p_kind and removed_at is null;
  insert into public.photos (id, user_id, card_id, kind, r2_key, bytes)
    values (p_id, p_user, p_card, p_kind, 'u/' || p_user || '/' || p_id || '.webp', p_bytes);
  return 'ok';
end $$;

/** Objects the daily purge must delete from R2 (removed photos, purged accounts). */
create function public.photos_to_purge(p_limit integer) returns table (id uuid, r2_key text)
language sql security definer set search_path = '' as $$
  select id, r2_key from public.photos
  where removed_at is not null and purged_at is null
  order by removed_at limit p_limit;
$$;

/** After the R2 delete: rows of purged accounts disappear, the others keep a tombstone. */
create function public.mark_photos_purged(p_ids uuid[]) returns void
language sql security definer set search_path = '' as $$
  delete from public.photos where id = any (p_ids) and user_id is null;
  update public.photos set purged_at = now() where id = any (p_ids);
$$;

revoke execute on function public.photo_removed() from public, anon, authenticated;
revoke execute on function public.begin_photo_upload(uuid, uuid, text, public.photo_kind, integer) from public, anon, authenticated;
revoke execute on function public.photos_to_purge(integer) from public, anon, authenticated;
revoke execute on function public.mark_photos_purged(uuid[]) from public, anon, authenticated;
grant execute on function public.begin_photo_upload(uuid, uuid, text, public.photo_kind, integer) to service_role;
grant execute on function public.photos_to_purge(integer) to service_role;
grant execute on function public.mark_photos_purged(uuid[]) to service_role;

-- Takedown (DSA notice-and-action, 15-privacy-legal): anyone, even without an account, can
-- report a photo; the owner resolves it from SQL until the moderation panel exists (M7).
create table public.takedown_requests (
  id uuid primary key default gen_random_uuid(),
  requester_email text not null check (char_length(requester_email) <= 254 and requester_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  photo_ref text not null check (char_length(photo_ref) between 1 and 500), -- link or photo id
  reason text not null check (char_length(reason) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected')),
  received_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.takedown_requests enable row level security; -- no policies: admin/service only
revoke all on public.takedown_requests from anon, authenticated;

create function public.request_takedown(p_email text, p_photo_ref text, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
begin
  -- Anti-spam: 3 per email per day and 60 overall per hour (a real wave would still be seen).
  if (select count(*) from public.takedown_requests
      where lower(requester_email) = lower(p_email) and received_at > now() - interval '1 day') >= 3
    or (select count(*) from public.takedown_requests where received_at > now() - interval '1 hour') >= 60 then
    raise exception 'too many requests' using errcode = 'P0001';
  end if;
  insert into public.takedown_requests (requester_email, photo_ref, reason)
    values (trim(p_email), trim(p_photo_ref), trim(p_reason))
    returning id into new_id;
  return new_id;
end $$;

/** Owner action: accept a request and remove the photo (repeat infringers: count by user_id). */
create function public.takedown_photo(p_photo uuid, p_request uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- No auth.uid() = SQL editor / service role (anon has no grant); app users must be admins.
  if (select auth.uid()) is not null
    and coalesce((select role from public.profiles where id = (select auth.uid())), 'user') <> 'admin' then
    raise exception 'admins only' using errcode = '42501';
  end if;
  update public.photos set removed_at = now(), removed_reason = 'takedown'
    where id = p_photo and removed_at is null;
  update public.takedown_requests set status = 'accepted', resolved_at = now() where id = p_request;
end $$;

revoke execute on function public.request_takedown(text, text, text) from public;
revoke execute on function public.takedown_photo(uuid, uuid) from public, anon;
grant execute on function public.request_takedown(text, text, text) to anon, authenticated;
grant execute on function public.takedown_photo(uuid, uuid) to authenticated;

-- Daily R2 purge at 03:37 UTC (after the 03:17 account purge). The Edge Function URL and a
-- shared secret come from Vault (set once per project, never in the repo); see docs/ai/22-build-release.md.
create extension if not exists pg_net;
select cron.schedule('purge-photos', '37 3 * * *', $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/photos',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'photos_cron_secret')),
    body := '{"action":"purge"}'::jsonb)
$cron$);
