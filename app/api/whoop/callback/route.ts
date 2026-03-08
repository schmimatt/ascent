import { NextRequest, NextResponse } from "next/server";

// OAuth callback — exchange authorization code for tokens
// Visit this after authorizing at the Whoop OAuth URL
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "No authorization code provided" }, { status: 400 });
  }

  const tokenRes = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL || "https://ascent.matthewjamesschmidt.com"}/api/whoop/callback`,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return NextResponse.json(
      { error: "Token exchange failed", details: text },
      { status: tokenRes.status }
    );
  }

  const tokens = await tokenRes.json();

  // Auto-persist the refresh token to Vercel env vars
  const vercelToken = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;
  let persisted = false;

  if (vercelToken && projectId && tokens.refresh_token) {
    try {
      const listUrl = `https://api.vercel.com/v9/projects/${projectId}/env${teamId ? `?teamId=${teamId}` : ""}`;
      const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${vercelToken}` },
      });
      const envVars = await listRes.json();
      const existing = envVars.envs?.find((e: { key: string }) => e.key === "WHOOP_REFRESH_TOKEN");

      if (existing) {
        const updateUrl = `https://api.vercel.com/v9/projects/${projectId}/env/${existing.id}${teamId ? `?teamId=${teamId}` : ""}`;
        await fetch(updateUrl, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${vercelToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ value: tokens.refresh_token }),
        });
        persisted = true;
      }
    } catch (e) {
      console.error("Failed to persist refresh token:", e);
    }
  }

  return NextResponse.json({
    message: persisted
      ? "Success! Refresh token has been automatically saved. Your dashboard is now live."
      : "Success! Copy the refresh_token below and set it as WHOOP_REFRESH_TOKEN in your Vercel environment variables.",
    persisted,
    scope: tokens.scope,
  });
}
