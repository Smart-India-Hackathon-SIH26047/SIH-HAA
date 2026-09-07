import { KeyRound } from "lucide-react";

/**
 * Shown when Supabase credentials are missing, instead of letting the app
 * fail with an opaque network error.
 */
export default function SetupNoticePage() {
  return (
    <div className="theme-victim flex min-h-svh items-center justify-center bg-canvas px-6 py-12 text-ink">
      <div className="card max-w-lg p-6">
        <KeyRound className="h-6 w-6 text-accent" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold">Authentication isn’t configured yet</h1>
        <p className="mt-2 text-sm text-muted">
          Add your Supabase project details to <code className="rounded bg-raised px-1 py-0.5 text-xs">frontend/.env</code>{" "}
          and restart the dev server:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-raised p-3 text-xs leading-relaxed">
{`VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>`}
        </pre>
        <p className="mt-3 text-sm text-muted">
          Both are in the Supabase dashboard under{" "}
          <strong className="font-medium text-ink">Project Settings → API</strong>. Use the{" "}
          <strong className="font-medium text-ink">anon / publishable</strong> key — never the
          service_role key, which must not ship in a browser bundle.
        </p>
        <p className="mt-3 text-sm text-muted">
          The <code className="rounded bg-raised px-1 py-0.5 text-xs">profiles</code> table also
          needs creating — the SQL is in{" "}
          <code className="rounded bg-raised px-1 py-0.5 text-xs">frontend/docs/auth-setup.md</code>.
        </p>
      </div>
    </div>
  );
}
