-- ============================================================================
-- Migration: 20260915_0025_expiry_alerts.sql
-- Description: Adds per-product expiry date tracking and a store-wide,
--              customizable "expiring soon" alert window (in days), mirroring
--              the existing low_stock_alert / low_stock_threshold pattern.
-- ============================================================================

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS expiry_alert_days INTEGER NOT NULL DEFAULT 30;

NOTIFY pgrst, 'reload schema';
