import { DashboardSelect } from "@/components/dashboard/select";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Archive, Check, ChevronLeft, ChevronRight, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CaptureSearch } from "./captures";
import { useDashboardWorkspace, type WorkspaceTask } from "./workspace";

export function TaskEditor({ task, onClose }: { task: WorkspaceTask; onClose: () => void }) {
  const { saveTask } = useDashboardWorkspace();
  const [title, setTitle] = useState(task.title);
  const [date, setDate] = useState(task.date);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="dashboard-dialog">
        <DialogTitle>{task.title ? "Edit task" : "Add a task"}</DialogTitle>
        <DialogDescription>
          Plan the next step for your workspace. Changes are saved on this browser.
        </DialogDescription>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim() || !date) return;
            saveTask({ ...task, title: title.trim(), date });
            onClose();
          }}
          className="space-y-5"
        >
          <label className="block text-sm">
            Task name
            <input
              required
              maxLength={160}
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 w-full rounded-xl border border-border bg-card p-3"
            />
          </label>
          <label className="block text-sm">
            Due date
            <input
              required
              type="date"
              value={date}
              min="2020-01-01"
              max="2100-12-31"
              onChange={(event) => setDate(event.target.value)}
              className="mt-2 w-full rounded-xl border border-border bg-card p-3"
            />
          </label>
          <button className="dashboard-button bg-primary text-primary-foreground" type="submit">
            Save task
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function newTask(date = "2026-09-07"): WorkspaceTask {
  return { id: `task-${Date.now()}`, title: "", date, done: false, archived: false, pinned: false };
}

export function TaskList({
  tasks,
  onEdit,
}: {
  tasks: WorkspaceTask[];
  onEdit: (task: WorkspaceTask) => void;
}) {
  const { saveTask, removeTask } = useDashboardWorkspace();
  return (
    <ul className="space-y-3">
      {tasks.map((task) => (
        <li
          key={task.id}
          data-complete={task.done}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData("application/x-clonyfy-task", task.id);
            event.dataTransfer.effectAllowed = "move";
          }}
          className="task-row rounded-2xl border border-border p-4"
        >
          <button
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border ${task.done ? "bg-primary text-primary-foreground" : ""}`}
            aria-label={`Complete ${task.title}`}
            aria-pressed={task.done}
            onClick={() => saveTask({ ...task, done: !task.done })}
          >
            {task.done && <Check size={16} />}
          </button>
          <div className="min-w-0 flex-1">
            <p
              className={`break-words text-sm ${task.done ? "text-muted-foreground line-through" : ""}`}
            >
              {task.title}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {task.date}
              {task.pinned ? " · Pinned" : ""}
              {task.archived ? " · Archived" : ""}
            </p>
          </div>
          <div className="task-actions flex flex-wrap gap-1">
            <button
              className="task-icon"
              aria-label={`Edit ${task.title}`}
              onClick={() => onEdit(task)}
            >
              <Pencil size={15} />
            </button>
            <button
              className="task-icon"
              aria-pressed={task.pinned}
              aria-label={`Pin ${task.title}`}
              onClick={() => saveTask({ ...task, pinned: !task.pinned })}
            >
              <Pin size={15} />
            </button>
            <button
              className="task-icon"
              aria-label={`${task.archived ? "Restore" : "Archive"} ${task.title}`}
              onClick={() => saveTask({ ...task, archived: !task.archived })}
            >
              <Archive size={15} />
            </button>
            {task.archived && (
              <button
                className="task-icon"
                aria-label={`Delete ${task.title}`}
                onClick={() => removeTask(task.id)}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Planner({ calendar = false }: { calendar?: boolean }) {
  const { tasks, saveTask } = useDashboardWorkspace();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const [editing, setEditing] = useState<WorkspaceTask | null>(null);
  const [month, setMonth] = useState(new Date(2026, 8, 1));
  const [selected, setSelected] = useState("2026-09-07");
  const [dragDay, setDragDay] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const dateKey = (day: number) =>
    `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const visible = tasks
    .filter(
      (task) =>
        (filter === "archived"
          ? task.archived
          : !task.archived &&
            (filter !== "done" || task.done) &&
            (filter !== "open" || !task.done)) &&
        task.title.toLowerCase().includes(query.trim().toLowerCase()) &&
        (!calendar || task.date === selected),
    )
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.date.localeCompare(b.date));
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Plan the next step</p>
          <h1 className="display-lg mt-3">{calendar ? "Calendar" : "My tasks"}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            A little structure between capturing a site and shipping your own.
          </p>
        </div>
        <button
          className="dashboard-button bg-primary text-primary-foreground"
          onClick={() => setEditing(newTask(selected))}
        >
          <Plus size={16} />
          Add task
        </button>
      </header>
      <div className="planner-summary" aria-label="Task totals">
        {[
          ["To do", tasks.filter((task) => !task.done && !task.archived).length],
          ["Completed", tasks.filter((task) => task.done && !task.archived).length],
          ["Pinned", tasks.filter((task) => task.pinned && !task.archived).length],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className={calendar ? "planner-calendar-layout" : ""}>
        {calendar && (
          <section className="surface rounded-3xl p-4 md:p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl">
                {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </h2>
              <div className="flex gap-2">
                <button
                  className="dashboard-button text-xs"
                  onClick={() => {
                    setMonth(new Date(2026, 8, 1));
                    setSelected("2026-09-07");
                  }}
                >
                  Demo week
                </button>
                <button
                  className="task-icon"
                  aria-label="Previous month"
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="task-icon"
                  aria-label="Next month"
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            <div className="dashboard-calendar">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <span key={day} className="calendar-weekday">
                  {day}
                </span>
              ))}
              {Array.from({ length: month.getDay() }, (_, i) => (
                <span key={`blank-${i}`} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const day = i + 1,
                  date = dateKey(day),
                  items = tasks.filter((task) => task.date === date && !task.archived);
                return (
                  <button
                    key={date}
                    className="calendar-day"
                    data-drop-target={dragDay === date}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragDay(date);
                    }}
                    onDragLeave={() => setDragDay(null)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragDay(null);
                      const task = tasks.find(
                        (item) =>
                          item.id === event.dataTransfer.getData("application/x-clonyfy-task"),
                      );
                      if (task) {
                        saveTask({ ...task, date });
                        setSelected(date);
                        setNotice(`Moved ${task.title} to ${date}.`);
                      }
                    }}
                    aria-label={`${date}, ${items.length} tasks`}
                    aria-pressed={selected === date}
                    onClick={() => setSelected(date)}
                  >
                    <span>{day}</span>
                    <span className="calendar-task-count">
                      {items.slice(0, 2).map((task) => (
                        <span className="calendar-task-label" data-done={task.done} key={task.id}>
                          {task.title}
                        </span>
                      ))}
                      {items.length > 2 && <span>+{items.length - 2} more</span>}
                    </span>
                    {items.length > 0 && <span className="calendar-dot" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Select a day to see its agenda. Drag tasks to reschedule, or edit their due date.
            </p>
          </section>
        )}
        <section className="surface rounded-3xl p-5 md:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-xl">
              {calendar ? `Tasks · ${selected}` : "Your work, organized"}
            </h2>
            <Link
              className="dashboard-button"
              to={calendar ? "/dashboard/tasks" : "/dashboard/calendar"}
            >
              {calendar ? "View all tasks" : "Open calendar"} ↗
            </Link>
          </div>
          <div className="dashboard-toolbar mb-6">
            <CaptureSearch label="Search tasks" value={query} onChange={setQuery} />
            <DashboardSelect
              label="Task status"
              value={filter}
              onValueChange={setFilter}
              options={[
                { value: "active", label: "All active tasks" },
                { value: "open", label: "To do" },
                { value: "done", label: "Completed" },
                { value: "archived", label: "Archive" },
              ]}
            />
          </div>
          {visible.length ? (
            <TaskList tasks={visible} onEdit={setEditing} />
          ) : (
            <div className="capture-empty">
              <svg viewBox="0 0 120 80" fill="none" aria-hidden="true">
                <rect
                  x="28"
                  y="10"
                  width="64"
                  height="60"
                  rx="8"
                  stroke="currentColor"
                  opacity=".5"
                />
                <path d="m42 38 10 10 24-24" stroke="currentColor" strokeWidth="2" />
              </svg>
              <h3>No tasks here yet</h3>
              <p>Choose another day or add your next step.</p>
              <button className="dashboard-button" onClick={() => setEditing(newTask(selected))}>
                Add a task
              </button>
            </div>
          )}
        </section>
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {notice}
      </p>
      {editing && <TaskEditor key={editing.id} task={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
