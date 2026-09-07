import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/config";

/**
 * Supabase client, or null when the project is not configured yet.
 *
 * Null rather than a client with empty credentials, so the UI can show a clear
 * "not configured" screen instead of failing with an opaque network error.
 *
 * The anon key is a public, publishable key — it is designed to ship in a
 * browser bundle and is safe there. What protects the data is Row Level
 * Security on the tables, NOT the secrecy of this key. Never put the
 * service_role key in this app.
 */
export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export const isSupabaseConfigured = Boolean(supabase);

/** Supabase's auth errors are terse; make the common ones human. */
export function readableAuthError(error) {
  if (!error) return null;
  const message = String(error.message || error);

  if (/invalid login credentials/i.test(message)) {
    return "That email and password don't match an account.";
  }
  if (/user already registered/i.test(message)) {
    return "An account with this email already exists. Try signing in.";
  }
  if (/password should be at least/i.test(message)) {
    return "Please choose a password of at least 6 characters.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Please confirm your email address, then sign in.";
  }
  if (/rate limit|too many/i.test(message)) {
    return "Too many attempts just now. Please wait a moment and try again.";
  }
  return message;
}
