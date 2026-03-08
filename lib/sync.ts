import { getDb } from "./db";

const BASE_URL = "https://api.prod.whoop.com/developer/v2";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

async function refreshAccessToken() {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.WHOOP_REFRESH_TOKEN!,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  const tokens = await res.json();

  // Persist rotated token
  if (tokens.refresh_token !== process.env.WHOOP_REFRESH_TOKEN) {
    process.env.WHOOP_REFRESH_TOKEN = tokens.refresh_token;
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
        console.error("Failed to persist refresh token:", e);
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

// Fetch ALL pages from a paginated endpoint
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

export async function syncWhoopData(fullSync = false): Promise<{ synced: number; errors: string[] }> {
  const sql = getDb();
  const token = await refreshAccessToken();
  let synced = 0;
  const errors: string[] = [];

  // Determine how far back to fetch
  // Full sync: all history. Regular sync: last 7 days
  const params: Record<string, string> = {};
  if (!fullSync) {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    params.start = weekAgo;
  }

  // Sync recovery
  try {
    const records = fullSync
      ? await whoopFetchAll("/recovery", token, params)
      : (await whoopFetch("/recovery", token, { ...params, limit: "25" })).records || [];

    for (const r of records as Array<{ score_state: string; created_at: string; score?: { recovery_score: number; hrv_rmssd_milli: number; resting_heart_rate: number; spo2_percentage?: number; skin_temp_celsius?: number; user_calibrating: boolean } }>) {
      if (r.score_state !== "SCORED" || !r.score) continue;
      const date = r.created_at.split("T")[0];
      await sql`
        INSERT INTO recovery (date, score, hrv, rhr, spo2, skin_temp_celsius, user_calibrating, raw)
        VALUES (${date}, ${r.score.recovery_score}, ${Math.round(r.score.hrv_rmssd_milli * 10) / 10},
                ${r.score.resting_heart_rate}, ${r.score.spo2_percentage ?? null},
                ${r.score.skin_temp_celsius ?? null}, ${r.score.user_calibrating}, ${JSON.stringify(r)})
        ON CONFLICT (date) DO UPDATE SET
          score = EXCLUDED.score, hrv = EXCLUDED.hrv, rhr = EXCLUDED.rhr,
          spo2 = EXCLUDED.spo2, skin_temp_celsius = EXCLUDED.skin_temp_celsius,
          user_calibrating = EXCLUDED.user_calibrating, raw = EXCLUDED.raw
      `;
      synced++;
    }
  } catch (e) {
    errors.push(`recovery: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Sync sleep
  try {
    const records = fullSync
      ? await whoopFetchAll("/activity/sleep", token, params)
      : (await whoopFetch("/activity/sleep", token, { ...params, limit: "25" })).records || [];

    for (const s of records as Array<{ score_state: string; nap: boolean; start: string; end: string; score?: { stage_summary: { total_in_bed_time_milli: number; total_awake_time_milli: number; total_light_sleep_time_milli: number; total_rem_sleep_time_milli: number; total_slow_wave_sleep_time_milli: number; sleep_cycle_count: number; disturbance_count: number }; sleep_efficiency_percentage?: number; respiratory_rate?: number; sleep_performance_percentage?: number; sleep_consistency_percentage?: number } }>) {
      if (s.score_state !== "SCORED" || !s.score) continue;
      const date = s.start.split("T")[0];
      const st = s.score.stage_summary;
      await sql`
        INSERT INTO sleep (date, total_in_bed_hours, total_awake_hours, total_light_hours,
                          total_rem_hours, total_deep_hours, sleep_cycle_count, disturbance_count,
                          efficiency, respiratory_rate, sleep_performance, sleep_consistency,
                          nap, start_time, end_time, raw)
        VALUES (${date}, ${milliToHours(st.total_in_bed_time_milli)}, ${milliToHours(st.total_awake_time_milli)},
                ${milliToHours(st.total_light_sleep_time_milli)}, ${milliToHours(st.total_rem_sleep_time_milli)},
                ${milliToHours(st.total_slow_wave_sleep_time_milli)}, ${st.sleep_cycle_count},
                ${st.disturbance_count}, ${s.score.sleep_efficiency_percentage ?? null},
                ${s.score.respiratory_rate ?? null}, ${s.score.sleep_performance_percentage ?? null},
                ${s.score.sleep_consistency_percentage ?? null}, ${s.nap}, ${s.start}, ${s.end},
                ${JSON.stringify(s)})
        ON CONFLICT (date) DO UPDATE SET
          total_in_bed_hours = EXCLUDED.total_in_bed_hours, total_awake_hours = EXCLUDED.total_awake_hours,
          total_light_hours = EXCLUDED.total_light_hours, total_rem_hours = EXCLUDED.total_rem_hours,
          total_deep_hours = EXCLUDED.total_deep_hours, sleep_cycle_count = EXCLUDED.sleep_cycle_count,
          disturbance_count = EXCLUDED.disturbance_count, efficiency = EXCLUDED.efficiency,
          respiratory_rate = EXCLUDED.respiratory_rate, sleep_performance = EXCLUDED.sleep_performance,
          sleep_consistency = EXCLUDED.sleep_consistency, nap = EXCLUDED.nap,
          start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, raw = EXCLUDED.raw
      `;
      synced++;
    }
  } catch (e) {
    errors.push(`sleep: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Sync cycles
  try {
    const records = fullSync
      ? await whoopFetchAll("/cycle", token, params)
      : (await whoopFetch("/cycle", token, { ...params, limit: "25" })).records || [];

    for (const c of records as Array<{ score_state: string; start: string; end?: string; score?: { strain: number; kilojoule: number; average_heart_rate: number; max_heart_rate: number } }>) {
      if (c.score_state !== "SCORED" || !c.score) continue;
      const date = c.start.split("T")[0];
      await sql`
        INSERT INTO cycle (date, strain, calories, avg_hr, max_hr, start_time, end_time, raw)
        VALUES (${date}, ${Math.round(c.score.strain * 10) / 10},
                ${Math.round(c.score.kilojoule * 0.239006)},
                ${c.score.average_heart_rate}, ${c.score.max_heart_rate},
                ${c.start}, ${c.end ?? null}, ${JSON.stringify(c)})
        ON CONFLICT (date) DO UPDATE SET
          strain = EXCLUDED.strain, calories = EXCLUDED.calories,
          avg_hr = EXCLUDED.avg_hr, max_hr = EXCLUDED.max_hr,
          start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, raw = EXCLUDED.raw
      `;
      synced++;
    }
  } catch (e) {
    errors.push(`cycle: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Sync workouts
  try {
    const records = fullSync
      ? await whoopFetchAll("/activity/workout", token, params)
      : (await whoopFetch("/activity/workout", token, { ...params, limit: "25" })).records || [];

    for (const w of records as Array<{ id: string; score_state: string; sport_name: string; start: string; end: string; score?: { strain: number; average_heart_rate: number; max_heart_rate: number; kilojoule: number; distance_meter?: number; altitude_gain_meter?: number; zone_durations?: { zone_zero_milli: number; zone_one_milli: number; zone_two_milli: number; zone_three_milli: number; zone_four_milli: number; zone_five_milli: number } } }>) {
      if (w.score_state !== "SCORED" || !w.score) continue;
      const date = w.start.split("T")[0];
      const dur = Math.round((new Date(w.end).getTime() - new Date(w.start).getTime()) / 60000);
      const zones = w.score.zone_durations ? {
        zone0: Math.round(w.score.zone_durations.zone_zero_milli / 60000),
        zone1: Math.round(w.score.zone_durations.zone_one_milli / 60000),
        zone2: Math.round(w.score.zone_durations.zone_two_milli / 60000),
        zone3: Math.round(w.score.zone_durations.zone_three_milli / 60000),
        zone4: Math.round(w.score.zone_durations.zone_four_milli / 60000),
        zone5: Math.round(w.score.zone_durations.zone_five_milli / 60000),
      } : null;

      await sql`
        INSERT INTO workout (whoop_id, date, sport, strain, avg_hr, max_hr, calories,
                            duration_minutes, distance_meters, altitude_gain_meters,
                            zones, start_time, end_time, raw)
        VALUES (${w.id}, ${date}, ${w.sport_name}, ${Math.round(w.score.strain * 10) / 10},
                ${w.score.average_heart_rate}, ${w.score.max_heart_rate},
                ${Math.round(w.score.kilojoule * 0.239006)}, ${dur},
                ${w.score.distance_meter ?? null}, ${w.score.altitude_gain_meter ?? null},
                ${zones ? JSON.stringify(zones) : null}, ${w.start}, ${w.end},
                ${JSON.stringify(w)})
        ON CONFLICT (whoop_id) DO UPDATE SET
          strain = EXCLUDED.strain, avg_hr = EXCLUDED.avg_hr, max_hr = EXCLUDED.max_hr,
          calories = EXCLUDED.calories, duration_minutes = EXCLUDED.duration_minutes,
          distance_meters = EXCLUDED.distance_meters, altitude_gain_meters = EXCLUDED.altitude_gain_meters,
          zones = EXCLUDED.zones, raw = EXCLUDED.raw
      `;
      synced++;
    }
  } catch (e) {
    errors.push(`workout: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Sync body measurement
  try {
    const body = await whoopFetch("/user/measurement/body", token);
    if (body) {
      const today = new Date().toISOString().split("T")[0];
      await sql`
        INSERT INTO body_measurement (date, height_meters, weight_kg, max_heart_rate)
        VALUES (${today}, ${body.height_meter}, ${body.weight_kilogram}, ${body.max_heart_rate})
        ON CONFLICT (date) DO UPDATE SET
          height_meters = EXCLUDED.height_meters, weight_kg = EXCLUDED.weight_kg,
          max_heart_rate = EXCLUDED.max_heart_rate
      `;
      synced++;
    }
  } catch (e) {
    errors.push(`body: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Log sync
  await sql`
    INSERT INTO sync_log (records_synced, error)
    VALUES (${synced}, ${errors.length > 0 ? errors.join("; ") : null})
  `;

  return { synced, errors };
}
