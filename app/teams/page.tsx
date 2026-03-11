"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Team {
  id: string;
  name: string;
  invite_code: string;
  role: string;
  member_count: number;
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = () => {
    fetch("/api/teams")
      .then(r => r.json())
      .then(data => setTeams(data.teams || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTeams(); }, []);

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTeamName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewTeamName("");
      fetchTeams();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create team");
    } finally {
      setCreating(false);
    }
  };

  const joinTeam = async () => {
    if (!joinCode.trim()) return;
    setJoining(true);
    setError(null);
    try {
      const res = await fetch("/api/teams/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: joinCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setJoinCode("");
      fetchTeams();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join team");
    } finally {
      setJoining(false);
    }
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 nav-blur bg-background/80 border-b border-border">
        <div className="mx-auto max-w-4xl px-6 flex items-center justify-between h-14">
          <Link href="/" className="text-lg font-semibold tracking-tight gradient-text">
            Ascent
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/teams" className="text-xs text-foreground font-medium">
              Teams
            </Link>
            <a href="/api/auth/logout" className="text-xs text-muted hover:text-foreground transition-colors">
              Sign out
            </a>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.2em] text-muted mb-2">Teams</p>
            <h1 className="text-3xl font-bold tracking-tight">Your Teams</h1>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Create + Join */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <div className="rounded-2xl bg-card border border-border p-6">
              <p className="text-xs uppercase tracking-wider text-muted mb-3">Create a Team</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createTeam()}
                  placeholder="Team name"
                  maxLength={50}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent-start transition-colors"
                />
                <button
                  onClick={createTeam}
                  disabled={creating || !newTeamName.trim()}
                  className="px-4 py-2 rounded-lg bg-accent-start/20 text-accent-start text-sm font-medium hover:bg-accent-start/30 transition-colors disabled:opacity-50"
                >
                  {creating ? "..." : "Create"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-card border border-border p-6">
              <p className="text-xs uppercase tracking-wider text-muted mb-3">Join a Team</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && joinTeam()}
                  placeholder="Invite code"
                  maxLength={8}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent-start transition-colors uppercase"
                />
                <button
                  onClick={joinTeam}
                  disabled={joining || !joinCode.trim()}
                  className="px-4 py-2 rounded-lg bg-accent-start/20 text-accent-start text-sm font-medium hover:bg-accent-start/30 transition-colors disabled:opacity-50"
                >
                  {joining ? "..." : "Join"}
                </button>
              </div>
            </div>
          </div>

          {/* Team list */}
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-accent-start border-t-transparent rounded-full animate-spin" />
            </div>
          ) : teams.length === 0 ? (
            <p className="text-center text-muted py-10">
              No teams yet. Create one or join with an invite code.
            </p>
          ) : (
            <div className="space-y-3">
              {teams.map(team => (
                <Link
                  key={team.id}
                  href={`/teams/${team.id}`}
                  className="block rounded-2xl bg-card border border-border p-5 hover:border-accent-start/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-lg">{team.name}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {team.member_count} member{Number(team.member_count) !== 1 ? "s" : ""} · {team.role}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted">INVITE CODE</p>
                      <p className="text-sm font-mono">{team.invite_code}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
