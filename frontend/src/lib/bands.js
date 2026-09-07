/**
 * The four risk bands. The backend sends these lowercase and enforces them
 * with a CHECK constraint, so `band` is the single source of truth — never
 * derive a band from the numeric score on the client.
 *
 * `officerLabel` is what a case officer sees. `subjectLabel` is deliberately
 * absent: bands are never shown on victim-facing screens.
 */
export const BANDS = {
  stable: {
    key: "stable",
    label: "Stable",
    order: 0,
    text: "text-band-stable",
    bg: "bg-band-stable-soft",
    border: "border-band-stable/30",
    dot: "bg-band-stable",
    description: "No indicators of rising distress.",
  },
  watch: {
    key: "watch",
    label: "Watch",
    order: 1,
    text: "text-band-watch",
    bg: "bg-band-watch-soft",
    border: "border-band-watch/30",
    dot: "bg-band-watch",
    description: "Early signals worth keeping an eye on.",
  },
  elevated: {
    key: "elevated",
    label: "Elevated",
    order: 2,
    text: "text-band-elevated",
    bg: "bg-band-elevated-soft",
    border: "border-band-elevated/30",
    dot: "bg-band-elevated",
    description: "Sustained distress. Counsellor contact suggested.",
  },
  priority: {
    key: "priority",
    label: "Priority",
    order: 3,
    text: "text-band-priority",
    bg: "bg-band-priority-soft",
    border: "border-band-priority/30",
    dot: "bg-band-priority",
    description: "Needs review now.",
  },
};

export const BAND_ORDER = ["stable", "watch", "elevated", "priority"];

const UNKNOWN_BAND = {
  key: "unknown",
  label: "No score yet",
  order: -1,
  text: "text-muted",
  bg: "bg-raised",
  border: "border-line",
  dot: "bg-faint",
  description: "This person has not been scored yet.",
};

export function bandMeta(band) {
  if (!band) return UNKNOWN_BAND;
  return BANDS[String(band).toLowerCase()] || UNKNOWN_BAND;
}

/** Hex values for chart libraries, which cannot read Tailwind classes. */
export const BAND_HEX = {
  stable: "#5b9e7a",
  watch: "#c7963e",
  elevated: "#c97641",
  priority: "#ae564f",
  unknown: "#8d9ca3",
};

export function bandHex(band) {
  return BAND_HEX[String(band || "").toLowerCase()] || BAND_HEX.unknown;
}

/**
 * Alert severity is a SEPARATE vocabulary from the risk bands
 * ("low" | "medium" | "high" | "critical"). Keep them visually distinct so
 * nobody reads an alert severity as a band.
 */
export const SEVERITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export function severityMeta(severity) {
  const key = String(severity || "").toLowerCase();
  const toBand = { low: "stable", medium: "watch", high: "elevated", critical: "priority" };
  return {
    label: SEVERITY_LABELS[key] || "Unknown",
    ...bandMeta(toBand[key]),
    key,
  };
}
