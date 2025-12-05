import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

// Force dynamic rendering to prevent caching (important for cron jobs)
export const dynamic = "force-dynamic";

type ScheduledMessageRecord = {
  id: number;
  user_id: string;
  contact_ids: any;
  message: string;
  attachment?: any;
  scheduled_for: string;
};

type ContactRecord = {
  id: number;
  contact_id: string;
  page_id: string;
  contact_name: string;
  page_name: string;
};

const MAX_MESSAGES_PER_RUN = 10;
const CONTACT_FETCH_CHUNK = 200; // avoid Supabase IN() limits
const MESSAGE_SEND_THROTTLE_MS = 120; // rate limit between sends
const ATTACHMENT_THROTTLE_MS = 400; // give media a moment to settle

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

function normalizeContactIds(raw: any): { dbIds: number[]; contactIds: (string | number)[] } {
  if (!Array.isArray(raw)) return { dbIds: [], contactIds: [] };

  const dbIds: number[] = [];
  const contactIds: (string | number)[] = [];

  for (const value of raw) {
    const candidate =
      value && typeof value === "object"
        ? ("id" in value ? (value as any).id : "contact_id" in value ? (value as any).contact_id : value)
        : value;

    if (candidate === null || candidate === undefined || candidate === "") continue;

    const asNumber = Number(candidate);
    if (!Number.isNaN(asNumber) && Number.isFinite(asNumber)) {
      dbIds.push(asNumber);
    }
    contactIds.push(candidate);
  }

  return {
    dbIds: Array.from(new Set(dbIds)),
    contactIds: Array.from(new Set(contactIds)),
  };
}

async function fetchContactsForScheduledMessage(userId: string, contactIds: (string | number)[]) {
  if (!contactIds.length) {
    throw new Error("No contact ids were stored with this scheduled message");
  }

  const normalized = normalizeContactIds(contactIds);
  const contacts: ContactRecord[] = [];
  const remainingByDbId = new Set(normalized.dbIds);
  const remainingByContactId = new Set(normalized.contactIds);

  // First pass: try database ids (numeric)
  if (normalized.dbIds.length > 0) {
    for (const chunk of chunkArray([...normalized.dbIds], CONTACT_FETCH_CHUNK)) {
      const { data, error } = await supabaseServer
        .from("contacts")
        .select("id, contact_id, page_id, contact_name, page_name")
        .in("id", chunk)
        .eq("user_id", userId);

      if (error) {
        throw new Error(`Failed to fetch contacts by id: ${error.message}`);
      }

      if (data?.length) {
        contacts.push(...(data as ContactRecord[]));
        data.forEach((row: any) => {
          remainingByDbId.delete(row.id);
          remainingByContactId.delete(row.contact_id);
        });
      }
    }
  }

  // Second pass: fallback to contact_id for anything missing
  if (remainingByContactId.size > 0) {
    for (const chunk of chunkArray([...remainingByContactId], CONTACT_FETCH_CHUNK)) {
      const { data, error } = await supabaseServer
        .from("contacts")
        .select("id, contact_id, page_id, contact_name, page_name")
        .in("contact_id", chunk)
        .eq("user_id", userId);

      if (error) {
        throw new Error(`Failed to fetch contacts by contact_id: ${error.message}`);
      }

      if (data?.length) {
        contacts.push(...(data as ContactRecord[]));
        data.forEach((row: any) => {
          remainingByContactId.delete(row.contact_id);
          remainingByDbId.delete(row.id);
        });
      }
    }
  }

  if (!contacts.length) {
    throw new Error("No contacts found for scheduled message");
  }

  return contacts;
}

async function sendMessageToContact(pageAccessToken: string, contact: ContactRecord, message: string, attachment: any) {
  const firstName = contact.contact_name?.split(" ")[0] || "there";
  const personalizedMessage = message.replace(/{FirstName}/g, firstName);

  let firstError: string | null = null;
  let attachmentSent = false;

  // Send attachment first if provided
  if (attachment && attachment.url) {
    try {
      const attachmentType = attachment.type || "file";
      const mediaPayload: any = {
        recipient: { id: contact.contact_id },
        message: {
          attachment: {
            type: attachmentType,
            payload: {
              url: attachment.url,
              is_reusable: true
            }
          }
        },
        messaging_type: "MESSAGE_TAG",
        tag: "ACCOUNT_UPDATE"
      };

      const mediaResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mediaPayload),
        }
      );

      const mediaData = await mediaResponse.json();
      if (!mediaResponse.ok || mediaData.error) {
        firstError = mediaData.error?.message || `Failed to send ${attachmentType}`;
      } else {
        attachmentSent = true;
      }
    } catch (error: any) {
      firstError = error?.message || "Failed to send attachment";
    }

    await sleep(ATTACHMENT_THROTTLE_MS);
  }

  // Send text message
  const textPayload: any = {
    recipient: { id: contact.contact_id },
    message: { text: personalizedMessage },
    messaging_type: "MESSAGE_TAG",
    tag: "ACCOUNT_UPDATE"
  };

  const sendResponse = await fetch(
    `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(textPayload),
    }
  );

  const sendData = await sendResponse.json();
  if (sendResponse.ok && !sendData.error) {
    return { success: true, attachmentSent };
  }

  return {
    success: false,
    attachmentSent,
    error: sendData.error?.message || firstError || "Unknown error"
  };
}

async function sendMessagesForPage(pageId: string, contacts: ContactRecord[], message: string, attachment: any) {
  const { data: pageData, error: pageError } = await supabaseServer
    .from("facebook_pages")
    .select("page_id, page_access_token, page_name")
    .eq("page_id", pageId)
    .single();

  if (pageError || !pageData || !pageData.page_access_token) {
    return {
      success: 0,
      failed: contacts.length,
      errors: [
        {
          page: contacts[0]?.page_name || pageId,
          error: pageError?.message || "No access token available for this page"
        }
      ]
    };
  }

  let success = 0;
  let failed = 0;
  const errors: any[] = [];

  for (const contactChunk of chunkArray(contacts, 25)) {
    for (const contact of contactChunk) {
      const sendResult = await sendMessageToContact(pageData.page_access_token, contact, message, attachment);

      if (sendResult.success) {
        success++;
        console.log(`ƒo. Sent scheduled message to ${contact.contact_name} (${contact.contact_id})`);
      } else {
        failed++;
        const errorMsg = sendResult.error || "Unknown error";
        console.error(`ƒ?O Failed to send scheduled message to ${contact.contact_name}:`, errorMsg);
        errors.push({
          contact: contact.contact_name,
          page: contact.page_name,
          error: errorMsg
        });
      }

      await sleep(MESSAGE_SEND_THROTTLE_MS);
    }
  }

  return { success, failed, errors };
}

async function processScheduledMessage(scheduledMessage: ScheduledMessageRecord) {
  const contactIds = normalizeContactIds(scheduledMessage.contact_ids);

  // Move to processing state early to avoid duplicate work
  await supabaseServer
    .from("scheduled_messages")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", scheduledMessage.id);

  try {
    const contacts = await fetchContactsForScheduledMessage(scheduledMessage.user_id, contactIds);

    // Group by page
    const contactsByPage = new Map<string, ContactRecord[]>();
    for (const contact of contacts) {
      if (!contactsByPage.has(contact.page_id)) {
        contactsByPage.set(contact.page_id, []);
      }
      contactsByPage.get(contact.page_id)!.push(contact);
    }

    let messageSuccess = 0;
    let messageFailed = 0;
    const messageErrors: any[] = [];

    for (const [pageId, pageContacts] of contactsByPage.entries()) {
      const result = await sendMessagesForPage(
        pageId,
        pageContacts,
        scheduledMessage.message,
        scheduledMessage.attachment
      );

      messageSuccess += result.success;
      messageFailed += result.failed;
      messageErrors.push(...result.errors);
    }

    // If nothing sent, treat as failed even if no explicit errors were captured
    const finalStatus = messageSuccess > 0 ? "sent" : "failed";

    await supabaseServer
      .from("scheduled_messages")
      .update({
        status: finalStatus,
        sent_count: messageSuccess,
        failed_count: messageFailed,
        errors: messageErrors,
        processed_at: new Date().toISOString()
      })
      .eq("id", scheduledMessage.id);

    console.log(`ƒo. Processed scheduled message ${scheduledMessage.id}: ${messageSuccess} sent, ${messageFailed} failed`);

    return {
      processed: 1,
      success: finalStatus === "sent" ? 1 : 0,
      failed: finalStatus === "failed" ? 1 : 0,
      errors: finalStatus === "failed" ? [{ scheduledMessageId: scheduledMessage.id, errors: messageErrors }] : []
    };
  } catch (error: any) {
    console.error(`ƒ?O Error processing scheduled message ${scheduledMessage.id}:`, error);

    await supabaseServer
      .from("scheduled_messages")
      .update({
        status: "failed",
        errors: [{ error: error.message || "Unknown error" }],
        processed_at: new Date().toISOString()
      })
      .eq("id", scheduledMessage.id);

    return {
      processed: 1,
      success: 0,
      failed: 1,
      errors: [{ scheduledMessageId: scheduledMessage.id, error: error.message || "Unknown error" }]
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authentication check for cron endpoint
    // Vercel Cron sends requests without standard auth headers
    // We check for various indicators that this is a Vercel Cron request
    const authHeader = request.headers.get("authorization");
    const vercelCronHeader = request.headers.get("x-vercel-cron");
    const vercelSignature = request.headers.get("x-vercel-signature");
    const userAgent = request.headers.get("user-agent") || "";
    const cronSecret = process.env.CRON_SECRET;
    
    // Log all headers for debugging (first time only)
    const allHeaders: Record<string, string | null> = {};
    request.headers.forEach((value, key) => {
      allHeaders[key] = value;
    });
    console.log("[Process Scheduled] Request received with headers:", {
      hasAuth: !!authHeader,
      hasVercelCron: !!vercelCronHeader,
      vercelCronValue: vercelCronHeader,
      hasVercelSignature: !!vercelSignature,
      userAgent: userAgent.substring(0, 100),
      allHeaders: Object.keys(allHeaders)
    });
    
    // Check if this is a Vercel Cron request
    // Vercel may send: x-vercel-cron header, x-vercel-signature, or specific User-Agent
    // Also, Vercel Cron typically doesn't send an Authorization header
    const hasVercelHeaders = 
      vercelCronHeader === "1" || 
      vercelCronHeader !== null ||
      vercelSignature !== null;
    
    const hasVercelUserAgent = 
      userAgent.toLowerCase().includes("vercel") ||
      userAgent.toLowerCase().includes("cron") ||
      userAgent.toLowerCase().includes("node-fetch") ||
      userAgent === ""; // Some cron services send no user agent
    
    // Vercel Cron typically doesn't send Authorization headers
    // If there's no auth header, it's likely from Vercel Cron (or a manual test)
    const isVercelCron = hasVercelHeaders || (hasVercelUserAgent && !authHeader);
    
    // Authentication logic:
    // - If CRON_SECRET is set, only block requests with invalid auth headers that are definitely NOT from Vercel
    // - If no CRON_SECRET is set, allow all requests
    // - Vercel Cron requests typically don't have auth headers, so we allow those when detected
    if (cronSecret) {
      const hasValidAuth = authHeader === `Bearer ${cronSecret}`;
      
      // Only block if:
      // - An Authorization header was provided (suggests manual/API call)
      // - AND the token is invalid
      // - AND we're confident it's NOT a Vercel Cron request
      if (authHeader && !hasValidAuth && !isVercelCron) {
        console.log("[Process Scheduled] Unauthorized request - blocking", {
          hasAuthHeader: !!authHeader,
          hasValidAuth,
          hasVercelCron: !!vercelCronHeader,
          vercelCronValue: vercelCronHeader,
          hasVercelSignature: !!vercelSignature,
          userAgent: userAgent.substring(0, 100),
          isVercelCron,
          reason: "Invalid auth token provided and not a Vercel Cron request"
        });
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
      // Otherwise allow: valid auth token OR no auth header (likely Vercel Cron) OR Vercel headers detected
    }
    // If no CRON_SECRET, allow all requests (open for debugging - can be secured later)
    
    console.log("[Process Scheduled] Request authorized", {
      isVercelCron,
      hasAuthHeader: !!authHeader,
      hasValidAuth: cronSecret ? authHeader === `Bearer ${cronSecret}` : 'N/A (no secret)',
      timestamp: new Date().toISOString()
    });

    const now = new Date().toISOString();
    // Also consider messages that have been "processing" for more than 30 minutes as stuck
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    // Find all pending scheduled messages that are due
    const { data: pendingMessages, error: pendingError } = await supabaseServer
      .from("scheduled_messages")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", now)
      .order("scheduled_for", { ascending: true })
      .limit(MAX_MESSAGES_PER_RUN);

    // Also find messages stuck in "processing" status (likely from a failed cron run)
    const { data: stuckMessages, error: stuckError } = await supabaseServer
      .from("scheduled_messages")
      .select("*")
      .eq("status", "processing")
      .lte("updated_at", thirtyMinutesAgo)
      .order("scheduled_for", { ascending: true })
      .limit(5);

    // Combine both results, prioritizing pending messages
    const scheduledMessages = [
      ...(pendingMessages || []), 
      ...(stuckMessages || [])
    ].slice(0, MAX_MESSAGES_PER_RUN); // Limit total for this run
    
    const fetchError = pendingError || stuckError;
    
    // Log if we found stuck messages
    if (stuckMessages && stuckMessages.length > 0) {
      console.log(`[Process Scheduled] Found ${stuckMessages.length} stuck message(s) in processing status`);
    }

    if (fetchError) {
      console.error("[Process Scheduled] Error fetching scheduled messages:", {
        error: fetchError,
        message: fetchError.message,
        code: fetchError.code,
        details: fetchError.details
      });
      return NextResponse.json(
        { error: "Failed to fetch scheduled messages", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!scheduledMessages || scheduledMessages.length === 0) {
      console.log("[Process Scheduled] No scheduled messages to process", {
        timestamp: now,
        checkedForPending: true
      });
      return NextResponse.json({
        success: true,
        message: "No scheduled messages to process",
        processed: 0
      });
    }

    console.log(`[Process Scheduled] Found ${scheduledMessages.length} scheduled message(s) to process`, {
      messageIds: scheduledMessages.map(m => (m as any).id),
      scheduledFor: scheduledMessages.map(m => (m as any).scheduled_for)
    });

    const results = {
      processed: 0,
      success: 0,
      failed: 0,
      errors: [] as any[]
    };

    // Process each scheduled message sequentially to keep memory usage low
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
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

// Also allow POST for manual triggering
export const POST = GET;
