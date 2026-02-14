-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/YOUR_PROJECT/sql)
-- This creates the table used for cloud backup/sync

-- User backup data table: stores full AsyncStorage snapshot per user
CREATE TABLE IF NOT EXISTS user_backups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  version TEXT NOT NULL DEFAULT '2.0',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security (RLS) so users can only access their own data
ALTER TABLE user_backups ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own backup
CREATE POLICY "Users can read own backup"
  ON user_backups
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own backup
CREATE POLICY "Users can insert own backup"
  ON user_backups
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own backup
CREATE POLICY "Users can update own backup"
  ON user_backups
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own backup
CREATE POLICY "Users can delete own backup"
  ON user_backups
  FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_user_backups_user_id ON user_backups(user_id);
