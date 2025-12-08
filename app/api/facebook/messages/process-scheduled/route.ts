import { NextRequest, NextResponse } from "next/server";
import { dynamic, MAX_MESSAGES_PER_RUN } from "./lib/constants";
import { authorizeCronRequest, isVercelCronRequest } from "./lib/auth";
import { fetchScheduledMessages } from "./lib/fetch-scheduled";
import { processScheduledMessage } from "./lib/process-message";
import { ScheduledMessageRecord } from "./lib/types";

export { dynamic };

export async function GET(request: NextRequest) {
  try {
    const { authorized, reason } = authorizeCronRequest(request.headers);
    const { isVercelCron, authHeader, vercelCronHeader, vercelSignature, userAgent } = isVercelCronRequest(request.headers);

    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized", reason }, { status: 401 });
    }

    console.log("[Process Scheduled] Request authorized", {
      isVercelCron,
      hasAuthHeader: !!authHeader,
      vercelCronHeader,
      hasVercelSignature: !!vercelSignature,
      userAgent: userAgent.substring(0, 100)
    });

    const { scheduledMessages, fetchError } = await fetchScheduledMessages();

    if (fetchError) {
      console.error("[Process Scheduled] Error fetching scheduled messages:", fetchError);
      return NextResponse.json({ error: "Failed to fetch scheduled messages", details: fetchError.message }, { status: 500 });
    }

    if (!scheduledMessages || scheduledMessages.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No scheduled messages to process",
        processed: 0
      });
    }

    console.log(`[Process Scheduled] Found ${scheduledMessages.length} scheduled message(s) to process`, {
      messageIds: scheduledMessages.map(m => (m as any).id)
    });

    const results = { processed: 0, success: 0, failed: 0, errors: [] as any[] };

    for (const scheduledMessage of scheduledMessages as ScheduledMessageRecord[]) {
      const result = await processScheduledMessage(scheduledMessage);
      results.processed += result.processed;
      results.success += result.success;
      results.failed += result.failed;
      results.errors.push(...result.errors);
    }

    return NextResponse.json({
      success: true,
      results: {
        processed: results.processed,
        success: results.success,
        failed: results.failed,
        errors: results.errors
      }
    });
  } catch (error: any) {
    console.error("[Process Scheduled] Fatal error in process scheduled messages route:", {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}

export const POST = GET;
