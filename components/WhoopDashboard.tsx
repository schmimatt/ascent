"use client";

import { useEffect, useState } from "react";
import AnimatedSection from "./AnimatedSection";
import { WhoopData } from "@/types/whoop";
import { mockWhoopData } from "@/data/mock-whoop";

function getRecoveryColor(score: number) {
  if (score >= 67) return "var(--whoop-green)";
  if (score >= 34) return "var(--whoop-yellow)";
  return "var(--whoop-red)";
}

function getRecoveryLabel(score: number) {
  if (score >= 67) return "Green — Ready to perform";
  if (score >= 34) return "Yellow — Moderate readiness";
  return "Red — Recovery needed";
}

function RecoveryRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getRecoveryColor(score);

  return (
    <div className="flex flex-col items-center">
      <svg width="160" height="160" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="52" textAnchor="middle" fill={color} fontSize="30" fontWeight="700">
          {score}%
        </text>
        <text x="60" y="70" textAnchor="middle" fill="var(--muted)" fontSize="10" fontWeight="500">
          RECOVERY
        </text>
      </svg>
      <p className="text-xs text-muted mt-1" style={{ color }}>{getRecoveryLabel(score)}</p>
    </div>
  );
}

function HrvSparkline({ data, current }: { data: { date: string; hrv: number }[]; current: number }) {
  const values = data.map((d) => d.hrv);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const avg = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10 : 0;
  const range = max - min || 1;
  const w = 200;
  const h = 56;
  const pad = 6;

  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted mb-3">Heart Rate Variability</p>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-3xl font-bold">{current}</span>
        <span className="text-xs text-muted">ms (RMSSD)</span>
      </div>
      <p className="text-xs text-muted mb-3">
        {values.length > 0 && `${values.length}-day avg: ${avg} ms · Range: ${min}–${max} ms`}
      </p>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full">
        <polyline
          points={points} fill="none" stroke="var(--accent-start)"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        />
        {values.map((v, i) => {
          const x = pad + (i / (values.length - 1)) * (w - pad * 2);
          const y = h - pad - ((v - min) / range) * (h - pad * 2);
          return (
            <circle
              key={i} cx={x} cy={y} r="3"
              fill={i === values.length - 1 ? "var(--accent-start)" : "var(--card)"}
              stroke={i === values.length - 1 ? "var(--accent-start)" : "var(--border)"}
              strokeWidth="1.5"
            />
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-muted mt-1">
        {data.length > 0 && <span>{data[0].date.slice(5)}</span>}
        {data.length > 0 && <span>{data[data.length - 1].date.slice(5)}</span>}
      </div>
    </div>
  );
}

function SleepBar({ data }: { data: WhoopData["sleep"] }) {
  const totalSleep = data.totalLightHours + data.totalRemHours + data.totalDeepHours;
  const colors = {
    deep: "#3b82f6",
    rem: "#8b5cf6",
    light: "#6366f1",
    awake: "#ef4444",
  };
  const stages = [
    { key: "Deep Sleep", value: data.totalDeepHours, color: colors.deep },
    { key: "REM Sleep", value: data.totalRemHours, color: colors.rem },
    { key: "Light Sleep", value: data.totalLightHours, color: colors.light },
    { key: "Awake", value: data.totalAwakeHours, color: colors.awake },
  ];

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-3xl font-bold">{totalSleep.toFixed(1)}</span>
        <span className="text-xs text-muted">hours of sleep</span>
      </div>
      <div className="flex items-baseline gap-4 text-xs text-muted mb-4">
        <span>{data.totalInBedHours.toFixed(1)}h total in bed</span>
        {data.sleepPerformance != null && <span>{Math.round(data.sleepPerformance)}% sleep performance</span>}
        {data.sleepConsistency != null && <span>{Math.round(data.sleepConsistency)}% consistency</span>}
      </div>
      <p className="text-xs text-muted mb-2">Sleep Stages</p>
      <div className="flex rounded-full overflow-hidden h-5 gap-0.5">
        {stages.map((s) => (
          <div
            key={s.key}
            style={{
              width: `${(s.value / data.totalInBedHours) * 100}%`,
              backgroundColor: s.color,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3">
        {stages.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-xs text-muted">{s.key} — {s.value.toFixed(1)}h ({Math.round((s.value / data.totalInBedHours) * 100)}%)</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
        <div>
          <p className="text-xs text-muted">Sleep Efficiency</p>
          <p className="font-semibold">{typeof data.efficiency === 'number' ? Math.round(data.efficiency) : data.efficiency}%</p>
        </div>
        {data.respiratoryRate != null && (
          <div>
            <p className="text-xs text-muted">Respiratory Rate</p>
            <p className="font-semibold">{typeof data.respiratoryRate === 'number' ? data.respiratoryRate.toFixed(1) : data.respiratoryRate} breaths/min</p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted">Sleep Cycles</p>
          <p className="font-semibold">{data.sleepCycleCount}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Disturbances</p>
          <p className="font-semibold">{data.disturbanceCount}</p>
        </div>
      </div>
    </div>
  );
}

function StrainGauge({ score, max, calories, avgHr }: { score: number; max: number; calories: number; avgHr: number }) {
  const percentage = score / max;
  const startAngle = -135;
  const endAngle = 135;
  const sweepAngle = (endAngle - startAngle) * percentage;
  const radius = 54;
  const cx = 60;
  const cy = 60;

  function polarToCartesian(angle: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  const bgStart = polarToCartesian(startAngle);
  const bgEnd = polarToCartesian(endAngle);
  const arcEnd = polarToCartesian(startAngle + sweepAngle);
  const largeArc = sweepAngle > 180 ? 1 : 0;

  const strainLevel = score < 5 ? "Light" : score < 10 ? "Moderate" : score < 14 ? "High" : score < 18 ? "Very High" : "Peak";

  return (
    <div className="flex flex-col items-center">
      <p className="text-xs uppercase tracking-wider text-muted mb-2">Day Strain</p>
      <svg width="160" height="130" viewBox="0 0 120 100">
        <path
          d={`M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 1 1 ${bgEnd.x} ${bgEnd.y}`}
          fill="none" stroke="var(--border)" strokeWidth="8" strokeLinecap="round"
        />
        <path
          d={`M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`}
          fill="none" stroke="var(--accent-end)" strokeWidth="8" strokeLinecap="round"
        />
        <text x={cx} y="50" textAnchor="middle" fill="var(--foreground)" fontSize="26" fontWeight="700">
          {score.toFixed(1)}
        </text>
        <text x={cx} y="66" textAnchor="middle" fill="var(--muted)" fontSize="9">
          out of {max} · {strainLevel}
        </text>
      </svg>
      <div className="mt-2 grid grid-cols-2 gap-4 w-full text-center">
        <div>
          <p className="text-xs text-muted">Calories Burned</p>
          <p className="font-semibold">{calories.toLocaleString()} kcal</p>
        </div>
        <div>
          <p className="text-xs text-muted">Avg Heart Rate</p>
          <p className="font-semibold">{avgHr} bpm</p>
        </div>
      </div>
    </div>
  );
}

function SleepHistory({ data }: { data: WhoopData["sleepHistory"] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.totalHours), 10);
  const avg = Math.round(data.reduce((a, d) => a + d.totalHours, 0) / data.length * 10) / 10;

  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted mb-1">Sleep History</p>
      <p className="text-[10px] text-muted mb-3">{data.length}-day avg: {avg}h</p>
      <div className="flex items-end gap-1.5 h-20">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.totalHours.toFixed(1)}h — ${d.date}`}>
            <span className="text-[8px] text-muted">{d.totalHours.toFixed(1)}</span>
            <div
              className="w-full rounded-t-sm bg-accent-start/70 transition-all"
              style={{ height: `${(d.totalHours / max) * 100}%` }}
            />
            <span className="text-[9px] text-muted">{d.date.slice(8)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecoveryHistory({ data }: { data: WhoopData["recoveryHistory"] }) {
  if (data.length === 0) return null;
  const avg = Math.round(data.reduce((a, d) => a + d.score, 0) / data.length);

  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted mb-1">Recovery History</p>
      <p className="text-[10px] text-muted mb-3">{data.length}-day avg: {avg}%</p>
      <div className="flex items-end gap-1.5 h-20">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.score}% — ${d.date}`}>
            <span className="text-[8px] text-muted">{d.score}</span>
            <div
              className="w-full rounded-t-sm transition-all"
              style={{
                height: `${d.score}%`,
                backgroundColor: getRecoveryColor(d.score),
                opacity: 0.8,
              }}
            />
            <span className="text-[9px] text-muted">{d.date.slice(8)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDistance(meters: number | null) {
  if (meters == null) return null;
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function daysAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${diff}d ago`;
}

function WorkoutCard({ workout }: { workout: WhoopData["workouts"][number] }) {
  const dist = formatDistance(workout.distanceMeters);
  const totalZoneMin = workout.zones
    ? Object.values(workout.zones).reduce((a, b) => a + b, 0)
    : 0;

  const zoneLabels = [
    { key: "zone0", color: "#94a3b8", label: "Rest" },
    { key: "zone1", color: "#60a5fa", label: "Easy" },
    { key: "zone2", color: "#34d399", label: "Light" },
    { key: "zone3", color: "#fbbf24", label: "Moderate" },
    { key: "zone4", color: "#f97316", label: "Hard" },
    { key: "zone5", color: "#ef4444", label: "All Out" },
  ];

  return (
    <div className="rounded-xl bg-card border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-base">{workout.sport}</p>
          <p className="text-xs text-muted">{daysAgo(workout.start)} &middot; {formatDuration(workout.durationMinutes)}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">{workout.strain.toFixed(1)}</p>
          <p className="text-xs text-muted">workout strain</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <div>
          <p className="text-xs text-muted">Avg Heart Rate</p>
          <p className="font-medium">{workout.avgHr} bpm</p>
        </div>
        <div>
          <p className="text-xs text-muted">Max Heart Rate</p>
          <p className="font-medium">{workout.maxHr} bpm</p>
        </div>
        <div>
          <p className="text-xs text-muted">Calories Burned</p>
          <p className="font-medium">{workout.calories} kcal</p>
        </div>
      </div>
      {dist && (
        <div className="mt-2 grid grid-cols-2 gap-3 text-center text-sm">
          <div>
            <p className="text-xs text-muted">Distance</p>
            <p className="font-medium">{dist}</p>
          </div>
          {workout.altitudeGainMeters != null && (
            <div>
              <p className="text-xs text-muted">Elevation Gain</p>
              <p className="font-medium">{Math.round(workout.altitudeGainMeters)} m</p>
            </div>
          )}
        </div>
      )}
      {workout.zones && totalZoneMin > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted mb-2">Heart Rate Zones</p>
          <div className="flex rounded-full overflow-hidden h-3 gap-px">
            {zoneLabels.map((z) => {
              const val = workout.zones![z.key as keyof typeof workout.zones];
              if (val === 0) return null;
              return (
                <div
                  key={z.key}
                  title={`${z.label}: ${val} min`}
                  style={{ width: `${(val / totalZoneMin) * 100}%`, backgroundColor: z.color }}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {zoneLabels.map((z) => {
              const val = workout.zones![z.key as keyof typeof workout.zones];
              if (val === 0) return null;
              return (
                <div key={z.key} className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: z.color }} />
                  <span className="text-[10px] text-muted">{z.label} {val}m</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function WhoopDashboard() {
  const [data, setData] = useState<WhoopData>(mockWhoopData);
  const [source, setSource] = useState<string>("loading");

  useEffect(() => {
    fetch("/api/whoop")
      .then((r) => r.json())
      .then((res) => {
        setData(res.data);
        setSource(res.source);
      })
      .catch(() => {
        setSource("mock");
      });
  }, []);

  const { recovery, recoveryHistory, sleep, sleepHistory, cycle, workouts, body } = data;

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${source === "live" || source === "database" ? "bg-whoop-green" : "bg-whoop-yellow"}`} />
          <span className="text-xs text-muted">
            {source === "live" || source === "database" ? "Live from Whoop" : source === "loading" ? "Loading..." : "Demo data"}
          </span>
        </div>
        {data.lastUpdated && (
          <span className="text-xs text-muted">
            Last synced {new Date(data.lastUpdated).toLocaleString()}
          </span>
        )}
      </div>

      {/* Top row: Recovery + HRV + Strain */}
      <div className="grid md:grid-cols-3 gap-4">
        <AnimatedSection delay={0.1}>
          <div className="rounded-2xl bg-card border border-border p-6 flex flex-col items-center">
            <p className="text-xs uppercase tracking-wider text-muted mb-2 self-start">Recovery Score</p>
            <RecoveryRing score={recovery.score} />
            <div className="mt-4 grid grid-cols-2 gap-4 w-full text-center">
              <div>
                <p className="text-xs text-muted">Resting Heart Rate</p>
                <p className="font-semibold">{recovery.rhr} bpm</p>
              </div>
              <div>
                <p className="text-xs text-muted">Blood Oxygen</p>
                <p className="font-semibold">{recovery.spo2 != null ? `${typeof recovery.spo2 === 'number' ? recovery.spo2.toFixed(1) : recovery.spo2}%` : "—"}</p>
              </div>
              {recovery.skinTempFahrenheit != null && (
                <div className="col-span-2">
                  <p className="text-xs text-muted">Skin Temperature</p>
                  <p className="font-semibold">{recovery.skinTempFahrenheit}°F / {recovery.skinTempCelsius}°C</p>
                </div>
              )}
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.2}>
          <div className="rounded-2xl bg-card border border-border p-6">
            <HrvSparkline data={recoveryHistory} current={recovery.hrv} />
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.3}>
          <div className="rounded-2xl bg-card border border-border p-6 flex flex-col items-center">
            <StrainGauge score={cycle.strain} max={21} calories={cycle.calories} avgHr={cycle.avgHr} />
          </div>
        </AnimatedSection>
      </div>

      {/* Sleep + Histories */}
      <div className="grid md:grid-cols-3 gap-4">
        <AnimatedSection delay={0.4} className="md:col-span-2">
          <div className="rounded-2xl bg-card border border-border p-6">
            <p className="text-xs uppercase tracking-wider text-muted mb-4">Last Night&apos;s Sleep</p>
            <SleepBar data={sleep} />
          </div>
        </AnimatedSection>

        <div className="space-y-4">
          {recoveryHistory.length > 0 && (
            <AnimatedSection delay={0.5}>
              <div className="rounded-2xl bg-card border border-border p-6">
                <RecoveryHistory data={recoveryHistory} />
              </div>
            </AnimatedSection>
          )}
          {sleepHistory.length > 0 && (
            <AnimatedSection delay={0.55}>
              <div className="rounded-2xl bg-card border border-border p-6">
                <SleepHistory data={sleepHistory} />
              </div>
            </AnimatedSection>
          )}
        </div>
      </div>

      {/* Body metrics */}
      {body && (
        <AnimatedSection delay={0.6}>
          <p className="text-xs uppercase tracking-wider text-muted mb-4">Body Measurements</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl bg-card border border-border p-5 text-center">
              <p className="text-xs text-muted mb-1">Height</p>
              <p className="text-xl font-bold">{Math.floor(body.heightMeters * 3.28084)}&apos;{Math.round((body.heightMeters * 3.28084 % 1) * 12)}&quot;</p>
              <p className="text-xs text-muted">{Math.round(body.heightMeters * 100)} cm</p>
            </div>
            <div className="rounded-2xl bg-card border border-border p-5 text-center">
              <p className="text-xs text-muted mb-1">Weight</p>
              <p className="text-xl font-bold">{Math.round(body.weightKg * 2.20462)} lbs</p>
              <p className="text-xs text-muted">{body.weightKg.toFixed(1)} kg</p>
            </div>
            <div className="rounded-2xl bg-card border border-border p-5 text-center">
              <p className="text-xs text-muted mb-1">Max Heart Rate</p>
              <p className="text-xl font-bold">{body.maxHeartRate}</p>
              <p className="text-xs text-muted">bpm</p>
            </div>
          </div>
        </AnimatedSection>
      )}

      {/* Workouts */}
      {workouts.length > 0 && (
        <AnimatedSection delay={0.7}>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted mb-4">Recent Workouts</p>
            <div className="grid md:grid-cols-2 gap-4">
              {workouts.map((w, i) => (
                <WorkoutCard key={i} workout={w} />
              ))}
            </div>
          </div>
        </AnimatedSection>
      )}
    </div>
  );
}
