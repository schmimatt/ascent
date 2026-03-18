import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

export async function POST() {
  try {
    let session;
    try {
      session = await requireAuth();
    } catch {
      // No session (unauthenticated page load) — skip silently
      return NextResponse.json({ ok: true, skipped: true });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { refreshToken: true, tokenExpiresAt: true },
    });

    if (!user?.refreshToken) {
      return NextResponse.json({ ok: false, error: "no_refresh_token" });
    }

    // Skip refresh if token is still valid for more than 1 hour
    if (user.tokenExpiresAt && user.tokenExpiresAt.getTime() > Date.now() + 3600000) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: user.refreshToken,
        client_id: process.env.WHOOP_CLIENT_ID!,
        client_secret: process.env.WHOOP_CLIENT_SECRET!,
      }),
    });

    if (!res.ok) {
      // Refresh failed — token chain is broken
      await prisma.user.update({
        where: { id: session.userId },
        data: { refreshToken: null },
      });
      return NextResponse.json({ ok: false, error: "refresh_failed" });
    }

    const tokens = await res.json();

    await prisma.user.update({
      where: { id: session.userId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
}
