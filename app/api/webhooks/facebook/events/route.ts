import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Store recent webhook events (in production, use a database or Redis)
const recentEvents: any[] = [];
const MAX_EVENTS = 100;

// Get recent webhook events for real-time updates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const since = request.nextUrl.searchParams.get("since");
    const sinceTime = since ? parseInt(since) : 0;

    // Filter events since the given timestamp
    const newEvents = recentEvents.filter(
      (event) => event.timestamp > sinceTime
    );

    return NextResponse.json({
      events: newEvents,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error("Error fetching webhook events:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

// Add event to the store (called by webhook handler)
export function addEvent(event: any) {
  recentEvents.unshift(event);
  if (recentEvents.length > MAX_EVENTS) {
    recentEvents.pop();
  }
}

// Export the events array for direct access
export { recentEvents };
