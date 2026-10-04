-- Permit anonymous visitors to submit testimonials for admin moderation.
-- Only the live schema columns are granted; callers cannot approve submissions.
alter table public.testimonials enable row level security;

grant usage on schema public to anon, authenticated;
grant insert (name, message, rating, approved)
  on public.testimonials to anon, authenticated;

drop policy if exists "Public can submit testimonials" on public.testimonials;
create policy "Public can submit testimonials"
  on public.testimonials for insert to anon, authenticated
  with check (
    length(trim(name)) between 2 and 60
    and length(trim(message)) between 10 and 800
    and rating between 1 and 5
    and approved = false
  );
