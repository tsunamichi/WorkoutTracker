import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Configuration ───────────────────────────────────────────────
// To set up:
// 1. Go to https://supabase.com and create a free project
// 2. Copy your project URL and anon key from Settings > API
// 3. Replace the placeholders below
// 4. Run the SQL migration in supabase-migration.sql in your Supabase SQL Editor
// ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://baegtyslskcfsnvwxusc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZWd0eXNsc2tjZnNudnd4dXNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwODgwMDgsImV4cCI6MjA4NjY2NDAwOH0.WB7I9RPgSMCu_Ggu9Dg4aYSTK_-QqiQXAEFMZMGwvDs';

export const isSupabaseConfigured = () =>
  !SUPABASE_URL.includes('YOUR_PROJECT_ID') && !SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: {
      getItem: (key: string) => AsyncStorage.getItem(key),
      setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
      removeItem: (key: string) => AsyncStorage.removeItem(key),
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
