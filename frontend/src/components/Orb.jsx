/**
 * The Saathi orb.
 *
 * Three layers — an ambient glow, a ring, and the sphere — animated together
 * from one clock per state so they stay coordinated. All the motion lives in
 * index.css; this only picks the state class and the size.
 *
 * States: "idle" | "listening" | "processing" | "speaking" | "error"
 */
export default function Orb({ state = "idle", size = 200, className = "" }) {
  return (
    <div
      className={`orb orb-${state} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div className="orb-glow" />
      <div className="orb-ring" />
      <div className="orb-core" />
    </div>
  );
}

/** The small circular mark used in the brand lockup. */
export function BrandMark({ size = 30, className = "" }) {
  return (
    <span
      className={`shrink-0 rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(circle at 32% 30%, var(--orb-a), var(--orb-b) 60%, var(--orb-c))",
        boxShadow: "0 0 0 4px rgb(var(--c-accent-softer))",
      }}
      aria-hidden="true"
    />
  );
}
