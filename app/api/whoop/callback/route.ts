import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, sessionCookie } from "@/lib/auth";
import { syncUserData } from "@/lib/sync";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://ascent.matthewjamesschmidt.com";

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${error}`, baseUrl));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", baseUrl));
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
      redirect_uri: `${baseUrl}/api/whoop/callback`,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error("Token exchange failed:", text);
    return NextResponse.redirect(new URL("/?error=token_failed", baseUrl));
  }

  const tokens = await tokenRes.json();

  // Fetch Whoop profile
  let profile: { user_id: string; first_name: string; last_name: string; email: string } | null = null;
  try {
    const profileRes = await fetch("https://api.prod.whoop.com/developer/v2/user/profile/basic", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (profileRes.ok) {
      profile = await profileRes.json();
    }
  } catch (e) {
    console.error("Failed to fetch Whoop profile:", e);
  }

  if (!profile) {
    return NextResponse.redirect(new URL("/?error=profile_failed", baseUrl));
  }

  const whoopUserId = String(profile.user_id);

  // Upsert user
  const user = await prisma.user.upsert({
    where: { whoopUserId },
    update: {
      email: profile.email || null,
      firstName: profile.first_name,
      lastName: profile.last_name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
    create: {
      whoopUserId,
      email: profile.email || null,
      firstName: profile.first_name,
      lastName: profile.last_name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });

  // Update any placeholder user rows (migration backfill)
  await prisma.user.updateMany({
    where: { whoopUserId: "pending", id: user.id },
    data: {
      whoopUserId,
      email: profile.email || null,
      firstName: profile.first_name,
      lastName: profile.last_name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });

  // Handle invite code — auto-join team
  const inviteCode = request.cookies.get("ascent_invite")?.value;
  if (inviteCode) {
    try {
      const team = await prisma.team.findUnique({ where: { inviteCode } });
      if (team) {
        await prisma.teamMember.upsert({
          where: { teamId_userId: { teamId: team.id, userId: user.id } },
          update: {},
          create: { teamId: team.id, userId: user.id, role: "member" },
        });
      }
    } catch (e) {
      console.error("Failed to auto-join team:", e);
    }
  }

  // Persist refresh token to Vercel env vars (backwards compat)
  const vercelToken = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (vercelToken && projectId && tokens.refresh_token) {
    try {
      const listUrl = `https://api.vercel.com/v9/projects/${projectId}/env${teamId ? `?teamId=${teamId}` : ""}`;
      const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${vercelToken}` },
      });
      const envVars = await listRes.json();
      const existing = envVars.envs?.find((e: { key: string }) => e.key === "WHOOP_REFRESH_TOKEN");
      if (existing) {
        await fetch(`https://api.vercel.com/v9/projects/${projectId}/env/${existing.id}${teamId ? `?teamId=${teamId}` : ""}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${vercelToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ value: tokens.refresh_token }),
        });
      }
    } catch (e) {
      console.error("Failed to persist refresh token:", e);
    }
  }

  // Sync user's Whoop data immediately after login
  try {
    await syncUserData(user.id, tokens.access_token);
  } catch (e) {
    console.error("Post-login sync failed:", e);
  }

  // Create session JWT
  const sessionToken = await createSession({
    userId: user.id,
    whoopUserId,
    firstName: profile.first_name,
    lastName: profile.last_name,
  });

  const redirectTo = inviteCode ? "/teams" : "/";
  const response = NextResponse.redirect(new URL(redirectTo, baseUrl));

  const cookie = sessionCookie(sessionToken);
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    path: cookie.path,
    maxAge: cookie.maxAge,
  });

  // Clear invite cookie
  if (inviteCode) {
    response.cookies.set("ascent_invite", "", { path: "/", maxAge: 0 });
  }

  return response;
}
