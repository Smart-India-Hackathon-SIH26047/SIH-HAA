/**
 * Colors resolve through CSS custom properties so the victim-facing and
 * officer-facing shells can swap the whole palette by class
 * (`.theme-victim` / `.theme-officer`) without duplicating utilities.
 *
 * Vars hold space-separated RGB channels so Tailwind opacity modifiers
 * (`bg-surface/60`) keep working.
 */
const withOpacity = (variable) => `rgb(var(${variable}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: withOpacity("--c-canvas"),
        "canvas-deep": withOpacity("--c-canvas-deep"),
        surface: withOpacity("--c-surface"),
        raised: withOpacity("--c-raised"),
        line: withOpacity("--c-line"),
        "line-soft": withOpacity("--c-line-soft"),
        ink: withOpacity("--c-ink"),
        muted: withOpacity("--c-muted"),
        faint: withOpacity("--c-faint"),
        accent: withOpacity("--c-accent"),
        "accent-strong": withOpacity("--c-accent-strong"),
        "accent-soft": withOpacity("--c-accent-soft"),
        "accent-softer": withOpacity("--c-accent-softer"),
        band: {
          stable: withOpacity("--c-band-stable"),
          "stable-soft": withOpacity("--c-band-stable-soft"),
          watch: withOpacity("--c-band-watch"),
          "watch-soft": withOpacity("--c-band-watch-soft"),
          elevated: withOpacity("--c-band-elevated"),
          "elevated-soft": withOpacity("--c-band-elevated-soft"),
          priority: withOpacity("--c-band-priority"),
          "priority-soft": withOpacity("--c-band-priority-soft"),
        },
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans Devanagari", "ui-sans-serif", "system-ui", "sans-serif"],
        head: ["Lora", "Noto Serif Devanagari", "ui-serif", "Georgia", "serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgb(21 54 92 / 0.06), 0 1px 1px rgb(21 54 92 / 0.04)",
        lift: "0 6px 20px rgb(21 54 92 / 0.09)",
        panel: "0 16px 40px rgb(21 54 92 / 0.14)",
      },
      keyframes: {
        "fade-rise": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.5" },
          "100%": { transform: "scale(1.9)", opacity: "0" },
        },
        typing: {
          "0%, 60%, 100%": { opacity: "0.25", transform: "translateY(0)" },
          "30%": { opacity: "1", transform: "translateY(-2px)" },
        },
      },
      animation: {
        "fade-rise": "fade-rise 320ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "pulse-ring": "pulse-ring 1800ms ease-out infinite",
        typing: "typing 1200ms ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
