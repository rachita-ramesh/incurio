-- Add last_login column to user_preferences table
ALTER TABLE user_preferences ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;

-- Update existing users to have last_login set to created_at
UPDATE user_preferences SET last_login = created_at WHERE last_login IS NULL;

-- Add comment to explain the column
COMMENT ON COLUMN user_preferences.last_login IS 'Timestamp of the user''s last login'; 