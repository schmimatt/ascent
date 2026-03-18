"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import TeamCompare from "@/components/TeamCompare";
import { ArrowLeft, Copy, Check, Users, Trash2, LogOut, Link2 } from "lucide-react";

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
  const [syncStatus, setSyncStatus] = useState<Record<string, { needsReauth: boolean; lastDataDate: string | null }>>({});

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

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    fetch(`/api/teams/${teamId}/compare?date=${today}`)
      .then(r => r.json())
      .then(data => {
        if (data.members) {
          const status: Record<string, { needsReauth: boolean; lastDataDate: string | null }> = {};
          for (const m of data.members) {
            status[m.userId] = { needsReauth: m.needsReauth, lastDataDate: m.lastDataDate };
          }
          setSyncStatus(status);
        }
      })
      .catch(() => {});
  }, [teamId]);

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
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
          <div className="flex items-center gap-4">
            <Link href="/teams" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Teams
            </Link>
            <a href="/api/auth/logout" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Sign out
            </a>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16">
        <div className="mx-auto max-w-6xl px-6">
          {/* Team header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <Link href="/teams" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-2 -ml-2 text-muted-foreground")}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                All Teams
              </Link>
              <h1 className="text-3xl font-bold tracking-tight">{team.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {members.length} member{members.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowInvite(!showInvite)}>
                <Link2 className="h-4 w-4 mr-1" />
                Invite
              </Button>
              {role === "owner" ? (
                <Button variant="destructive" size="sm" onClick={deleteTeam}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              ) : (
                <Button variant="destructive" size="sm" onClick={leaveTeam}>
                  <LogOut className="h-4 w-4 mr-1" />
                  Leave
                </Button>
              )}
            </div>
          </div>

          {/* Invite panel */}
          {showInvite && (
            <Card className="mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Invite Link</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={typeof window !== "undefined" ? `${window.location.origin}/api/auth/login?invite=${team.invite_code}` : ""}
                    className="font-mono text-xs"
                  />
                  <Button variant="outline" size="sm" onClick={copyInviteLink}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Share this link. New users will sign in with Whoop and auto-join this team.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Members */}
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {members.map(m => {
                  const status = syncStatus[m.id];
                  const isStale = status?.lastDataDate
                    ? (Date.now() - new Date(status.lastDataDate).getTime()) > 2 * 86400000
                    : true;

                  return (
                    <div key={m.id} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                          {m.first_name?.charAt(0)}
                        </div>
                        <span className="text-sm font-medium">
                          {m.first_name} {m.last_name?.charAt(0)}.
                        </span>
                        {status && (
                          status.needsReauth ? (
                            <span className="flex items-center gap-1 text-[10px] text-red-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                              Needs to re-authenticate
                            </span>
                          ) : !isStale ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" title="Syncing" />
                          ) : null
                        )}
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{m.role}</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Separator className="my-6" />

          {/* Comparison dashboard */}
          <TeamCompare teamId={teamId} />
        </div>
      </main>
    </>
  );
}
