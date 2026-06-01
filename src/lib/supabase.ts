import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Inicialización lazy — el cliente se crea en el primer uso, no en el import
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
    _client = createClient(url, key);
  }
  return _client;
}

export type DbUser = {
  id: string;
  name: string;
  email: string;
  password_hash: string | null;
  provider: "email" | "google";
  avatar_url: string | null;
  created_at: string;
};
