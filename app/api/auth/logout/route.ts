import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function GET() {
  const response = NextResponse.redirect(
    new URL("/", process.env.NEXT_PUBLIC_BASE_URL || "https://ascent.matthewjamesschmidt.com")
  );
  const cookie = clearSessionCookie();
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    path: cookie.path,
    maxAge: cookie.maxAge,
  });
  return response;
}
