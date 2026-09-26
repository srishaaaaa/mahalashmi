-- ============================================================================
-- Migration: 20260926_0041_fix_duplicate_get_next_invoice_no.sql
-- Description: Fix duplicate function definition causing "is not unique" error
--              Drop all versions and recreate the correct one
-- ============================================================================

-- Drop the ambiguous function (CASCADE will handle dependencies)
DROP FUNCTION IF EXISTS public.get_next_invoice_no() CASCADE;

-- Recreate the correct, latest version
CREATE OR REPLACE FUNCTION public.get_next_invoice_no()
RETURNS VARCHAR AS $$
DECLARE
  v_next_number INT;
  v_invoice_no VARCHAR;
BEGIN
  -- Get the next invoice number from the sequence
  v_next_number := nextval('public.invoice_number_seq');

  -- Format as 8-digit zero-padded number
  v_invoice_no := LPAD(v_next_number::TEXT, 8, '0');

  RETURN v_invoice_no;
END;
$$ LANGUAGE plpgsql;
