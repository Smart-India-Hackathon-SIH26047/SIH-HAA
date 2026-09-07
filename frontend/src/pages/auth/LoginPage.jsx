import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ClipboardList, Heart, Loader2 } from "lucide-react";
import { ROLES, useAuth } from "@/auth/AuthProvider";
import { readableAuthError } from "@/lib/supabase";
import { LanguageSwitch, useLang } from "@/i18n/LanguageProvider";

/**
 * Entry screen.
 *
 * By default there are no credentials — you pick which side you're using and
 * continue. Email and password fields only appear when the app is configured
 * to require accounts (VITE_REQUIRE_LOGIN=true).
 */
export default function LoginPage() {
  const { signIn, signUp, chooseRole, requiresCredentials, continueAnonymously } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();

  const [role, setRole] = useState(ROLES.VICTIM);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [offerSignUp, setOfferSignUp] = useState(false);

  const go = (chosen) =>
    navigate(chosen === ROLES.OFFICER ? "/officer" : "/check-in", { replace: true });

  const finish = async (userId) => {
    await chooseRole(role, userId);
    go(role);
  };

  /**
   * One button. Try to sign in; if that email has no account, offer to create
   * one rather than guessing. Registering silently on a mistyped password
   * would hit Supabase's anti-enumeration behaviour, which returns a fake
   * success and leaves you unable to sign in with either password.
   */
  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setOfferSignUp(false);
    setBusy(true);

    try {
      if (!requiresCredentials) {
        await chooseRole(role);
        go(role);
        return;
      }

      const result = await signIn(email.trim(), password);
      await finish(result.userId);
    } catch (err) {
      const message = String(err?.message || "");
      if (/invalid login credentials/i.test(message)) {
        setOfferSignUp(true);
        setError(t("noAccountMatch"));
      } else {
        setError(readableAuthError(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const goAnonymous = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await continueAnonymously(lang);
      navigate("/check-in", { replace: true });
    } catch (err) {
      setError(err?.message ? `${t("anonFailed")} (${err.message})` : t("anonFailed"));
    } finally {
      setBusy(false);
    }
  };

  const createAccount = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const result = await signUp(email.trim(), password);
      if (result.needsConfirmation) {
        setNotice(
          "Account created, but this project still requires email confirmation. " +
            "Turn it off in Supabase (Authentication → Providers → Email), then sign in.",
        );
        setOfferSignUp(false);
        return;
      }
      await finish(result.userId);
    } catch (err) {
      setError(readableAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-svh flex-col bg-canvas text-ink">
      <div className="flex items-center justify-between px-5 pt-5 sm:px-8 lg:px-16">
        <Link to="/" className="inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {t("back")}
        </Link>
        <LanguageSwitch compact />
      </div>

      <div className="flex flex-1 items-center justify-center px-5 py-8">
        <div className="w-full max-w-[440px] rounded-[22px] border border-line-soft bg-surface p-8 shadow-lift">
          <h1 className="text-center font-head text-2xl">{t("loginTitle")}</h1>
          <p className="mb-6 mt-1.5 text-center text-sm text-muted">
            {t("loginSub")}
          </p>

          <form onSubmit={submit}>
            <div className="mb-6 grid gap-2.5">
              <RoleOption
                icon={Heart}
                title={t("roleVictim")}
                description={t("roleVictimDesc")}
                selected={role === ROLES.VICTIM}
                onSelect={() => setRole(ROLES.VICTIM)}
              />
              <RoleOption
                icon={ClipboardList}
                title={t("roleOfficer")}
                description={t("roleOfficerDesc")}
                selected={role === ROLES.OFFICER}
                onSelect={() => setRole(ROLES.OFFICER)}
              />
            </div>

            {requiresCredentials && (
              <>
                <Field
                  label={t("email")}
                  type="email"
                  required
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                  placeholder="you@example.com"
                />
                <Field
                  label={t("password")}
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                  placeholder="••••••"
                />
              </>
            )}

            {error && (
              <div className="mb-3 rounded-xl bg-band-elevated-soft px-3 py-2.5 text-sm text-band-elevated" role="alert">
                <p>{error}</p>
                {offerSignUp && (
                  <button
                    type="button"
                    onClick={createAccount}
                    disabled={busy}
                    className="mt-1.5 font-semibold underline underline-offset-2"
                  >
                    {t("createWithEmail")}
                  </button>
                )}
              </div>
            )}
            {notice && (
              <p className="mb-3 rounded-xl bg-accent-softer px-3 py-2 text-sm text-accent-strong" role="status">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-soft transition-colors hover:bg-accent-strong disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("continue")}
            </button>
          </form>

          <p className="mt-5 text-center text-[12.5px] text-faint">
            {requiresCredentials ? t("loginHintAccounts") : t("loginHintDemo")}
          </p>

          {/* Anonymous entry: no email, no password, no name. */}
          <div className="mt-6 border-t border-line-soft pt-5">
            <button
              type="button"
              onClick={goAnonymous}
              disabled={busy}
              className="w-full rounded-full border border-line px-5 py-3 text-sm font-semibold text-accent-strong transition-colors hover:border-accent/50 hover:bg-accent-softer disabled:opacity-60"
            >
              {busy ? t("anonCreating") : t("anonEntry")}
            </button>
            <p className="mt-2 text-center text-[12px] text-faint">{t("anonExplain")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoleOption({ icon: Icon, title, description, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        "flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-colors",
        selected
          ? "border-accent bg-accent-softer"
          : "border-line-soft bg-surface hover:border-accent/40",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          selected ? "bg-accent text-white" : "bg-raised text-accent-strong",
        ].join(" ")}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[14.5px] font-semibold">{title}</span>
        <span className="mt-0.5 block text-[13px] text-muted">{description}</span>
      </span>
    </button>
  );
}

function Field({ label, value, onChange, ...props }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[13px] font-semibold text-muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[10px] border border-line bg-canvas px-3.5 py-3 text-[15px] text-ink placeholder:text-faint focus:border-accent focus:bg-surface focus:outline-none"
        {...props}
      />
    </label>
  );
}
