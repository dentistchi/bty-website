-- Phase 3: Avatars bucket for user-uploaded profile images.
-- Public read; authenticated users can upload/update/delete only under their own folder (user_id).

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

-- Authenticated: upload only to folder named after own user_id
create policy "Arena avatars: authenticated insert own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- Authenticated: update/delete only own folder
create policy "Arena avatars: authenticated update own folder"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Arena avatars: authenticated delete own folder"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- Public read for avatar URLs (bucket is public; explicit policy for clarity)
create policy "Arena avatars: public read"
on storage.objects for select to public
using (bucket_id = 'avatars');
