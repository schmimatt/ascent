import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const invite = request.nextUrl.searchParams.get("invite");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://ascent.matthewjamesschmidt.com";

  const params = new URLSearchParams({
    client_id: process.env.WHOOP_CLIENT_ID!,
    response_type: "code",
    redirect_uri: `${baseUrl}/api/whoop/callback`,
    scope: "read:recovery read:sleep read:workout read:cycles read:profile read:body_measurement",
  });

  const response = NextResponse.redirect(
    `https://api.prod.whoop.com/oauth/oauth2/auth?${params.toString()}`
  );

  // Preserve invite code through OAuth redirect
  if (invite) {
    response.cookies.set("ascent_invite", invite, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600, // 10 minutes
    });
  }

  return response;
}
