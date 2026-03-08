import { NextResponse } from "next/server";
import { fetchWhoopData } from "@/lib/whoop";
import { mockWhoopData } from "@/data/mock-whoop";

export const revalidate = 300; // ISR: revalidate every 5 minutes

export async function GET() {
  // Use mock data if Whoop credentials aren't configured
  if (!process.env.WHOOP_CLIENT_ID || !process.env.WHOOP_REFRESH_TOKEN) {
    return NextResponse.json({ data: mockWhoopData, source: "mock" });
  }

  try {
    const data = await fetchWhoopData();
    return NextResponse.json({ data, source: "live" });
  } catch (error) {
    console.error("Whoop API error:", error);
    // Fall back to mock data on API failure
    return NextResponse.json({
      data: mockWhoopData,
      source: "mock",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
