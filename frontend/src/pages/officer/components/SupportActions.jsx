import { MessageSquare, Phone } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";

/**
 * Per-case "Initiate call" / "Send SMS" actions.
 *
 * IMPORTANT — what these actually dial:
 * The numbers come from the backend's SUPPORT_CALL_NUMBER / SUPPORT_SMS_NUMBER,
 * which are the support line, NOT the person. No contact details for people are
 * stored anywhere in this system (Person has pseudonym, language, case_phase,
 * district, state — no phone, no email), so contacting someone directly is not
 * possible from here. The labels say "support line" so nobody assumes otherwise.
 *
 * A channel the backend has not configured comes back null. It is rendered
 * disabled with the reason, never swapped for a different number.
 */
export default function SupportActions({ contacts, pseudonym, size = "sm" }) {
  const { t } = useLang();
  const call = contacts?.call || null;
  const sms = contacts?.sms || null;
  const dense = size === "sm";

  const base = [
    "inline-flex items-center gap-1.5 rounded-lg border font-medium transition-colors",
    dense ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm",
  ].join(" ");

  const enabled = "border-line bg-surface text-accent-strong hover:border-accent/50 hover:bg-accent-soft";
  const disabled = "border-line bg-raised text-faint cursor-not-allowed";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {call ? (
        <a
          href={`tel:${String(call.number).replace(/[^\d+]/g, "")}`}
          className={`${base} ${enabled}`}
          title={`Call ${call.name} (${call.number}) about ${pseudonym}`}
        >
          <Phone className={dense ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" />
          {t("initiateCall")}
        </a>
      ) : (
        <span className={`${base} ${disabled}`} title="SUPPORT_CALL_NUMBER is not configured">
          <Phone className={dense ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" />
          {t("callUnavailable")}
        </span>
      )}

      {sms ? (
        <a
          href={`sms:${String(sms.number).replace(/[^\d+]/g, "")}`}
          className={`${base} ${enabled}`}
          title={`Message ${sms.name} (${sms.number}) about ${pseudonym}`}
        >
          <MessageSquare className={dense ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" />
          {t("sendSms")}
        </a>
      ) : (
        <span
          className={`${base} ${disabled}`}
          title="SUPPORT_SMS_NUMBER is not set on the backend, so no SMS channel is configured"
        >
          <MessageSquare className={dense ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" />
          {t("smsNotConfigured")}
        </span>
      )}
    </div>
  );
}
