-- Prepaid wallet: drivers top up via Wompi; each completed trip automatically
-- deducts its commission (balance is always derived, so it can't drift).
alter table public.driver_topups add column method text not null default 'wompi';

create or replace function public.driver_balance(p_driver uuid default auth.uid())
returns integer language sql stable security definer set search_path = public as $$
  with me as (select case when public.is_admin() then p_driver else auth.uid() end as id)
  select (
      coalesce((select sum(amount) from public.driver_topups, me where driver_id = me.id and status = 'pagado'), 0)
    - coalesce((select sum(platform_commission) from public.trips, me where driver_id = me.id and status = 'completed'), 0)
  )::integer
$$;

-- A driver can take a trip only if the wallet covers its commission.
create or replace function public.accept_ride(p_trip uuid)
returns public.trips language plpgsql security definer set search_path = public as $$
declare t public.trips; need integer;
begin
  if not public.is_driver() then raise exception 'Tu cuenta de conductor aún no está aprobada'; end if;
  if exists (select 1 from public.trips where driver_id = auth.uid() and status in ('accepted', 'arriving', 'in_progress')) then
    raise exception 'Ya tienes un viaje activo';
  end if;
  select platform_commission into need from public.trips where id = p_trip;
  if public.driver_balance(auth.uid()) < coalesce(need, 0) then
    raise exception 'Saldo insuficiente para la comisión de este viaje. Recarga tu saldo NÜVA';
  end if;
  update public.trips
     set driver_id = auth.uid(), status = 'accepted', accepted_at = now()
   where id = p_trip and status = 'requested' and passenger_id <> auth.uid()
  returning * into t;
  if not found then raise exception 'Este viaje ya fue tomado o cancelado'; end if;
  return t;
end $$;

-- Approval grants a one-time welcome credit so new drivers can start right away.
create or replace function public.set_driver_status(p_driver uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  update public.profiles set driver_status = p_status where id = p_driver and role = 'driver';
  if not found then raise exception 'Conductor no encontrado'; end if;
  if p_status = 'aprobado' and not exists (select 1 from public.driver_topups where driver_id = p_driver and method = 'bono') then
    insert into public.driver_topups (driver_id, amount, status, method, payment_ref) values (p_driver, 20000, 'pagado', 'bono', 'BIENVENIDA');
  end if;
end $$;

-- Wallet screen: balance + recent movements (top-ups in, commissions out).
create or replace function public.driver_wallet()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'balance', public.driver_balance(auth.uid()),
    'movements', coalesce((
      select jsonb_agg(m order by m->>'at' desc) from (
        select jsonb_build_object('kind', case when method = 'bono' then 'bono' else 'recarga' end, 'amount', amount, 'status', status, 'at', created_at) as m
          from public.driver_topups where driver_id = auth.uid()
        union all
        select jsonb_build_object('kind', 'comision', 'amount', -platform_commission, 'status', 'pagado', 'at', completed_at, 'code', code)
          from public.trips where driver_id = auth.uid() and status = 'completed'
        order by 1 desc
        limit 40
      ) x
    ), '[]'::jsonb)
  )
$$;

revoke execute on function public.driver_wallet() from public, anon;
grant execute on function public.driver_wallet() to authenticated;
revoke execute on function public.accept_ride(uuid) from public, anon;
grant execute on function public.accept_ride(uuid) to authenticated;
revoke execute on function public.set_driver_status(uuid, text) from public, anon;
grant execute on function public.set_driver_status(uuid, text) to authenticated;
