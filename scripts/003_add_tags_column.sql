-- Add tags column to payments table for custom labeling
ALTER TABLE payments ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Create index for better query performance on tags
CREATE INDEX IF NOT EXISTS idx_payments_tags ON payments USING GIN(tags);

-- Add a comment for documentation
COMMENT ON COLUMN payments.tags IS 'Array of custom tags for categorizing payments';
