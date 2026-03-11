import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || "ascent-dev-secret-change-in-prod"
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /teams routes and /api/teams routes
  if (!pathname.startsWith("/teams") && !pathname.startsWith("/api/teams")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("ascent_session")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/api/auth/login", request.url));
  }

  try {
    await jwtVerify(token, SECRET);
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/api/auth/login", request.url));
  }
}

export const config = {
  matcher: ["/teams/:path*", "/api/teams/:path*"],
};
