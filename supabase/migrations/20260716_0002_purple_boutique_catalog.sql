-- Originally seeded a "Purple Boutique" demo catalog (Tailoring / Jewellery &
-- Accessories / Posstore categories with sample products like Saree Blouse,
-- Bridal Jewellery Rent, Perfume). None of that applies to Mahalashmi Stores
-- (a grocery store), so this migration is intentionally left as a no-op.
-- The demo catalog it originally inserted was removed from the live database
-- by migration 20260911_0019_remove_purple_boutique_catalog.sql.
-- Add Mahalashmi Stores' real categories/products through the app's product
-- management screen instead of seeding them here.
SELECT 1;
