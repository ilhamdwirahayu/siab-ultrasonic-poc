import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret || url === "REPLACE" || secret === "REPLACE_SERVER_ONLY") return null;
  try {
    const parsedUrl = new URL(url);
    const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname);
    if (parsedUrl.protocol !== "https:" && !(parsedUrl.protocol === "http:" && isLoopback)) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL must use HTTPS except for a local development server.");
    }
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is invalid.");
  }
  client ??= createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
