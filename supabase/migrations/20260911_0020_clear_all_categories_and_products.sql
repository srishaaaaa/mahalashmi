-- ============================================================================
-- Migration: 20260911_0020_clear_all_categories_and_products.sql
-- Description: Full clean slate — remove every remaining category and
--              product (including the system "Unregistered" category left
--              by migration 0019). The app recreates "Unregistered"
--              automatically the first time ad-hoc POS billing is used, so
--              this is safe. Add Mahalashmi Stores' real catalog through the
--              app's product management screen.
-- ============================================================================

DELETE FROM public.products;
DELETE FROM public.categories;
