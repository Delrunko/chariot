-- Allow public quote submissions while keeping reads and management admin-only.
-- The schema columns used by the frontend are defined in the initial migration.

grant insert (
  id,
  client_name,
  client_email,
  client_phone,
  message,
  category_id,
  items,
  event_date,
  address,
  estimated_price
) on public.quotes to anon, authenticated;

drop policy if exists "Public can submit quotes" on public.quotes;
create policy "Public can submit quotes"
  on public.quotes for insert to anon, authenticated
  with check (
    length(trim(client_name)) between 1 and 200
    and (event_date is null or event_date >= current_date)
    and (estimated_price is null or estimated_price >= 0)
    and jsonb_typeof(items) = 'array'
  );
