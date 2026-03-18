import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

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

// GET /api/teams/[teamId]/compare?date=YYYY-MM-DD — members' data for a specific date (or latest)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await requireAuth();
    const { teamId } = await params;

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: session.userId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    // Parse optional date param
    const dateParam = request.nextUrl.searchParams.get("date");
    const targetDate = dateParam ? new Date(dateParam + "T00:00:00Z") : null;

    // Get all team members (include token fields for needsReauth — server-side only)
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

    const sevenDaysAgo = new Date();
    if (targetDate) {
      sevenDaysAgo.setTime(targetDate.getTime() - 7 * 86400000);
    } else {
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    }

    const historyEnd = targetDate ?? new Date();

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

    return NextResponse.json({ members: comparisons });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
