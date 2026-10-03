-- Profile photos: public "avatars" bucket, each user writes only inside their own folder.
alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "avatars own insert" on storage.objects;
drop policy if exists "avatars own update" on storage.objects;
drop policy if exists "avatars own delete" on storage.objects;
create policy "avatars own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Saves the photo URL on the caller's profile; only URLs from their own avatars folder.
create or replace function public.set_my_avatar(p_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if p_url is not null and p_url !~ ('/storage/v1/object/public/avatars/' || auth.uid()::text || '/') then
    raise exception 'Foto no válida';
  end if;
  update public.profiles set avatar_url = p_url where id = auth.uid();
end $$;
revoke execute on function public.set_my_avatar(text) from public, anon;
grant execute on function public.set_my_avatar(text) to authenticated;
