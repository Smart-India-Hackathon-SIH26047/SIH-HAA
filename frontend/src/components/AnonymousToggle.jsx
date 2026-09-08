import { useState } from "react";
import { Loader2, Shield, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";

/**
 * Switches this conversation between the person's own case and an unlinked
 * anonymous one.
 *
 * The explanation panel is deliberately specific about the boundary. It would
 * be easy — and wrong — to imply that nothing is recorded. Check-ins made in
 * this mode are still stored and still scored; what changes is that they are
 * attached to a separate case code, so they never appear in the person's own
 * history and no officer looking at that case can see them.
 */
export default function AnonymousToggle({ compact = false }) {
  const { anonymousMode, switchingAnonymous, toggleAnonymousMode } = useAuth();
  const { t, lang } = useLang();
  const [explaining, setExplaining] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        role="switch"
        aria-checked={anonymousMode}
        disabled={switchingAnonymous}
        onClick={async () => {
          const nowOn = await toggleAnonymousMode(lang);
          if (nowOn) setExplaining(true);
        }}
        className={[
          "inline-flex min-h-[38px] items-center gap-2 rounded-full border px-3.5 font-semibold transition-colors disabled:opacity-60",
          compact ? "text-xs" : "text-[13px]",
          anonymousMode
            ? "border-accent-soft bg-accent-soft text-accent-strong"
            : "border-line bg-surface text-muted hover:bg-raised",
        ].join(" ")}
      >
        {switchingAnonymous ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : anonymousMode ? (
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Shield className="h-4 w-4" aria-hidden="true" />
        )}
        {anonymousMode ? t("anonModeOn") : t("anonModeOff")}
      </button>

      {anonymousMode && !explaining && (
        <button
          type="button"
          onClick={() => setExplaining(true)}
          className="ml-1 text-[11px] text-muted underline underline-offset-2"
        >
          {t("anonWhatThisMeans")}
        </button>
      )}

      {explaining && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[min(20rem,80vw)] rounded-2xl border border-line bg-surface p-4 shadow-panel">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[13px] font-semibold text-ink">{t("anonExplainTitle")}</p>
            <button
              type="button"
              onClick={() => setExplaining(false)}
              aria-label={t("close")}
              className="-mr-1 -mt-1 rounded-full p-1 text-muted hover:bg-raised hover:text-ink"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <ul className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-muted">
            <li>• {t("anonExplainHidden")}</li>
            <li>• {t("anonExplainStored")}</li>
            <li>• {t("anonExplainNotRetro")}</li>
          </ul>
        </div>
      )}
    </div>
  );
}
