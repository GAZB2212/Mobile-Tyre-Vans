-- Add contacted_note column to ai_conversations table
-- Allows staff to record a freetext call note when marking a lead as contacted
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS contacted_note text;
