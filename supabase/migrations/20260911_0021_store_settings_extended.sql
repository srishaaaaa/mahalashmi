-- ============================================================================
-- Migration: 20260911_0021_store_settings_extended.sql
-- Description: Extend store_settings with fields needed for the new Store
--              Settings screen: Instagram handle, low-stock threshold, a
--              dynamic logo URL (overrides the static bundled logo across
--              the app and generated invoices/receipts), and DB-stored
--              admin/staff credentials (so "Change Password" can actually
--              persist — the previous login only checked fixed .env values).
--              Also creates a public 'branding' storage bucket for the logo
--              upload, mirroring the existing 'invoices' bucket pattern.
-- ============================================================================

ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS instagram_handle TEXT NOT NULL DEFAULT '';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS low_stock_threshold NUMERIC(12,3) NOT NULL DEFAULT 5;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS admin_id TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS admin_password TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS staff_id TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS staff_password TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('branding', 'branding', TRUE, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE SET public = TRUE, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

DROP POLICY IF EXISTS branding_public_read ON storage.objects;
CREATE POLICY branding_public_read ON storage.objects FOR SELECT TO public USING (bucket_id = 'branding');

DROP POLICY IF EXISTS branding_portal_upload ON storage.objects;
CREATE POLICY branding_portal_upload ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'branding');

DROP POLICY IF EXISTS branding_portal_update ON storage.objects;
CREATE POLICY branding_portal_update ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'branding') WITH CHECK (bucket_id = 'branding');

NOTIFY pgrst, 'reload schema';
