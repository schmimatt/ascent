"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
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

function RecoveryRingSmall({ score, name, needsReauth }: { score: number; name: string; needsReauth?: boolean }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;

  if (needsReauth) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <svg width="90" height="90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--color-border)" strokeWidth="6" />
          <text x="40" y="42" textAnchor="middle" fill="var(--color-muted-foreground)" fontSize="18" fontWeight="700">
            ?
          </text>
        </svg>
        <span className="text-xs font-medium truncate max-w-[80px]">{name}</span>
        <span className="text-[10px] text-red-500">Re-auth needed</span>
      </div>
    );
  }

  const offset = circumference - (score / 100) * circumference;
  const color = getRecoveryColor(score);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width="90" height="90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--color-border)" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={radius} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 40 40)"
        />
        <text x="40" y="38" textAnchor="middle" fill={color} fontSize="18" fontWeight="700">
          {score}%
        </text>
        <text x="40" y="52" textAnchor="middle" fill="var(--color-muted-foreground)" fontSize="8">
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

export default function TeamCompare({ teamId }: { teamId: string }) {
  const [members, setMembers] = useState<MemberComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(getToday());

  const fetchData = (date: string) => {
    setLoading(true);
    setError(null);
    fetch(`/api/teams/${teamId}/compare?date=${date}`)
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
  };

  useEffect(() => {
    fetchData(selectedDate);
  }, [teamId, selectedDate]);

  const goBack = () => setSelectedDate(prev => addDays(prev, -1));
  const goForward = () => {
    const next = addDays(selectedDate, 1);
    if (next <= getToday()) setSelectedDate(next);
  };
  const goToday = () => setSelectedDate(getToday());
  const isToday = selectedDate === getToday();

  if (error) {
    return <p className="text-center text-muted-foreground py-10">{error}</p>;
  }

  const leaderboard = [...members].sort((a, b) =>
    (b.recovery?.score ?? 0) - (a.recovery?.score ?? 0)
  );

  return (
    <div className="space-y-6">
      {/* Date picker */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={selectedDate}
                max={getToday()}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-auto text-sm font-medium"
              />
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {formatDate(selectedDate)}
              </span>
              {!isToday && (
                <Button variant="outline" size="sm" onClick={goToday}>
                  Today
                </Button>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={goForward} disabled={isToday}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : members.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">No member data yet. Members need to sync their Whoop data.</p>
      ) : (
        <>
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
                    needsReauth={m.needsReauth}
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
