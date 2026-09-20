-- ============================================================================
-- Migration: 20260921_0033_store_appearance_and_profile.sql
-- Description: Adds a site-wide accent colour, business type, and a separate
--              shop contact number to store_settings for the redesigned
--              Store Settings page (Shop Profile / Contact Details / Shop
--              Information / Appearance / Product Catalogue).
-- ============================================================================

ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS accent_color TEXT NOT NULL DEFAULT '#2E7D32';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS business_type TEXT NOT NULL DEFAULT '';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS shop_contact_number TEXT NOT NULL DEFAULT '';

NOTIFY pgrst, 'reload schema';
