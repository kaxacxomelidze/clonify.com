import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Boxes, CreditCard, Github, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ApiError, updateProfile } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/settings")({
  head: () => ({ meta: [{ title: "Settings — Clonyfy dashboard" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, refresh } = useAuth();
  const [active, setActive] = useState("General");
  const [saved, setSaved] = useState({
    name: user?.name || "",
    email: user?.email || "",
    notifications: true,
  });
  const [draft, setDraft] = useState(saved);
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let notifications = true;
    try {
      const value = JSON.parse(localStorage.getItem("clonyfy-profile-prefs") || "null");
      if (value && typeof value.notifications === "boolean") notifications = value.notifications;
    } catch {
      /* optional */
    }
    const next = { name: user.name, email: user.email, notifications };
    setSaved(next);
    setDraft(next);
  }, [user]);

  const sections = [
    { label: "General", icon: Boxes },
    { label: "Notifications", icon: Bell },
  ];
  return (
    <div className="dashboard-settings mx-auto max-w-6xl">
      <aside className="space-y-6">
        <div className="surface rounded-2xl p-4">
          <p className="text-sm">{saved.name}</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">{saved.email}</p>
        </div>
        <nav aria-label="Settings" className="space-y-1">
          {sections.map((section) => (
            <button
              key={section.label}
              onClick={() => setActive(section.label)}
              aria-pressed={active === section.label}
              className={`flex min-h-11 w-full items-center gap-3 rounded-full px-4 py-3 text-sm ${active === section.label ? "bg-accent" : "text-muted-foreground"}`}
            >
              <section.icon size={16} />
              {section.label}
            </button>
          ))}
        </nav>
        <nav aria-label="Workspace settings" className="space-y-1">
          <Link
            to="/dashboard/billing"
            className="flex min-h-11 items-center gap-3 rounded-full px-4 py-3 text-sm text-muted-foreground hover:bg-accent"
          >
            <CreditCard size={16} />
            Billing
          </Link>
          <Link
            to="/dashboard/team"
            className="flex min-h-11 items-center gap-3 rounded-full px-4 py-3 text-sm text-muted-foreground hover:bg-accent"
          >
            <Users size={16} />
            Members
          </Link>
          <Link
            to="/dashboard/integrations"
            className="flex min-h-11 items-center gap-3 rounded-full px-4 py-3 text-sm text-muted-foreground hover:bg-accent"
          >
            <Github size={16} />
            Integrations
          </Link>
        </nav>
      </aside>
      <section className="surface rounded-3xl p-5 md:p-8">
        <h1 className="font-display text-2xl">Account settings</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Update your profile on this account. Name and password sync to the Backend.
        </p>
        <form
          className="mt-8 space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void (async () => {
              setBusy(true);
              setNotice("");
              try {
                const body: { name?: string; password?: string } = {};
                if (draft.name.trim() && draft.name !== saved.name) body.name = draft.name.trim();
                if (password) {
                  if (password.length < 8) {
                    setNotice("Password must be at least 8 characters.");
                    setBusy(false);
                    return;
                  }
                  body.password = password;
                }
                if (body.name || body.password) {
                  await updateProfile(body);
                  await refresh();
                }
                try {
                  localStorage.setItem(
                    "clonyfy-profile-prefs",
                    JSON.stringify({ notifications: draft.notifications }),
                  );
                } catch {
                  /* ignore */
                }
                setSaved({ ...draft, email: saved.email });
                setPassword("");
                setNotice("Preferences saved.");
                toast.success("Settings saved.");
              } catch (err) {
                const message = err instanceof ApiError ? err.message : "Could not save settings.";
                setNotice(message);
                toast.error(message);
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          {active === "General" ? (
            <>
              <label className="block text-sm">
                Full name
                <input
                  required
                  maxLength={80}
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-border bg-background p-3"
                />
              </label>
              <label className="block text-sm">
                Email
                <input
                  required
                  type="email"
                  value={draft.email}
                  readOnly
                  className="mt-2 w-full rounded-xl border border-border bg-background p-3"
                />
              </label>
              <label className="block text-sm">
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Leave blank to keep current password"
                  className="mt-2 w-full rounded-xl border border-border bg-background p-3"
                />
              </label>
            </>
          ) : (
            <label className="flex items-start gap-4 rounded-2xl border border-border p-5">
              <input
                type="checkbox"
                checked={draft.notifications}
                onChange={(event) => setDraft({ ...draft, notifications: event.target.checked })}
                className="mt-1 h-4 w-4 accent-white"
              />
              <span>
                <span className="block text-sm">Capture completion updates</span>
                <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">
                  Preference is stored for this browser. Transactional emails still follow your
                  Backend SMTP configuration.
                </span>
              </span>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="dashboard-button bg-primary text-primary-foreground disabled:opacity-50"
            >
              Save changes
            </button>
            <button
              type="button"
              className="dashboard-button"
              onClick={() => {
                setDraft(saved);
                setPassword("");
                setNotice("Unsaved changes discarded.");
              }}
            >
              Cancel
            </button>
          </div>
          <p className="text-sm text-muted-foreground" role="status">
            {notice}
          </p>
        </form>
      </section>
    </div>
  );
}
