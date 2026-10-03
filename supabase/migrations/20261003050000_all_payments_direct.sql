-- Every passenger payment goes straight to the driver (cash, Nequi, Daviplata,
-- Bancolombia). NÜVA collects its commission from the driver via Wompi top-ups.
alter table public.trips drop column payment_channel;
alter table public.trips add column payment_channel text generated always as ('direct') stored;

-- Driver payout accounts: { nequi, daviplata, bancolombia }.
-- Share with the passenger only the account for the method they chose.
create or replace function public.trip_counterpart(p_trip uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t public.trips; other uuid; p public.profiles; acct text;
begin
  select * into t from public.trips where id = p_trip;
  if not found or auth.uid() not in (t.passenger_id, coalesce(t.driver_id, '00000000-0000-0000-0000-000000000000')) then
    raise exception 'No autorizado';
  end if;
  other := case when auth.uid() = t.passenger_id then t.driver_id else t.passenger_id end;
  if other is null then return null; end if;
  select * into p from public.profiles where id = other;
  if auth.uid() = t.passenger_id and t.status in ('in_progress', 'completed') then
    acct := case t.payment
      when 'nequi' then p.payout ->> 'nequi'
      when 'daviplata' then p.payout ->> 'daviplata'
      when 'bancolombia' then p.payout ->> 'bancolombia'
    end;
  end if;
  return jsonb_build_object(
    'name', coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1)),
    'rating', p.rating,
    'vehicle', p.vehicle,
    'role', p.role,
    'payAccount', acct,
    'nequi', case when t.payment = 'nequi' then acct end
  );
end $$;

-- Commission debt the driver must pay to NÜVA (positive number), for the top-up flow.
create or replace function public.driver_commission_due()
returns integer language sql stable security definer set search_path = public as $$
  select greatest(0, -public.driver_balance(auth.uid()))
$$;

revoke execute on function public.driver_commission_due() from public, anon;
grant execute on function public.driver_commission_due() to authenticated;
revoke execute on function public.trip_counterpart(uuid) from public, anon;
grant execute on function public.trip_counterpart(uuid) to authenticated;
