import { AlertCircle, Loader2, WifiOff } from "lucide-react";
import Button from "./Button";

export function Spinner({ className = "" }) {
  return <Loader2 className={`h-4 w-4 animate-spin ${className}`} aria-hidden="true" />;
}

export function LoadingState({ label = "Loading…" }) {
  return (
    <div className="flex items-center gap-2 py-12 justify-center text-muted text-sm" role="status">
      <Spinner />
      {label}
    </div>
  );
}

/**
 * `error` is an ApiError. A status of 0 means the request never reached the
 * server, which during a demo almost always means uvicorn is not running —
 * so say that rather than showing a generic failure.
 */
export function ErrorState({ error, onRetry }) {
  const offline = error?.isOffline;
  const Icon = offline ? WifiOff : AlertCircle;

  return (
    <div className="card p-6 text-center max-w-md mx-auto my-10">
      <Icon className="h-6 w-6 mx-auto text-band-elevated" aria-hidden="true" />
      <p className="mt-3 font-medium text-ink">
        {offline ? "Can’t reach the server" : "Something went wrong"}
      </p>
      <p className="mt-1.5 text-sm text-muted">
        {offline
          ? "Check that the backend is running and that VITE_API_BASE_URL points at it."
          : error?.message || "Please try again."}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="text-center py-14 px-6">
      {Icon && <Icon className="h-6 w-6 mx-auto text-faint" aria-hidden="true" />}
      <p className="mt-3 font-medium text-ink">{title}</p>
      {description && <p className="mt-1.5 text-sm text-muted max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
