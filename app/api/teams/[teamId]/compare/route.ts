import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export interface MemberComparison {
  userId: string;
  firstName: string;
  lastName: string;
  recovery: { score: number; hrv: number; rhr: number } | null;
  sleep: { totalHours: number; efficiency: number } | null;
  strain: { score: number; calories: number } | null;
  recoveryHistory: { date: string; score: number }[];
  sleepHistory: { date: string; totalHours: number }[];
  strainHistory: { date: string; strain: number }[];
}

// GET /api/teams/[teamId]/compare — all members' latest data
export async function GET(
  _request: NextRequest,
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

    // Get all team members
    const members = await prisma.teamMember.findMany({
      where: { teamId },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { joinedAt: "asc" },
    });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const comparisons: MemberComparison[] = await Promise.all(
      members.map(async (m) => {
        const userId = m.user.id;

        const [latestRecovery, latestSleep, latestCycle, recoveryHist, sleepHist, strainHist] = await Promise.all([
          prisma.recovery.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
          prisma.sleep.findFirst({ where: { userId, nap: false }, orderBy: { date: "desc" } }),
          prisma.cycle.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
          prisma.recovery.findMany({
            where: { userId, date: { gte: sevenDaysAgo } },
            orderBy: { date: "asc" },
            select: { date: true, score: true },
          }),
          prisma.sleep.findMany({
            where: { userId, nap: false, date: { gte: sevenDaysAgo } },
            orderBy: { date: "asc" },
            select: { date: true, totalInBedHours: true, totalAwakeHours: true },
          }),
          prisma.cycle.findMany({
            where: { userId, date: { gte: sevenDaysAgo } },
            orderBy: { date: "asc" },
            select: { date: true, strain: true },
          }),
        ]);

        return {
          userId,
          firstName: m.user.firstName ?? "",
          lastName: m.user.lastName ?? "",
          recovery: latestRecovery
            ? { score: latestRecovery.score!, hrv: latestRecovery.hrv!, rhr: latestRecovery.rhr! }
            : null,
          sleep: latestSleep
            ? {
                totalHours: (latestSleep.totalInBedHours ?? 0) - (latestSleep.totalAwakeHours ?? 0),
                efficiency: latestSleep.efficiency ?? 0,
              }
            : null,
          strain: latestCycle
            ? { score: latestCycle.strain!, calories: latestCycle.calories! }
            : null,
          recoveryHistory: recoveryHist.map(r => ({
            date: r.date.toISOString().split("T")[0],
            score: r.score!,
          })),
          sleepHistory: sleepHist.map(s => ({
            date: s.date.toISOString().split("T")[0],
            totalHours: (s.totalInBedHours ?? 0) - (s.totalAwakeHours ?? 0),
          })),
          strainHistory: strainHist.map(c => ({
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
