alter table public.quotes
  add column if not exists photos_paths text[] not null default '{}'::text[];

grant insert (photos_paths) on public.quotes to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('quote-images', 'quote-images', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Public can upload quote images" on storage.objects;
create policy "Public can upload quote images"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'quote-images');
