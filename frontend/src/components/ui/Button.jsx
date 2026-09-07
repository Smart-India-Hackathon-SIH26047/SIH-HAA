const VARIANTS = {
  primary:
    "bg-accent text-white hover:bg-accent-strong active:bg-accent-strong disabled:bg-accent/40",
  soft: "bg-accent-soft text-accent-strong hover:bg-accent-soft/70 disabled:opacity-50",
  quiet: "bg-transparent text-muted hover:bg-raised hover:text-ink disabled:opacity-50",
  outline:
    "bg-surface text-ink border border-line hover:border-accent/50 hover:text-accent-strong disabled:opacity-50",
};

const SIZES = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={[
        "inline-flex items-center justify-center rounded-full font-medium",
        "transition-colors duration-150 disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
