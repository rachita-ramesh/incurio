-- Add last_login column to users table
ALTER TABLE users ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;

-- Update existing users to have last_login set to created_at
UPDATE users SET last_login = created_at WHERE last_login IS NULL;

-- Add comment to explain the column
COMMENT ON COLUMN users.last_login IS 'Timestamp of the user''s last login'; 