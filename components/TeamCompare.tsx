"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MemberComparison } from "@/app/api/teams/[teamId]/compare/route";

function getRecoveryColor(score: number) {
  if (score >= 67) return "#44b700";
  if (score >= 34) return "#f5a623";
  return "#e53935";
}

function RecoveryRingSmall({ score, name }: { score: number; name: string }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getRecoveryColor(score);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width="90" height="90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={radius} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 40 40)"
        />
        <text x="40" y="38" textAnchor="middle" fill={color} fontSize="18" fontWeight="700">
          {score}%
        </text>
        <text x="40" y="52" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="8">
          RECOVERY
        </text>
      </svg>
      <span className="text-xs font-medium truncate max-w-[80px]">{name}</span>
    </div>
  );
}

function CompareBar({
  members,
  getValue,
  getLabel,
  maxValue,
  color,
  unit,
}: {
  members: MemberComparison[];
  getValue: (m: MemberComparison) => number | null;
  getLabel: (m: MemberComparison) => string;
  maxValue: number;
  color: string;
  unit: string;
}) {
  const sorted = [...members]
    .map(m => ({ ...m, val: getValue(m) }))
    .filter(m => m.val !== null)
    .sort((a, b) => (b.val ?? 0) - (a.val ?? 0));

  return (
    <div className="space-y-2.5">
      {sorted.map(m => (
        <div key={m.userId} className="flex items-center gap-3">
          <span className="text-xs w-20 truncate text-right text-muted-foreground">{getLabel(m)}</span>
          <div className="flex-1 h-7 bg-muted rounded-full overflow-hidden relative">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(((m.val ?? 0) / maxValue) * 100, 2)}%`,
                backgroundColor: color,
              }}
            />
            <span className="absolute right-2.5 top-1 text-xs font-medium">
              {typeof m.val === "number" ? (Number.isInteger(m.val) ? m.val : m.val.toFixed(1)) : "—"}{unit}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function TrendOverlay({
  members,
  getHistory,
  yLabel,
}: {
  members: MemberComparison[];
  getHistory: (m: MemberComparison) => { date: string; value: number }[];
  yLabel: string;
}) {
  const allValues = members.flatMap(m => getHistory(m).map(h => h.value));
  if (allValues.length === 0) return null;
  const max = Math.max(...allValues);
  const min = Math.min(...allValues);
  const range = max - min || 1;

  const w = 300;
  const h = 80;
  const pad = 8;
  const colors = ["#6366f1", "#a855f7", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#ec4899", "#14b8a6"];

  return (
    <div>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full">
        {members.map((m, mi) => {
          const history = getHistory(m);
          if (history.length < 2) return null;
          const points = history
            .map((pt, i) => {
              const x = pad + (i / (history.length - 1)) * (w - pad * 2);
              const y = h - pad - ((pt.value - min) / range) * (h - pad * 2);
              return `${x},${y}`;
            })
            .join(" ");
          return (
            <polyline
              key={m.userId}
              points={points}
              fill="none"
              stroke={colors[mi % colors.length]}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.8}
            />
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
        {members.map((m, mi) => (
          <div key={m.userId} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[mi % colors.length] }} />
            <span className="text-[10px] text-muted-foreground">{m.firstName}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5">{yLabel}</p>
    </div>
  );
}

export default function TeamCompare({ teamId }: { teamId: string }) {
  const [members, setMembers] = useState<MemberComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/teams/${teamId}/compare`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setMembers(data.members);
        }
      })
      .catch(() => setError("Failed to load comparison data"))
      .finally(() => setLoading(false));
  }, [teamId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-muted-foreground py-10">{error}</p>;
  }

  if (members.length === 0) {
    return <p className="text-center text-muted-foreground py-10">No member data yet. Members need to sync their Whoop data.</p>;
  }

  const leaderboard = [...members].sort((a, b) =>
    (b.recovery?.score ?? 0) - (a.recovery?.score ?? 0)
  );

  return (
    <div className="space-y-6">
      {/* Recovery rings */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recovery Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap justify-center gap-6">
            {leaderboard.map(m => (
              <RecoveryRingSmall
                key={m.userId}
                score={m.recovery?.score ?? 0}
                name={m.firstName}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sleep + Strain bars */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sleep Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <CompareBar
              members={members}
              getValue={m => m.sleep?.totalHours ?? null}
              getLabel={m => m.firstName}
              maxValue={12}
              color="#6366f1"
              unit="h"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Day Strain</CardTitle>
          </CardHeader>
          <CardContent>
            <CompareBar
              members={members}
              getValue={m => m.strain?.score ?? null}
              getLabel={m => m.firstName}
              maxValue={21}
              color="#a855f7"
              unit=""
            />
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Recovery</TableHead>
                <TableHead className="text-right">Sleep</TableHead>
                <TableHead className="text-right">Strain</TableHead>
                <TableHead className="text-right">HRV</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.map((m, i) => (
                <TableRow key={m.userId}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{m.firstName} {m.lastName?.charAt(0)}.</TableCell>
                  <TableCell className="text-right">
                    <span style={{ color: getRecoveryColor(m.recovery?.score ?? 0) }}>
                      {m.recovery?.score ?? "—"}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {m.sleep?.totalHours?.toFixed(1) ?? "—"}h
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {m.strain?.score?.toFixed(1) ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {m.recovery?.hrv ?? "—"} ms
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 7-day trends */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recovery Trend (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendOverlay
              members={members}
              getHistory={m => m.recoveryHistory.map(h => ({ date: h.date, value: h.score }))}
              yLabel="Recovery %"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sleep Trend (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendOverlay
              members={members}
              getHistory={m => m.sleepHistory.map(h => ({ date: h.date, value: h.totalHours }))}
              yLabel="Hours"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Strain Trend (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendOverlay
              members={members}
              getHistory={m => m.strainHistory.map(h => ({ date: h.date, value: h.strain }))}
              yLabel="Strain"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
