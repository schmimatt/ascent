import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/teams — list user's teams
export async function GET() {
  try {
    const session = await requireAuth();

    const memberships = await prisma.teamMember.findMany({
      where: { userId: session.userId },
      include: {
        team: {
          include: { _count: { select: { members: true } } },
        },
      },
      orderBy: { team: { createdAt: "desc" } },
    });

    const teams = memberships.map(m => ({
      id: m.team.id,
      name: m.team.name,
      invite_code: m.team.inviteCode,
      created_at: m.team.createdAt,
      role: m.role,
      member_count: m.team._count.members,
    }));

    return NextResponse.json({ teams });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// POST /api/teams — create a team
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { name } = await request.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Team name is required" }, { status: 400 });
    }

    if (name.length > 50) {
      return NextResponse.json({ error: "Team name too long (max 50 chars)" }, { status: 400 });
    }

    const inviteCode = crypto.randomUUID().slice(0, 8).toUpperCase();

    const team = await prisma.team.create({
      data: {
        name: name.trim(),
        createdBy: session.userId,
        inviteCode,
        members: {
          create: { userId: session.userId, role: "owner" },
        },
      },
    });

    return NextResponse.json({
      team: { id: team.id, name: team.name, invite_code: team.inviteCode },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
