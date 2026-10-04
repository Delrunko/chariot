-- Repair the Supabase permissions used by the admin dashboard.
-- Run the entire script in Supabase Studio > SQL Editor as a project admin.
--
-- This is intentionally additive: public catalog and buyer policies remain
-- intact. Admin order changes still go through admin_update_order, and profile
-- role fields are never made writable through the client.

begin;

-- SECURITY DEFINER prevents the admin role check from recursively evaluating
-- the profiles table's RLS policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.books enable row level security;
alter table public.book_images enable row level security;
alter table public.services enable row level security;
alter table public.service_images enable row level security;
alter table public.orders enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_images enable row level security;
alter table public.payment_config enable row level security;

-- PostgREST needs SQL privileges before RLS policies can be evaluated.
grant select on public.profiles, public.categories, public.subcategories,
  public.books, public.book_images, public.services, public.service_images,
  public.orders, public.quotes, public.quote_images, public.payment_config
  to authenticated;
grant usage on schema public to anon, authenticated;

-- Keep this explicit grant separate: the dashboard embeds quote_images in its
-- quotes request, and PostgREST requires table SELECT permission for embeds.
grant usage on schema public to authenticated;
grant select on table public.quote_images to authenticated;

grant insert, update, delete on public.categories, public.subcategories,
  public.books, public.book_images, public.services, public.service_images,
  public.quotes, public.quote_images, public.payment_config to authenticated;
grant insert (user_id, book_id, service_id, payment_method, amount)
  on public.orders to authenticated;
grant execute on function public.order_amount_matches_catalog(uuid, uuid, numeric)
  to authenticated;

-- Keep one active/paid order per item, but allow a customer to retry after
-- an administrator marks a previous payment attempt as failed.
drop index if exists public.orders_user_book_unique;
create unique index orders_user_book_unique
  on public.orders (user_id, book_id)
  where book_id is not null and status in ('en_attente', 'paye');
drop index if exists public.orders_user_service_unique;
create unique index orders_user_service_unique
  on public.orders (user_id, service_id)
  where service_id is not null and status in ('en_attente', 'paye');

-- Keep profile editing limited to the signed-in user's non-privileged fields.
grant update (first_name, last_name, telephone) on public.profiles to authenticated;

-- Keep only the receiving phone number; no merchant code is used.
alter table public.payment_config
  drop column if exists merchant_code;
alter table public.payment_config
  alter column merchant_number set default '656877046';
update public.payment_config
set merchant_number = '656877046'
where id = (select min(id) from public.payment_config);
insert into public.payment_config (merchant_number)
select '656877046'
where not exists (select 1 from public.payment_config);

-- The book form uploads the cover before the PDF. Both buckets must exist.
-- Keep covers public for images, while PDFs and media remain private.
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

-- Catalog access for admins, without removing the existing public/paid-buyer
-- SELECT policies.
drop policy if exists "Admin Full Read categories" on public.categories;
create policy "Admin Full Read categories"
  on public.categories for select to authenticated
  using ((select public.is_admin()));
drop policy if exists "Admin Full Write categories" on public.categories;
create policy "Admin Full Write categories"
  on public.categories for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admin Full Read subcategories" on public.subcategories;
create policy "Admin Full Read subcategories"
  on public.subcategories for select to authenticated
  using ((select public.is_admin()));
drop policy if exists "Admin Full Write subcategories" on public.subcategories;
create policy "Admin Full Write subcategories"
  on public.subcategories for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admin Full Read books" on public.books;
create policy "Admin Full Read books"
  on public.books for select to authenticated
  using ((select public.is_admin()));
drop policy if exists "Admin Full Write books" on public.books;
create policy "Admin Full Write books"
  on public.books for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admin Full Read book images" on public.book_images;
create policy "Admin Full Read book images"
  on public.book_images for select to authenticated
  using ((select public.is_admin()));
drop policy if exists "Admin Full Write book images" on public.book_images;
create policy "Admin Full Write book images"
  on public.book_images for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admin Full Read services" on public.services;
create policy "Admin Full Read services"
  on public.services for select to authenticated
  using ((select public.is_admin()));
drop policy if exists "Admin Full Write services" on public.services;
create policy "Admin Full Write services"
  on public.services for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admin Full Read service images" on public.service_images;
create policy "Admin Full Read service images"
  on public.service_images for select to authenticated
  using ((select public.is_admin()));
drop policy if exists "Admin Full Write service images" on public.service_images;
create policy "Admin Full Write service images"
  on public.service_images for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Orders can be read by admins but cannot be directly edited by the browser.
-- Status transitions remain validated by the SECURITY DEFINER RPC.
drop policy if exists "Admin Full Read orders" on public.orders;
create policy "Admin Full Read orders"
  on public.orders for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admin Full Read quotes" on public.quotes;
create policy "Admin Full Read quotes"
  on public.quotes for select to authenticated
  using ((select public.is_admin()));
drop policy if exists "Admin Full Write quotes" on public.quotes;
create policy "Admin Full Write quotes"
  on public.quotes for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admin Full Read quote images" on public.quote_images;
create policy "Admin Full Read quote images"
  on public.quote_images for select to authenticated
  using ((select public.is_admin()));
drop policy if exists "Admin Full Write quote images" on public.quote_images;
create policy "Admin Full Write quote images"
  on public.quote_images for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Self Profile Access" on public.profiles;
create policy "Self Profile Access"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));
drop policy if exists "Admin Full Read profiles" on public.profiles;
create policy "Admin Full Read profiles"
  on public.profiles for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admin Full Read payment config" on public.payment_config;
create policy "Admin Full Read payment config"
  on public.payment_config for select to authenticated
  using ((select public.is_admin()));
drop policy if exists "Admin Full Write payment config" on public.payment_config;
create policy "Admin Full Write payment config"
  on public.payment_config for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Ensure the existing admin-only order status RPC is present and safe.
create or replace function public.admin_update_order(
  requested_order_id uuid,
  requested_status text,
  requested_reference text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if requested_status not in ('paye', 'echoue') then
    raise exception 'Unsupported order status' using errcode = '22023';
  end if;

  update public.orders
  set status = requested_status,
      paid_at = case when requested_status = 'paye' then now() else null end,
      transaction_reference = coalesce(requested_reference, transaction_reference)
  where id = requested_order_id
    and status = 'en_attente';

  return found;
end;
$$;

revoke all on function public.admin_update_order(uuid, text, text) from public, anon;
grant execute on function public.admin_update_order(uuid, text, text) to authenticated;

-- Dashboard uploads and signed downloads use these buckets. Preserve public
-- cover reads and paid-buyer media/PDF policies; add admin access explicitly.
drop policy if exists "Admins manage covers" on storage.objects;
create policy "Admins manage covers"
  on storage.objects for all to authenticated
  using (bucket_id = 'covers' and (select public.is_admin()))
  with check (bucket_id = 'covers' and (select public.is_admin()));

drop policy if exists "Admins manage media" on storage.objects;
create policy "Admins manage media"
  on storage.objects for all to authenticated
  using (bucket_id = 'media' and (select public.is_admin()))
  with check (bucket_id = 'media' and (select public.is_admin()));

drop policy if exists "Admins manage PDF objects" on storage.objects;
create policy "Admins manage PDF objects"
  on storage.objects for all to authenticated
  using (bucket_id = 'pdfs' and (select public.is_admin()))
  with check (bucket_id = 'pdfs' and (select public.is_admin()));

commit;

-- Verify the privileges and policies used by the dashboard.
select table_name, privilege_type
from information_schema.table_privileges
where table_schema = 'public'
  and grantee = 'authenticated'
  and table_name in (
    'profiles', 'categories', 'subcategories', 'books', 'book_images',
    'services', 'service_images', 'orders', 'quotes', 'quote_images',
    'payment_config'
  )
order by table_name, privilege_type;

select
  has_schema_privilege('authenticated', 'public', 'USAGE') as authenticated_can_use_public_schema,
  has_table_privilege('authenticated', 'public.quotes', 'SELECT') as authenticated_can_read_quotes,
  has_table_privilege('authenticated', 'public.quote_images', 'SELECT') as authenticated_can_read_quote_images;

select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles', 'categories', 'subcategories', 'books', 'book_images',
    'services', 'service_images', 'orders', 'quotes', 'quote_images',
    'payment_config'
  )
order by tablename, policyname;

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('covers', 'pdfs', 'media')
order by id;
