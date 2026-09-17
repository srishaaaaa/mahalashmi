-- ====================================================================
-- Migration 0018: Barcode Custom Label Sizes Persistence Table
-- ====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.barcode_custom_sizes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  labels_per_row INTEGER NOT NULL DEFAULT 1 CHECK (labels_per_row >= 1),
  width_mm NUMERIC(8, 2) NOT NULL CHECK (width_mm > 0),
  height_mm NUMERIC(8, 2) NOT NULL CHECK (height_mm > 0),
  horizontal_gap_mm NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (horizontal_gap_mm >= 0),
  is_custom BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.barcode_custom_sizes ENABLE ROW LEVEL SECURITY;

-- Allow read/write access for POS operations
DROP POLICY IF EXISTS barcode_custom_sizes_all ON public.barcode_custom_sizes;
CREATE POLICY barcode_custom_sizes_all ON public.barcode_custom_sizes 
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- Fast lookup index
CREATE INDEX IF NOT EXISTS idx_barcode_custom_sizes_created_at 
  ON public.barcode_custom_sizes(created_at ASC);

COMMIT;
