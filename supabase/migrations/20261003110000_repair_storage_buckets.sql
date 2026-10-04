-- Ensure the storage buckets required by the admin catalog and private
-- purchases exist, including projects where earlier bucket migrations were
-- not applied. PDFs and service media must remain private.

insert into storage.buckets (id, name, public)
values
  ('covers', 'covers', true),
  ('pdfs', 'pdfs', false),
  ('media', 'media', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Public can read covers" on storage.objects;
create policy "Public can read covers"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'covers');

drop policy if exists "Admins manage covers" on storage.objects;
create policy "Admins manage covers"
  on storage.objects for all to authenticated
  using (bucket_id = 'covers' and (select public.is_admin()))
  with check (bucket_id = 'covers' and (select public.is_admin()));

drop policy if exists "Paid book buyers can read their PDFs" on storage.objects;
create policy "Paid book buyers can read their PDFs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'pdfs'
    and exists (
      select 1
      from public.books b
      join public.orders o on o.book_id = b.id
      where b.pdf_path = name
        and o.user_id = (select auth.uid())
        and o.status = 'paye'
    )
  );

drop policy if exists "Paid service buyers can read service PDFs" on storage.objects;
create policy "Paid service buyers can read service PDFs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'pdfs'
    and exists (
      select 1
      from public.services s
      join public.orders o on o.service_id = s.id
      where s.document_path = name
        and o.user_id = (select auth.uid())
        and o.status = 'paye'
    )
  );

drop policy if exists "Admins manage PDF objects" on storage.objects;
create policy "Admins manage PDF objects"
  on storage.objects for all to authenticated
  using (bucket_id = 'pdfs' and (select public.is_admin()))
  with check (bucket_id = 'pdfs' and (select public.is_admin()));

drop policy if exists "Paid service buyers can read service videos" on storage.objects;
create policy "Paid service buyers can read service videos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'media'
    and exists (
      select 1
      from public.services s
      join public.orders o on o.service_id = s.id
      where s.video_path = name
        and o.user_id = (select auth.uid())
        and o.status = 'paye'
    )
  );

drop policy if exists "Admins manage media" on storage.objects;
create policy "Admins manage media"
  on storage.objects for all to authenticated
  using (bucket_id = 'media' and (select public.is_admin()))
  with check (bucket_id = 'media' and (select public.is_admin()));
