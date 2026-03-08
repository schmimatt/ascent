import { WhoopData, RecoveryData, SleepData, CycleData, Workout, BodyMeasurement, UserProfile } from "@/types/whoop";

const BASE_URL = "https://api.prod.whoop.com/developer/v2";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

// Persist the new refresh token to Vercel env vars via their API
async function persistRefreshToken(newToken: string) {
  const vercelToken = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!vercelToken || !projectId) return;

  try {
    // Get existing env var ID
    const listUrl = `https://api.vercel.com/v9/projects/${projectId}/env${teamId ? `?teamId=${teamId}` : ""}`;
    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${vercelToken}` },
    });
    const envVars = await listRes.json();
    const existing = envVars.envs?.find((e: { key: string }) => e.key === "WHOOP_REFRESH_TOKEN");

    if (existing) {
      // Update existing
      const updateUrl = `https://api.vercel.com/v9/projects/${projectId}/env/${existing.id}${teamId ? `?teamId=${teamId}` : ""}`;
      await fetch(updateUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: newToken }),
      });
    }
  } catch (e) {
    console.error("Failed to persist refresh token:", e);
  }
}

async function refreshAccessToken(): Promise<TokenResponse> {
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

  const tokens: TokenResponse = await res.json();

  // Whoop rotates refresh tokens — persist the new one
  if (tokens.refresh_token !== process.env.WHOOP_REFRESH_TOKEN) {
    process.env.WHOOP_REFRESH_TOKEN = tokens.refresh_token;
    await persistRefreshToken(tokens.refresh_token);
  }

  return tokens;
}

async function whoopFetch(path: string, accessToken: string, params?: Record<string, string>) {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Whoop API ${path} failed (${res.status}): ${text}`);
  }

  return res.json();
}

function milliToHours(ms: number): number {
  return Math.round((ms / 3600000) * 10) / 10;
}

export async function fetchWhoopData(): Promise<WhoopData> {
  const tokens = await refreshAccessToken();
  const token = tokens.access_token;

  const [profileRes, bodyRes, recoveryRes, sleepRes, cycleRes, workoutRes] = await Promise.all([
    whoopFetch("/user/profile/basic", token).catch(() => null),
    whoopFetch("/user/measurement/body", token).catch(() => null),
    whoopFetch("/recovery", token, { limit: "7" }).catch(() => ({ records: [] })),
    whoopFetch("/activity/sleep", token, { limit: "7" }).catch(() => ({ records: [] })),
    whoopFetch("/cycle", token, { limit: "1" }).catch(() => ({ records: [] })),
    whoopFetch("/activity/workout", token, { limit: "10" }).catch(() => ({ records: [] })),
  ]);

  const profile: UserProfile | null = profileRes ? {
    firstName: profileRes.first_name,
    lastName: profileRes.last_name,
    email: profileRes.email,
  } : null;

  const body: BodyMeasurement | null = bodyRes ? {
    heightMeters: bodyRes.height_meter,
    weightKg: bodyRes.weight_kilogram,
    maxHeartRate: bodyRes.max_heart_rate,
  } : null;

  const recoveryRecords = recoveryRes.records || [];
  const latestRecovery = recoveryRecords[0];
  const recoveryScore = latestRecovery?.score;

  const recovery: RecoveryData = recoveryScore ? {
    score: recoveryScore.recovery_score,
    hrv: Math.round(recoveryScore.hrv_rmssd_milli * 10) / 10,
    rhr: recoveryScore.resting_heart_rate,
    spo2: recoveryScore.spo2_percentage ?? null,
    skinTempCelsius: recoveryScore.skin_temp_celsius ?? null,
    skinTempFahrenheit: recoveryScore.skin_temp_celsius != null
      ? Math.round((recoveryScore.skin_temp_celsius * 9 / 5 + 32) * 10) / 10
      : null,
    userCalibrating: recoveryScore.user_calibrating,
  } : {
    score: 0, hrv: 0, rhr: 0, spo2: null,
    skinTempCelsius: null, skinTempFahrenheit: null, userCalibrating: true,
  };

  const recoveryHistory = recoveryRecords
    .filter((r: { score_state: string }) => r.score_state === "SCORED")
    .map((r: { created_at: string; score: { recovery_score: number; hrv_rmssd_milli: number } }) => ({
      date: r.created_at.split("T")[0],
      score: r.score.recovery_score,
      hrv: Math.round(r.score.hrv_rmssd_milli * 10) / 10,
    }))
    .reverse();

  const sleepRecords = sleepRes.records || [];
  const latestSleep = sleepRecords[0];
  const sleepScore = latestSleep?.score;
  const stages = sleepScore?.stage_summary;
  const sleepNeeded = sleepScore?.sleep_needed;

  const sleep: SleepData = stages ? {
    totalInBedHours: milliToHours(stages.total_in_bed_time_milli),
    totalAwakeHours: milliToHours(stages.total_awake_time_milli),
    totalLightHours: milliToHours(stages.total_light_sleep_time_milli),
    totalRemHours: milliToHours(stages.total_rem_sleep_time_milli),
    totalDeepHours: milliToHours(stages.total_slow_wave_sleep_time_milli),
    sleepCycleCount: stages.sleep_cycle_count,
    disturbanceCount: stages.disturbance_count,
    efficiency: sleepScore.sleep_efficiency_percentage ?? 0,
    respiratoryRate: sleepScore.respiratory_rate ?? null,
    sleepPerformance: sleepScore.sleep_performance_percentage ?? null,
    sleepConsistency: sleepScore.sleep_consistency_percentage ?? null,
    sleepNeededBaseline: sleepNeeded ? milliToHours(sleepNeeded.baseline_milli) : 0,
    sleepNeededDebt: sleepNeeded ? milliToHours(sleepNeeded.need_from_sleep_debt_milli) : 0,
    sleepNeededStrain: sleepNeeded ? milliToHours(sleepNeeded.need_from_recent_strain_milli) : 0,
    nap: latestSleep.nap,
    start: latestSleep.start,
    end: latestSleep.end,
  } : {
    totalInBedHours: 0, totalAwakeHours: 0, totalLightHours: 0,
    totalRemHours: 0, totalDeepHours: 0, sleepCycleCount: 0,
    disturbanceCount: 0, efficiency: 0, respiratoryRate: null,
    sleepPerformance: null, sleepConsistency: null,
    sleepNeededBaseline: 0, sleepNeededDebt: 0, sleepNeededStrain: 0,
    nap: false, start: "", end: "",
  };

  const sleepHistory = sleepRecords
    .filter((s: { score_state: string }) => s.score_state === "SCORED")
    .map((s: { start: string; score: { stage_summary: { total_in_bed_time_milli: number; total_awake_time_milli: number }; sleep_efficiency_percentage: number } }) => ({
      date: s.start.split("T")[0],
      totalHours: milliToHours(
        s.score.stage_summary.total_in_bed_time_milli - s.score.stage_summary.total_awake_time_milli
      ),
      efficiency: s.score.sleep_efficiency_percentage ?? 0,
    }))
    .reverse();

  const cycleRecords = cycleRes.records || [];
  const latestCycle = cycleRecords[0];
  const cycleScore = latestCycle?.score;

  const cycle: CycleData = cycleScore ? {
    strain: Math.round(cycleScore.strain * 10) / 10,
    calories: Math.round(cycleScore.kilojoule * 0.239006),
    avgHr: cycleScore.average_heart_rate,
    maxHr: cycleScore.max_heart_rate,
    start: latestCycle.start,
    end: latestCycle.end,
  } : {
    strain: 0, calories: 0, avgHr: 0, maxHr: 0, start: "", end: null,
  };

  const workoutRecords = workoutRes.records || [];
  const workouts: Workout[] = workoutRecords
    .filter((w: { score_state: string }) => w.score_state === "SCORED")
    .map((w: {
      sport_name: string;
      start: string;
      end: string;
      score: {
        strain: number;
        average_heart_rate: number;
        max_heart_rate: number;
        kilojoule: number;
        distance_meter: number | null;
        altitude_gain_meter: number | null;
        zone_durations: {
          zone_zero_milli: number;
          zone_one_milli: number;
          zone_two_milli: number;
          zone_three_milli: number;
          zone_four_milli: number;
          zone_five_milli: number;
        } | null;
      };
    }) => {
      const startTime = new Date(w.start).getTime();
      const endTime = new Date(w.end).getTime();
      const durationMinutes = Math.round((endTime - startTime) / 60000);
      const zones = w.score.zone_durations;

      return {
        sport: w.sport_name
          .split("_")
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(" "),
        strain: Math.round(w.score.strain * 10) / 10,
        avgHr: w.score.average_heart_rate,
        maxHr: w.score.max_heart_rate,
        calories: Math.round(w.score.kilojoule * 0.239006),
        durationMinutes,
        distanceMeters: w.score.distance_meter ?? null,
        altitudeGainMeters: w.score.altitude_gain_meter ?? null,
        start: w.start,
        end: w.end,
        zones: zones ? {
          zone0: Math.round(zones.zone_zero_milli / 60000),
          zone1: Math.round(zones.zone_one_milli / 60000),
          zone2: Math.round(zones.zone_two_milli / 60000),
          zone3: Math.round(zones.zone_three_milli / 60000),
          zone4: Math.round(zones.zone_four_milli / 60000),
          zone5: Math.round(zones.zone_five_milli / 60000),
        } : null,
      };
    });

  return {
    profile,
    body,
    recovery,
    recoveryHistory,
    sleep,
    sleepHistory,
    cycle,
    workouts,
    lastUpdated: new Date().toISOString(),
  };
}
