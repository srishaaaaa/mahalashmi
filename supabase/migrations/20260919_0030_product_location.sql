-- ============================================================================
-- Migration: 20260919_0030_product_location.sql
-- Description: Adds a free-text rack/row storage location per product, so
--              staff can note where an item physically sits in the store
--              (mirrors the mfg_date/expiry_date single-column pattern).
-- ============================================================================

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS location TEXT;

NOTIFY pgrst, 'reload schema';
