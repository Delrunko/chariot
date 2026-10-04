-- Migration immédiate : table testimonials + RLS + moderation admin
BEGIN;

CREATE TABLE IF NOT EXISTS public.testimonials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    rating INT CHECK (rating >= 1 AND rating <= 5) DEFAULT 5,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_approved BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read approved testimonials" ON public.testimonials;
CREATE POLICY "Public read approved testimonials"
ON public.testimonials FOR SELECT TO anon, authenticated
USING (is_approved = TRUE);

DROP POLICY IF EXISTS "Authenticated users can submit testimonial" ON public.testimonials;
CREATE POLICY "Authenticated users can submit testimonial"
ON public.testimonials FOR INSERT TO authenticated
WITH CHECK (
    author_name IS NOT NULL
    AND author_name <> ''
    AND content IS NOT NULL
    AND content <> ''
    AND rating BETWEEN 1 AND 5
    AND user_id = auth.uid()
);

DROP POLICY IF EXISTS "Admin manage all testimonials" ON public.testimonials;
CREATE POLICY "Admin manage all testimonials"
ON public.testimonials FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'admin'
    )
);

COMMIT;
