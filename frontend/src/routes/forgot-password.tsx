import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError, fetchPublicConfig, forgotPasswordRequest } from "@/lib/api";
import { Brand } from "@/components/site/brand";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password — Clonyfy" },
      { name: "description", content: "Request a password reset link for your Clonyfy account." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  // Until outgoing email is set up, a reset link can't arrive; say so instead of pretending.
  const [emailEnabled, setEmailEnabled] = useState(true);

  useEffect(() => {
    fetchPublicConfig()
      .then((config) => setEmailEnabled(config.email_enabled !== false))
      .catch(() => {});
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await forgotPasswordRequest(email.trim());
      setMessage("If that email is registered, a reset link is on its way.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send reset email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16">
      <Link to="/" className="mb-10 self-start">
        <Brand />
      </Link>
      <h1 className="font-display text-3xl tracking-tight">Reset your password</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Enter your account email and we will send you a link to choose a new password.
      </p>
      {!emailEnabled && (
        <div
          role="note"
          className="mt-6 rounded-2xl border border-border p-4 text-sm leading-relaxed"
        >
          <p className="font-medium">Reset emails are temporarily unavailable.</p>
          <p className="mt-2 text-muted-foreground">
            If your account email is a Google or GitHub address, log in with Google or GitHub using
            that same email. It opens your existing account. Then set a new password in Settings.
          </p>
          <Link
            to="/login"
            className="mt-3 inline-flex min-h-11 items-center rounded-full border border-border px-5 text-sm"
          >
            Log in with Google or GitHub
          </Link>
        </div>
      )}
      {emailEnabled && (
        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm">
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-xl border border-border bg-background p-3"
              autoComplete="email"
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {message ? (
            <p role="status" className="text-sm text-muted-foreground">
              {message}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
      <p className="mt-6 text-sm text-muted-foreground">
        <Link to="/login" className="underline underline-offset-4">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
