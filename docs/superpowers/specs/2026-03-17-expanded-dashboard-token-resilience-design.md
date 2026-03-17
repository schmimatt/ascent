# Expanded Team Dashboard + Token Resilience

## Problem

1. The team comparison page only shows recovery score, sleep hours, and strain — discarding ~80% of synced Whoop data (HRV, RHR, SpO2, skin temp, sleep stages, efficiency, performance, respiratory rate, workout details, etc.).
2. When Whoop OAuth refresh tokens break (chain invalidation), all users except the most recently logged-in show 0% with no indication that re-authentication is needed. The sync silently fails indefinitely.

## Solution

Expand the compare API and UI to surface all synced data, and make the token refresh chain resilient so users effectively never need to re-login.

---

## 1. API Changes — Compare Route

**File**: `app/api/teams/[teamId]/compare/route.ts`

Expand `MemberComparison` interface. All numeric fields from Prisma nullable columns use `number | null` to match the schema. The entire object (recovery, sleep, strain) is `null` when no record exists for the date.

```typescript
export interface MemberComparison {
  userId: string;
  firstName: string;
  lastName: string;

  // Sync status
  lastDataDate: string | null;   // most recent date with any data in DB
  needsReauth: boolean;          // tokens are dead — user must re-login

  // Recovery (for selected date)
  recovery: {
    score: number | null;
    hrv: number | null;
    rhr: number | null;
    spo2: number | null;
    skinTempCelsius: number | null;
  } | null;

  // Sleep (for selected date, non-nap only)
  // Note: DB has @@unique([userId, date]) so only one sleep record per day is stored.
  // If a nap overwrites the main sleep for a given date, that's a pre-existing limitation.
  sleep: {
    totalHours: number;          // computed: (totalInBedHours ?? 0) - (totalAwakeHours ?? 0)
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

  // Strain / Day Cycle (for selected date)
  strain: {
    score: number | null;
    calories: number | null;
    avgHr: number | null;
    maxHr: number | null;
  } | null;

  // Workouts (for selected date — array, 0 or more)
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

  // 7-day history (unchanged)
  recoveryHistory: { date: string; score: number }[];
  sleepHistory: { date: string; totalHours: number }[];
  strainHistory: { date: string; strain: number }[];
}
```

### Sync status logic

To determine `needsReauth`:
- Expand the user select in the team members query to include `refreshToken` and `tokenExpiresAt` (server-side only — never leak these to the client).
- `needsReauth = true` if `refreshToken` is null AND the user has no data in the last 2 days. This avoids false positives where a user has no refresh token but their access token still works.

To determine `lastDataDate`:
- Find the most recent date from recovery, sleep, or cycle for that user.

### Workout query

Add a `prisma.workout.findMany()` filtered by userId + date for the selected day. Return all workouts (not just findFirst). Workouts don't have a unique constraint on [userId, date], so multiple per day is supported.

---

## 2. UI Changes — TeamCompare Component

**File**: `components/TeamCompare.tsx`

### Layout (hybrid approach)

**Top section — visual cards (quick glance):**
- Recovery rings: unchanged, but show "?" icon with "Needs re-auth" label when `needsReauth` is true, instead of showing 0%.
- Sleep hours bars: unchanged.
- Day strain bars: unchanged.

**Comprehensive detail table (replaces the existing Leaderboard table):**

One row per member. Columns grouped by category:

| Name | Recovery | HRV | RHR | SpO2 | Skin Temp | Sleep | Efficiency | Performance | Deep | REM | Light | Disturbances | Resp Rate | Strain | Calories | Avg HR | Max HR |
|------|----------|-----|-----|------|-----------|-------|------------|-------------|------|-----|-------|-------------|-----------|--------|----------|--------|--------|

- Members with no data for the date: show "—" in every cell.
- Members needing re-auth: subtle indicator on their row.
- Table scrolls horizontally on mobile.
- Sorted by recovery score descending (same as the old leaderboard).
- The old Leaderboard card is removed — this table is a strict superset of its data.

**Workouts section (new, below the detail table):**
- Only rendered if any member has workouts for the selected date.
- Each workout as a compact card: member name, sport name, duration, strain, calories, avg/max HR.
- Multiple workouts per member listed individually.

**7-day trends:** unchanged, remain at the bottom.

### Members list sync status

**File**: `app/teams/[teamId]/page.tsx`

Each member in the Members card gets a status dot next to their name:
- Green dot: has data within the last 2 days (syncing normally).
- Red dot + "Needs to re-authenticate" text: `needsReauth` is true.

The compare endpoint already returns `needsReauth` and `lastDataDate` per member, so the team page fetches `/api/teams/{teamId}/compare?date=today` on mount to get sync status.

---

## 3. Token Resilience

### A. Refresh on app load

**New file**: `app/api/auth/refresh/route.ts`

POST endpoint that:
1. Reads the session cookie to identify the logged-in user.
2. Looks up their refresh token from the DB.
3. If refresh token exists, calls Whoop's token endpoint to refresh.
4. Saves the new access + refresh tokens to DB.
5. Returns `{ ok: true }` or `{ error: "..." }`.

If the refresh fails (Whoop returns non-200), set `refreshToken = null` on the user record.

**Client-side**: In the root layout or a shared component, call `POST /api/auth/refresh` on mount (fire-and-forget). This keeps the token chain alive as long as the user opens the app at all.

### B. Atomic token rotation in sync

**File**: `lib/sync.ts` — `refreshUserToken()`

Current flow: refresh token -> get new tokens -> save to DB -> return access token.

This is already sequential and saves tokens before returning. No change to the save logic needed. However, add early-exit in `syncUserData`: if the first API call returns 401, skip remaining endpoints and return immediately instead of accumulating 5 identical 401 errors.

### C. Dead token detection

**File**: `lib/sync.ts` — `syncAllUsers()`

Restructure the error handling to separate token refresh failures from sync data failures:

```typescript
// Separate try-catch for token refresh vs data sync
let accessToken: string;
try {
  accessToken = await refreshUserToken(user.id, user.refreshToken);
} catch (e) {
  // Refresh failed — token chain is broken, null it out
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: null },
  });
  allErrors.push(`[${user.id}] token: ${e.message}`);
  continue; // skip to next user
}

// Data sync — errors here don't invalidate tokens
try {
  const result = await syncUserData(user.id, accessToken, fullSync);
  // ...
} catch (e) {
  allErrors.push(`[${user.id}] sync: ${e.message}`);
}
```

This ensures only actual token failures null out the refresh token — a network blip during data sync won't destroy a valid token chain.

---

## What's NOT changing

- Prisma schema: no changes needed, all data is already being synced and stored.
- Sync logic (`lib/sync.ts` data fetching): unchanged, already syncs all data types.
- 7-day trend charts: unchanged.
- Date picker: unchanged.
- Cron schedule: unchanged.
- Workout `zones` data: excluded from the compare response for now (complex nested data, low value for comparison view).
