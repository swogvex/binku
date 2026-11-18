-- Account deletion (Apple 5.1.1(v), Google Play, GDPR art. 17): the user asks in-app, the
-- account is hidden at once and hard-deleted after 14 days; signing in again before that
-- cancels it. Hard delete = delete from auth.users, which cascades to every user table.
-- shortcut: R2 photos (M4) are not removed here yet; add them to the purge when uploads exist.

alter table public.profiles add column deletion_requested_at timestamptz;

-- security definer: clients have no grant on deletion_requested_at, so they cannot backdate it.
create function public.request_account_deletion() returns timestamptz
language sql security definer set search_path = '' as $$
  update public.profiles set deletion_requested_at = now()
  where id = (select auth.uid())
  returning deletion_requested_at + interval '14 days';
$$;

create function public.cancel_account_deletion() returns void
language sql security definer set search_path = '' as $$
  update public.profiles set deletion_requested_at = null where id = (select auth.uid());
$$;

create function public.purge_deleted_accounts() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  delete from auth.users u
  using public.profiles p
  where p.id = u.id and p.deletion_requested_at < now() - interval '14 days';
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.request_account_deletion() from public, anon;
revoke execute on function public.cancel_account_deletion() from public, anon;
revoke execute on function public.purge_deleted_accounts() from public, anon, authenticated;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;

-- Daily at 03:17 UTC (off the hour, quiet time in Spain).
create extension if not exists pg_cron;
select cron.schedule('purge-deleted-accounts', '17 3 * * *', 'select public.purge_deleted_accounts()');
