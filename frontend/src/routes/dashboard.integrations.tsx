import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Figma, Github, MessageSquare, NotebookPen } from "lucide-react";
import { ApiError, connectGitHub } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/integrations")({
  head: () => ({ meta: [{ title: "Integrations — Clonyfy dashboard" }] }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const [githubLogin, setGithubLogin] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [repos, setRepos] = useState<Array<{ fullName: string; htmlUrl: string }>>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("clonyfy-github-login");
      if (saved) setGithubLogin(saved);
    } catch {
      /* optional */
    }
  }, []);

  const connect = async () => {
    if (!token.trim()) {
      toast.error("Paste a GitHub personal access token with repo scope.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const data = await connectGitHub(token.trim());
      setGithubLogin(data.user.login);
      setRepos(data.repos.slice(0, 8).map((r) => ({ fullName: r.fullName, htmlUrl: r.htmlUrl })));
      try {
        localStorage.setItem("clonyfy-github-login", data.user.login);
      } catch {
        /* ignore */
      }
      setNotice(`Connected as @${data.user.login}. ${data.repos.length} pushable repos found.`);
      toast.success(`GitHub connected as @${data.user.login}`);
      setToken("");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not connect GitHub.";
      setNotice(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const comingSoon = (name: string) => {
    toast.message(`${name} is not available yet`, {
      description: "We'll notify you when this integration ships. No connection was attempted.",
    });
    setNotice(`${name} is on the roadmap. Nothing was connected.`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="eyebrow">Fits into your workflow</p>
        <h1 className="display-lg mt-3">Integrations</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Connect GitHub with a personal access token to push clones. Other tools are listed for
          roadmap clarity and fail safely.
        </p>
      </header>
      <div className="grid gap-5 md:grid-cols-2">
        <section className="integration-card surface rounded-3xl p-6" data-connected={!!githubLogin}>
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-border">
              <Github size={24} strokeWidth={1.5} />
            </span>
            <div>
              <h2 className="font-display text-xl">GitHub</h2>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                GH · {githubLogin ? `@${githubLogin}` : "Requires paid plan"}
              </p>
            </div>
            {githubLogin && <Check size={16} className="ml-auto" />}
          </div>
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            Validate a fine-grained or classic token with repo write access, then push exports from
            a finished clone.
          </p>
          <label className="mt-5 block text-sm">
            Personal access token
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_…"
              className="mt-2 w-full rounded-xl border border-border bg-background p-3"
              autoComplete="off"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="dashboard-button bg-primary text-primary-foreground disabled:opacity-50"
              disabled={busy}
              onClick={() => void connect()}
            >
              {busy ? "Connecting…" : githubLogin ? "Reconnect" : "Connect GitHub"}
            </button>
            <Link to="/dashboard/library" className="dashboard-button">
              Open library to export
            </Link>
          </div>
          {repos.length > 0 && (
            <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
              {repos.map((repo) => (
                <li key={repo.fullName}>
                  <a
                    href={repo.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4"
                  >
                    {repo.fullName}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="integration-card surface rounded-3xl p-6">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-border">
              <Figma size={24} strokeWidth={1.5} />
            </span>
            <div>
              <h2 className="font-display text-xl">Figma</h2>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                FG · Desktop plugin + Web SVG
              </p>
            </div>
            <Check size={16} className="ml-auto" />
          </div>
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            From a finished clone open Export to Figma: Desktop copies Scene Graph for Clonyfy
            Import, or download SVG for Figma Web.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/dashboard/library" className="dashboard-button bg-primary text-primary-foreground">
              Open library to export
            </Link>
          </div>
        </section>

        {[
          {
            name: "Slack",
            short: "SL",
            icon: MessageSquare,
            description: "Completion alerts for your team after a capture finishes.",
          },
          {
            name: "Notion",
            short: "NT",
            icon: NotebookPen,
            description: "Capture notes and launch checklists in a shared workspace.",
          },
        ].map((item) => (
          <section key={item.name} className="integration-card surface rounded-3xl p-6">
            <div className="flex items-center gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-border">
                <item.icon size={24} strokeWidth={1.5} />
              </span>
              <div>
                <h2 className="font-display text-xl">{item.name}</h2>
                <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {item.short} · Coming soon
                </p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button className="dashboard-button" onClick={() => comingSoon(item.name)}>
                Notify me
              </button>
            </div>
          </section>
        ))}
      </div>
      <p className="surface rounded-2xl p-5 text-sm text-muted-foreground" role="status">
        {notice ||
          "GitHub push and Figma export are available from finished captures in Library."}
      </p>
    </div>
  );
}
