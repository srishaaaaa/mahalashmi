-- ============================================================================
-- Migration: 20260911_0019_remove_purple_boutique_catalog.sql
-- Description: Remove the "Purple Boutique" demo catalog inserted by migration
--              0002 (Tailoring / Jewellery & Accessories / Posstore categories
--              and their sample products: Saree Blouse, Bridal Jewellery Rent,
--              Perfume, etc.). None of it applies to Mahalashmi Stores, a
--              grocery store. Real products should be added through the app's
--              product management screen.
-- ============================================================================

DELETE FROM public.products
WHERE category IN ('Tailoring', 'Jewellery & Accessories', 'Posstore');

DELETE FROM public.categories
WHERE name_en IN ('Tailoring', 'Jewellery & Accessories', 'Posstore');
