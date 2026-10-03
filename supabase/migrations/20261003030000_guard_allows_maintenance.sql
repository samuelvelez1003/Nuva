-- End users can never change role/driver_status (RLS + this guard). Requests with no
-- end user (SQL editor, service role) are maintenance and are allowed.
create or replace function public.guard_role_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and (new.role is distinct from old.role or new.driver_status is distinct from old.driver_status) then
    raise exception 'Solo un administrador puede cambiar roles o aprobar conductores';
  end if;
  return new;
end $$;
