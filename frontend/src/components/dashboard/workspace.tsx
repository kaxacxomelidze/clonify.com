import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { CLONES, type CloneJob, type CloneStatus } from "./data";
import { fetchOutputs, type OutputItem } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_KEY = "clonyfy-demo-captures-v1";
export type WorkspaceTask = {
  id: string;
  title: string;
  date: string;
  done: boolean;
  archived: boolean;
  pinned: boolean;
};
const SEED_TASKS: WorkspaceTask[] = [];
const WorkspaceContext = createContext<{
  jobs: CloneJob[];
  addJob: (job: CloneJob) => void;
  refreshJobs: () => Promise<void>;
  tasks: WorkspaceTask[];
  saveTask: (task: WorkspaceTask) => void;
  removeTask: (id: string) => void;
}>({
  jobs: [],
  addJob: () => {},
  refreshJobs: async () => {},
  tasks: SEED_TASKS,
  saveTask: () => {},
  removeTask: () => {},
});

function mapOutput(item: OutputItem): CloneJob {
  let domain = item.name || "site";
  try {
    if (item.targetOrigin && /^https?:\/\//i.test(item.targetOrigin)) {
      domain = new URL(item.targetOrigin).host;
    } else if (item.targetOrigin && !item.targetOrigin.startsWith("builder:")) {
      domain = item.targetOrigin;
    }
  } catch {
    /* keep name */
  }
  const statusRaw = String(item.status || "done").toLowerCase();
  const status: CloneStatus =
    statusRaw === "running" || statusRaw === "queued" || statusRaw === "saving"
      ? statusRaw === "saving"
        ? "running"
        : statusRaw
      : statusRaw === "error" || statusRaw === "failed"
        ? "error"
        : "done";
  return {
    id: String(item.id || item.dir),
    domain,
    pages: Number(item.pages) || 0,
    assets: Number(item.assets) || 0,
    routes: Number(item.apiRoutes) || 0,
    status,
    startedAt: item.capturedAt ? new Date(item.capturedAt).toLocaleTimeString("en-US") : "",
    elapsed: "—",
    ...(item.dir ? { outDir: item.dir } : {}),
  };
}

function elapsedSince(iso?: string) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m ${String(rem).padStart(2, "0")}s`;
}

export function DashboardWorkspace({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [jobs, setJobs] = useState<CloneJob[]>([]);
  const [tasks, setTasks] = useState(SEED_TASKS);

  const refreshJobs = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const outputs = await fetchOutputs(80);
      setJobs(outputs.map(mapOutput));
    } catch {
      /* Keep current list if refresh fails. */
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setJobs([]);
      return;
    }
    void refreshJobs();
  }, [isAuthenticated, refreshJobs]);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem("clonyfy-demo-tasks-v1") || "null");
      if (Array.isArray(saved))
        setTasks(
          saved.filter(
            (task): task is WorkspaceTask =>
              !!task &&
              typeof task.id === "string" &&
              typeof task.title === "string" &&
              /^\d{4}-\d{2}-\d{2}$/.test(task.date) &&
              [task.done, task.archived, task.pinned].every((value) => typeof value === "boolean"),
          ),
        );
    } catch {
      /* Storage is optional. */
    }
  }, []);

  const updateTasks = (update: (current: WorkspaceTask[]) => WorkspaceTask[]) => {
    setTasks((current) => {
      const next = update(current);
      try {
        localStorage.setItem("clonyfy-demo-tasks-v1", JSON.stringify(next));
      } catch {
        /* Keep the current session usable. */
      }
      return next;
    });
  };
  const saveTask = (task: WorkspaceTask) =>
    updateTasks((current) =>
      current.some((item) => item.id === task.id)
        ? current.map((item) => (item.id === task.id ? task : item))
        : [...current, task],
    );
  const removeTask = (id: string) =>
    updateTasks((current) => current.filter((task) => task.id !== id));
  const addJob = useCallback((job: CloneJob) => {
    setJobs((current) => {
      const next = [job, ...current.filter((item) => item.id !== job.id)];
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(
            next.filter((item) => !CLONES.some((seed) => seed.id === item.id)).slice(0, 30),
          ),
        );
      } catch {
        /* The in-memory workspace remains usable. */
      }
      return next;
    });
  }, []);
  return (
    <WorkspaceContext.Provider value={{ jobs, addJob, refreshJobs, tasks, saveTask, removeTask }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useDashboardWorkspace() {
  return useContext(WorkspaceContext);
}

export { elapsedSince };
