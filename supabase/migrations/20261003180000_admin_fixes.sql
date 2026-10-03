-- Admin panel fixes.

-- 1. Manual top-ups (Curaçao, or cash received in Colombia) are real money in, not an
--    "ajuste": record them as method 'manual' so finance counts them as top-ups.
drop function if exists public.admin_adjust_wallet(uuid, integer, text);
create or replace function public.admin_adjust_wallet(p_driver uuid, p_amount integer, p_reason text, p_kind text default 'ajuste')
returns integer language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_kind not in ('ajuste', 'manual') then raise exception 'Tipo inválido'; end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 1000000 then raise exception 'Monto inválido'; end if;
  if p_kind = 'manual' and p_amount < 0 then raise exception 'Una recarga debe ser positiva'; end if;
  if coalesce(length(trim(p_reason)), 0) < 3 then raise exception 'Escribe el motivo o la referencia del pago'; end if;
  if not exists (select 1 from public.profiles where id = p_driver and role = 'driver') then raise exception 'Conductor no encontrado'; end if;
  insert into public.driver_topups (driver_id, amount, status, method, payment_ref)
  values (p_driver, p_amount, 'pagado', p_kind, left(trim(p_reason), 120));
  return public.driver_balance(p_driver);
end $$;
revoke execute on function public.admin_adjust_wallet(uuid, integer, text, text) from public, anon;
grant execute on function public.admin_adjust_wallet(uuid, integer, text, text) to authenticated;

create or replace function public.admin_finance(p_days integer default 30, p_country text default 'CO') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb; since timestamptz := now() - make_interval(days => p_days); low integer;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select low_balance into low from public.nuva_settings where country = p_country;
  select jsonb_build_object(
    'topups',      coalesce((select sum(t.amount) from public.driver_topups t join public.profiles p on p.id = t.driver_id where p.country = p_country and not p.test_wallet and t.method in ('wompi', 'manual') and t.status = 'pagado' and t.created_at > since), 0),
    'topupsCount', coalesce((select count(*)     from public.driver_topups t join public.profiles p on p.id = t.driver_id where p.country = p_country and not p.test_wallet and t.method in ('wompi', 'manual') and t.status = 'pagado' and t.created_at > since), 0),
    'bonuses',     coalesce((select sum(t.amount) from public.driver_topups t join public.profiles p on p.id = t.driver_id where p.country = p_country and not p.test_wallet and t.method = 'bono' and t.status = 'pagado' and t.created_at > since), 0),
    'adjustments', coalesce((select sum(t.amount) from public.driver_topups t join public.profiles p on p.id = t.driver_id where p.country = p_country and not p.test_wallet and t.method = 'ajuste' and t.created_at > since), 0),
    'commissions', coalesce((select sum(tr.platform_commission) from public.trips tr join public.profiles p on p.id = tr.driver_id where tr.country = p_country and not p.test_wallet and tr.status = 'completed' and tr.completed_at > since), 0),
    'balances',    coalesce((select sum(public.driver_balance(id)) from public.profiles where role = 'driver' and not test_wallet and country = p_country), 0),
    'lowDrivers',  coalesce((select count(*) from public.profiles where role = 'driver' and not test_wallet and country = p_country and driver_status = 'aprobado' and public.driver_balance(id) < coalesce(low, 0)), 0)
  ) into r;
  return r;
end $$;

-- 2. Tickets and promos belong to a country (the console shows one at a time).
alter table public.support_tickets add column if not exists country text not null default 'CO';
alter table public.promos add column if not exists country text not null default 'CO';
create index if not exists support_tickets_country_idx on public.support_tickets (country, created_at desc);
create index if not exists support_tickets_created_by_idx on public.support_tickets (created_by);
create index if not exists support_tickets_trip_idx on public.support_tickets (trip_id);

-- A ticket takes its creator's country; users can't pick priority/status or attach
-- someone else's trip (only admins set those).
create or replace function public.ticket_defaults() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select coalesce(country, 'CO') into new.country from public.profiles where id = new.created_by;
  if not public.is_admin() then
    new.status := 'abierto';
    new.priority := 'media';
    if new.trip_id is not null and not exists (
      select 1 from public.trips t where t.id = new.trip_id and new.created_by in (t.passenger_id, t.driver_id)
    ) then
      new.trip_id := null;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists support_tickets_defaults on public.support_tickets;
create trigger support_tickets_defaults before insert on public.support_tickets
  for each row execute function public.ticket_defaults();

-- 3. New tickets and sign-ups appear live in the console (RLS still applies).
alter publication supabase_realtime add table public.support_tickets;
alter publication supabase_realtime add table public.profiles;
