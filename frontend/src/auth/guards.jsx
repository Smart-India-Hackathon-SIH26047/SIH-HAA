import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuth, ROLES } from "./AuthProvider";
import { LoadingState } from "@/components/ui/States";
import SetupNoticePage from "@/pages/auth/SetupNoticePage";

/**
 * Home route for a KNOWN role, or null when the role is unknown.
 *
 * It deliberately does not fall back to the victim home. "role is undefined"
 * and "role is victim" are different states, and collapsing them is exactly
 * what routed officers into the victim app while the profiles row was still
 * in flight. Callers must handle null rather than guess a side of the app.
 */
export const homeFor = (role) => {
  if (role === ROLES.OFFICER) return "/officer";
  if (role === ROLES.VICTIM) return "/check-in";
  return null;
};

/**
 * Gate for the signed-in areas.
 *
 * NOTE ON WHAT THIS PROTECTS: the UI only. The FastAPI backend has no
 * authentication and does not verify tokens, so every endpoint stays
 * reachable directly. In demo mode this gate is only a role switch.
 */
export function RequireAuth() {
  const { isAuthenticated, loading, roleResolved, role, requiresCredentials } = useAuth();
  const location = useLocation();

  // Only account mode needs Supabase configured.
  if (requiresCredentials && !isSupabaseConfigured) return <SetupNoticePage />;
  // `loading` now covers the role lookup too, so reaching past this line
  // means the role below is the real answer and not a not-yet-loaded null.
  if (loading || !roleResolved) return <LoadingState label="Loading…" />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  // Account mode can be signed in without a role yet; demo mode cannot.
  if (!role) return <Navigate to={requiresCredentials ? "/choose-role" : "/login"} replace />;

  return <Outlet />;
}

/** Gate for one role. Sends the other role to its own home. */
export function RequireRole({ role: required }) {
  const { role, loading, roleResolved, requiresCredentials } = useAuth();

  // An unresolved role is NOT a role. Redirecting on it is what produced the
  // wrong landing page; wait instead.
  if (loading || !roleResolved) return <LoadingState label="Loading…" />;
  if (!role) return <Navigate to={requiresCredentials ? "/choose-role" : "/login"} replace />;
  if (role === required) return <Outlet />;

  // A real, resolved, different role: send it home. A role we do not
  // recognise goes back to the chooser rather than to a guessed default.
  const home = homeFor(role);
  if (!home) return <Navigate to={requiresCredentials ? "/choose-role" : "/login"} replace />;
  return <Navigate to={home} replace />;
}

/** Keeps an already-signed-in user off the entry screen. */
export function RedirectIfAuthenticated({ children }) {
  const { isAuthenticated, role, loading, roleResolved, requiresCredentials } = useAuth();

  if (requiresCredentials && !isSupabaseConfigured) return <SetupNoticePage />;
  if (loading || !roleResolved) return <LoadingState label="Loading…" />;

  if (isAuthenticated) {
    const home = homeFor(role);
    if (!home) return <Navigate to="/choose-role" replace />;
    return <Navigate to={home} replace />;
  }
  return children;
}
