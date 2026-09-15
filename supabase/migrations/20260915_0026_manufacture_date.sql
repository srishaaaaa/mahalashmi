-- ============================================================================
-- Migration: 20260915_0026_manufacture_date.sql
-- Description: Adds per-product manufacture date, displayed alongside the
--              expiry date on the Expiry Alerts screen and in the product
--              editor (mirrors the expiry_date column added in 0025).
-- ============================================================================

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS mfg_date DATE;

NOTIFY pgrst, 'reload schema';
