import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Activity, LifeBuoy, LogOut, Menu, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/Orb";
import { useAuth } from "@/auth/AuthProvider";
import { LanguageSwitch, useLang } from "@/i18n/LanguageProvider";
import AnonymousToggle from "@/components/AnonymousToggle";

const NAV = [
  { to: "/check-in", key: "navCheckin", icon: Sparkles, end: true },
  { to: "/status", key: "navStatus", icon: Activity, end: false },
  { to: "/support", key: "navSupport", icon: LifeBuoy, end: false },
];

/**
 * The beneficiary shell: a light topbar and an off-canvas drawer.
 *
 * Chrome stays minimal on purpose — the check-in screen is the point, and
 * navigation should not compete with it.
 */
export default function VictimLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { signOut } = useAuth();
  const { t } = useLang();
  const close = () => setDrawerOpen(false);

  return (
    <div className="flex min-h-svh flex-col bg-canvas text-ink">
      <a href="#main" className="sr-only-focusable absolute left-4 top-4 z-50 rounded-full bg-accent px-4 py-2 text-white">
        Skip to content
      </a>

      <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-line-soft bg-surface px-4 py-3">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-muted hover:bg-raised hover:text-ink"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="flex items-center gap-2 font-head text-[16.5px] text-accent-strong">
          <BrandMark size={20} />
          {t("brand")}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <AnonymousToggle compact />
          <LanguageSwitch compact />
        </div>
      </header>

      {drawerOpen && (
        <div
          className="fixed inset-0 z-[55] bg-ink/35"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <nav
        aria-label="Saathi menu"
        className={[
          "fixed inset-y-0 left-0 z-[60] flex w-[250px] flex-col bg-surface p-4 transition-transform duration-[250ms]",
          drawerOpen ? "translate-x-0 shadow-panel" : "-translate-x-full",
        ].join(" ")}
        style={{ transitionTimingFunction: "var(--ease-calm)" }}
      >
        <span className="flex items-center gap-2.5 px-2.5 pb-6 pt-1.5 font-head text-lg text-accent-strong">
          <BrandMark size={22} />
          {t("brand")}
        </span>

        <ul className="flex flex-1 list-none flex-col gap-0.5 p-0">
          {NAV.map(({ to, key, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={close}
                className={({ isActive }) =>
                  [
                    "flex min-h-[44px] w-full items-center gap-3 rounded-[11px] px-3.5 py-3 text-[14.5px] transition-colors",
                    isActive
                      ? "bg-accent-soft font-semibold text-accent-strong"
                      : "font-medium text-muted hover:bg-raised hover:text-ink",
                  ].join(" ")
                }
              >
                <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                {t(key)}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="mt-3 border-t border-line-soft pt-3">
          <button
            type="button"
            onClick={signOut}
            className="flex min-h-[44px] w-full items-center gap-3 rounded-[11px] px-3.5 py-3 text-[14.5px] font-medium text-muted hover:bg-raised hover:text-ink"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {t('signOut')}
          </button>
        </div>
      </nav>

      <main id="main" className="mx-auto flex w-full max-w-[640px] flex-1 flex-col px-5 py-5 sm:px-8 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}
