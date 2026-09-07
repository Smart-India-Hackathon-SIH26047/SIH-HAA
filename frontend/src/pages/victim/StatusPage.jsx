import { useAuth } from "@/auth/AuthProvider";
import { fetchPersonHistory } from "@/api/endpoints";
import { useAsync } from "@/hooks/useAsync";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { formatRelative, parseServerDate } from "@/lib/format";
import { useLang } from "@/i18n/LanguageProvider";

/**
 * "My Status" — the beneficiary's own view of how they're doing.
 *
 * DELIBERATELY NO NUMERIC SCORE. The mockup tucks a score ring behind a
 * "View details" toggle, but showing someone their own distress score is the
 * open question still on hold — so this shows plain language only, and the
 * details panel is left out until that decision is made.
 *
 * Bands are also not named here ("Watch", "Elevated" are triage vocabulary).
 * They map to a sentence about what Saathi is doing, not a label to wear.
 */
const BAND_MESSAGE_KEY = {
  stable: "statusStable",
  watch: "statusWatch",
  elevated: "statusElevated",
  priority: "statusPriority",
};

export default function StatusPage() {
  const { personId, user } = useAuth();
  const { t } = useLang();

  const history = useAsync(
    ({ signal }) =>
      fetchPersonHistory({
        personId,
        // Audited on every read, so it records the real viewer.
        accessedBy: user?.id ? `user:${user.id}` : "beneficiary_app",
        signal,
      }),
    [personId, user?.id],
  );

  if (history.loading) return <LoadingState label="Loading your status…" />;
  if (history.error) return <ErrorState error={history.error} onRetry={history.reload} />;

  const scores = history.data?.scores || [];
  const checkins = history.data?.checkins || [];

  const latest = [...scores].sort(
    (a, b) => (parseServerDate(b.created_at) ?? 0) - (parseServerDate(a.created_at) ?? 0),
  )[0];
  const lastCheckin = [...checkins].sort(
    (a, b) => (parseServerDate(b.created_at) ?? 0) - (parseServerDate(a.created_at) ?? 0),
  )[0];

  const message = latest ? t(BAND_MESSAGE_KEY[latest.band] || "statusWatch") : t("statusNone");

  return (
    <div className="flex flex-col gap-4">
      <section className="card p-6">
        <h1 className="font-head text-[17px]">{t("statusTitle")}</h1>
        <p className="mt-1 text-[13.5px] text-muted">
          {t("statusNote")}
        </p>
        <p className="mt-4 max-w-[44ch] text-[14.5px] leading-relaxed text-muted">{message}</p>
      </section>

      <section className="card p-6">
        <h2 className="font-head text-[17px]">{t("yourCheckins")}</h2>
        <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
          <Stat label={t("lastCheckin")} value={lastCheckin ? formatRelative(lastCheckin.created_at) : "—"} />
          <Stat label={t("checkinsSoFar")} value={String(checkins.length)} />
        </div>

        {checkins.length > 0 && (
          <ul className="mt-5 flex list-none flex-col gap-2.5 p-0">
            {[...checkins]
              .sort((a, b) => (parseServerDate(b.created_at) ?? 0) - (parseServerDate(a.created_at) ?? 0))
              .slice(0, 5)
              .map((checkin) => (
                <li
                  key={checkin.id}
                  className="rounded-[10px] bg-raised px-3 py-2.5 text-[13px]"
                >
                  <span className="text-muted">{formatRelative(checkin.created_at)}</span>
                  <p className="mt-1 line-clamp-2 text-ink">{checkin.raw_text}</p>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-raised px-4 py-3.5">
      <div className="mb-1 text-xs text-muted">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}
