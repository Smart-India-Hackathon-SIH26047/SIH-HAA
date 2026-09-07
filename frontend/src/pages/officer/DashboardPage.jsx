import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { fetchPeople, fetchSupportContacts } from "@/api/endpoints";
import { useAsync } from "@/hooks/useAsync";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { BAND_ORDER, bandMeta } from "@/lib/bands";
import { formatRelative, titleCase } from "@/lib/format";
import SupportActions from "./components/SupportActions";
import { useLang } from "@/i18n/LanguageProvider";

/** Band names come from lib/bands.js in English; translate for display. */
const BAND_LABEL_KEY = {
  stable: "bandStable",
  watch: "bandWatch",
  elevated: "bandElevated",
  priority: "bandPriority",
};
const bandLabel = (t, band) => (BAND_LABEL_KEY[band] ? t(BAND_LABEL_KEY[band]) : bandMeta(band).label);

/**
 * Officer case list.
 *
 * Scores and bands ARE shown here — this is the officer console, where triage
 * information is the point. They are never rendered on the beneficiary side.
 */
export default function DashboardPage() {
  const { t } = useLang();
  const [district, setDistrict] = useState("");
  const [state, setState] = useState("");
  const [bandFilter, setBandFilter] = useState("");
  const [selected, setSelected] = useState(null);

  const people = useAsync(
    ({ signal }) => fetchPeople({ district, state, signal }),
    [district, state],
  );
  const contacts = useAsync(({ signal }) => fetchSupportContacts({ signal }), []);

  const rows = people.data || [];

  const { districts, states } = useMemo(
    () => ({
      districts: [...new Set(rows.map((p) => p.district).filter(Boolean))].sort(),
      states: [...new Set(rows.map((p) => p.state).filter(Boolean))].sort(),
    }),
    [rows],
  );

  const counts = useMemo(() => {
    const tally = Object.fromEntries(BAND_ORDER.map((b) => [b, 0]));
    for (const p of rows) if (p.band && p.band in tally) tally[p.band] += 1;
    return tally;
  }, [rows]);

  const visible = useMemo(
    () =>
      rows
        .filter((p) => (bandFilter ? p.band === bandFilter : true))
        .sort((a, b) => {
          const rank = (p) => (p.band ? bandMeta(p.band).order : -1);
          return rank(b) - rank(a) || a.pseudonym.localeCompare(b.pseudonym);
        }),
    [rows, bandFilter],
  );

  if (people.loading && !people.data) return <LoadingState label="Loading cases…" />;
  if (people.error) return <ErrorState error={people.error} onRetry={people.reload} />;

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard n={counts.priority} label={t("bandPriority")} tone="text-band-priority" />
        <SummaryCard n={counts.elevated} label={t("bandElevated")} tone="text-band-elevated" />
        <SummaryCard n={counts.watch} label={t("bandWatch")} tone="text-band-watch" />
        <SummaryCard n={rows.length} label={t("totalCases")} tone="text-accent" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Select label={t("filterDistrict")} allLabel={t("filterAll")} value={district} onChange={setDistrict} options={districts} />
        <Select label={t("filterState")} allLabel={t("filterAll")} value={state} onChange={setState} options={states} />
        <Select
          label={t("filterBand")}
          value={bandFilter}
          onChange={setBandFilter}
          options={BAND_ORDER}
          render={(b) => bandLabel(t, b)}
        />
        {(district || state || bandFilter) && (
          <button
            type="button"
            onClick={() => {
              setDistrict("");
              setState("");
              setBandFilter("");
            }}
            className="rounded-full px-3 py-2 text-[13.5px] text-muted hover:bg-raised hover:text-ink"
          >
            {t("clear")}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="card">
          <EmptyState title={t("noCasesMatch")} description={t("noCasesHint")} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-[22px] border border-line-soft bg-surface">
          <div className="hidden grid-cols-[1fr_1.2fr_0.9fr_1fr_0.9fr] gap-2.5 bg-raised px-5 py-3 text-[11.5px] font-bold uppercase tracking-[0.04em] text-faint md:grid">
            <div>{t("colCase")}</div>
            <div>{t("colDistrict")}</div>
            <div>{t("colBand")}</div>
            <div>{t("colScore")}</div>
            <div>{t("colLastCheckin")}</div>
          </div>

          {visible.map((person) => {
            const meta = bandMeta(person.band);
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => setSelected(person)}
                className="grid w-full grid-cols-2 gap-x-2.5 gap-y-1.5 border-b border-line-soft px-5 py-4 text-left text-[13.5px] last:border-b-0 hover:bg-accent-softer md:grid-cols-[1fr_1.2fr_0.9fr_1fr_0.9fr] md:items-center"
              >
                <div className="font-head font-bold">{person.pseudonym}</div>
                <div className="text-muted">
                  {person.district}
                  {person.state ? `, ${person.state}` : ""}
                </div>
                <div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold ${meta.bg} ${meta.text}`}
                  >
                    <span className={`h-[7px] w-[7px] rounded-full ${meta.dot}`} aria-hidden="true" />
                    {bandLabel(t, person.band)}
                  </span>
                </div>
                <div className="tabular-nums">
                  {person.score !== null && person.score !== undefined
                    ? Number(person.score).toFixed(1)
                    : "—"}
                </div>
                <div className="text-muted">
                  {person.last_scored_at ? formatRelative(person.last_scored_at) : "—"}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <CaseDetailPanel
          person={selected}
          contacts={contacts.data}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function SummaryCard({ n, label, tone }) {
  return (
    <div className="rounded-2xl border border-line-soft bg-surface px-5 py-4">
      <div className={`mb-1.5 font-head text-3xl leading-none ${tone}`}>{n}</div>
      <div className="text-[13px] text-muted">{label}</div>
    </div>
  );
}

function Select({ label, value, onChange, options, render, allLabel = "all" }) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="cursor-pointer rounded-full border border-line bg-surface px-3.5 py-2.5 text-[13.5px] text-ink focus:border-accent focus:outline-none"
      >
        <option value="">{label}: {allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {render ? render(option) : option}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Slide-over with the case summary and the per-case support actions. */
function CaseDetailPanel({ person, contacts, onClose }) {
  const { t } = useLang();
  const meta = bandMeta(person.band);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/35" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Case ${person.pseudonym}`}
        onClick={(event) => event.stopPropagation()}
        className="h-full w-full max-w-[480px] overflow-y-auto bg-surface p-6 shadow-panel"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="font-head text-xl">{person.pseudonym}</h2>
            <p className="mt-1 text-[13px] text-muted">
              {person.district}
              {person.state ? `, ${person.state}` : ""}
              {person.case_phase ? ` · ${titleCase(person.case_phase)}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-raised text-muted hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold ${meta.bg} ${meta.text}`}
          >
            <span className={`h-[7px] w-[7px] rounded-full ${meta.dot}`} aria-hidden="true" />
            {bandLabel(t, person.band)}
          </span>
          {person.score !== null && person.score !== undefined && (
            <span className="text-sm text-muted">
              Score <b className="tabular-nums text-ink">{Number(person.score).toFixed(1)}</b> / 100
            </span>
          )}
        </div>
        <p className="mt-2 text-[13px] text-muted">{meta.description}</p>

        <div className="mt-6 border-t border-line-soft pt-5">
          <h3 className="mb-3 text-[13px] font-semibold text-muted">{t("contactSupportLine")}</h3>
          <SupportActions contacts={contacts} pseudonym={person.pseudonym} size="md" />
        </div>

        <div className="mt-6 border-t border-line-soft pt-5">
          <Link
            to={`/officer/cases/${person.id}`}
            className="text-sm font-semibold text-accent-strong underline underline-offset-2"
          >
            {t("openFullCase")}
          </Link>
        </div>
      </div>
    </div>
  );
}
