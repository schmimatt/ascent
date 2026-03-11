import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/teams/[teamId] — team details + members
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

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const members = await prisma.teamMember.findMany({
      where: { teamId },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { joinedAt: "asc" },
    });

    return NextResponse.json({
      team: {
        id: team.id,
        name: team.name,
        invite_code: team.inviteCode,
        created_at: team.createdAt,
      },
      members: members.map(m => ({
        id: m.user.id,
        first_name: m.user.firstName,
        last_name: m.user.lastName,
        role: m.role,
        joined_at: m.joinedAt,
      })),
      role: membership.role,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// DELETE /api/teams/[teamId] — delete team (owner only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await requireAuth();
    const { teamId } = await params;

    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: session.userId } },
    });
    if (!membership || membership.role !== "owner") {
      return NextResponse.json({ error: "Only the owner can delete a team" }, { status: 403 });
    }

    await prisma.team.delete({ where: { id: teamId } });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
