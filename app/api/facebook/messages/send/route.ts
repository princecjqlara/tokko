import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { BACKGROUND_JOB_THRESHOLD, LARGE_SEND_FAST_PATH_THRESHOLD } from "./lib/constants";
import { guardDuplicateRequest } from "./lib/request-guard";
import { createBackgroundSendJob, triggerBackgroundJob } from "./lib/background-job";
import { fetchContactsForSend } from "./lib/contacts";
import { scheduleMessageSend } from "./lib/schedule";
import { sendDirectMessages } from "./lib/direct-send";

export const maxDuration = 300; // keep in sync with ./lib/constants
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;

    if (!session || !accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const requestId = request.headers.get("x-request-id");
    const duplicateCheck = guardDuplicateRequest(requestId);

    if (!duplicateCheck.allowed) {
      console.warn(`[Send Message API] Duplicate request detected: ${requestId}`);
      return NextResponse.json({ error: duplicateCheck.message }, { status: 409 });
    } else if (requestId) {
      console.log(`[Send Message API] Processing request ID: ${requestId}`);
    }

    const body = await request.json();
    let { contactIds, message, scheduleDate, attachment, confirm } = body;

    const uniqueContactIds = Array.from(new Set(contactIds || []));
    if (uniqueContactIds.length !== (contactIds?.length || 0)) {
      console.warn(`[Send Message API] Removed ${(contactIds?.length || 0) - uniqueContactIds.length} duplicate contact IDs from request`);
    }
    contactIds = uniqueContactIds;

    console.log("[Send Message API] Received request:", {
      requestId,
      contactIdsCount: contactIds?.length,
      originalCount: Array.isArray(body.contactIds) ? body.contactIds.length : 0,
      userId,
      hasMessage: !!message
    });

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ error: "No contacts selected" }, { status: 400 });
    }
    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    if (confirm !== true) {
      console.warn("[Send Message API] No confirm flag provided; auto-confirming broadcast to avoid duplicates.");
      confirm = true;
    }

    const shouldUseBackgroundJob = !scheduleDate && contactIds.length > BACKGROUND_JOB_THRESHOLD;
    if (shouldUseBackgroundJob) {
      const { sendJob, jobError } = await createBackgroundSendJob({
        userId,
        contactIds,
        message,
        attachment
      });

      if (jobError || !sendJob) {
        return NextResponse.json(
          { error: "Failed to create background job", details: jobError?.message || "Unknown error" },
          { status: 500 }
        );
      }

      await triggerBackgroundJob(sendJob.id, accessToken);
      return NextResponse.json({
        success: true,
        results: {
          total: contactIds.length,
          sent: 0,
          failed: 0,
          errors: [],
          scheduled: false,
          backgroundJob: true,
          jobId: sendJob.id,
          message: `Batch detected (${contactIds.length} contacts). Job created and processing will start immediately. For huge sends (50k-100k), allow time for multiple cron runs. Mode: ${
            contactIds.length > LARGE_SEND_FAST_PATH_THRESHOLD ? "FAST-PATH" : "STANDARD"
          }.`
        }
      });
    }

    // For scheduled or direct small sends, fetch contacts first
    const { contacts, contactsError } = await fetchContactsForSend(userId, contactIds);
    if (contactsError) {
      const errorMessage =
        typeof contactsError === "string" && contactsError.includes("<html>")
          ? "Database connection timeout. Please try again."
          : contactsError.message || "Failed to fetch contacts";
      return NextResponse.json({ error: "Failed to fetch contacts", details: errorMessage }, { status: 500 });
    }

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ error: "No contacts found" }, { status: 404 });
    }

    if (scheduleDate) {
      const scheduled = await scheduleMessageSend({
        userId,
        contacts,
        message,
        attachment,
        scheduleDate
      });

      if (scheduled.error) {
        return NextResponse.json(
          { error: scheduled.error, details: scheduled.details },
          { status: scheduled.status || 400 }
        );
      }

      return NextResponse.json(scheduled.result);
    }

    const directResults = await sendDirectMessages({ contacts, message, attachment });

    return NextResponse.json({
      success: true,
      results: {
        total: contactIds.length,
        sent: directResults.success,
        failed: directResults.failed,
        errors: directResults.errors,
        scheduled: directResults.scheduled
      }
    });
  } catch (error: any) {
    console.error("Error in send message route:", error);
    try {
      return NextResponse.json(
        {
          success: false,
          error: "Internal server error",
          details: error.message || "An unexpected error occurred"
        },
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    } catch {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: "Internal server error",
          details: "An unexpected error occurred"
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }
}
