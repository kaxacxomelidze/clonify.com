import { useState } from "react";
import { Github } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ApiError, ensureApiAwake, fetchGitHubBranches, pushToGitHub } from "@/lib/api";

const TOKEN_SESSION_KEY = "clonyfy-github-token-session";

function readSessionToken() {
  try {
    return sessionStorage.getItem(TOKEN_SESSION_KEY) || "";
  } catch {
    return "";
  }
}

function writeSessionToken(token: string) {
  try {
    if (token) sessionStorage.setItem(TOKEN_SESSION_KEY, token);
    else sessionStorage.removeItem(TOKEN_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function GitHubPushDialog({
  open,
  onOpenChange,
  outDir,
  domain,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outDir: string;
  domain?: string;
}) {
  const [token, setToken] = useState(readSessionToken);
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [branches, setBranches] = useState<string[]>([]);
  const [commitMessage, setCommitMessage] = useState(
    () => `Import Clonyfy clone${domain ? ` (${domain})` : ""}`,
  );
  const [busy, setBusy] = useState("");
  const [hint, setHint] = useState("");

  const loadBranches = async () => {
    if (!token.trim() || !repo.trim()) {
      toast.error("Enter a GitHub token and owner/repo first.");
      return;
    }
    setBusy("branches");
    setHint("");
    try {
      await ensureApiAwake({ attempts: 4, timeoutMs: 12_000 }).catch(() => {});
      const data = await fetchGitHubBranches(token.trim(), repo.trim());
      setBranches(data.branches || []);
      if (data.branches?.length && !data.branches.includes(branch)) {
        setBranch(data.branches[0] || "main");
      }
      writeSessionToken(token.trim());
      toast.success(`Loaded ${data.branches?.length || 0} branches.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load branches.");
    } finally {
      setBusy("");
    }
  };

  const push = async () => {
    if (!token.trim() || token.trim().length < 20) {
      toast.error("Paste a GitHub personal access token with repo scope.");
      return;
    }
    if (!repo.trim()) {
      toast.error("Enter a repository as owner/repo (example: yourname/clone).");
      return;
    }
    setBusy("push");
    setHint("Checking GitHub repo, then uploading clone files…");
    try {
      await ensureApiAwake({ attempts: 4, timeoutMs: 12_000 }).catch(() => {});
      const payload: {
        outDir: string;
        token: string;
        repo: string;
        branch: string;
        commitMessage?: string;
        createRepo?: boolean;
      } = {
        outDir,
        token: token.trim(),
        repo: repo.trim(),
        branch: branch.trim() || "main",
        createRepo: true,
      };
      const msg = commitMessage.trim();
      if (msg) payload.commitMessage = msg;
      const data = await pushToGitHub(payload);
      writeSessionToken(token.trim());
      toast.success(
        data.createdRepo
          ? "Created the GitHub repo and pushed the clone."
          : "Pushed to GitHub.",
      );
      const openUrl = data.commitUrl || data.repoUrl || data.url;
      if (openUrl) window.open(openUrl, "_blank", "noopener,noreferrer");
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "GitHub push failed.";
      toast.error(message);
      setHint(message);
    } finally {
      setBusy("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dashboard-dialog max-w-lg" data-lenis-prevent>
        <DialogTitle className="flex items-center gap-2">
          <Github size={18} />
          Push to GitHub
        </DialogTitle>
        <DialogDescription>
          Pushes captured clone files to GitHub. Needs a paid plan and a PAT with{" "}
          <strong>repo</strong> scope. Empty repos are fine (we create the first commit). If{" "}
          <code>owner/repo</code> does not exist under your user, we try to create it. Token stays in
          this browser tab only.
        </DialogDescription>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            Personal access token
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="mt-2 w-full rounded-xl border border-border bg-background p-3"
              placeholder="ghp_…"
            />
          </label>
          <label className="block text-sm">
            Repository
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              className="mt-2 w-full rounded-xl border border-border bg-background p-3"
              placeholder="owner/repo"
            />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block min-w-[10rem] flex-1 text-sm">
              Branch
              <input
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                list="clonyfy-gh-branches"
                className="mt-2 w-full rounded-xl border border-border bg-background p-3"
                placeholder="main"
              />
              <datalist id="clonyfy-gh-branches">
                {branches.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>
            <button
              type="button"
              className="dashboard-button"
              onClick={() => void loadBranches()}
              disabled={busy === "branches"}
            >
              {busy === "branches" ? "Loading…" : "Load branches"}
            </button>
          </div>
          <label className="block text-sm">
            Commit message
            <input
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              className="mt-2 w-full rounded-xl border border-border bg-background p-3"
            />
          </label>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
          <button
            type="button"
            className="dashboard-button w-full bg-primary text-primary-foreground"
            onClick={() => void push()}
            disabled={!!busy}
          >
            {busy === "push" ? "Pushing…" : "Push clone"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
