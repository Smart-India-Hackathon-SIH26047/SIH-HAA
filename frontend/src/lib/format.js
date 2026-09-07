/**
 * Backend datetimes are naive UTC (`datetime.utcnow().isoformat()`), so they
 * arrive without a trailing Z. Parsing them directly makes the browser read
 * them as local time. Append the Z ourselves.
 */
export function parseServerDate(value) {
  if (!value) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  const date = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date-only fields (case events) are plain calendar dates — no zone shift. */
export function parseCalendarDate(value) {
  if (!value) return null;
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDate(value, { calendar = false } = {}) {
  const date = calendar ? parseCalendarDate(value) : parseServerDate(value);
  return date ? dateFmt.format(date) : "—";
}

export function formatDateTime(value) {
  const date = parseServerDate(value);
  return date ? dateTimeFmt.format(date) : "—";
}

export function formatRelative(value) {
  const date = parseServerDate(value);
  if (!date) return "—";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

export const CASE_EVENT_LABELS = {
  hearing_scheduled: "Hearing scheduled",
  hearing_delayed: "Hearing delayed",
  threat_reported: "Threat reported",
  compensation_released: "Compensation released",
};

export function caseEventLabel(type) {
  return CASE_EVENT_LABELS[type] || String(type || "").replace(/_/g, " ");
}

export function titleCase(value) {
  const text = String(value || "").replace(/_/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

/** Short, stable label for a person whose real name we never hold. */
export function shortId(id) {
  return id ? String(id).slice(0, 8) : "—";
}
