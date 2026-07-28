-- Add timestamped notes history columns
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS admin_notes_history jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_notes_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Migrate existing admin_notes to admin_notes_history
UPDATE quotes 
SET admin_notes_history = jsonb_build_array(
  jsonb_build_object(
    'text', admin_notes,
    'timestamp', COALESCE(created_at, NOW())::text,
    'author', 'System Migration'
  )
)
WHERE admin_notes IS NOT NULL AND admin_notes != '';

-- Migrate existing customer_notes to customer_notes_history
UPDATE quotes 
SET customer_notes_history = jsonb_build_array(
  jsonb_build_object(
    'text', customer_notes,
    'timestamp', COALESCE(created_at, NOW())::text,
    'author', 'System Migration'
  )
)
WHERE customer_notes IS NOT NULL AND customer_notes != '';

-- Keep the old columns for backward compatibility during transition
-- We can drop them later if needed: ALTER TABLE quotes DROP COLUMN admin_notes;
-- We can drop them later if needed: ALTER TABLE quotes DROP COLUMN customer_notes;
