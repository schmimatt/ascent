import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// POST /api/teams/[teamId]/leave
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await requireAuth();
    const { teamId } = await params;

    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: session.userId } },
    });

    if (!membership) {
      return NextResponse.json({ error: "Not a member" }, { status: 400 });
    }
    if (membership.role === "owner") {
      return NextResponse.json({ error: "Owners must delete the team, not leave" }, { status: 400 });
    }

    await prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId: session.userId } },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
