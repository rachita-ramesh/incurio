-- Rename the users table to user_preferences
ALTER TABLE public.users RENAME TO user_preferences;

-- Update all RLS policies to refer to the new table name
ALTER POLICY "Users can view their own profile" ON public.user_preferences RENAME TO "Users can view their own preferences";
ALTER POLICY "Users can update their own profile" ON public.user_preferences RENAME TO "Users can update their own preferences";

-- Add comment to explain the table
COMMENT ON TABLE public.user_preferences IS 'Users preferences for spark topics'; 