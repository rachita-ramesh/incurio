-- Add details column to facts table
ALTER TABLE facts ADD COLUMN details TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN facts.details IS 'Detailed explanation or additional context for the fact';

-- Update existing facts to have empty details
UPDATE facts SET details = '' WHERE details IS NULL; 