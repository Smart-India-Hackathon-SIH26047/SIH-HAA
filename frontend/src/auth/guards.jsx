import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuth, ROLES } from "./AuthProvider";
import { LoadingState } from "@/components/ui/States";
import SetupNoticePage from "@/pages/auth/SetupNoticePage";

const homeFor = (role) => (role === ROLES.OFFICER ? "/officer" : "/check-in");

/**
 * Gate for the signed-in areas.
 *
 * NOTE ON WHAT THIS PROTECTS: the UI only. The FastAPI backend has no
 * authentication and does not verify tokens, so every endpoint stays
 * reachable directly. In demo mode this gate is only a role switch.
 */
export function RequireAuth() {
  const { isAuthenticated, loading, role, requiresCredentials } = useAuth();
  const location = useLocation();

  // Only account mode needs Supabase configured.
  if (requiresCredentials && !isSupabaseConfigured) return <SetupNoticePage />;
  if (loading) return <LoadingState label="Loading…" />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  // Account mode can be signed in without a role yet; demo mode cannot.
  if (!role) return <Navigate to={requiresCredentials ? "/choose-role" : "/login"} replace />;

  return <Outlet />;
}

/** Gate for one role. Sends the other role to its own home. */
export function RequireRole({ role: required }) {
  const { role, loading, requiresCredentials } = useAuth();

  if (loading) return <LoadingState label="Loading…" />;
  if (!role) return <Navigate to={requiresCredentials ? "/choose-role" : "/login"} replace />;
  if (role !== required) return <Navigate to={homeFor(role)} replace />;

  return <Outlet />;
}

/** Keeps an already-signed-in user off the entry screen. */
export function RedirectIfAuthenticated({ children }) {
  const { isAuthenticated, role, loading, requiresCredentials } = useAuth();

  if (requiresCredentials && !isSupabaseConfigured) return <SetupNoticePage />;
  if (loading) return <LoadingState label="Loading…" />;

  if (isAuthenticated) {
    if (!role) return <Navigate to="/choose-role" replace />;
    return <Navigate to={homeFor(role)} replace />;
  }
  return children;
}
