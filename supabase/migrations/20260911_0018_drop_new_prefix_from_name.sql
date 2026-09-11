-- ============================================================================
-- Migration: 20260911_0018_drop_new_prefix_from_name.sql
-- Description: Store name changed from "New Mahalashmi Stores" to
--              "Mahalashmi Stores" (the "New" prefix was dropped).
-- ============================================================================

UPDATE public.store_settings
SET name = 'Mahalashmi Stores',
    updated_at = NOW()
WHERE id = 1;
