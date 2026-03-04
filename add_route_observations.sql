-- Add observations and notes to the routes table
ALTER TABLE routes 
ADD COLUMN IF NOT EXISTS observations TEXT;
