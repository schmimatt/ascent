import { prisma } from "./prisma";
import { Prisma } from "./generated/prisma/client";

const BASE_URL = "https://api.prod.whoop.com/developer/v2";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

async function refreshUserToken(userId: string, refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed for user ${userId} (${res.status}): ${text}`);
  }

  const tokens = await res.json();

  // Update tokens in DB
  await prisma.user.update({
    where: { id: userId },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });

  // Also persist to Vercel env vars (backwards compat)
  if (tokens.refresh_token !== refreshToken) {
    const vercelToken = process.env.VERCEL_API_TOKEN;
    const projectId = process.env.VERCEL_PROJECT_ID;
    const teamId = process.env.VERCEL_TEAM_ID;
    if (vercelToken && projectId) {
      try {
        const listUrl = `https://api.vercel.com/v9/projects/${projectId}/env${teamId ? `?teamId=${teamId}` : ""}`;
        const listRes = await fetch(listUrl, {
          headers: { Authorization: `Bearer ${vercelToken}` },
        });
        const envVars = await listRes.json();
        const existing = envVars.envs?.find((e: { key: string }) => e.key === "WHOOP_REFRESH_TOKEN");
        if (existing) {
          await fetch(`https://api.vercel.com/v9/projects/${projectId}/env/${existing.id}${teamId ? `?teamId=${teamId}` : ""}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${vercelToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ value: tokens.refresh_token }),
          });
        }
      } catch (e) {
        console.error("Failed to persist refresh token to Vercel:", e);
      }
    }
  }

  return tokens.access_token;
}

async function whoopFetch(path: string, token: string, params?: Record<string, string>) {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Whoop API ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function whoopFetchAll(path: string, token: string, params?: Record<string, string>) {
  const allRecords: unknown[] = [];
  let nextToken: string | null = null;

  do {
    const p: Record<string, string> = { ...params, limit: "25" };
    if (nextToken) p.nextToken = nextToken;
    const res = await whoopFetch(path, token, p);
    if (res.records) allRecords.push(...res.records);
    nextToken = res.next_token || null;
  } while (nextToken);

  return allRecords;
}

function milliToHours(ms: number): number {
  return Math.round((ms / 3600000) * 10) / 10;
}

export async function syncUserData(
  userId: string,
  accessToken: string,
  fullSync = false
): Promise<{ synced: number; errors: string[] }> {
  let synced = 0;
  const errors: string[] = [];
  let got401 = false;

  const params: Record<string, string> = {};
  if (!fullSync) {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    params.start = weekAgo;
  }

  // Sync recovery
  try {
    const records = await whoopFetchAll("/recovery", accessToken, params);

    for (const r of records as Array<{ score_state: string; created_at: string; score?: { recovery_score: number; hrv_rmssd_milli: number; resting_heart_rate: number; spo2_percentage?: number; skin_temp_celsius?: number; user_calibrating: boolean } }>) {
      if (r.score_state !== "SCORED" || !r.score) continue;
      const date = new Date(r.created_at.split("T")[0]);
      await prisma.recovery.upsert({
        where: { userId_date: { userId, date } },
        update: {
          score: r.score.recovery_score,
          hrv: Math.round(r.score.hrv_rmssd_milli * 10) / 10,
          rhr: r.score.resting_heart_rate,
          spo2: r.score.spo2_percentage ?? null,
          skinTempCelsius: r.score.skin_temp_celsius ?? null,
          userCalibrating: r.score.user_calibrating,
          raw: r as object,
        },
        create: {
          userId,
          date,
          score: r.score.recovery_score,
          hrv: Math.round(r.score.hrv_rmssd_milli * 10) / 10,
          rhr: r.score.resting_heart_rate,
          spo2: r.score.spo2_percentage ?? null,
          skinTempCelsius: r.score.skin_temp_celsius ?? null,
          userCalibrating: r.score.user_calibrating,
          raw: r as object,
        },
      });
      synced++;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`recovery: ${msg}`);
    if (msg.includes("(401)")) got401 = true;
  }

  if (got401) {
    errors.push("Skipping remaining endpoints — access token is invalid");
    return { synced, errors };
  }

  // Sync sleep
  try {
    const records = await whoopFetchAll("/activity/sleep", accessToken, params);

    for (const s of records as Array<{ score_state: string; nap: boolean; start: string; end: string; score?: { stage_summary: { total_in_bed_time_milli: number; total_awake_time_milli: number; total_light_sleep_time_milli: number; total_rem_sleep_time_milli: number; total_slow_wave_sleep_time_milli: number; sleep_cycle_count: number; disturbance_count: number }; sleep_efficiency_percentage?: number; respiratory_rate?: number; sleep_performance_percentage?: number; sleep_consistency_percentage?: number } }>) {
      if (s.score_state !== "SCORED" || !s.score) continue;
      const date = new Date(s.end.split("T")[0]);
      const st = s.score.stage_summary;
      const sleepData = {
        totalInBedHours: milliToHours(st.total_in_bed_time_milli),
        totalAwakeHours: milliToHours(st.total_awake_time_milli),
        totalLightHours: milliToHours(st.total_light_sleep_time_milli),
        totalRemHours: milliToHours(st.total_rem_sleep_time_milli),
        totalDeepHours: milliToHours(st.total_slow_wave_sleep_time_milli),
        sleepCycleCount: st.sleep_cycle_count,
        disturbanceCount: st.disturbance_count,
        efficiency: s.score.sleep_efficiency_percentage ?? null,
        respiratoryRate: s.score.respiratory_rate ?? null,
        sleepPerformance: s.score.sleep_performance_percentage ?? null,
        sleepConsistency: s.score.sleep_consistency_percentage ?? null,
        nap: s.nap,
        startTime: new Date(s.start),
        endTime: new Date(s.end),
        raw: s as object,
      };

      await prisma.sleep.upsert({
        where: { userId_date: { userId, date } },
        update: sleepData,
        create: { userId, date, ...sleepData },
      });
      synced++;
    }
  } catch (e) {
    errors.push(`sleep: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Sync cycles
  try {
    const records = await whoopFetchAll("/cycle", accessToken, params);

    for (const c of records as Array<{ score_state: string; start: string; end?: string; score?: { strain: number; kilojoule: number; average_heart_rate: number; max_heart_rate: number } }>) {
      if (c.score_state !== "SCORED" || !c.score) continue;
      const date = new Date(c.start.split("T")[0]);
      const cycleData = {
        strain: Math.round(c.score.strain * 10) / 10,
        calories: Math.round(c.score.kilojoule * 0.239006),
        avgHr: c.score.average_heart_rate,
        maxHr: c.score.max_heart_rate,
        startTime: new Date(c.start),
        endTime: c.end ? new Date(c.end) : null,
        raw: c as object,
      };

      await prisma.cycle.upsert({
        where: { userId_date: { userId, date } },
        update: cycleData,
        create: { userId, date, ...cycleData },
      });
      synced++;
    }
  } catch (e) {
    errors.push(`cycle: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Sync workouts
  try {
    const records = await whoopFetchAll("/activity/workout", accessToken, params);

    for (const w of records as Array<{ id: string; score_state: string; sport_name: string; start: string; end: string; score?: { strain: number; average_heart_rate: number; max_heart_rate: number; kilojoule: number; distance_meter?: number; altitude_gain_meter?: number; zone_durations?: { zone_zero_milli: number; zone_one_milli: number; zone_two_milli: number; zone_three_milli: number; zone_four_milli: number; zone_five_milli: number } } }>) {
      if (w.score_state !== "SCORED" || !w.score) continue;
      const date = new Date(w.start.split("T")[0]);
      const dur = Math.round((new Date(w.end).getTime() - new Date(w.start).getTime()) / 60000);
      const zones = w.score.zone_durations ? {
        zone0: Math.round(w.score.zone_durations.zone_zero_milli / 60000),
        zone1: Math.round(w.score.zone_durations.zone_one_milli / 60000),
        zone2: Math.round(w.score.zone_durations.zone_two_milli / 60000),
        zone3: Math.round(w.score.zone_durations.zone_three_milli / 60000),
        zone4: Math.round(w.score.zone_durations.zone_four_milli / 60000),
        zone5: Math.round(w.score.zone_durations.zone_five_milli / 60000),
      } : null;

      const workoutData = {
        userId,
        date,
        sport: w.sport_name,
        strain: Math.round(w.score.strain * 10) / 10,
        avgHr: w.score.average_heart_rate,
        maxHr: w.score.max_heart_rate,
        calories: Math.round(w.score.kilojoule * 0.239006),
        durationMinutes: dur,
        distanceMeters: w.score.distance_meter ?? null,
        altitudeGainMeters: w.score.altitude_gain_meter ?? null,
        zones: zones ? (zones as Prisma.InputJsonValue) : Prisma.JsonNull,
        startTime: new Date(w.start),
        endTime: new Date(w.end),
        raw: w as object,
      };

      await prisma.workout.upsert({
        where: { whoopId: w.id },
        update: workoutData,
        create: { whoopId: w.id, ...workoutData },
      });
      synced++;
    }
  } catch (e) {
    errors.push(`workout: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Sync body measurement
  try {
    const body = await whoopFetch("/user/measurement/body", accessToken);
    if (body) {
      const today = new Date(new Date().toISOString().split("T")[0]);
      await prisma.bodyMeasurement.upsert({
        where: { userId_date: { userId, date: today } },
        update: {
          heightMeters: body.height_meter,
          weightKg: body.weight_kilogram,
          maxHeartRate: body.max_heart_rate,
        },
        create: {
          userId,
          date: today,
          heightMeters: body.height_meter,
          weightKg: body.weight_kilogram,
          maxHeartRate: body.max_heart_rate,
        },
      });
      synced++;
    }
  } catch (e) {
    errors.push(`body: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { synced, errors };
}

// Sync all users in the database
export async function syncAllUsers(fullSync = false): Promise<{ synced: number; errors: string[] }> {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { refreshToken: { not: null } },
        { accessToken: { not: null } },
      ],
    },
    select: { id: true, accessToken: true, refreshToken: true, tokenExpiresAt: true },
  });

  let totalSynced = 0;
  const allErrors: string[] = [];

  for (const user of users) {
    let accessToken: string;

    // Step 1: Refresh token — always refresh to keep the chain alive
    if (user.refreshToken) {
      try {
        accessToken = await refreshUserToken(user.id, user.refreshToken);
      } catch (e) {
        // Retry once after a short delay — Whoop may have a transient error
        try {
          await new Promise(r => setTimeout(r, 2000));
          accessToken = await refreshUserToken(user.id, user.refreshToken);
        } catch (e2) {
          // Token chain is broken — null out refresh token so we stop retrying
          // and UI can show "needs re-auth"
          await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken: null },
          });
          allErrors.push(`[${user.id}] token: ${e2 instanceof Error ? e2.message : String(e2)}`);
          continue;
        }
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

  // Log sync
  await prisma.syncLog.create({
    data: {
      recordsSynced: totalSynced,
      error: allErrors.length > 0 ? allErrors.join("; ") : null,
    },
  });

  return { synced: totalSynced, errors: allErrors };
}
