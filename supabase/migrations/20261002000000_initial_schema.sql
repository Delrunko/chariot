-- Chariot schema for Supabase.
-- PDF objects must be stored as books/<book UUID>/<filename> in the private pdfs bucket.
-- Only a trusted payment webhook/Edge Function may change an order to 'paye'.
-- Profiles are created by the auth trigger; never accept role='admin' from signup metadata.
-- Quote submissions and access-log mutations should be handled by a trusted Edge Function.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  first_name text not null default '',
  last_name text not null default '',
  telephone text,
  role text not null default 'client' check (role in ('admin', 'client')),
  created_at timestamptz not null default now()
);

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
begin
  requested_username := nullif(new.raw_user_meta_data ->> 'username', '');

  insert into public.profiles (id, username, first_name, last_name, telephone)
  values (
    new.id,
    requested_username,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'telephone', '')
  )
  on conflict do nothing;

  if not exists (select 1 from public.profiles where id = new.id) then
    insert into public.profiles (id, first_name, last_name, telephone)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'first_name', ''),
      coalesce(new.raw_user_meta_data ->> 'last_name', ''),
      nullif(new.raw_user_meta_data ->> 'telephone', '')
    );
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();
revoke all on function public.create_profile_for_auth_user() from public, anon, authenticated;

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
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text not null default '',
  category_type text not null default 'livre'
    check (category_type in ('livre', 'service')),
  sort_order integer not null default 0 check (sort_order >= 0),
  active boolean not null default true
);

create table public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  name text not null,
  slug text not null default '',
  sort_order integer not null default 0 check (sort_order >= 0),
  active boolean not null default true,
  unique (category_id, name)
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text not null default '',
  subcategory_id uuid not null references public.subcategories (id) on delete restrict,
  price numeric(10, 0) not null check (price >= 0),
  cover_path text not null,
  pdf_path text,
  available boolean not null default true,
  featured boolean not null default false,
  added_at timestamptz not null default now()
);

create table public.book_images (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  image_path text not null,
  sort_order integer not null default 0 check (sort_order >= 0)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text not null default '',
  subcategory_id uuid not null references public.subcategories (id) on delete restrict,
  price numeric(10, 0) not null check (price >= 0),
  cover_path text not null,
  document_path text,
  video_path text,
  video_url text not null default '',
  available boolean not null default true,
  added_at timestamptz not null default now(),
  whatsapp_phone text not null default ''
);

create index books_pdf_path_idx on public.books (pdf_path) where pdf_path is not null;
create index services_document_path_idx on public.services (document_path) where document_path is not null;

create table public.service_images (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  image_path text not null,
  sort_order integer not null default 0 check (sort_order >= 0)
);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  message text not null,
  rating smallint check (rating between 1 and 5),
  approved boolean not null default true,
  created_at timestamptz not null default now()
);

-- One table preserves both Django Achat and ServiceAchat while enforcing one item per order.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  book_id uuid references public.books (id) on delete restrict,
  service_id uuid references public.services (id) on delete restrict,
  payment_method text not null default 'orange_money'
    check (payment_method in ('orange_money', 'mtn_momo')),
  status text not null default 'en_attente'
    check (status in ('en_attente', 'paye', 'echoue')),
  transaction_reference text not null default '',
  amount numeric(10, 0) check (amount is null or amount >= 0),
  purchased_at timestamptz not null default now(),
  paid_at timestamptz,
  check ((book_id is not null)::integer + (service_id is not null)::integer = 1),
  check (book_id is null or amount is not null)
);

create unique index orders_user_book_unique
  on public.orders (user_id, book_id) where book_id is not null;
create unique index orders_user_service_unique
  on public.orders (user_id, service_id) where service_id is not null;
create index orders_user_status_idx on public.orders (user_id, status);

create table public.access_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  device_fingerprint varchar(255) not null,
  created_at timestamptz not null default now(),
  last_revalidated_at timestamptz not null default now(),
  active boolean not null default true,
  unique (user_id, book_id, device_fingerprint)
);

create table public.payment_config (
  id bigint generated by default as identity primary key,
  merchant_number varchar(20) not null default '656877046'
);

insert into public.payment_config (merchant_number)
values ('656877046');

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  client_name varchar(200) not null,
  client_email text not null default '',
  client_phone varchar(50) not null default '',
  message text not null default '',
  category_id uuid references public.categories (id) on delete set null,
  items jsonb not null default '[]'::jsonb,
  event_date date,
  address varchar(300) not null default '',
  estimated_price numeric(12, 0) check (estimated_price is null or estimated_price >= 0),
  created_at timestamptz not null default now(),
  pdf_path text
);

create table public.quote_images (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  image_path text not null
);

create table public.visit_counter (
  singleton boolean primary key default true check (singleton),
  count bigint not null default 0 check (count >= 0)
);

insert into public.visit_counter (singleton, count) values (true, 0);

create or replace function public.order_amount_matches_catalog(
  requested_book_id uuid,
  requested_service_id uuid,
  requested_amount numeric
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when requested_book_id is not null then exists (
      select 1 from public.books
      where id = requested_book_id
        and available
        and price = requested_amount
    )
    when requested_service_id is not null then exists (
      select 1 from public.services
      where id = requested_service_id
        and available
        and (requested_amount is null or price = requested_amount)
    )
    else false
  end;
$$;
revoke all on function public.order_amount_matches_catalog(uuid, uuid, numeric) from public, anon;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.books enable row level security;
alter table public.book_images enable row level security;
alter table public.services enable row level security;
alter table public.service_images enable row level security;
alter table public.testimonials enable row level security;
alter table public.orders enable row level security;
alter table public.access_logs enable row level security;
alter table public.payment_config enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_images enable row level security;
alter table public.visit_counter enable row level security;

create policy "Profiles are readable by their owner or admins"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "Admins manage profiles"
  on public.profiles for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Active categories are public"
  on public.categories for select to anon, authenticated using (active);
create policy "Admins manage categories"
  on public.categories for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Active subcategories are public"
  on public.subcategories for select to anon, authenticated
  using (
    active and exists (
      select 1 from public.categories c
      where c.id = category_id and c.active
    )
  );
create policy "Admins manage subcategories"
  on public.subcategories for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Available books are public"
  on public.books for select to anon, authenticated using (available);
create policy "Buyers can read purchased books"
  on public.books for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.book_id = id
      and o.user_id = (select auth.uid())
      and o.status = 'paye'
  ));
create policy "Admins manage books"
  on public.books for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Images of available books are public"
  on public.book_images for select to anon, authenticated
  using (exists (select 1 from public.books b where b.id = book_id and b.available));
create policy "Admins manage book images"
  on public.book_images for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Available services are public"
  on public.services for select to anon, authenticated using (available);
create policy "Buyers can read purchased services"
  on public.services for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.service_id = id
      and o.user_id = (select auth.uid())
      and o.status = 'paye'
  ));
create policy "Admins manage services"
  on public.services for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Images of available services are public"
  on public.service_images for select to anon, authenticated
  using (exists (select 1 from public.services s where s.id = service_id and s.available));
create policy "Admins manage service images"
  on public.service_images for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Approved testimonials are public"
  on public.testimonials for select to anon, authenticated using (approved);
create policy "Admins manage testimonials"
  on public.testimonials for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Users read their orders"
  on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Users can create pending orders at catalog prices"
  on public.orders for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'en_attente'
    and paid_at is null
    and transaction_reference = ''
    and public.order_amount_matches_catalog(book_id, service_id, amount)
  );

create policy "Users read their own access logs"
  on public.access_logs for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Payment configuration is public"
  on public.payment_config for select to anon, authenticated using (true);
create policy "Admins manage payment configuration"
  on public.payment_config for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins manage quotes"
  on public.quotes for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "Admins manage quote images"
  on public.quote_images for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Visit count is public"
  on public.visit_counter for select to anon, authenticated using (true);
create policy "Admins manage visit count"
  on public.visit_counter for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on public.profiles, public.categories, public.subcategories, public.books,
  public.book_images, public.services, public.service_images, public.testimonials,
  public.orders, public.access_logs, public.payment_config, public.quotes,
  public.quote_images, public.visit_counter from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (first_name, last_name, telephone) on public.profiles to authenticated;

grant select on public.categories, public.subcategories, public.books, public.book_images,
  public.services, public.service_images, public.testimonials, public.payment_config,
  public.visit_counter to anon, authenticated;
grant insert, update, delete on public.categories, public.subcategories, public.books,
  public.book_images, public.services, public.service_images, public.testimonials,
  public.payment_config, public.visit_counter to authenticated;

grant select on public.orders to authenticated;
grant insert (user_id, book_id, service_id, payment_method, amount) on public.orders to authenticated;
grant select on public.access_logs to authenticated;
grant execute on function public.order_amount_matches_catalog(uuid, uuid, numeric) to authenticated;
grant usage, select on all sequences in schema public to authenticated;

insert into storage.buckets (id, name, public)
values ('pdfs', 'pdfs', false)
on conflict (id) do update set public = false;

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

create policy "Admins manage PDF objects"
  on storage.objects for all to authenticated
  using (bucket_id = 'pdfs' and (select public.is_admin()))
  with check (bucket_id = 'pdfs' and (select public.is_admin()));
