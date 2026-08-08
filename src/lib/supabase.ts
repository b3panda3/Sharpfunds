import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file or hosting platform."
  );
}

export const supabase = createClient(
  supabaseUrl || "",
  supabaseAnonKey || ""
);

/** Base URL for Supabase Edge Functions */
export const EDGE_FUNCTIONS_BASE = `${supabaseUrl || ""}/functions/v1`;