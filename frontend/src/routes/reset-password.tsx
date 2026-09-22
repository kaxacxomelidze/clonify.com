import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { ApiError, resetPasswordRequest } from "@/lib/api";
import { Brand } from "@/components/site/brand";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Choose a new password — Clonyfy" },
      { name: "description", content: "Set a new password for your Clonyfy account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token: searchToken } = Route.useSearch();
  const navigate = useNavigate();
  const token = useMemo(() => {
    if (searchToken) return searchToken;
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") || "";
  }, [searchToken]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!token) {
      setError("Reset link is missing or incomplete.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await resetPasswordRequest(token, password);
      await navigate({ to: "/login" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16">
      <Link to="/" className="mb-10 self-start">
        <Brand />
      </Link>
      <h1 className="font-display text-3xl tracking-tight">Choose a new password</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Use at least 8 characters. You will be signed out of other sessions after resetting.
      </p>
      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm">
          New password
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-xl border border-border bg-background p-3"
            autoComplete="new-password"
            minLength={8}
          />
        </label>
        <label className="block text-sm">
          Confirm password
          <input
            required
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-2 w-full rounded-xl border border-border bg-background p-3"
            autoComplete="new-password"
            minLength={8}
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy || !token}
          className="w-full rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Saving…" : "Update password"}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        <Link to="/login" className="underline underline-offset-4">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
