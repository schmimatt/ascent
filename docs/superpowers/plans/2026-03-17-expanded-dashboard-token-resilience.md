# Expanded Team Dashboard + Token Resilience Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface all synced Whoop data on the team comparison page, and make OAuth token refresh resilient so users never need to re-login.

**Architecture:** The compare API expands to return all stored metrics (recovery, sleep, strain, workouts) plus sync status per member. The UI keeps the existing visual cards at top, replaces the leaderboard with a comprehensive detail table, and adds a workouts section. Token resilience is achieved via refresh-on-app-load, separated error handling in sync, and dead token detection.

**Tech Stack:** Next.js 16, React 19, Prisma 7 (Neon adapter), TypeScript, Tailwind 4, shadcn/ui components

**Spec:** `docs/superpowers/specs/2026-03-17-expanded-dashboard-token-resilience-design.md`

---

## Chunk 1: Token Resilience

### Task 1: Dead token detection in sync

**Files:**
- Modify: `lib/sync.ts` (lines 295-343, `syncAllUsers` function)

- [ ] **Step 1: Restructure error handling in `syncAllUsers()`**

In `lib/sync.ts`, replace the single try-catch in the `for (const user of users)` loop (lines 309-333) with separated try-catches for token refresh vs data sync:

```typescript
for (const user of users) {
  let accessToken: string;

  // Step 1: Refresh token — failures here mean the chain is broken
  if (user.refreshToken) {
    try {
      accessToken = await refreshUserToken(user.id, user.refreshToken);
    } catch (e) {
      // Token chain is broken — null out refresh token so we stop retrying
      // and UI can show "needs re-auth"
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: null },
      });
      allErrors.push(`[${user.id}] token: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
  } else if (user.accessToken && user.tokenExpiresAt && user.tokenExpiresAt > new Date()) {
    accessToken = user.accessToken;
  } else if (user.accessToken) {
    accessToken = user.accessToken;
  } else {
    allErrors.push(`[${user.id}] no valid token`);
    continue;
  }

  // Step 2: Sync data — errors here do NOT invalidate tokens
  try {
    const result = await syncUserData(user.id, accessToken, fullSync);
    totalSynced += result.synced;
    allErrors.push(...result.errors.map(e => `[${user.id}] ${e}`));
  } catch (e) {
    allErrors.push(`[${user.id}] sync: ${e instanceof Error ? e.message : String(e)}`);
  }
}
```

- [ ] **Step 2: Add early-exit on 401 in `syncUserData()`**

In `lib/sync.ts`, in the `syncUserData()` function, add a helper to detect 401 errors. If the first endpoint (recovery) fails with a 401, return immediately instead of trying all 5 endpoints with a dead token:

```typescript
// At the top of syncUserData, add a flag
let got401 = false;

// In each endpoint's catch block (recovery, sleep, cycles, workouts, body),
// check if the error message contains "401" and set the flag:
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  errors.push(`recovery: ${msg}`);
  if (msg.includes("(401)")) got401 = true;
}

// After the recovery sync block, add:
if (got401) {
  errors.push("Skipping remaining endpoints — access token is invalid");
  return { synced, errors };
}
```

- [ ] **Step 3: Verify the app builds**

Run: `cd /Users/matthewschmidt/ascent && npx next build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add lib/sync.ts
git commit -m "fix: separate token refresh from data sync error handling

Null out refreshToken when refresh fails so UI can detect dead tokens.
Prevents data sync errors from incorrectly invalidating valid tokens.
Early-exits on 401 to avoid redundant API calls with dead tokens."
```

---

### Task 2: Refresh on app load

**Files:**
- Create: `app/api/auth/refresh/route.ts`
- Modify: `app/layout.tsx` (add client-side refresh call)

- [ ] **Step 1: Create the refresh API route**

Create `app/api/auth/refresh/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

export async function POST() {
  try {
    let session;
    try {
      session = await requireAuth();
    } catch {
      // No session (unauthenticated page load) — skip silently
      return NextResponse.json({ ok: true, skipped: true });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { refreshToken: true, tokenExpiresAt: true },
    });

    if (!user?.refreshToken) {
      return NextResponse.json({ ok: false, error: "no_refresh_token" });
    }

    // Skip refresh if token is still valid for more than 1 hour
    if (user.tokenExpiresAt && user.tokenExpiresAt.getTime() > Date.now() + 3600000) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: user.refreshToken,
        client_id: process.env.WHOOP_CLIENT_ID!,
        client_secret: process.env.WHOOP_CLIENT_SECRET!,
      }),
    });

    if (!res.ok) {
      // Refresh failed — token chain is broken
      await prisma.user.update({
        where: { id: session.userId },
        data: { refreshToken: null },
      });
      return NextResponse.json({ ok: false, error: "refresh_failed" });
    }

    const tokens = await res.json();

    await prisma.user.update({
      where: { id: session.userId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
}
```

- [ ] **Step 2: Read the current layout file**

Read `app/layout.tsx` to understand the current structure before modifying.

- [ ] **Step 3: Add client-side refresh trigger**

Create a small component and add it to the layout. The component calls `/api/auth/refresh` on mount (fire-and-forget). It should only fire if the user is logged in (has a session cookie).

Add a new component inline or as a separate file `components/TokenRefresh.tsx`:

```typescript
"use client";

import { useEffect } from "react";

export function TokenRefresh() {
  useEffect(() => {
    // Fire-and-forget — refresh token on app load
    fetch("/api/auth/refresh", { method: "POST" }).catch(() => {});
  }, []);

  return null;
}
```

Add `<TokenRefresh />` inside the `<body>` in `app/layout.tsx`.

- [ ] **Step 4: Verify the app builds**

Run: `cd /Users/matthewschmidt/ascent && npx next build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/refresh/route.ts components/TokenRefresh.tsx app/layout.tsx
git commit -m "feat: refresh Whoop token on app load

Keeps the OAuth refresh chain alive as long as users open the app.
Nulls out dead refresh tokens so UI can detect re-auth needed."
```

---

## Chunk 2: Expanded Compare API

### Task 3: Expand the MemberComparison interface and API response

**Files:**
- Modify: `app/api/teams/[teamId]/compare/route.ts`

- [ ] **Step 1: Replace the MemberComparison interface**

Replace the existing `MemberComparison` interface (lines 5-15) with:

```typescript
export interface MemberComparison {
  userId: string;
  firstName: string;
  lastName: string;

  // Sync status
  lastDataDate: string | null;
  needsReauth: boolean;

  // Recovery
  recovery: {
    score: number | null;
    hrv: number | null;
    rhr: number | null;
    spo2: number | null;
    skinTempCelsius: number | null;
  } | null;

  // Sleep
  sleep: {
    totalHours: number;
    totalInBedHours: number | null;
    totalAwakeHours: number | null;
    totalLightHours: number | null;
    totalRemHours: number | null;
    totalDeepHours: number | null;
    sleepCycleCount: number | null;
    disturbanceCount: number | null;
    efficiency: number | null;
    sleepPerformance: number | null;
    sleepConsistency: number | null;
    respiratoryRate: number | null;
  } | null;

  // Strain
  strain: {
    score: number | null;
    calories: number | null;
    avgHr: number | null;
    maxHr: number | null;
  } | null;

  // Workouts
  workouts: {
    sport: string | null;
    strain: number | null;
    avgHr: number | null;
    maxHr: number | null;
    calories: number | null;
    durationMinutes: number | null;
    distanceMeters: number | null;
    altitudeGainMeters: number | null;
  }[];

  // 7-day history
  recoveryHistory: { date: string; score: number }[];
  sleepHistory: { date: string; totalHours: number }[];
  strainHistory: { date: string; strain: number }[];
}
```

- [ ] **Step 2: Update the team members query to include token fields**

In the GET handler, update the `prisma.teamMember.findMany()` call (around line 39) to include `refreshToken` and `tokenExpiresAt` in the user select:

```typescript
const members = await prisma.teamMember.findMany({
  where: { teamId },
  include: {
    user: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        refreshToken: true,
        tokenExpiresAt: true,
      },
    },
  },
  orderBy: { joinedAt: "asc" },
});
```

- [ ] **Step 3: Update the per-member data mapping**

Replace the `Promise.all` block inside `members.map()` (lines 54-115) with expanded queries and response mapping:

```typescript
const comparisons: MemberComparison[] = await Promise.all(
  members.map(async (m) => {
    const userId = m.user.id;

    const dayFilter = targetDate
      ? { userId, date: targetDate }
      : { userId };
    const dayOrder = targetDate ? undefined : { date: "desc" as const };

    const [latestRecovery, latestSleep, latestCycle, workouts, recoveryHist, sleepHist, strainHist, lastData] = await Promise.all([
      prisma.recovery.findFirst({ where: dayFilter, orderBy: dayOrder }),
      prisma.sleep.findFirst({ where: { ...dayFilter, nap: false }, orderBy: dayOrder }),
      prisma.cycle.findFirst({ where: dayFilter, orderBy: dayOrder }),
      // Workouts: findMany for the day (multiple per day possible)
      targetDate
        ? prisma.workout.findMany({ where: { userId, date: targetDate }, orderBy: { startTime: "asc" } })
        : prisma.workout.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 5 }),
      prisma.recovery.findMany({
        where: { userId, date: { gte: sevenDaysAgo, lte: historyEnd } },
        orderBy: { date: "asc" },
        select: { date: true, score: true },
      }),
      prisma.sleep.findMany({
        where: { userId, nap: false, date: { gte: sevenDaysAgo, lte: historyEnd } },
        orderBy: { date: "asc" },
        select: { date: true, totalInBedHours: true, totalAwakeHours: true },
      }),
      prisma.cycle.findMany({
        where: { userId, date: { gte: sevenDaysAgo, lte: historyEnd } },
        orderBy: { date: "asc" },
        select: { date: true, strain: true },
      }),
      // Last data date: most recent recovery, sleep, or cycle
      prisma.recovery.findFirst({
        where: { userId },
        orderBy: { date: "desc" },
        select: { date: true },
      }),
    ]);

    // Determine needsReauth
    const hasRecentData = lastData && (Date.now() - lastData.date.getTime()) < 2 * 86400000;
    const needsReauth = !m.user.refreshToken && !hasRecentData;

    return {
      userId,
      firstName: m.user.firstName ?? "",
      lastName: m.user.lastName ?? "",
      lastDataDate: lastData?.date.toISOString().split("T")[0] ?? null,
      needsReauth,
      recovery: latestRecovery
        ? {
            score: latestRecovery.score,
            hrv: latestRecovery.hrv,
            rhr: latestRecovery.rhr,
            spo2: latestRecovery.spo2,
            skinTempCelsius: latestRecovery.skinTempCelsius,
          }
        : null,
      sleep: latestSleep
        ? {
            totalHours: (latestSleep.totalInBedHours ?? 0) - (latestSleep.totalAwakeHours ?? 0),
            totalInBedHours: latestSleep.totalInBedHours,
            totalAwakeHours: latestSleep.totalAwakeHours,
            totalLightHours: latestSleep.totalLightHours,
            totalRemHours: latestSleep.totalRemHours,
            totalDeepHours: latestSleep.totalDeepHours,
            sleepCycleCount: latestSleep.sleepCycleCount,
            disturbanceCount: latestSleep.disturbanceCount,
            efficiency: latestSleep.efficiency,
            sleepPerformance: latestSleep.sleepPerformance,
            sleepConsistency: latestSleep.sleepConsistency,
            respiratoryRate: latestSleep.respiratoryRate,
          }
        : null,
      strain: latestCycle
        ? {
            score: latestCycle.strain,
            calories: latestCycle.calories,
            avgHr: latestCycle.avgHr,
            maxHr: latestCycle.maxHr,
          }
        : null,
      workouts: workouts.map(w => ({
        sport: w.sport,
        strain: w.strain,
        avgHr: w.avgHr,
        maxHr: w.maxHr,
        calories: w.calories,
        durationMinutes: w.durationMinutes,
        distanceMeters: w.distanceMeters,
        altitudeGainMeters: w.altitudeGainMeters,
      })),
      recoveryHistory: recoveryHist
        .filter(r => r.score !== null)
        .map(r => ({
          date: r.date.toISOString().split("T")[0],
          score: r.score!,
        })),
      sleepHistory: sleepHist.map(s => ({
        date: s.date.toISOString().split("T")[0],
        totalHours: (s.totalInBedHours ?? 0) - (s.totalAwakeHours ?? 0),
      })),
      strainHistory: strainHist
        .filter(c => c.strain !== null)
        .map(c => ({
          date: c.date.toISOString().split("T")[0],
          strain: c.strain!,
        })),
    };
  })
);
```

- [ ] **Step 4: Verify the app builds**

Run: `cd /Users/matthewschmidt/ascent && npx next build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add app/api/teams/[teamId]/compare/route.ts
git commit -m "feat: expand compare API with all Whoop metrics, workouts, sync status

Returns recovery (score, HRV, RHR, SpO2, skin temp), full sleep breakdown,
strain (score, calories, HR), workouts array, and needsReauth status."
```

---

## Chunk 3: Expanded UI

### Task 4: Update TeamCompare to show all data

**Files:**
- Modify: `components/TeamCompare.tsx`

- [ ] **Step 1: Update the recovery rings to handle needsReauth**

In the `RecoveryRingSmall` component, add a `needsReauth` prop. When true, show a "?" instead of the score and use a muted color:

```typescript
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
```

Update the usage in the recovery rings section to pass `needsReauth`:

```typescript
<RecoveryRingSmall
  key={m.userId}
  score={m.recovery?.score ?? 0}
  name={m.firstName}
  needsReauth={m.needsReauth}
/>
```

- [ ] **Step 2: Replace the Leaderboard table with the comprehensive detail table**

Remove the existing Leaderboard Card (lines 309-350) and replace with a new comprehensive table. The table should have all metrics as columns, grouped by category. Use the existing `Table` components from shadcn/ui:

```typescript
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
```

- [ ] **Step 3: Add workouts section**

Below the detail table, add a workouts section. Only render if any member has workouts for the date:

```typescript
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
```

- [ ] **Step 4: Verify the app builds**

Run: `cd /Users/matthewschmidt/ascent && npx next build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add components/TeamCompare.tsx
git commit -m "feat: expand team compare UI with all metrics, workouts, re-auth status

Replace leaderboard with comprehensive detail table showing all recovery,
sleep, and strain metrics. Add workouts section. Show re-auth indicator
for members with dead tokens."
```

---

### Task 5: Add sync status to members list

**Files:**
- Modify: `app/teams/[teamId]/page.tsx`

- [ ] **Step 1: Fetch sync status from compare endpoint**

In the `TeamPage` component, add state for sync status and fetch it from the compare endpoint. Add after the existing `useEffect` that fetches team details:

```typescript
const [syncStatus, setSyncStatus] = useState<Record<string, { needsReauth: boolean; lastDataDate: string | null }>>({});

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
```

- [ ] **Step 2: Add status indicators to member list items**

Update the member list rendering (around line 169) to show sync status dots:

```typescript
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
```

- [ ] **Step 3: Verify the app builds**

Run: `cd /Users/matthewschmidt/ascent && npx next build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add app/teams/[teamId]/page.tsx
git commit -m "feat: show sync status indicators on team members list

Green dot for actively syncing members, red dot with message for
members who need to re-authenticate their Whoop connection."
```

---

### Task 6: Manual verification

- [ ] **Step 1: Start dev server**

Run: `cd /Users/matthewschmidt/ascent && npm run dev`

- [ ] **Step 2: Open the team page in browser**

Navigate to the team page with Chris's data. Verify:
- Chris shows recovery ring with score, all other members show "?" with "Re-auth needed"
- Detail table shows all metrics for Chris (recovery, HRV, RHR, SpO2, skin temp, full sleep breakdown, strain, calories, HR)
- Other members show "—" across all columns with dimmed row
- Members list shows green dot for Chris, red dot + "Needs to re-authenticate" for others
- If Chris had workouts on the selected date, workouts section appears
- Navigate to March 12 to see Chris's running workout
- 7-day trends still work

- [ ] **Step 3: Final commit and push**

```bash
git push origin main
```
