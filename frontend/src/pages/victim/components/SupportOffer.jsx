import { MessageSquare, Phone, X } from "lucide-react";

const ICONS = { call: Phone, sms: MessageSquare };

/**
 * The score-gated support offer, shown inline in the conversation when the
 * backend sends `support_offer`.
 *
 * Deliberately NOT a modal — unlike the crisis SupportSheet, this is an offer
 * for someone whose distress has risen but who is not in acute danger.
 * Interrupting them would undo the point of the conversation. It sits in the
 * flow, it can be dismissed, and the chat continues either way.
 */
export default function SupportOffer({ offer, onDismiss }) {
  if (!offer) return null;

  return (
    <div className="animate-fade-rise rounded-2xl border border-accent/25 bg-accent-soft/60 p-4">
      <div className="flex items-start gap-3">
        <p className="flex-1 text-sm leading-relaxed text-ink">{offer.message}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={offer.dismissLabel}
          className="-mr-1 -mt-1 rounded-full p-1.5 text-muted hover:bg-surface hover:text-ink"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {offer.options.map((option) => {
          const Icon = ICONS[option.type] || Phone;
          const href =
            option.type === "sms"
              ? `sms:${String(option.number).replace(/[^\d+]/g, "")}`
              : `tel:${String(option.number).replace(/[^\d+]/g, "")}`;

          return (
            <a
              key={option.type}
              href={href}
              className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-medium text-accent-strong shadow-soft transition-colors hover:bg-surface/70"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {option.label}
            </a>
          );
        })}

        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full px-4 py-2 text-sm text-muted hover:text-ink"
        >
          {offer.dismissLabel}
        </button>
      </div>
    </div>
  );
}
