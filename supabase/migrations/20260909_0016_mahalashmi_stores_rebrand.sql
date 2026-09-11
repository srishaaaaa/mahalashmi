-- ============================================================================
-- Migration: 20260909_0016_mahalashmi_stores_rebrand.sql
-- Description: Update store_settings default row from legacy brand data to
--              New Mahalashmi Stores details.
--              Guarded to only fire once, transitioning from the exact CLAD
--              values set by migration 0012: re-running the combined schema
--              after the owner has customized their store settings (or after
--              this step already ran) must not touch the row again.
-- ============================================================================

UPDATE public.store_settings
SET name = 'New Mahalashmi Stores',
    owner_name = 'M. Senthamil',
    phone = '+91 98659 75714',
    email = 'senthamil75714@gmail.com',
    address = '5/85, Teacher''s Colony, Masinaickanpatty, Ayyothiyapattanam, Salem - 636103',
    updated_at = NOW()
WHERE id = 1 AND name = 'CLAD' AND owner_name = 'Rubi krishna';
