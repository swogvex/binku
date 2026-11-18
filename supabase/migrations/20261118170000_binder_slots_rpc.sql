-- Replaces a binder's whole card order in one atomic call (the app saves the flat order).
-- security invoker: RLS on binder_slots still limits it to the caller's own binders.
create function public.set_binder_slots(p_binder uuid, p_cards text[]) returns void
language sql security invoker set search_path = '' as $$
  delete from public.binder_slots where binder_id = p_binder;
  insert into public.binder_slots (binder_id, page, position, card_id)
  select p_binder, 0, t.o - 1, t.c from unnest(p_cards) with ordinality as t(c, o);
$$;

revoke execute on function public.set_binder_slots(uuid, text[]) from public, anon;
grant execute on function public.set_binder_slots(uuid, text[]) to authenticated;
