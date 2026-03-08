import { NextRequest, NextResponse } from "next/server";
import { initSchema } from "@/lib/db";
import { syncWhoopData } from "@/lib/sync";

// Sync endpoint — called by Vercel Cron or manually
// ?full=true for full historical sync (first time)
export async function GET(request: NextRequest) {
  // Simple auth — require a secret to prevent abuse
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Ensure tables exist
    await initSchema();

    const fullSync = request.nextUrl.searchParams.get("full") === "true";
    const result = await syncWhoopData(fullSync);

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
