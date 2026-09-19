-- Card images contain personal study material. They must not be publicly readable.
update storage.buckets set public = false where id = 'card-images';
drop policy if exists card_images_select on storage.objects;
create policy card_images_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
