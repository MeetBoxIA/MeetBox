/**
 * Singleton Supabase client for server-side use.
 * Uses the service-role key so it bypasses Row Level Security — only
 * call this from API routes or server actions, never from the browser.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazy init — client is created on first use rather than at import time,
// which avoids crashes during build when env vars are not yet injected.
let _client: SupabaseClient | null = null;

/** Return the shared Supabase client, creating it on first call. */
export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    _client = createClient(url, key);
  }
  return _client;
}

/** Shape of a row in the `users` table. */
export type DbUser = {
  id: string;
  name: string;
  email: string;
  password_hash: string | null;
  provider: "email" | "google";
  avatar_url: string | null;
  created_at: string;
};
