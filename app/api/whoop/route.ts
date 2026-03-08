import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { mockWhoopData } from "@/data/mock-whoop";
import { WhoopData } from "@/types/whoop";

export const revalidate = 300;

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ data: mockWhoopData, source: "mock" });
  }

  try {
    const sql = getDb();

    // Fetch from database in parallel
    const [recoveryRows, sleepRows, cycleRows, workoutRows, bodyRows, recoveryHistoryRows, sleepHistoryRows] = await Promise.all([
      sql`SELECT * FROM recovery ORDER BY date DESC LIMIT 1`,
      sql`SELECT * FROM sleep WHERE nap = false ORDER BY date DESC LIMIT 1`,
      sql`SELECT * FROM cycle ORDER BY date DESC LIMIT 1`,
      sql`SELECT * FROM workout ORDER BY date DESC LIMIT 10`,
      sql`SELECT * FROM body_measurement ORDER BY date DESC LIMIT 1`,
      sql`SELECT date, score, hrv FROM recovery ORDER BY date DESC LIMIT 30`,
      sql`SELECT date, total_in_bed_hours - total_awake_hours as total_hours, efficiency FROM sleep WHERE nap = false ORDER BY date DESC LIMIT 30`,
    ]);

    const r = recoveryRows[0];
    const s = sleepRows[0];
    const c = cycleRows[0];
    const b = bodyRows[0];

    const data: WhoopData = {
      profile: null,
      body: b ? {
        heightMeters: b.height_meters,
        weightKg: b.weight_kg,
        maxHeartRate: b.max_heart_rate,
      } : null,
      recovery: r ? {
        score: r.score,
        hrv: r.hrv,
        rhr: r.rhr,
        spo2: r.spo2,
        skinTempCelsius: r.skin_temp_celsius,
        skinTempFahrenheit: r.skin_temp_celsius != null
          ? Math.round((r.skin_temp_celsius * 9 / 5 + 32) * 10) / 10
          : null,
        userCalibrating: r.user_calibrating,
      } : mockWhoopData.recovery,
      recoveryHistory: recoveryHistoryRows.map(row => ({
        date: row.date instanceof Date ? row.date.toISOString().split("T")[0] : String(row.date),
        score: row.score,
        hrv: row.hrv,
      })).reverse(),
      sleep: s ? {
        totalInBedHours: s.total_in_bed_hours,
        totalAwakeHours: s.total_awake_hours,
        totalLightHours: s.total_light_hours,
        totalRemHours: s.total_rem_hours,
        totalDeepHours: s.total_deep_hours,
        sleepCycleCount: s.sleep_cycle_count,
        disturbanceCount: s.disturbance_count,
        efficiency: s.efficiency,
        respiratoryRate: s.respiratory_rate,
        sleepPerformance: s.sleep_performance,
        sleepConsistency: s.sleep_consistency,
        sleepNeededBaseline: 0,
        sleepNeededDebt: 0,
        sleepNeededStrain: 0,
        nap: s.nap,
        start: s.start_time,
        end: s.end_time,
      } : mockWhoopData.sleep,
      sleepHistory: sleepHistoryRows.map(row => ({
        date: row.date instanceof Date ? row.date.toISOString().split("T")[0] : String(row.date),
        totalHours: row.total_hours,
        efficiency: row.efficiency,
      })).reverse(),
      cycle: c ? {
        strain: c.strain,
        calories: c.calories,
        avgHr: c.avg_hr,
        maxHr: c.max_hr,
        start: c.start_time,
        end: c.end_time,
      } : mockWhoopData.cycle,
      workouts: workoutRows.map(w => ({
        sport: String(w.sport)
          .split("_")
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(" "),
        strain: w.strain,
        avgHr: w.avg_hr,
        maxHr: w.max_hr,
        calories: w.calories,
        durationMinutes: w.duration_minutes,
        distanceMeters: w.distance_meters,
        altitudeGainMeters: w.altitude_gain_meters,
        start: w.start_time,
        end: w.end_time,
        zones: w.zones as WhoopData["workouts"][number]["zones"],
      })),
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json({ data, source: "database" });
  } catch (error) {
    console.error("Database read error:", error);
    return NextResponse.json({
      data: mockWhoopData,
      source: "mock",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
