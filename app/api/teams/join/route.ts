import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// POST /api/teams/join — join a team by invite code
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { inviteCode } = await request.json();

    if (!inviteCode || typeof inviteCode !== "string") {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
    }

    const team = await prisma.team.findUnique({
      where: { inviteCode: inviteCode.toUpperCase() },
      include: { _count: { select: { members: true } } },
    });

    if (!team) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }

    if (team._count.members >= 8) {
      return NextResponse.json({ error: "Team is full (max 8 members)" }, { status: 400 });
    }

    // Check if already a member
    const existing = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: team.id, userId: session.userId } },
    });
    if (existing) {
      return NextResponse.json({ error: "Already a member", teamId: team.id }, { status: 400 });
    }

    await prisma.teamMember.create({
      data: { teamId: team.id, userId: session.userId, role: "member" },
    });

    return NextResponse.json({ teamId: team.id, name: team.name });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
