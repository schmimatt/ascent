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

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function MetricRing({ value, maxValue, label, color, unit, isLeader }: { value: number | null; maxValue: number; label: string; color: string; unit: string; isLeader?: boolean }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const pct = value != null ? Math.min(value / maxValue, 1) : 0;
  const offset = circumference - pct * circumference;
  const display = value != null
    ? (Number.isInteger(value) ? `${value}${unit}` : `${value.toFixed(1)}${unit}`)
    : "—";

  return (
    <div className="flex flex-col items-center relative">
      {isLeader && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[11px] leading-none" title="1st place">
          <svg width="14" height="12" viewBox="0 0 14 12" fill="#f5a623">
            <polygon points="7,0 9,4 14,4 10,7 11.5,12 7,9 2.5,12 4,7 0,4 5,4" />
          </svg>
        </div>
      )}
      <svg width="68" height="68" viewBox="0 0 64 64">
        {isLeader && (
          <circle cx="32" cy="32" r={radius + 3} fill="none" stroke="#f5a623" strokeWidth="1.5" opacity="0.5" />
        )}
        <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--color-border)" strokeWidth="5" />
        {value != null && (
          <circle
            cx="32" cy="32" r={radius} fill="none" stroke={color} strokeWidth="5"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
            transform="rotate(-90 32 32)"
          />
        )}
        <text x="32" y="34" textAnchor="middle" fill={value != null ? color : "var(--color-muted-foreground)"} fontSize="13" fontWeight="700">
          {display}
        </text>
      </svg>
      <span className="text-[10px] text-muted-foreground mt-0.5">{label}</span>
    </div>
  );
}

function getLeaders(members: MemberComparison[]) {
  const active = members.filter(m => !m.needsReauth);

  const bestRecovery = active.reduce<string | null>((best, m) => {
    if (m.recovery?.score == null) return best;
    const bestMember = active.find(a => a.userId === best);
    if (!best || (bestMember?.recovery?.score ?? -1) < m.recovery.score) return m.userId;
    return best;
  }, null);

  const bestSleep = active.reduce<string | null>((best, m) => {
    if (m.sleep?.totalHours == null) return best;
    const bestMember = active.find(a => a.userId === best);
    if (!best || (bestMember?.sleep?.totalHours ?? -1) < m.sleep.totalHours) return m.userId;
    return best;
  }, null);

  const bestStrain = active.reduce<string | null>((best, m) => {
    if (m.strain?.score == null) return best;
    const bestMember = active.find(a => a.userId === best);
    if (!best || (bestMember?.strain?.score ?? -1) < m.strain.score) return m.userId;
    return best;
  }, null);

  return { bestRecovery, bestSleep, bestStrain };
}

function MemberMetrics({ member, leaders }: { member: MemberComparison; leaders: { bestRecovery: string | null; bestSleep: string | null; bestStrain: string | null } }) {
  if (member.needsReauth) {
    return (
      <div className="flex flex-col items-center gap-2 px-3">
        <div className="flex gap-2 pt-2.5">
          <MetricRing value={null} maxValue={100} label="Recovery" color="#44b700" unit="%" />
          <MetricRing value={null} maxValue={12} label="Sleep" color="#6366f1" unit="h" />
          <MetricRing value={null} maxValue={21} label="Strain" color="#a855f7" unit="" />
        </div>
        <span className="text-xs font-medium">{member.firstName}</span>
        <span className="text-[10px] text-red-500">Re-auth needed</span>
      </div>
    );
  }

  const recoveryScore = member.recovery?.score ?? null;
  const recoveryColor = getRecoveryColor(recoveryScore ?? 0);

  return (
    <div className="flex flex-col items-center gap-2 px-3">
      <div className="flex gap-2 pt-2.5">
        <MetricRing value={recoveryScore} maxValue={100} label="Recovery" color={recoveryColor} unit="%" isLeader={leaders.bestRecovery === member.userId} />
        <MetricRing value={member.sleep?.totalHours ?? null} maxValue={12} label="Sleep" color="#6366f1" unit="h" isLeader={leaders.bestSleep === member.userId} />
        <MetricRing value={member.strain?.score ?? null} maxValue={21} label="Strain" color="#a855f7" unit="" isLeader={leaders.bestStrain === member.userId} />
      </div>
      <span className="text-xs font-medium">{member.firstName}</span>
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

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No data for this date</p>;
  }

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

export { getToday, addDays, formatDate };

export default function TeamCompare({ teamId, selectedDate }: { teamId: string; selectedDate: string }) {
  const [members, setMembers] = useState<MemberComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/teams/${teamId}/compare?date=${selectedDate}`)
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
  }, [teamId, selectedDate]);

  if (error) {
    return <p className="text-center text-muted-foreground py-10">{error}</p>;
  }

  const leaderboard = [...members].sort((a, b) =>
    (b.recovery?.score ?? 0) - (a.recovery?.score ?? 0)
  );

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : members.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">No member data yet. Members need to sync their Whoop data.</p>
      ) : (
        <>
          {/* Member metrics — recovery, sleep, strain rings per person */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Daily Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const leaders = getLeaders(members);
                return (
                  <div className="flex flex-wrap justify-center gap-6">
                    {leaderboard.map(m => (
                      <MemberMetrics key={m.userId} member={m} leaders={leaders} />
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Comprehensive Detail Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Daily Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card z-10">Name</TableHead>
                    <TableHead className="text-right">Recovery</TableHead>
                    <TableHead className="text-right">HRV</TableHead>
                    <TableHead className="text-right">RHR</TableHead>
                    <TableHead className="text-right">SpO2</TableHead>
                    <TableHead className="text-right">Skin Temp</TableHead>
                    <TableHead className="text-right">Sleep</TableHead>
                    <TableHead className="text-right">Efficiency</TableHead>
                    <TableHead className="text-right">Performance</TableHead>
                    <TableHead className="text-right">Deep</TableHead>
                    <TableHead className="text-right">REM</TableHead>
                    <TableHead className="text-right">Light</TableHead>
                    <TableHead className="text-right">Disturbances</TableHead>
                    <TableHead className="text-right">Resp Rate</TableHead>
                    <TableHead className="text-right">Strain</TableHead>
                    <TableHead className="text-right">Calories</TableHead>
                    <TableHead className="text-right">Avg HR</TableHead>
                    <TableHead className="text-right">Max HR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((m) => (
                    <TableRow key={m.userId} className={m.needsReauth ? "opacity-50" : ""}>
                      <TableCell className="sticky left-0 bg-card z-10 font-medium">
                        {m.firstName} {m.lastName?.charAt(0)}.
                        {m.needsReauth && <span className="ml-1 text-[10px] text-red-500">!</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <span style={{ color: getRecoveryColor(m.recovery?.score ?? 0) }}>
                          {m.recovery?.score ?? "—"}
                          {m.recovery?.score != null && "%"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {m.recovery?.hrv != null ? `${m.recovery.hrv.toFixed(1)} ms` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {m.recovery?.rhr ?? "—"}
                        {m.recovery?.rhr != null && " bpm"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {m.recovery?.spo2 != null ? `${m.recovery.spo2.toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {m.recovery?.skinTempCelsius != null ? `${m.recovery.skinTempCelsius.toFixed(1)}°` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {m.sleep?.totalHours != null ? `${m.sleep.totalHours.toFixed(1)}h` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {m.sleep?.efficiency != null ? `${m.sleep.efficiency.toFixed(0)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {m.sleep?.sleepPerformance != null ? `${m.sleep.sleepPerformance}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {m.sleep?.totalDeepHours != null ? `${m.sleep.totalDeepHours.toFixed(1)}h` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {m.sleep?.totalRemHours != null ? `${m.sleep.totalRemHours.toFixed(1)}h` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {m.sleep?.totalLightHours != null ? `${m.sleep.totalLightHours.toFixed(1)}h` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {m.sleep?.disturbanceCount ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {m.sleep?.respiratoryRate != null ? `${m.sleep.respiratoryRate.toFixed(1)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {m.strain?.score != null ? m.strain.score.toFixed(1) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {m.strain?.calories != null ? m.strain.calories.toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {m.strain?.avgHr ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {m.strain?.maxHr ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Workouts */}
          {members.some(m => m.workouts.length > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Workouts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {members.flatMap(m =>
                    m.workouts.map((w, i) => (
                      <div
                        key={`${m.userId}-${i}`}
                        className="rounded-lg border border-border p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{m.firstName}</span>
                          <span className="text-xs text-muted-foreground capitalize">
                            {w.sport ?? "Activity"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {w.durationMinutes != null && (
                            <span>{w.durationMinutes} min</span>
                          )}
                          {w.strain != null && (
                            <span>Strain: {w.strain.toFixed(1)}</span>
                          )}
                          {w.calories != null && (
                            <span>{w.calories.toLocaleString()} cal</span>
                          )}
                          {w.avgHr != null && w.maxHr != null && (
                            <span>HR: {w.avgHr}–{w.maxHr}</span>
                          )}
                          {w.distanceMeters != null && w.distanceMeters > 0 && (
                            <span>{(w.distanceMeters / 1000).toFixed(1)} km</span>
                          )}
                          {w.altitudeGainMeters != null && w.altitudeGainMeters > 0 && (
                            <span>+{w.altitudeGainMeters.toFixed(0)}m elev</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}

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
        </>
      )}
    </div>
  );
}
