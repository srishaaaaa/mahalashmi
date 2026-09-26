-- ============================================================================
-- Migration: 20260926_0040_update_store_name_to_mahalashmi.sql
-- Description: Update store name from "YG ENTERPRISES" or similar legacy names
--              to "Mahalashmi Stores" for consistent branding
-- ============================================================================

UPDATE public.store_settings
SET name = 'Mahalashmi Stores',
    updated_at = NOW()
WHERE id = 1 AND (
  name = 'YG ENTERPRISES' OR
  name = 'New Mahalashmi Stores' OR
  name = 'CLAD' OR
  name IS NULL
);
