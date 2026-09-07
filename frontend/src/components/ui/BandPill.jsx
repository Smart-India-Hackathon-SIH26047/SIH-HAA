import { bandMeta } from "@/lib/bands";

/**
 * Officer-facing only. Bands are an internal triage vocabulary and are never
 * shown to the person checking in.
 */
export default function BandPill({ band, size = "md", showDot = true, className = "" }) {
  const meta = bandMeta(band);
  const sizing = size === "sm" ? "text-xs px-2 py-0.5 gap-1.5" : "text-sm px-2.5 py-1 gap-2";

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border font-medium whitespace-nowrap",
        meta.bg,
        meta.text,
        meta.border,
        sizing,
        className,
      ].join(" ")}
    >
      {showDot && <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />}
      {meta.label}
    </span>
  );
}
