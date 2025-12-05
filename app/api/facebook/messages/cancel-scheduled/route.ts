import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !(session as any).accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { scheduledMessageId } = body || {};

    if (!scheduledMessageId) {
      return NextResponse.json(
        { error: "scheduledMessageId is required" },
        { status: 400 }
      );
    }

    const { data: scheduledMessage, error: fetchError } = await supabaseServer
      .from("scheduled_messages")
      .select("*")
      .eq("id", scheduledMessageId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !scheduledMessage) {
      return NextResponse.json(
        { error: "Scheduled message not found" },
        { status: 404 }
      );
    }

    if (scheduledMessage.status === "sent") {
      return NextResponse.json(
        { error: "Message already sent and cannot be canceled" },
        { status: 409 }
      );
    }

    // Mark as canceled so cron skips it
    const { error: cancelError } = await supabaseServer
      .from("scheduled_messages")
      .update({
        status: "canceled",
        processed_at: new Date().toISOString(),
      })
      .eq("id", scheduledMessageId)
      .eq("user_id", userId);

    if (cancelError) {
      return NextResponse.json(
        { error: "Failed to cancel scheduled message", details: cancelError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      canceled: true,
      scheduledMessageId,
    });
  } catch (error: any) {
    console.error("[Cancel Scheduled] Error canceling scheduled message:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
