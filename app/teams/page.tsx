"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Users, Plus, LogIn, ArrowRight } from "lucide-react";

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
          <div className="flex items-center gap-4">
            <Link href="/teams" className="text-sm text-foreground font-medium">
              Teams
            </Link>
            <a href="/api/auth/logout" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Sign out
            </a>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-2">Teams</p>
            <h1 className="text-3xl font-bold tracking-tight">Your Teams</h1>
            <p className="text-muted-foreground mt-1">Create a team or join one to compare Whoop data with friends.</p>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Create + Join */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create a Team
                </CardTitle>
                <CardDescription>Start a new team and invite friends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    value={newTeamName}
                    onChange={e => setNewTeamName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && createTeam()}
                    placeholder="Team name"
                    maxLength={50}
                  />
                  <Button
                    onClick={createTeam}
                    disabled={creating || !newTeamName.trim()}
                  >
                    {creating ? "..." : "Create"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Join a Team
                </CardTitle>
                <CardDescription>Enter an invite code to join</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && joinTeam()}
                    placeholder="Invite code"
                    maxLength={8}
                    className="uppercase"
                  />
                  <Button
                    onClick={joinTeam}
                    disabled={joining || !joinCode.trim()}
                  >
                    {joining ? "..." : "Join"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Team list */}
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : teams.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No teams yet. Create one or join with an invite code.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {teams.map(team => (
                <Link key={team.id} href={`/teams/${team.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="flex items-center justify-between py-5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{team.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {team.member_count} member{Number(team.member_count) !== 1 ? "s" : ""}
                            </span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {team.role}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Invite</p>
                          <p className="text-sm font-mono">{team.invite_code}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
