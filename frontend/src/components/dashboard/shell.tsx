import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid,
  Gauge,
  Library,
  Settings,
  BarChart3,
  CreditCard,
  Menu,
  Plus,
  Activity,
  CalendarDays,
  ListTodo,
  Files,
  Blocks,
  Users,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { Brand, BrandMark } from "@/components/site/brand";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CaptureDetails, CaptureSearch, CaptureStatus } from "./captures";
import type { CloneJob } from "./data";
import { useDashboardWorkspace } from "./workspace";
import { useAuth } from "@/hooks/use-auth";

const NAV = [
  { to: "/dashboard", label: "Clone", icon: LayoutGrid, exact: true },
  { to: "/dashboard/overview", label: "Overview", icon: Gauge, exact: false },
  { to: "/dashboard/calendar", label: "Calendar", icon: CalendarDays, exact: false },
  { to: "/dashboard/tasks", label: "My tasks", icon: ListTodo, exact: false },
  { to: "/dashboard/library", label: "Library", icon: Library, exact: false },
  { to: "/dashboard/activity", label: "Activity", icon: Activity, exact: false },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3, exact: false },
  { to: "/dashboard/documents", label: "Documents", icon: Files, exact: false },
  { to: "/dashboard/integrations", label: "Integrations", icon: Blocks, exact: false },
  { to: "/dashboard/team", label: "Teams", icon: Users, exact: false },
  { to: "/dashboard/billing", label: "Subscription", icon: CreditCard, exact: false },
  { to: "/dashboard/settings", label: "Settings", icon: Settings, exact: false },
] as const;

function Sidebar({
  onNavigate,
  onSelect,
}: {
  onNavigate?: () => void;
  onSelect: (job: CloneJob) => void;
}) {
  const [query, setQuery] = useState("");
  const { jobs } = useDashboardWorkspace();
  const list = jobs.filter((job) => job.domain.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className="dashboard-sidebar" data-lenis-prevent>
      <Link to="/" aria-label="Clonyfy home" onClick={onNavigate} className="w-fit">
        <Brand />
      </Link>
      <nav aria-label="Dashboard" className="flex flex-col gap-1">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.exact }}
            onClick={onNavigate}
            className="flex min-h-11 items-center gap-3 rounded-full px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-foreground"
          >
            <item.icon size={16} />
            {item.label}
          </Link>
        ))}
      </nav>
      <section>
        <h2 className="eyebrow mb-3">History</h2>
        <CaptureSearch value={query} onChange={setQuery} label="Filter clones" />
        <ul className="mt-3 space-y-1">
          {list.map((job) => (
            <li key={job.id}>
              <button
                onClick={() => onSelect(job)}
                className="flex w-full flex-col gap-1 rounded-2xl px-3 py-3 text-left hover:bg-accent/60"
              >
                <span className="block w-full truncate text-sm">{job.domain}</span>
                <CaptureStatus status={job.status} />
              </button>
            </li>
          ))}
          {!list.length && (
            <li className="px-3 py-4 text-xs text-muted-foreground">No clones match.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<CloneJob | null>(null);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const current = NAV.find((item) => item.to === pathname.replace(/\/$/, ""))?.label ?? "Clone";
  const { user, logout } = useAuth();
  const { refreshJobs } = useDashboardWorkspace();
  const navigate = useNavigate();
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="dashboard-shell min-h-screen bg-background">
      <a
        href="#dashboard-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-primary focus:p-3 focus:text-primary-foreground"
      >
        Skip to dashboard content
      </a>
      <header className="sticky top-0 z-40 h-[72px] border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-[110rem] items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border lg:hidden"
                  aria-label="Open menu"
                >
                  <Menu size={18} />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="dashboard-shell w-[min(320px,calc(100vw-16px))] p-0 pt-12 [&>button]:grid [&>button]:h-11 [&>button]:w-11 [&>button]:place-items-center"
                data-lenis-prevent
              >
                <SheetTitle className="sr-only">Dashboard navigation</SheetTitle>
                <SheetDescription className="sr-only">
                  Navigate your workspace or inspect a recent capture.
                </SheetDescription>
                <Sidebar onNavigate={() => setOpen(false)} onSelect={setSelected} />
              </SheetContent>
            </Sheet>
            {current === "Clone" ? (
              <Link
                to="/dashboard"
                aria-label="Clonyfy dashboard"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
              >
                <BrandMark className="h-7 w-7" />
              </Link>
            ) : (
              <span className="hidden text-sm text-muted-foreground sm:block">{current}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
            >
              <Plus size={16} />
              <span>New clone</span>
            </Link>
            <Link
              to="/dashboard/settings"
              aria-label="Account settings"
              className="grid h-11 w-11 place-items-center rounded-full border border-border text-xs"
              title={user?.email || "Settings"}
            >
              {initial}
            </Link>
            <button
              type="button"
              aria-label="Log out"
              className="grid h-11 w-11 place-items-center rounded-full border border-border"
              onClick={() => {
                void (async () => {
                  await logout();
                  toast.success("Signed out.");
                  await navigate({ to: "/login" });
                })();
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[110rem]">
        <aside className="sticky top-[72px] hidden h-[calc(100dvh-72px)] w-64 shrink-0 border-r border-border lg:block xl:w-72">
          <Sidebar onSelect={setSelected} />
        </aside>
        <main
          id="dashboard-content"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 py-8 outline-none md:px-8"
        >
          {children}
        </main>
      </div>
      <CaptureDetails
        job={selected}
        onClose={() => setSelected(null)}
        onDeleted={() => void refreshJobs()}
      />
    </div>
  );
}
