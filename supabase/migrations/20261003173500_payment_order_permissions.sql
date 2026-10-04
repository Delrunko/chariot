-- Let authenticated customers submit a pending order through the Supabase
-- client while preserving RLS validation of owner, status, and catalog price.
grant usage on schema public to anon, authenticated;
grant select on public.books, public.services, public.orders to authenticated;
grant insert (user_id, book_id, service_id, payment_method, amount)
  on public.orders to authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.order_amount_matches_catalog(uuid, uuid, numeric)
  to authenticated;

-- Failed attempts can be retried. Keep at most one pending or paid order per
-- user/product, while retaining failed attempts for audit history.
drop index if exists public.orders_user_book_unique;
create unique index orders_user_book_unique
  on public.orders (user_id, book_id)
  where book_id is not null and status in ('en_attente', 'paye');

drop index if exists public.orders_user_service_unique;
create unique index orders_user_service_unique
  on public.orders (user_id, service_id)
  where service_id is not null and status in ('en_attente', 'paye');
