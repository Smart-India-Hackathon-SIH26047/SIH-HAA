/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "#2563EB",
        "brand-mid": "#3B82F6",
        "brand-soft": "#DBEAFE",
        "brand-pale": "#EFF6FF",
        "brand-orb": "#60A5FA",
        ink: "#1E293B",
        paper: "#F0F7FF",
        sidebar: "#E4EEFF",
        line: "#BFDBFE",
        muted: "#64748B",
        "muted-light": "#94A3B8",
        alert: "#DC2626",
        "alert-soft": "#FEE2E2",
        glass: "rgba(255,255,255,0.65)",
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        orb: '0 8px 64px 16px rgba(96,165,250,0.45)',
        'orb-sm': '0 4px 32px 8px rgba(96,165,250,0.3)',
        glass: '0 4px 24px rgba(37,99,235,0.08)',
        sidebar: '2px 0 20px rgba(37,99,235,0.06)',
      },

      animation: {
        'orb-pulse': 'orbPulse 3s ease-in-out infinite',
        'orb-glow': 'orbGlow 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'dot-bounce': 'dotBounce 1.4s ease-in-out infinite',
      },
      keyframes: {
        orbPulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.06)', opacity: '0.92' },
        },
        orbGlow: {
          '0%, 100%': { boxShadow: '0 8px 64px 16px rgba(96,165,250,0.45)' },
          '50%': { boxShadow: '0 8px 80px 24px rgba(59,130,246,0.6)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        dotBounce: {
          '0%, 80%, 100%': { transform: 'translateY(0)', opacity: '0.5' },
          '40%': { transform: 'translateY(-6px)', opacity: '1' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
