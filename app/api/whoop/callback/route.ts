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

  // Display the tokens — save the refresh_token as WHOOP_REFRESH_TOKEN env var
  return NextResponse.json({
    message: "Success! Copy the refresh_token below and set it as WHOOP_REFRESH_TOKEN in your Vercel environment variables.",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
    scope: tokens.scope,
  });
}
