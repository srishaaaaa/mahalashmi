-- ============================================================================
-- Migration: 20260911_0017_orders_invoice_pdf_url.sql
-- Description: Add the missing invoice_pdf_url column on public.orders.
--              Migration 0009 created the 'invoices' storage bucket for
--              generated PDFs, but never added the column the app uses
--              (Dashboard.tsx, Pos.tsx) to persist/read each order's PDF URL.
-- ============================================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_pdf_url TEXT;
