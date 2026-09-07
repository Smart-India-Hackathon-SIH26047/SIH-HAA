import { NavLink, Outlet } from "react-router-dom";
import { BellRing, LayoutGrid, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { shortId } from "@/lib/format";
import { LanguageSwitch, useLang } from "@/i18n/LanguageProvider";

const NAV = [
  { to: "/officer", key: "officerCases", icon: LayoutGrid, end: true },
  { to: "/officer/alerts", key: "officerAlerts", icon: BellRing, end: false },
];

/**
 * The officer-facing shell: cooler palette, persistent navigation, denser
 * type. Deliberately reads as a working tool rather than a calm space.
 */
export default function OfficerLayout() {
  const { user, officerId, signOut } = useAuth();
  const { t } = useLang();
  const label = user?.user_metadata?.display_name || user?.email || shortId(officerId);

  return (
    <div className="theme-officer min-h-svh bg-canvas text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />
            <span className="font-semibold tracking-tight">{t("brand")}</span>
            <span className="text-xs text-faint border-l border-line pl-2 ml-1">
              Case support
            </span>
          </div>

          <nav className="flex items-center gap-1" aria-label="Main">
            {NAV.map(({ to, key, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  [
                    "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent-soft text-accent-strong"
                      : "text-muted hover:bg-raised hover:text-ink",
                  ].join(" ")
                }
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {t(key)}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <LanguageSwitch compact />
            <span className="hidden text-xs text-muted sm:inline">{label}</span>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              {t('signOut')}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
