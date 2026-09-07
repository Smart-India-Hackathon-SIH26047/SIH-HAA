import { Phone, X } from "lucide-react";

/**
 * Shown when the backend returns `type: "safety_flag"`.
 *
 * Tone matters here more than anywhere else in the app: this is a person in
 * distress, not an error state. No warning triangles, no red, no "alert"
 * language — a calm card with numbers that can be tapped to dial.
 */
export default function SupportSheet({ flag, onDismiss }) {
  if (!flag) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/25 backdrop-blur-sm" onClick={onDismiss} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-title"
        className="relative w-full max-w-md animate-fade-rise rounded-t-3xl border border-line bg-surface p-6 pb-safe shadow-lift sm:rounded-3xl sm:pb-6"
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-1.5 text-faint hover:bg-raised hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <h2 id="support-title" className="pr-8 text-lg font-semibold text-ink">
          You don’t have to hold this alone
        </h2>

        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          {flag.message ||
            "Someone is available to talk with you right now, at any hour. Reaching out is a strong thing to do."}
        </p>

        {flag.helplines.length > 0 && (
          <ul className="mt-5 space-y-2">
            {flag.helplines.map((helpline) => (
              <li key={helpline.label}>
                {helpline.number ? (
                  <a
                    href={`tel:${helpline.number.replace(/[^\d+]/g, "")}`}
                    className="flex items-center gap-3 rounded-2xl border border-accent/25 bg-accent-soft px-4 py-3 transition-colors hover:border-accent/50"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-accent-strong" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">{helpline.label}</span>
                      <span className="block text-sm text-accent-strong">{helpline.number}</span>
                    </span>
                  </a>
                ) : (
                  <div className="rounded-2xl border border-line bg-raised px-4 py-3 text-sm text-ink">
                    {helpline.label}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onDismiss}
          className="mt-5 w-full rounded-full py-2.5 text-sm text-muted hover:text-ink"
        >
          Continue our conversation
        </button>
      </div>
    </div>
  );
}
