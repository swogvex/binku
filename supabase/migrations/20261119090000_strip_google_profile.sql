-- Data minimisation (owner decision 2026-11-18): Google sends the user's name and avatar on
-- every sign-in and Supabase Auth would keep them in the user/identity metadata. Binku never
-- uses them (the public name is @username), so they are dropped before they are stored and
-- do not need declaring in the store privacy labels. Email and provider ids stay (sign-in).

create function public.strip_profile_metadata() returns trigger
language plpgsql set search_path = '' as $$
declare
  drop_keys text[] := array['name', 'full_name', 'given_name', 'family_name', 'nickname',
    'picture', 'avatar_url'];
begin
  if tg_table_name = 'users' then
    new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - drop_keys;
  else
    new.identity_data := coalesce(new.identity_data, '{}'::jsonb) - drop_keys;
  end if;
  return new;
end $$;

create trigger strip_profile_metadata before insert or update on auth.users
  for each row execute function public.strip_profile_metadata();
create trigger strip_profile_metadata before insert or update on auth.identities
  for each row execute function public.strip_profile_metadata();

-- Accounts created before this migration.
update auth.users set raw_user_meta_data = raw_user_meta_data
  where raw_user_meta_data ?| array['name', 'full_name', 'given_name', 'family_name', 'nickname', 'picture', 'avatar_url'];
update auth.identities set identity_data = identity_data
  where identity_data ?| array['name', 'full_name', 'given_name', 'family_name', 'nickname', 'picture', 'avatar_url'];

revoke execute on function public.strip_profile_metadata() from public, anon, authenticated;
