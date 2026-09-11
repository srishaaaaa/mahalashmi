-- Migration: 8-digit Invoice Number Generation
-- Ensures invoice numbers are strictly 8 digits in total (e.g., 10000001, 10000002...)

-- invoice_number_seq already exists by this point (created without a START
-- WITH value by an earlier migration), so "IF NOT EXISTS ... START WITH" is
-- a no-op here and never actually seeds the intended floor. Force it up to
-- at least 10000001 explicitly. GREATEST() means this only ever moves the
-- sequence forward, never backward, so it's safe to re-run against a live
-- database that has already issued invoice numbers above this floor.
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START WITH 10000001;
SELECT setval('public.invoice_number_seq', GREATEST((SELECT last_value FROM public.invoice_number_seq), 10000001), true);

CREATE OR REPLACE FUNCTION public.get_next_invoice_no()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
VOLATILE
AS $$
  SELECT LPAD(nextval('public.invoice_number_seq')::TEXT, 8, '0');
$$;
