-- ============================================================================
-- Migration: 20260923_0034_customer_event_acknowledgement.sql
-- Description: Lets a birthday/anniversary notification be dismissed
--              permanently for the day it fires (ticking it, or sending the
--              WhatsApp wish, both count as acknowledged) instead of
--              re-appearing on every login for the same occasion.
-- ============================================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS birthday_wish_sent_on DATE,
  ADD COLUMN IF NOT EXISTS anniversary_wish_sent_on DATE;

NOTIFY pgrst, 'reload schema';
