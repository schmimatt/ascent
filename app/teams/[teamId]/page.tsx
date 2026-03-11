"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import TeamCompare from "@/components/TeamCompare";

interface TeamDetails {
  id: string;
  name: string;
  invite_code: string;
}

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

export default function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const router = useRouter();
  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [role, setRole] = useState<string>("member");
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/teams/${teamId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          router.push("/teams");
          return;
        }
        setTeam(data.team);
        setMembers(data.members);
        setRole(data.role);
      })
      .catch(() => router.push("/teams"))
      .finally(() => setLoading(false));
  }, [teamId, router]);

  const copyInviteLink = () => {
    if (!team) return;
    const baseUrl = window.location.origin;
    navigator.clipboard.writeText(`${baseUrl}/api/auth/login?invite=${team.invite_code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const leaveTeam = async () => {
    if (!confirm("Leave this team?")) return;
    await fetch(`/api/teams/${teamId}/leave`, { method: "POST" });
    router.push("/teams");
  };

  const deleteTeam = async () => {
    if (!confirm("Delete this team? This cannot be undone.")) return;
    await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
    router.push("/teams");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-accent-start border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!team) return null;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 nav-blur bg-background/80 border-b border-border">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between h-14">
          <Link href="/" className="text-lg font-semibold tracking-tight gradient-text">
            Ascent
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/teams" className="text-xs text-muted hover:text-foreground transition-colors">
              Teams
            </Link>
            <a href="/api/auth/logout" className="text-xs text-muted hover:text-foreground transition-colors">
              Sign out
            </a>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16">
        <div className="mx-auto max-w-6xl px-6">
          {/* Team header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <Link href="/teams" className="text-xs text-muted hover:text-foreground transition-colors mb-2 inline-block">
                &larr; All Teams
              </Link>
              <h1 className="text-3xl font-bold tracking-tight">{team.name}</h1>
              <p className="text-sm text-muted mt-1">
                {members.length} member{members.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowInvite(!showInvite)}
                className="px-3 py-1.5 rounded-lg bg-accent-start/20 text-accent-start text-xs font-medium hover:bg-accent-start/30 transition-colors"
              >
                Invite
              </button>
              {role === "owner" ? (
                <button
                  onClick={deleteTeam}
                  className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors"
                >
                  Delete
                </button>
              ) : (
                <button
                  onClick={leaveTeam}
                  className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors"
                >
                  Leave
                </button>
              )}
            </div>
          </div>

          {/* Invite panel */}
          {showInvite && (
            <div className="rounded-2xl bg-card border border-border p-5 mb-6">
              <p className="text-xs uppercase tracking-wider text-muted mb-2">Invite Link</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono truncate">
                  {typeof window !== "undefined" ? window.location.origin : ""}/api/auth/login?invite={team.invite_code}
                </code>
                <button
                  onClick={copyInviteLink}
                  className="px-3 py-2 rounded-lg bg-accent-start/20 text-accent-start text-xs font-medium hover:bg-accent-start/30 transition-colors whitespace-nowrap"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-[10px] text-muted mt-2">
                Share this link. New users will sign in with Whoop and auto-join this team.
              </p>
            </div>
          )}

          {/* Members list */}
          <div className="rounded-2xl bg-card border border-border p-5 mb-6">
            <p className="text-xs uppercase tracking-wider text-muted mb-3">Members</p>
            <div className="space-y-2">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between py-1">
                  <span className="text-sm font-medium">
                    {m.first_name} {m.last_name?.charAt(0)}.
                  </span>
                  <span className="text-[10px] text-muted uppercase tracking-wider">{m.role}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Comparison dashboard */}
          <TeamCompare teamId={teamId} />
        </div>
      </main>
    </>
  );
}
