-- Administrators can verify member-only services without assigning themselves
-- a separate entitlement. Regular members still require an active entitlement.
create or replace function public.has_entitlement(kind text, at_time timestamptz default now())
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1
    from member_accounts m
    join user_entitlements e on e.user_id = m.user_id
    where m.user_id = auth.uid()
      and m.status = 'active'
      and e.entitlement_type = kind
      and e.active
      and (e.valid_from is null or e.valid_from <= at_time)
      and (e.valid_until is null or e.valid_until >= at_time)
  )
$$;

grant execute on function public.has_entitlement(text, timestamptz) to authenticated;
