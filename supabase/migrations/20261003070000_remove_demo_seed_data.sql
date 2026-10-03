-- Remove the example zones and promos seeded with the initial schema: the
-- admin console now shows only real, admin-created data.
delete from public.promos where code in ('NUVAFRESH', 'ELECTRICO');
delete from public.zones where name in ('Chapinero · Zona G', 'Usaquén · Santa Bárbara', 'Salitre · Aeropuerto', 'Teusaquillo · Galerías', 'Suba · Niza', 'Centro · La Candelaria');
