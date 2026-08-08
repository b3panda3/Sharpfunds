-- RLS policies for user_profiles table
-- Run this in Supabase SQL Editor
-- Fixes: onboarding unable to save because UPDATE was blocked by RLS

-- Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Allow users to insert their own profile (first-time creation)
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile (onboarding completion, settings)
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow users to delete their own profile (account cleanup)
CREATE POLICY "Users can delete own profile" ON user_profiles
  FOR DELETE USING (auth.uid() = id);