-- Watchlist items table for cross-device sync
-- Run this in Supabase SQL Editor if the table doesn't exist

CREATE TABLE IF NOT EXISTS watchlist_items (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own watchlist" ON watchlist_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watchlist" ON watchlist_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own watchlist" ON watchlist_items
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can update own watchlist" ON watchlist_items
  FOR UPDATE USING (auth.uid() = user_id);
