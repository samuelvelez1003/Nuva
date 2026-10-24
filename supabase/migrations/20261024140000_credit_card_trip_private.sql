-- Trigger function only: never callable through the API.
revoke execute on function public.credit_card_trip() from public, anon, authenticated;
