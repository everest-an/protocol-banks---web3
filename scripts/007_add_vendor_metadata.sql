-- Add category and tier columns to vendors table for better tagging
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tier TEXT; -- e.g., 'subsidiary', 'partner', 'vendor'

-- Update existing records to have default values if needed
UPDATE vendors SET category = 'Uncategorized' WHERE category IS NULL;
UPDATE vendors SET tier = 'vendor' WHERE tier IS NULL;
