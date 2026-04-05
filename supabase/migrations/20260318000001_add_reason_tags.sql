-- Add reason_tags column to trip_items for AI recommendation explanations
ALTER TABLE trip_items ADD COLUMN reason_tags text[] NOT NULL DEFAULT '{}';
