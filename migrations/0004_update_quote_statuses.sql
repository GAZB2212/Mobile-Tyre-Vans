-- Migration: Update quote statuses
-- Changes: pending, under_review, awaiting_confirmation, confirmed, in_progress, completed, cancelled
-- To: pending, deposit_taken, in_build, completed, cancelled

-- First, update existing quotes to use new status values
UPDATE quotes SET status = 'deposit_taken' WHERE status IN ('under_review', 'awaiting_confirmation', 'confirmed');
UPDATE quotes SET status = 'in_build' WHERE status = 'in_progress';

-- Note: 'pending', 'completed', and 'cancelled' remain unchanged
