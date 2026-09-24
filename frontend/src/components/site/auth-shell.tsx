import { useSiteLanguage } from "@/hooks/use-site-language";
import { useAuth } from "@/hooks/use-auth";
import { ApiError, ensureApiAwake, googleAuthUrl } from "@/lib/api";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  AtSign,
  LockKeyhole,
  UserRound,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";
import { Brand, BrandMark } from "./brand";
import { LanguageSwitcher } from "./language-switcher";
import { AuthArt } from "./auth-art";

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
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const oauthError = params.get("oauth_error");
      if (oauthError) {
        setError(oauthErrorMessage(oauthError, params.get("ban_reason"), tr));
        params.delete("oauth_error");
        params.delete("ban_reason");
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
    setBusy(true);
    setError("");
    try {
      await ensureApiAwake({ attempts: 10, timeoutMs: 15_000 }).catch(() => {});
      const attempt = async () => {
        if (mode === "login") await login(email, password);
        else await register(name, email, password);
      };
      try {
        await attempt();
      } catch (first) {
        const retryable =
          (first instanceof ApiError && (first.status === 502 || first.status === 503 || first.status === 504)) ||
          (!(first instanceof ApiError) &&
            (first instanceof TypeError ||
              (first instanceof Error && /Failed to fetch|NetworkError|abort|waking/i.test(first.message))));
        if (!retryable) throw first;
        await ensureApiAwake({ attempts: 8, timeoutMs: 15_000, force: true }).catch(() => {});
        await new Promise((r) => setTimeout(r, 2000));
        await attempt();
      }
      await navigate({ to: "/dashboard" });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof TypeError || (err instanceof Error && /Failed to fetch|NetworkError|abort/i.test(err.message))
            ? tr("Cannot reach the API. The Backend may be waking up (Render free tier) — wait ~30–90s and try again. Prefer https://www.clonyfy.com.")
            : mode === "login"
              ? tr("Could not log in. Check your email and password.")
              : tr("Could not create your account. Please try again.");
      setError(message);
    } finally {
      setBusy(false);
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
          <p className="auth-subtitle">{subtitle}</p>
          <div className="auth-socials">
            <SocialButton
              label="Google"
              icon={<GoogleMark />}
              onClick={() => {
                window.location.href = googleAuthUrl();
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

function oauthErrorMessage(
  code: string,
  banReason: string | null,
  tr: (text: string) => string,
): string {
  switch (code) {
    case "cancelled":
      return tr("Google sign-in was cancelled.");
    case "not_configured":
      return tr("Google sign-in is not available yet. Please use email and password.");
    case "email_unverified":
      return tr("Your Google account email is not verified.");
    case "invalid_state":
      return tr("Google sign-in expired. Please try again.");
    case "blocked":
      return banReason
        ? `${tr("This account has been blocked.")} ${banReason}`
        : tr("This account has been blocked.");
    case "server_error":
      return tr("Google sign-in failed. Please try again.");
    default:
      return code;
  }
}
