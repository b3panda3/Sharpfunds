import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(
  supabaseUrl ?? "https://fflycxbmbibuldwijkvs.supabase.co",
  supabaseAnonKey ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmbHljeGJtYmlidWxkd2lqa3ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTA3MTUsImV4cCI6MjEwMTU4NjcxNX0.tPF_kby-cgNFqGDIMgEpTYt7ptpxZsLhO2yqZ8kB-4s"
);

/** Base URL for Supabase Edge Functions */
export const EDGE_FUNCTIONS_BASE = `${supabaseUrl}/functions/v1`;