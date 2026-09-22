import { DashboardSelect } from "@/components/dashboard/select";
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/dashboard/team")({
  head: () => ({ meta: [{ title: "Teams — Clonyfy dashboard" }] }),
  component: TeamPage,
});

type Member = { email: string; role: string; team: string };

function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Editor");
  const [team, setTeam] = useState("Design");
  const [filter, setFilter] = useState("All teams");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem("clonyfy-team-members") || "null");
      if (Array.isArray(saved))
        setMembers(
          saved.filter(
            (member): member is Member =>
              !!member &&
              typeof member.email === "string" &&
              ["Editor", "Viewer"].includes(member.role) &&
              ["Design", "Development"].includes(member.team),
          ),
        );
    } catch {
      /* Optional storage. */
    }
  }, []);

  const save = (next: Member[]) => {
    setMembers(next);
    try {
      localStorage.setItem("clonyfy-team-members", JSON.stringify(next));
    } catch {
      /* Session remains usable. */
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="eyebrow">Build together</p>
        <h1 className="display-lg mt-3">Teams</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Plan roles locally for now. Email invitations are not sent yet — this stays on your
          browser until shared workspaces ship.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {["Design", "Development"].map((name) => (
          <button
            key={name}
            aria-pressed={filter === name}
            onClick={() => setFilter(filter === name ? "All teams" : name)}
            className="surface flex items-center gap-4 rounded-3xl p-6 text-left"
          >
            <Users size={24} />
            <span>
              <span className="block font-display text-xl">{name}</span>
              <span className="text-xs text-muted-foreground">
                {members.filter((member) => member.team === name).length} members
              </span>
            </span>
          </button>
        ))}
      </div>
      <section className="surface rounded-3xl p-5 md:p-6">
        <h2 className="text-xl">Add a member</h2>
        <form
          className="dashboard-toolbar mt-5"
          onSubmit={(event) => {
            event.preventDefault();
            const normalized = email.trim().toLowerCase();
            if (!normalized.includes("@")) {
              setNotice("Enter a valid email address.");
              toast.error("Enter a valid email address.");
              return;
            }
            if (members.some((member) => member.email === normalized)) {
              setNotice("That member is already listed.");
              toast.error("That member is already listed.");
              return;
            }
            save([...members, { email: normalized, role, team }]);
            setEmail("");
            setNotice("Saved locally. No invitation email was sent.");
            toast.message("Member saved locally", {
              description: "Team invites are not enabled on the Backend yet.",
            });
          }}
        >
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@company.com"
            className="min-w-[14rem] flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm"
          />
          <DashboardSelect
            label="Role"
            value={role}
            onValueChange={setRole}
            options={[
              { value: "Editor", label: "Editor" },
              { value: "Viewer", label: "Viewer" },
            ]}
          />
          <DashboardSelect
            label="Team"
            value={team}
            onValueChange={setTeam}
            options={[
              { value: "Design", label: "Design" },
              { value: "Development", label: "Development" },
            ]}
          />
          <button type="submit" className="dashboard-button bg-primary text-primary-foreground">
            Add member
          </button>
        </form>
        <p className="mt-4 text-sm text-muted-foreground" role="status">
          {notice}
        </p>
        <ul className="mt-6 space-y-3">
          {members
            .filter((member) => filter === "All teams" || member.team === filter)
            .map((member) => (
              <li
                key={member.email}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 text-sm"
              >
                <span>
                  <span className="block">{member.email}</span>
                  <span className="text-xs text-muted-foreground">
                    {member.role} · {member.team}
                  </span>
                </span>
                <button
                  className="dashboard-button"
                  onClick={() => {
                    save(members.filter((item) => item.email !== member.email));
                    setNotice("Member removed from local list.");
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
        </ul>
        {!members.length && (
          <p className="mt-4 text-sm text-muted-foreground">No members yet.</p>
        )}
      </section>
    </div>
  );
}
