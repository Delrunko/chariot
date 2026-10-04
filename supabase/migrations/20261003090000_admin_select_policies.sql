-- Restore administrator read access for the dashboard without changing
-- public or owner-scoped access policies.

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

alter table public.books enable row level security;
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.services enable row level security;
alter table public.orders enable row level security;
alter table public.profiles enable row level security;
alter table public.service_images enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_images enable row level security;

grant select on public.books, public.categories, public.subcategories,
  public.services, public.orders, public.profiles, public.service_images,
  public.quotes, public.quote_images to authenticated;

drop policy if exists "Admin can read all books" on public.books;
create policy "Admin can read all books"
  on public.books for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admin can read all categories" on public.categories;
create policy "Admin can read all categories"
  on public.categories for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admin can read all subcategories" on public.subcategories;
create policy "Admin can read all subcategories"
  on public.subcategories for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admin can read all services" on public.services;
create policy "Admin can read all services"
  on public.services for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admin can read all orders" on public.orders;
create policy "Admin can read all orders"
  on public.orders for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admin can read all profiles" on public.profiles;
create policy "Admin can read all profiles"
  on public.profiles for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admin can read all service images" on public.service_images;
create policy "Admin can read all service images"
  on public.service_images for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admin can read all quotes" on public.quotes;
create policy "Admin can read all quotes"
  on public.quotes for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admin can read all quote images" on public.quote_images;
create policy "Admin can read all quote images"
  on public.quote_images for select to authenticated
  using ((select public.is_admin()));

select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and policyname in (
    'Admin can read all books',
    'Admin can read all categories',
    'Admin can read all subcategories',
    'Admin can read all services',
    'Admin can read all orders',
    'Admin can read all profiles',
    'Admin can read all service images',
    'Admin can read all quotes',
    'Admin can read all quote images'
  )
order by tablename;
