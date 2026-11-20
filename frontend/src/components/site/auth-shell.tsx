import { useSiteLanguage } from "@/hooks/use-site-language";
import { useAuth } from "@/hooks/use-auth";
import {
  ApiError,
  ensureApiAwake,
  fetchCaptchaConfig,
  githubAuthUrl,
  googleAuthUrl,
  loginResendRequest,
  resendCodeRequest,
  track,
} from "@/lib/api";
import { postAuthDestination, rememberPendingPlan } from "@/lib/pending-plan";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, AtSign, LockKeyhole, UserRound, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Brand, BrandMark } from "./brand";
import { LanguageSwitcher } from "./language-switcher";
import { AuthArt } from "./auth-art";
import { Turnstile } from "./turnstile";

export function AuthShell({
  title,
  subtitle,
  submitLabel,
  mode,
  footer,
}: {
  title: string;
  subtitle: string;
  submitLabel: string;
  mode: "login" | "register";
  footer: ReactNode;
}) {
  const { t: tr, language } = useSiteLanguage();
  const { login, verifyLogin, register, verifyCode, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [captchaSitekey, setCaptchaSitekey] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [codeEmail, setCodeEmail] = useState("");
  const [code, setCode] = useState("");
  const [resendNote, setResendNote] = useState("");
  // Login with a correct password → a code is emailed; this is that attempt's id.
  const [loginChallenge, setLoginChallenge] = useState("");
  const [resendIn, setResendIn] = useState(0);
  // Turnstile tokens are single-use: a failed attempt needs a fresh widget.
  const [captchaKey, setCaptchaKey] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  function resetCaptcha() {
    if (!captchaSitekey) return;
    setCaptchaToken("");
    setCaptchaKey((k) => k + 1);
  }

  function goPostAuth() {
    const dest = postAuthDestination();
    const toOnboarding = mode === "register" && (dest as { to: string }).to === "/dashboard";
    return navigate((toOnboarding ? { to: "/start" } : dest) as never);
  }

  // Turnstile is on only when the backend reports a sitekey; otherwise the form works as before.
  useEffect(() => {
    let active = true;
    void fetchCaptchaConfig()
      .then((c) => {
        if (active && c?.sitekey) setCaptchaSitekey(c.sitekey);
      })
      .catch(() => {
        /* no captcha configured / unreachable: leave the form open */
      });
    return () => {
      active = false;
    };
  }, []);

  // Already signed in (e.g. clicked "Log in" or "Get started" from the landing page):
  // skip the form instead of making the user log in again.
  useEffect(() => {
    if (isAuthenticated && !busy)
      void navigate({ ...postAuthDestination(), replace: true } as never);
  }, [isAuthenticated, busy, navigate]);

  useEffect(() => {
    rememberPendingPlan();
    if (mode === "register") track("signup_view");
  }, [mode]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const oauthError = params.get("oauth_error");
      if (oauthError) {
        setError(
          oauthErrorMessage(oauthError, params.get("ban_reason"), params.get("provider"), tr),
        );
        params.delete("oauth_error");
        params.delete("ban_reason");
        params.delete("provider");
        const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
        window.history.replaceState({}, "", next);
      }
    } catch {
      /* ignore */
    }
  }, [tr]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const name = String(form.get("name") || "").trim();
    if (captchaSitekey && !captchaToken) {
      setError(tr("Please complete the human verification and try again."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await ensureApiAwake({ attempts: 10, timeoutMs: 15_000 }).catch(() => {});
      let needsCode = false;
      const attempt = async () => {
        if (mode === "login") {
          const result = await login(email, password, captchaToken);
          needsCode = !!result.needsCode;
          if (needsCode) {
            setLoginChallenge(result.challenge || "");
            setCodeEmail(result.email || email);
            setCode("");
            setResendIn(60);
          }
        } else {
          const result = await register(name, email, password, captchaToken);
          needsCode = !!result.needsCode;
          if (needsCode) {
            setCodeEmail(result.email || email);
            setResendIn(60);
          }
        }
      };
      try {
        await attempt();
      } catch (first) {
        const retryable =
          (first instanceof ApiError &&
            (first.status === 502 || first.status === 503 || first.status === 504)) ||
          (!(first instanceof ApiError) &&
            (first instanceof TypeError ||
              (first instanceof Error &&
                /Failed to fetch|NetworkError|abort|waking/i.test(first.message))));
        if (!retryable) throw first;
        await ensureApiAwake({ attempts: 8, timeoutMs: 15_000, force: true }).catch(() => {});
        await new Promise((r) => setTimeout(r, 2000));
        await attempt();
      }
      // Email code step (sign-up confirmation or login anti-bot check) before the session.
      if (needsCode) {
        setBusy(false);
        return;
      }
      await goPostAuth();
    } catch (err) {
      resetCaptcha();
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof TypeError ||
              (err instanceof Error && /Failed to fetch|NetworkError|abort/i.test(err.message))
            ? tr("Cannot reach the server. Check your connection and try again.")
            : mode === "login"
              ? tr("Could not log in. Check your email and password.")
              : tr("Could not create your account. Please try again.");
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      if (loginChallenge) {
        await verifyLogin(loginChallenge, code.trim());
      } else {
        await verifyCode(codeEmail, code.trim());
      }
      await goPostAuth();
    } catch (err) {
      const expired =
        err instanceof ApiError &&
        !!(err.data as { expired?: boolean } | undefined)?.expired &&
        !!loginChallenge;
      if (expired) {
        // This login attempt is over (too many tries or timed out): back to the form.
        setLoginChallenge("");
        setCodeEmail("");
        setCode("");
        resetCaptcha();
      }
      setError(
        err instanceof ApiError ? err.message : tr("That code is wrong or expired. Request a new one."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    if (resendIn > 0) return;
    setResendNote("");
    try {
      if (loginChallenge) await loginResendRequest(loginChallenge);
      else await resendCodeRequest(codeEmail);
      setResendIn(60);
      setResendNote(tr("A new code is on its way."));
    } catch (err) {
      const data = err instanceof ApiError ? (err.data as { retryAfter?: number } | null) : null;
      const retryAfter = Number(data?.retryAfter || 0);
      if (retryAfter > 0) setResendIn(retryAfter);
      setResendNote(
        err instanceof ApiError ? err.message : tr("Couldn't resend right now. Try again shortly."),
      );
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-atmosphere" aria-hidden="true" />
      <header className="auth-topbar">
        <Link to={language === "fr" ? "/fr" : "/"} aria-label={tr("Clonyfy home")}>
          <Brand />
        </Link>
        <div className="auth-topbar-actions">
          <Link
            to={language === "fr" ? "/fr" : "/"}
            className="auth-back"
            aria-label={tr("Back to site")}
          >
            <ArrowLeft aria-hidden="true" /> <span>{tr("Back to site")}</span>
          </Link>
          <LanguageSwitcher />
        </div>
      </header>
      <main className="auth-layout">
        <section className="auth-story" aria-label={tr("A better starting point")}>
          <AuthArt />
          <div className="auth-story-copy">
            <span className="auth-story-kicker">
              <span /> {tr("A better starting point")}
            </span>
            <h2>
              {tr("Good ideas deserve")}
              <br />
              <span>{tr("a head start.")}</span>
            </h2>
            <p>{tr("A spark of inspiration. A space to make it yours.")}</p>
          </div>
        </section>
        <section className="auth-form-panel" aria-labelledby="auth-title">
          <div className="auth-panel-intro">
            <span className="auth-panel-symbol">
              <BrandMark />
            </span>
            <span>{tr("Your creative space")}</span>
            <span className="auth-panel-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </div>
          <h1 id="auth-title">{title}</h1>
          {codeEmail ? (
            <form className="auth-form" onSubmit={onVerifyCode}>
              <p className="auth-subtitle">
                {tr("We sent a 6-digit code to")} <strong>{codeEmail}</strong>.{" "}
                {loginChallenge
                  ? tr("Enter it to log in. It keeps bots out of your account.")
                  : tr("Enter it to finish creating your account.")}
              </p>
              <div className="auth-field">
                <label htmlFor="auth-code">{tr("Verification code")}</label>
                <div className="auth-input-wrap">
                  <input
                    id="auth-code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="------"
                    autoFocus
                    required
                  />
                </div>
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              {resendNote ? (
                <p className="text-xs text-muted-foreground">{resendNote}</p>
              ) : null}
              <button
                type="submit"
                className="auth-submit"
                disabled={busy || code.length < 6}
              >
                <span>{busy ? tr("Please wait…") : tr("Verify & continue")}</span>
                <ArrowRight aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onResend}
                disabled={resendIn > 0}
                className="mt-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:no-underline disabled:opacity-60"
              >
                {resendIn > 0 ? `${tr("Resend code")} (${resendIn}s)` : tr("Resend code")}
              </button>
              {loginChallenge ? (
                <button
                  type="button"
                  onClick={() => {
                    setLoginChallenge("");
                    setCodeEmail("");
                    setCode("");
                    setError("");
                    setResendNote("");
                    resetCaptcha();
                  }}
                  className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  {tr("Use a different account")}
                </button>
              ) : null}
            </form>
          ) : (
            <>
          <p className="auth-subtitle">{subtitle}</p>
          <div className="auth-socials">
            <SocialButton
              label="Google"
              icon={<GoogleMark />}
              onClick={() => {
                window.location.href = googleAuthUrl();
              }}
            />
            <SocialButton
              label="GitHub"
              icon={<GitHubMark />}
              onClick={() => {
                window.location.href = githubAuthUrl();
              }}
            />
          </div>
          <div className="auth-divider">
            <span />
            {tr("or continue with email")}
            <span />
          </div>
          <form className="auth-form" onSubmit={onSubmit}>
            {mode === "register" && (
              <Field
                name="name"
                label={tr("Full name")}
                placeholder={tr("Your name")}
                icon={<UserRound />}
                type="text"
                autoComplete="name"
              />
            )}
            <Field
              name="email"
              label={tr("Email address")}
              placeholder={tr("you@example.com")}
              icon={<AtSign />}
              type="email"
              autoComplete={mode === "login" ? "username" : "email"}
            />
            <Field
              name="password"
              label={tr("Password")}
              placeholder="••••••••"
              icon={<LockKeyhole />}
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            {mode === "login" ? (
              <p className="text-right text-xs text-muted-foreground">
                <Link to="/forgot-password" className="underline underline-offset-4">
                  {tr("Forgot password?")}
                </Link>
              </p>
            ) : null}
            {captchaSitekey ? (
              <Turnstile key={captchaKey} sitekey={captchaSitekey} onToken={setCaptchaToken} />
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <button type="submit" className="auth-submit" disabled={busy}>
              <span>{busy ? tr("Please wait…") : submitLabel}</span>
              <ArrowRight aria-hidden="true" />
            </button>
          </form>
            </>
          )}
          <p className="auth-account-link">{footer}</p>
        </section>
      </main>
      <footer className="auth-page-footer">
        <span>© {new Date().getFullYear()} Clonyfy</span>
        <span>{tr("Make something that’s yours.")}</span>
      </footer>
    </div>
  );
}

function Field({
  icon,
  label,
  placeholder,
  type,
  name,
  autoComplete,
}: {
  icon: ReactNode;
  label: string;
  placeholder: string;
  type: "email" | "password" | "text";
  name: string;
  autoComplete: string;
}) {
  const { t: tr } = useSiteLanguage();
  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-field">
      <label htmlFor={`auth-${name}`}>{label}</label>
      <div className="auth-input-wrap">
        <span className="auth-field-icon" aria-hidden="true">
          {icon}
        </span>
        <input
          id={`auth-${name}`}
          name={name}
          type={type === "password" && visible ? "text" : type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
        />
        {type === "password" && (
          <button
            type="button"
            className="auth-password-toggle"
            aria-label={tr(visible ? "Hide password" : "Show password")}
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        )}
      </div>
    </div>
  );
}

function SocialButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="auth-provider" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.8 12.2c0-.7-.1-1.4-.2-2.1H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.4Z" />
      <path d="M12 22c2.7 0 5-.9 6.8-2.4L15.5 17c-.9.6-2 1-3.5 1a6 6 0 0 1-5.6-4.1H3v2.7A10 10 0 0 0 12 22Z" />
      <path d="M6.4 13.9a6 6 0 0 1 0-3.8V7.4H3a10 10 0 0 0 0 9.2l3.4-2.7Z" />
      <path d="M12 6c1.6 0 2.9.6 4 1.6l3-3A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9 5.4l3.4 2.7A6 6 0 0 1 12 6Z" />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.48 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.57 2.34 1.12 2.91.86.09-.66.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.73 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85.01 1.71.12 2.51.34 1.9-1.32 2.74-1.05 2.74-1.05.55 1.42.2 2.47.1 2.73.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.38-.01 2.49-.01 2.83 0 .26.18.58.69.48A10.03 10.03 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

function oauthErrorMessage(
  code: string,
  banReason: string | null,
  provider: string | null,
  tr: (text: string) => string,
): string {
  const isGithub = provider === "github";
  switch (code) {
    case "cancelled":
      return isGithub ? tr("GitHub sign-in was cancelled.") : tr("Google sign-in was cancelled.");
    case "not_configured":
      return isGithub
        ? tr("GitHub sign-in is not available yet. Please use email and password.")
        : tr("Google sign-in is not available yet. Please use email and password.");
    case "email_unverified":
      return isGithub
        ? tr("Your GitHub account email is not verified.")
        : tr("Your Google account email is not verified.");
    case "email_missing":
      return tr(
        "Your GitHub account has no public email. Add a verified email on GitHub, then try again.",
      );
    case "invalid_state":
      return isGithub
        ? tr("GitHub sign-in expired. Please try again.")
        : tr("Google sign-in expired. Please try again.");
    case "blocked":
      return banReason
        ? `${tr("This account has been blocked.")} ${banReason}`
        : tr("This account has been blocked.");
    case "server_error":
      return isGithub
        ? tr("GitHub sign-in failed. Please try again.")
        : tr("Google sign-in failed. Please try again.");
    default:
      return code;
  }
}
