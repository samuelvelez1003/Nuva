-- Drivers can leave their Nequi number at sign-up; it's copied into profiles.payout.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.user_role;
begin
  r := case
    when exists (select 1 from public.bootstrap_admins b where lower(b.email) = lower(new.email)) then 'admin'::public.user_role
    when new.raw_user_meta_data ->> 'role' = 'driver' then 'driver'::public.user_role
    else 'passenger'::public.user_role
  end;
  insert into public.profiles (id, email, full_name, phone, role, driver_status, vehicle, payout)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', new.phone),
    r,
    case when r = 'driver' then 'pendiente' end,
    case when r = 'driver' then new.raw_user_meta_data -> 'vehicle' end,
    case when r = 'driver' then new.raw_user_meta_data -> 'payout' end
  );
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
