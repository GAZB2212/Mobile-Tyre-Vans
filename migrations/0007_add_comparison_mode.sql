-- Add comparison mode fields to quotes table
-- These columns allow storing two van configurations per quote (Option A / Option B)
-- and tracking which option the customer ultimately chose.
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS comparison_config json;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS chosen_option text;

-- Enforce domain constraint: chosen_option must be NULL, 'A', or 'B'
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'quotes_chosen_option_check'
  ) THEN
    ALTER TABLE quotes ADD CONSTRAINT quotes_chosen_option_check
      CHECK (chosen_option IS NULL OR chosen_option IN ('A', 'B'));
  END IF;
END $$;
