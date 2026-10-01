import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { ApiError, fetchAffiliate, saveAffiliateUsername, type AffiliateInfo } from "@/lib/api";
import {
  AffiliateFaq,
  AffiliateSteps,
  commissionLabel,
  WHOP_SIGNUP_URL,
} from "@/components/site/affiliate-program";

export const Route = createFileRoute("/dashboard/affiliates")({
  head: () => ({ meta: [{ title: "Affiliates — Clonyfy dashboard" }] }),
  component: AffiliatesPage,
});

const SHARE_TARGETS = [
  { label: "Homepage", path: "/" },
  { label: "Pricing", path: "/#pricing" },
  { label: "Sign-up page", path: "/register" },
];

function withCode(link: string, path: string) {
  const url = new URL(link);
  const target = new URL(path, url.origin);
  target.searchParams.set("a", url.searchParams.get("a") || "");
  return target.toString();
}

function AffiliatesPage() {
  const [info, setInfo] = useState<AffiliateInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [username, setUsername] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    fetchAffiliate()
      .then((data) => {
        setInfo(data);
        setUsername(data.username);
      })
      .catch((err) =>
        setLoadError(err instanceof ApiError ? err.message : "Could not load your affiliate link."),
      );
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const value = username.trim();
    if (!value) {
      setFormError("Enter your Whop username.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const data = await saveAffiliateUsername(value);
      setInfo(data);
      setUsername(data.username);
      setEditing(false);
      toast.success(`Linked to Whop as @${data.username}`);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not save your Whop username.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      const data = await saveAffiliateUsername("");
      setInfo(data);
      setUsername("");
      setEditing(false);
      toast.success("Affiliate link removed");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not remove the link.");
    } finally {
      setSaving(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      toast.success("Link copied");
      window.setTimeout(() => setCopied((current) => (current === text ? "" : current)), 2000);
    } catch {
      toast.error("Copy failed. Select the link and copy it manually.");
    }
  };

  const linked = !!info?.username && !editing;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="eyebrow">Partner program</p>
        <h1 className="display-lg mt-3">Earn with Clonyfy</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Share Clonyfy and earn {commissionLabel(info?.commission)} on the paid plans your
          referrals buy. Referrals and payouts run through Whop.
        </p>
      </header>

      {loadError && (
        <p role="alert" className="rounded-2xl border border-border p-4 text-sm text-destructive">
          {loadError}
        </p>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <section className="surface rounded-3xl p-6" aria-labelledby="whop-account">
          <h2 id="whop-account" className="font-display text-xl">
            Your Whop account
          </h2>
          {linked ? (
            <>
              <p className="mt-3 flex items-center gap-2 text-sm">
                <Check size={16} aria-hidden="true" />
                Linked as <strong>@{info?.username}</strong>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Commissions for your referrals go to this Whop account.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" className="dashboard-button" onClick={() => setEditing(true)}>
                  Change username
                </button>
                <button
                  type="button"
                  className="dashboard-button disabled:opacity-50"
                  disabled={saving}
                  onClick={() => void remove()}
                >
                  Remove
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={(e) => void save(e)} noValidate>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Enter the username from your Whop profile. We check it with Whop before saving.
              </p>
              <label className="mt-5 block text-sm" htmlFor="whop-username">
                Whop username
              </label>
              <div className="mt-2 flex items-center rounded-xl border border-border bg-background focus-within:ring-2 focus-within:ring-ring">
                <span className="pl-3 text-sm text-muted-foreground">@</span>
                <input
                  id="whop-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your-username"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  aria-invalid={!!formError}
                  aria-describedby={formError ? "whop-username-error" : undefined}
                  className="w-full bg-transparent p-3 pl-1 outline-none"
                />
              </div>
              {formError && (
                <p id="whop-username-error" role="alert" className="mt-2 text-sm text-destructive">
                  {formError}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="dashboard-button bg-primary text-primary-foreground disabled:opacity-50"
                  disabled={saving || !info}
                >
                  {saving ? "Checking with Whop…" : "Save and get my link"}
                </button>
                {editing && (
                  <button
                    type="button"
                    className="dashboard-button"
                    onClick={() => {
                      setEditing(false);
                      setUsername(info?.username || "");
                      setFormError("");
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                No Whop account?{" "}
                <a
                  href={WHOP_SIGNUP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Create one free on Whop
                </a>
                .
              </p>
            </form>
          )}
        </section>

        <section className="surface rounded-3xl p-6" aria-labelledby="your-link">
          <h2 id="your-link" className="font-display text-xl">
            Your link
          </h2>
          {info?.link ? (
            <>
              <div className="mt-4 flex gap-2">
                <input
                  readOnly
                  value={info.link}
                  aria-label="Your affiliate link"
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full min-w-0 rounded-xl border border-border bg-background p-3 text-sm"
                />
                <button
                  type="button"
                  className="dashboard-button shrink-0 bg-primary text-primary-foreground"
                  onClick={() => void copy(info.link)}
                >
                  {copied === info.link ? <Check size={16} /> : <Copy size={16} />}
                  <span className="ml-2">{copied === info.link ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <p className="mt-5 text-xs uppercase tracking-widest text-muted-foreground">
                Link to a specific page
              </p>
              <ul className="mt-3 space-y-2">
                {SHARE_TARGETS.map((target) => {
                  const url = withCode(info.link, target.path);
                  return (
                    <li
                      key={target.path}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block">{target.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{url}</span>
                      </span>
                      <button
                        type="button"
                        className="dashboard-button shrink-0"
                        aria-label={`Copy ${target.label} link`}
                        onClick={() => void copy(url)}
                      >
                        {copied === url ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <a
                href={info.whopUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                See referrals and earnings on Whop <ExternalLink size={14} aria-hidden="true" />
              </a>
            </>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Save your Whop username and your personal link appears here, ready to copy.
            </p>
          )}
        </section>
      </div>

      <section aria-labelledby="how-it-works" className="space-y-4">
        <h2 id="how-it-works" className="font-display text-xl">
          How it works
        </h2>
        <AffiliateSteps commission={info?.commission} />
      </section>

      <section aria-labelledby="affiliate-faq" className="space-y-4">
        <h2 id="affiliate-faq" className="font-display text-xl">
          Questions
        </h2>
        <AffiliateFaq />
      </section>
    </div>
  );
}
