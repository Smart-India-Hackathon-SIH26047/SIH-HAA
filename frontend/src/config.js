/**
 * Runtime configuration, read from Vite env vars.
 * Copy `.env.example` to `.env` and fill in real UUIDs from the backend seeds.
 */

const raw = import.meta.env;

/** Base URL for the FastAPI backend. Trailing slash trimmed. */
export const API_BASE_URL = (raw.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

/**
 * Until there is a real auth/session flow, the person and officer identities
 * come from env. Both must be UUIDs — the backend calls `uuid.UUID()` on
 * person_id and looks officers up by primary key.
 */
export const DEMO_PERSON_ID = raw.VITE_DEMO_PERSON_ID || "";
export const DEMO_OFFICER_ID = raw.VITE_DEMO_OFFICER_ID || "";

/**
 * Supabase project, used for authentication only. The FastAPI backend still
 * owns all case data.
 *
 * The anon key is publishable and safe in a browser bundle — Row Level
 * Security is what protects the data. Never put a service_role key here.
 */
export const SUPABASE_URL = (raw.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
export const SUPABASE_ANON_KEY = raw.VITE_SUPABASE_ANON_KEY || "";

/**
 * Whether the entry screen asks for an email and password.
 *
 * ON by default. It is lenient rather than absent: one "Continue" button that
 * signs you in, or offers to create the account if that email is new — no
 * separate register step. Set VITE_REQUIRE_LOGIN=false for a demo with no
 * credentials at all, where picking a role is the whole sign-in.
 */
export const REQUIRE_LOGIN = String(raw.VITE_REQUIRE_LOGIN ?? "true").toLowerCase() !== "false";

export const IS_DEV = raw.DEV;
