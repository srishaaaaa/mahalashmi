-- ============================================================================
-- Migration: 20260911_0018_drop_new_prefix_from_name.sql
-- Description: Store name changed from "New Mahalashmi Stores" to
--              "Mahalashmi Stores" (the "New" prefix was dropped).
--              Guarded to only fire once, transitioning from the exact name
--              set by migration 0016: re-running the combined schema after
--              the owner has since renamed their store via Settings (or
--              after this step already ran) must not touch the row again.
-- ============================================================================

UPDATE public.store_settings
SET name = 'Mahalashmi Stores',
    updated_at = NOW()
WHERE id = 1 AND name = 'New Mahalashmi Stores';
