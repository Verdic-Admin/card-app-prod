-- Migration 19: Add Inventory Lots (Self-Referencing Pattern)
-- A "Lot" is a standard inventory row with is_lot = true.
-- Individual cards point back to their parent lot via lot_id.

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS is_lot boolean NOT NULL DEFAULT false;

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS lot_id uuid REFERENCES public.inventory(id) ON DELETE SET NULL;
