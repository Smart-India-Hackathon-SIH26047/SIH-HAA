import { useState } from "react";
import { Navigate } from "react-router-dom";
import { ClipboardList, Heart, Loader2, LogOut } from "lucide-react";
import { ROLES, useAuth } from "@/auth/AuthProvider";
import { homeFor } from "@/auth/guards";
import { LoadingState } from "@/components/ui/States";

/**
 * Role selection after sign-in. Deliberately two large, plainly worded
 * choices rather than a dropdown — the person choosing "I need support" may
 * be in distress, and this should not feel like filling in a form.
 */
export default function RoleSelectPage() {
  const { chooseRole, signOut, user, isAuthenticated, loading, roleResolved, role } = useAuth();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  // This route sits outside RequireAuth (which would bounce back here in a
  // loop), so it carries its own checks.
  if (loading || !roleResolved) return <LoadingState label="Loading…" />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Once a role is resolved this redirect fires on its own. Leaving is driven
  // by the resolved role rather than by an imperative navigate() next to the
  // state write, so there is no window where the two disagree.
  const resolvedHome = homeFor(role);
  if (resolvedHome) return <Navigate to={resolvedHome} replace />;

  const pick = async (chosen) => {
    setBusy(chosen);
    setError(null);
    try {
      await chooseRole(chosen);
      // No navigate() here: chooseRole sets the role, and the redirect above
      // picks it up on the next render. Stays busy until that happens.
    } catch (err) {
      setError(err.message || "Could not save that choice.");
      setBusy(null);
    }
  };

  const name = user?.user_metadata?.display_name;

  return (
    <div className="theme-victim flex min-h-svh items-center justify-center bg-canvas px-6 py-12 text-ink">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-semibold tracking-tight">
          {name ? `Hello, ${name}.` : "Hello."}
        </h1>
        <p className="mt-1.5 text-sm text-muted">How will you be using NHAA?</p>

        <div className="mt-7 grid gap-3">
          <RoleCard
            icon={Heart}
            title="I need support"
            description="A private space to talk about how you're doing, whenever you want to."
            onClick={() => pick(ROLES.VICTIM)}
            busy={busy === ROLES.VICTIM}
            disabled={Boolean(busy)}
          />
          <RoleCard
            icon={ClipboardList}
            title="I'm an officer"
            description="Review cases assigned to you, and follow up on alerts."
            onClick={() => pick(ROLES.OFFICER)}
            busy={busy === ROLES.OFFICER}
            disabled={Boolean(busy)}
          />
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-band-elevated-soft px-3 py-2 text-sm text-band-elevated" role="alert">
            {error}
          </p>
        )}

        <p className="mt-6 text-xs text-faint">
          You can change this later by signing out and back in.
        </p>

        <button
          type="button"
          onClick={signOut}
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  );
}

function RoleCard({ icon: Icon, title, description, onClick, busy, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 text-left shadow-soft transition-colors hover:border-accent/50 disabled:opacity-60"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          <Icon className="h-5 w-5" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-sm text-muted">{description}</span>
      </span>
    </button>
  );
}
