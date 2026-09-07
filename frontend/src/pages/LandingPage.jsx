import { Link, useNavigate } from "react-router-dom";
import Orb, { BrandMark } from "@/components/Orb";
import { LanguageSwitch, useLang } from "@/i18n/LanguageProvider";

/**
 * Public landing page.
 *
 * Deliberately says nothing about privacy guarantees or voice input here —
 * the start page sets a tone, and promises about confidentiality belong where
 * they can be acted on, not in marketing copy.
 */
export default function LandingPage() {
  const navigate = useNavigate();
  const { t } = useLang();

  return (
    <div className="min-h-svh bg-canvas text-ink">
      <header className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 sm:px-8 lg:px-16">
        <Link to="/" className="flex items-center gap-2.5 font-head text-[22px] text-accent-strong">
          <BrandMark />
          {t("brand")}
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {[
            ["#how", "navHow"],
            ["#about", "navAbout"],
            ["#support", "navSupport"],
          ].map(([href, key]) => (
            <a key={href} href={href} className="text-sm font-medium text-muted hover:text-ink">
              {t(key)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSwitch compact />
          <Link
            to="/login"
            className="inline-flex min-h-[44px] items-center rounded-full border border-line px-5 text-sm font-semibold text-accent-strong transition-colors hover:border-accent-soft hover:bg-accent-softer"
          >
            {t("signIn")}
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1240px] items-center gap-10 px-5 pb-10 pt-10 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-16 lg:pt-[90px]">
        <div className="order-2 lg:order-1">
          <p className="mb-3.5 text-sm font-semibold text-accent">{t("heroEyebrow")}</p>
          <h1 className="font-head text-[clamp(34px,5vw,54px)] leading-[1.08]">
            {t("heroLine1")}
            <br />
            {t("heroLine2")}
          </h1>
          <p className="mb-7 mt-5 max-w-[46ch] text-[17px] text-muted">
            {t("heroSub")}
          </p>
          <div className="flex flex-col gap-3.5 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-soft transition-colors hover:bg-accent-strong"
            >
              {t("ctaStart")}
            </button>
            <a
              href="#how"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-line px-6 py-3 font-semibold text-accent-strong transition-colors hover:border-accent-soft hover:bg-accent-softer"
            >
              {t("ctaLearn")}
            </a>
          </div>
        </div>

        <div className="order-1 flex h-[220px] items-center justify-center lg:order-2 lg:h-[340px]">
          <Orb state="idle" size={200} />
        </div>
      </section>

      <section id="how" className="mx-auto max-w-[1240px] px-5 py-[70px] sm:px-8 lg:px-16">
        <div className="mx-auto mb-10 max-w-[640px] text-center">
          <h2 className="font-head text-[clamp(26px,3.6vw,36px)]">
            {t("howTitle")}
          </h2>
          <p className="mt-3 text-[15.5px] text-muted">
            {t("howSub")}
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {[
            ["01", "how1h", "how1p"],
            ["02", "how2h", "how2p"],
            ["03", "how3h", "how3p"],
          ].map(([num, titleKey, bodyKey]) => (
            <article key={num} className="rounded-[22px] border border-line-soft bg-surface p-6">
              <div className="mb-3.5 font-head text-[26px] text-accent">{num}</div>
              <h3 className="mb-2 text-[17px] font-semibold">{t(titleKey)}</h3>
              <p className="text-[14.5px] text-muted">{t(bodyKey)}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="about" className="bg-canvas-deep">
        <div className="mx-auto max-w-[1240px] px-5 py-[70px] sm:px-8 lg:px-16">
          <div className="grid gap-5 text-center sm:grid-cols-2 lg:grid-cols-4">
            {[
              [ClockIcon, "trust1h", "trust1p"],
              [UsersIcon, "trust2h", "trust2p"],
              [HeartIcon, "trust3h", "trust3p"],
              [ChartIcon, "trust4h", "trust4p"],
            ].map(([Icon, titleKey, bodyKey]) => (
              <div key={titleKey} className="p-2.5">
                <Icon />
                <h4 className="mb-1.5 text-[14.5px] font-semibold">{t(titleKey)}</h4>
                <p className="text-[13px] text-muted">{t(bodyKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer id="support" className="px-5 py-9 text-center text-[13px] text-faint sm:px-8 lg:px-16">
        {t("footer")}
      </footer>
    </div>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  className: "mx-auto mb-2.5 h-[26px] w-[26px] text-accent",
  "aria-hidden": true,
};

const ClockIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);
const UsersIcon = () => (
  <svg {...iconProps}>
    <path d="M4 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
    <circle cx="10" cy="7" r="3.2" />
    <path d="M17 8a3 3 0 100-6" />
  </svg>
);
const HeartIcon = () => (
  <svg {...iconProps}>
    <path d="M12 21c-4-3-8-6.5-8-11a5 5 0 019-3 5 5 0 019 3c0 4.5-4 8-8 11z" />
  </svg>
);
const ChartIcon = () => (
  <svg {...iconProps}>
    <path d="M3 17l5-5 4 4 8-9" />
  </svg>
);
