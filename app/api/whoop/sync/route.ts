import { NextRequest, NextResponse } from "next/server";
import { syncAllUsers } from "@/lib/sync";

// Sync endpoint — called by Vercel Cron or manually
// ?full=true for full historical sync (first time)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const fullSync = request.nextUrl.searchParams.get("full") === "true";
    const result = await syncAllUsers(fullSync);

    return NextResponse.json({
      ok: true,
      synced: result.synced,
      errors: result.errors,
      fullSync,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Sync failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
