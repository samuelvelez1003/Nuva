-- Local currencies: Curaçao moves from USD to the Caribbean guilder (XCG, "Cg"),
-- still stored in cents. Colombia stays in COP.
create or replace function public.country_currency(c text) returns text language sql immutable as $$
  select case c when 'CW' then 'XCG' else 'COP' end
$$;

-- Curaçao launch rates in XCG cents (≈ USD × 1.79): base Cg7,00 · Cg2,70/km · Cg0,45/min · minimum Cg14,50.
insert into public.pricing_versions (version, base_fare, price_per_km, price_per_minute, minimum_fare, commission_pct, categories, note, country)
select (select max(version) from public.pricing_versions) + 1, 700, 270, 45, 1450, 12,
  '{
    "moto":    {"id":"moto","name":"Moto","tagline":"Rápido y económico","seats":1,"multiplier":0.7,"minimumFare":1250,"enabled":false,"etaMinutes":2},
    "go":      {"id":"go","name":"Go","tagline":"El viaje de todos los días","seats":4,"multiplier":1,"minimumFare":1450,"enabled":true,"etaMinutes":4},
    "eco":     {"id":"eco","name":"Eléctrico","tagline":"Cero emisiones, mismo precio justo","seats":4,"multiplier":1.05,"minimumFare":1600,"enabled":true,"etaMinutes":6},
    "confort": {"id":"confort","name":"Confort","tagline":"Carros nuevos, conductores top","seats":4,"multiplier":1.3,"minimumFare":2000,"enabled":true,"etaMinutes":5},
    "xl":      {"id":"xl","name":"XL","tagline":"Hasta 6 personas y maletas","seats":6,"multiplier":1.6,"minimumFare":2500,"enabled":true,"etaMinutes":8}
  }'::jsonb,
  'Curazao en florín caribeño (XCG, centavos)', 'CW';

-- Apps released before the country selector read "the latest version" without a
-- country filter: keep a Colombian version on top so they keep quoting in pesos.
insert into public.pricing_versions (version, base_fare, price_per_km, price_per_minute, minimum_fare, commission_pct, categories, note, published_by, country)
select (select max(version) from public.pricing_versions) + 1, base_fare, price_per_km, price_per_minute, minimum_fare, commission_pct, categories,
       'Re-publicada: compatibilidad con apps sin selector de país', published_by, 'CO'
from public.pricing_versions where country = 'CO' order by version desc limit 1;

update public.nuva_settings set min_topup = 1800, low_balance = 500 where country = 'CW';

-- Compatibility with apps released before the country selector (they read the
-- latest version without a country filter): publishing Curaçao also re-publishes
-- the current Colombian rates on top. Remove once every installed app is updated.
create or replace function public.publish_pricing(p_config jsonb, p_note text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare v integer; c text := coalesce(p_config ->> 'country', 'CO');
begin
  if not public.is_admin() then raise exception 'Solo administradores pueden publicar tarifas'; end if;
  if c not in ('CO', 'CW') then raise exception 'País no válido'; end if;
  select coalesce(max(version), 0) + 1 into v from public.pricing_versions;
  insert into public.pricing_versions (version, base_fare, price_per_km, price_per_minute, minimum_fare, commission_pct, categories, note, published_by, country)
  values (v, (p_config ->> 'baseFare')::integer, (p_config ->> 'pricePerKm')::integer, (p_config ->> 'pricePerMinute')::integer,
          (p_config ->> 'minimumFare')::integer, (p_config ->> 'commissionPct')::numeric, p_config -> 'categories', p_note, auth.uid(), c);
  if c <> 'CO' then
    insert into public.pricing_versions (version, base_fare, price_per_km, price_per_minute, minimum_fare, commission_pct, categories, note, published_by, country)
    select v + 1, base_fare, price_per_km, price_per_minute, minimum_fare, commission_pct, categories,
           'Re-publicada: compatibilidad con apps sin selector de país', published_by, 'CO'
    from public.pricing_versions where country = 'CO' order by version desc limit 1;
  end if;
  return v;
end $$;
