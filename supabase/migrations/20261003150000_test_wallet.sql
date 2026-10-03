-- Test wallet: accounts used to try the driver app (e.g. the founder's admin account)
-- never run out of balance and don't pollute the real finance figures.
--   * commissions of their trips are not deducted from their NÜVA balance
--   * accept_ride doesn't ask them for balance
--   * admin_finance ignores their trips, top-ups and adjustments

alter table public.profiles add column if not exists test_wallet boolean not null default false;

-- Users can edit their own profile row: protect the columns only an admin may change.
create or replace function public.guard_role_change() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and (new.role is distinct from old.role
       or new.driver_status is distinct from old.driver_status
       or new.test_wallet is distinct from old.test_wallet
       or new.country is distinct from old.country
       or new.rating is distinct from old.rating) then
    raise exception 'Solo un administrador puede cambiar roles, país, calificación o aprobar conductores';
  end if;
  return new;
end $$;

create or replace function public.driver_balance(p_driver uuid default auth.uid()) returns integer
language sql stable security definer set search_path = public as $$
  with me as (select case when public.is_admin() then p_driver else auth.uid() end as id)
  select (
      coalesce((select sum(amount) from public.driver_topups, me where driver_id = me.id and status = 'pagado'), 0)
    - case when coalesce((select p.test_wallet from public.profiles p, me where p.id = me.id), false) then 0
           else coalesce((select sum(platform_commission) from public.trips, me where driver_id = me.id and status = 'completed'), 0) end
  )::integer
$$;

create or replace function public.accept_ride(p_trip uuid) returns public.trips
language plpgsql security definer set search_path = public as $$
declare t public.trips; need integer; tc text; dc text; test boolean;
begin
  if not public.is_driver() then raise exception 'Tu cuenta de conductor aún no está aprobada'; end if;
  if exists (select 1 from public.trips where driver_id = auth.uid() and status in ('accepted', 'arriving', 'in_progress')) then
    raise exception 'Ya tienes un viaje activo';
  end if;
  select platform_commission, country into need, tc from public.trips where id = p_trip;
  select country, test_wallet into dc, test from public.profiles where id = auth.uid();
  if tc is distinct from dc and not public.is_admin() then raise exception 'Este viaje es de otro país'; end if;
  if not coalesce(test, false) and public.driver_balance(auth.uid()) < coalesce(need, 0) then
    raise exception 'Saldo insuficiente para la comisión de este viaje. Recarga tu saldo NÜVA';
  end if;
  update public.trips set driver_id = auth.uid(), status = 'accepted', accepted_at = now()
   where id = p_trip and status = 'requested' and passenger_id <> auth.uid()
  returning * into t;
  if not found then raise exception 'Este viaje ya fue tomado o cancelado'; end if;
  return t;
end $$;

create or replace function public.driver_wallet() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'balance', public.driver_balance(auth.uid()),
    'test', coalesce((select test_wallet from public.profiles where id = auth.uid()), false),
    'movements', coalesce((
      select jsonb_agg(m order by m->>'at' desc) from (
        select jsonb_build_object(
                 'kind', case method when 'bono' then 'bono' when 'ajuste' then 'ajuste' else 'recarga' end,
                 'amount', amount, 'status', status, 'at', created_at,
                 'note', case when method = 'ajuste' then payment_ref end) as m
          from public.driver_topups where driver_id = auth.uid()
        union all
        -- Test wallets list their trips' commission as 0: nothing was charged.
        select jsonb_build_object('kind', 'comision',
                 'amount', case when (select test_wallet from public.profiles where id = auth.uid()) then 0 else -platform_commission end,
                 'status', 'pagado', 'at', completed_at, 'code', code)
          from public.trips where driver_id = auth.uid() and status = 'completed'
        order by 1 desc
        limit 40
      ) x
    ), '[]'::jsonb)
  )
$$;

create or replace function public.admin_finance(p_days integer default 30, p_country text default 'CO') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb; since timestamptz := now() - make_interval(days => p_days); low integer;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select low_balance into low from public.nuva_settings where country = p_country;
  select jsonb_build_object(
    'topups',      coalesce((select sum(t.amount) from public.driver_topups t join public.profiles p on p.id = t.driver_id where p.country = p_country and not p.test_wallet and t.method = 'wompi' and t.status = 'pagado' and t.created_at > since), 0),
    'topupsCount', coalesce((select count(*)     from public.driver_topups t join public.profiles p on p.id = t.driver_id where p.country = p_country and not p.test_wallet and t.method = 'wompi' and t.status = 'pagado' and t.created_at > since), 0),
    'bonuses',     coalesce((select sum(t.amount) from public.driver_topups t join public.profiles p on p.id = t.driver_id where p.country = p_country and not p.test_wallet and t.method = 'bono' and t.status = 'pagado' and t.created_at > since), 0),
    'adjustments', coalesce((select sum(t.amount) from public.driver_topups t join public.profiles p on p.id = t.driver_id where p.country = p_country and not p.test_wallet and t.method = 'ajuste' and t.created_at > since), 0),
    'commissions', coalesce((select sum(tr.platform_commission) from public.trips tr join public.profiles p on p.id = tr.driver_id where tr.country = p_country and not p.test_wallet and tr.status = 'completed' and tr.completed_at > since), 0),
    'balances',    coalesce((select sum(public.driver_balance(id)) from public.profiles where role = 'driver' and not test_wallet and country = p_country), 0),
    'lowDrivers',  coalesce((select count(*) from public.profiles where role = 'driver' and not test_wallet and country = p_country and driver_status = 'aprobado' and public.driver_balance(id) < coalesce(low, 0)), 0)
  ) into r;
  return r;
end $$;

-- The founder's admin account tests the driver app with a balance that is never spent.
update public.profiles set test_wallet = true
 where id = (select id from auth.users where email = 'bs.velez10@gmail.com');
insert into public.driver_topups (driver_id, amount, status, method, payment_ref)
select u.id, 1000000, 'pagado', 'ajuste', 'Saldo de pruebas (no se descuenta)'
  from auth.users u
 where u.email = 'bs.velez10@gmail.com'
   and not exists (select 1 from public.driver_topups t where t.driver_id = u.id and t.payment_ref = 'Saldo de pruebas (no se descuenta)');
