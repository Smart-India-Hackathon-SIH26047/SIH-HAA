import { MessageSquare, Phone } from "lucide-react";
import { fetchSupportContacts } from "@/api/endpoints";
import { useAsync } from "@/hooks/useAsync";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useLang } from "@/i18n/LanguageProvider";

/**
 * Support numbers, always reachable rather than only offered when distress
 * rises. Numbers come from the backend so there is one source of truth.
 */
export default function SupportPage() {
  const { t } = useLang();
  const contacts = useAsync(({ signal }) => fetchSupportContacts({ signal }), []);

  if (contacts.loading) return <LoadingState label="Loading…" />;
  if (contacts.error) return <ErrorState error={contacts.error} onRetry={contacts.reload} />;

  const { call, sms } = contacts.data || {};

  return (
    <div className="flex flex-col gap-4">
      <section className="card p-6">
        <h1 className="font-head text-[17px]">{t("supportTitle")}</h1>
        <p className="mt-1 text-[13.5px] text-muted">
          {t("supportSub")}
        </p>

        <div className="mt-5 flex flex-col gap-2.5">
          {call && (
            <a
              href={`tel:${String(call.number).replace(/[^\d+]/g, "")}`}
              className="flex items-center gap-3.5 rounded-[14px] border border-accent-soft bg-accent-softer px-4 py-3.5 transition-colors hover:border-accent/40"
            >
              <Phone className="h-4 w-4 shrink-0 text-accent-strong" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{call.name}</span>
                <span className="block text-sm text-accent-strong">{call.number}</span>
              </span>
            </a>
          )}

          {sms ? (
            <a
              href={`sms:${String(sms.number).replace(/[^\d+]/g, "")}`}
              className="flex items-center gap-3.5 rounded-[14px] border border-accent-soft bg-accent-softer px-4 py-3.5 transition-colors hover:border-accent/40"
            >
              <MessageSquare className="h-4 w-4 shrink-0 text-accent-strong" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{t("supportSms")}</span>
                <span className="block text-sm text-accent-strong">{sms.number}</span>
              </span>
            </a>
          ) : (
            <p className="rounded-[14px] bg-raised px-4 py-3.5 text-sm text-muted">
              {t("supportNoSms")}
            </p>
          )}

          <a
            href="tel:112"
            className="flex items-center gap-3.5 rounded-[14px] border border-line bg-surface px-4 py-3.5 transition-colors hover:border-accent/40"
          >
            <Phone className="h-4 w-4 shrink-0 text-band-elevated" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">{t("supportEmergency")}</span>
              <span className="block text-sm text-muted">112</span>
            </span>
          </a>
        </div>
      </section>
    </div>
  );
}
