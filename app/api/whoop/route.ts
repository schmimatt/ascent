import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mockWhoopData } from "@/data/mock-whoop";
import { WhoopData } from "@/types/whoop";

export const revalidate = 300;

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ data: mockWhoopData, source: "mock" });
  }

  try {
    // Support ?userId= param, default to first user (Matthew)
    let userId = request.nextUrl.searchParams.get("userId");
    if (!userId) {
      const firstUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
      userId = firstUser?.id ?? null;
    }

    if (!userId) {
      return NextResponse.json({ data: mockWhoopData, source: "mock" });
    }

    const [r, s, c, workouts, b, recoveryHistory, sleepHistory] = await Promise.all([
      prisma.recovery.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
      prisma.sleep.findFirst({ where: { userId, nap: false }, orderBy: { date: "desc" } }),
      prisma.cycle.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
      prisma.workout.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 10 }),
      prisma.bodyMeasurement.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
      prisma.recovery.findMany({
        where: { userId },
        orderBy: { date: "desc" },
        take: 30,
        select: { date: true, score: true, hrv: true },
      }),
      prisma.sleep.findMany({
        where: { userId, nap: false },
        orderBy: { date: "desc" },
        take: 30,
        select: { date: true, totalInBedHours: true, totalAwakeHours: true, efficiency: true },
      }),
    ]);

    const data: WhoopData = {
      profile: null,
      body: b ? {
        heightMeters: b.heightMeters!,
        weightKg: b.weightKg!,
        maxHeartRate: b.maxHeartRate!,
      } : null,
      recovery: r ? {
        score: r.score!,
        hrv: r.hrv!,
        rhr: r.rhr!,
        spo2: r.spo2,
        skinTempCelsius: r.skinTempCelsius,
        skinTempFahrenheit: r.skinTempCelsius != null
          ? Math.round((r.skinTempCelsius * 9 / 5 + 32) * 10) / 10
          : null,
        userCalibrating: r.userCalibrating,
      } : mockWhoopData.recovery,
      recoveryHistory: recoveryHistory.map(row => ({
        date: row.date.toISOString().split("T")[0],
        score: row.score!,
        hrv: row.hrv!,
      })).reverse(),
      sleep: s ? {
        totalInBedHours: s.totalInBedHours!,
        totalAwakeHours: s.totalAwakeHours!,
        totalLightHours: s.totalLightHours!,
        totalRemHours: s.totalRemHours!,
        totalDeepHours: s.totalDeepHours!,
        sleepCycleCount: s.sleepCycleCount!,
        disturbanceCount: s.disturbanceCount!,
        efficiency: s.efficiency!,
        respiratoryRate: s.respiratoryRate,
        sleepPerformance: s.sleepPerformance,
        sleepConsistency: s.sleepConsistency,
        sleepNeededBaseline: 0,
        sleepNeededDebt: 0,
        sleepNeededStrain: 0,
        nap: s.nap,
        start: s.startTime?.toISOString() ?? "",
        end: s.endTime?.toISOString() ?? "",
      } : mockWhoopData.sleep,
      sleepHistory: sleepHistory.map(row => ({
        date: row.date.toISOString().split("T")[0],
        totalHours: (row.totalInBedHours ?? 0) - (row.totalAwakeHours ?? 0),
        efficiency: row.efficiency ?? 0,
      })).reverse(),
      cycle: c ? {
        strain: c.strain!,
        calories: c.calories!,
        avgHr: c.avgHr!,
        maxHr: c.maxHr!,
        start: c.startTime?.toISOString() ?? "",
        end: c.endTime?.toISOString() ?? null,
      } : mockWhoopData.cycle,
      workouts: workouts.map(w => ({
        sport: String(w.sport)
          .split("_")
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(" "),
        strain: w.strain!,
        avgHr: w.avgHr!,
        maxHr: w.maxHr!,
        calories: w.calories!,
        durationMinutes: w.durationMinutes!,
        distanceMeters: w.distanceMeters,
        altitudeGainMeters: w.altitudeGainMeters,
        start: w.startTime?.toISOString() ?? "",
        end: w.endTime?.toISOString() ?? "",
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
