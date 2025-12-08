import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseServer } from "@/lib/supabase-server";

// Vercel Pro allows up to 300 seconds (5 minutes), Hobby plan allows 10 seconds
// For large batches (>100 contacts), we use background jobs to avoid timeout
export const maxDuration = 300; // 5 minutes max duration (requires Vercel Pro plan)
export const dynamic = "force-dynamic";

// Threshold for using background jobs (to avoid timeout)
// Default to 0 so ALL sends go through background jobs unless explicitly overridden
const BACKGROUND_JOB_THRESHOLD = Number(process.env.BACKGROUND_JOB_THRESHOLD ?? "0");

// For extremely large sends, skip the expensive prefetch step and go straight to a background job
// This avoids timeouts when contactIds is in the tens of thousands.
const LARGE_SEND_FAST_PATH_THRESHOLD = Number(process.env.LARGE_SEND_FAST_PATH_THRESHOLD || "5000");

// Supabase IN() query limit - chunk queries to avoid "Bad Request" errors
const CONTACT_FETCH_CHUNK = 200;

// Helper function to chunk arrays
function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

// Track processed request IDs to prevent duplicates (in-memory cache with TTL)
const processedRequests = new Map<string, number>();
const REQUEST_TTL = 5 * 60 * 1000; // 5 minutes

// Clean up old request IDs periodically
setInterval(() => {
  const now = Date.now();
  for (const [requestId, timestamp] of processedRequests.entries()) {
    if (now - timestamp > REQUEST_TTL) {
      processedRequests.delete(requestId);
    }
  }
}, 60 * 1000); // Clean up every minute

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !(session as any).accessToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;

    // Check for request ID to prevent duplicates
    const requestId = request.headers.get("x-request-id");
    if (requestId) {
      if (processedRequests.has(requestId)) {
        console.warn(`[Send Message API] Duplicate request detected: ${requestId}`);
        return NextResponse.json(
          {
            error: "Duplicate request",
            details: "This request has already been processed"
          },
          { status: 409 } // Conflict
        );
      }
      // Mark request as processed
      processedRequests.set(requestId, Date.now());
      console.log(`[Send Message API] Processing request ID: ${requestId}`);
    } else {
      console.warn("[Send Message API] No request ID provided - duplicate protection disabled");
    }

    const body = await request.json();
    let { contactIds, message, scheduleDate, attachment, confirm } = body;

    // CRITICAL: Deduplicate contactIds BEFORE processing to prevent duplicate sends
    // Remove duplicates from contactIds array to ensure each contact is only processed once
    const uniqueContactIds = Array.from(new Set(contactIds));
    if (uniqueContactIds.length !== contactIds.length) {
      console.warn(`[Send Message API] Removed ${contactIds.length - uniqueContactIds.length} duplicate contact IDs from request`);
      contactIds = uniqueContactIds; // Use deduplicated array
    }

    console.log("[Send Message API] Received request:", {
      requestId,
      contactIdsCount: contactIds?.length,
      originalCount: Array.isArray(body.contactIds) ? body.contactIds.length : 0,
      contactIds: contactIds,
      userId,
      hasMessage: !!message
    });

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: "No contacts selected" },
        { status: 400 }
      );
    }

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Safety guard: auto-confirm if caller did not pass confirm=true.
    // This prevents user-facing failures while still logging the implicit confirmation.
    if (confirm !== true) {
      console.warn("[Send Message API] No confirm flag provided; auto-confirming broadcast to avoid duplicates.");
      confirm = true;
    }

    console.log("[Send Message API] Fetching contacts with IDs:", contactIds);

    // For medium and large batches, immediately create a background job to avoid request timeouts
    const shouldUseBackgroundJob = !scheduleDate && contactIds.length > BACKGROUND_JOB_THRESHOLD;

    if (shouldUseBackgroundJob) {
      // Extremely large sends still go through the same path; we just adjust the log copy
      const mode = contactIds.length > LARGE_SEND_FAST_PATH_THRESHOLD ? "FAST-PATH" : "STANDARD";
      console.log(`[Send Message API] ${mode} background job enabled for batch of ${contactIds.length} contacts (threshold: ${BACKGROUND_JOB_THRESHOLD}, fast path: ${LARGE_SEND_FAST_PATH_THRESHOLD}). Creating job without prefetch.`);

      const dedupedContactIds = Array.from(new Set(contactIds));

      const { data: sendJob, error: jobError } = await supabaseServer
        .from("send_jobs")
        .insert({
          user_id: userId,
          contact_ids: dedupedContactIds,
          message: message.trim(),
          attachment: attachment || null,
          status: "pending",
          total_count: dedupedContactIds.length,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (jobError) {
        console.error("[Send Message API] Error creating background send job:", jobError);
        return NextResponse.json(
          { error: "Failed to create background job", details: jobError.message },
          { status: 500 }
        );
      }

      console.log(`[Send Message API] Background job created: ${sendJob.id} (deduped count: ${dedupedContactIds.length})`);

      // Fire-and-forget trigger; cron will also pick it up
      try {
        let triggerUrl = 'http://localhost:3000';
        if (process.env.NEXTAUTH_URL) {
          triggerUrl = process.env.NEXTAUTH_URL;
        } else if (process.env.VERCEL_URL) {
          triggerUrl = `https://${process.env.VERCEL_URL}`;
        }
        triggerUrl = `${triggerUrl}/api/facebook/messages/process-send-job`;

        fetch(triggerUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: sendJob.id,
            accessToken: (session as any).accessToken
          }),
          signal: AbortSignal.timeout(5000)
        }).then(response => {
          if (!response.ok) {
            console.warn(`[Send Message API] Background trigger returned ${response.status}, cron will resume job if needed`);
          }
        }).catch(err => {
          console.warn(`[Send Message API] Background trigger failed (${err.message}), cron will resume job`);
        });
      } catch (triggerError: any) {
        console.warn(`[Send Message API] Background trigger exception: ${triggerError.message}, cron will resume job`);
      }

      return NextResponse.json({
        success: true,
        results: {
          total: dedupedContactIds.length,
          sent: 0,
          failed: 0,
          errors: [],
          scheduled: false,
          backgroundJob: true,
          jobId: sendJob.id,
          message: `Batch detected (${dedupedContactIds.length} contacts). Job created and processing will start immediately. For huge sends (50k-100k), allow time for multiple cron runs.`
        }
      });
    }

    // The frontend uses contact_id as the id, so we need to query by contact_id
    // But we also need page_id to uniquely identify contacts
    // Since contactIds might be contact_id values, we need to handle both cases

    let contacts: any[] | null = null;
    let contactsError: any = null;

    try {
      // Add timeout to database queries (10 seconds)
      const queryTimeout = 10000;

      // Chunk contactIds to avoid Supabase IN() query limits
      // Supabase has a limit on the number of items in IN() clauses (typically 200-1000)
      contacts = [];
      contactsError = null;

      // IMPORTANT: Frontend sends a mix of database IDs and contact_ids
      // We need to try BOTH methods and merge results
      // First, try to fetch by database id
      console.log("[Send Message API] Fetching contacts by database id...");
      const contactsByDbId: any[] = [];

      for (const chunk of chunkArray(contactIds, CONTACT_FETCH_CHUNK)) {
        const chunkQueryPromise = supabaseServer
          .from("contacts")
          .select(`
            id,
            contact_id,
            page_id,
            contact_name,
            page_name
          `)
          .in("id", chunk)
          .eq("user_id", userId);

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Database query timeout")), queryTimeout)
        );

        try {
          const chunkQuery = await Promise.race([chunkQueryPromise, timeoutPromise]) as any;

          if (chunkQuery.error) {
            console.error(`[Send Message API] Error fetching chunk by id:`, chunkQuery.error);
            contactsError = chunkQuery.error;
          } else if (chunkQuery.data && chunkQuery.data.length > 0) {
            contactsByDbId.push(...chunkQuery.data);
          }
        } catch (chunkError: any) {
          console.error(`[Send Message API] Error in chunk query:`, chunkError);
          if (!contactsError) {
            contactsError = chunkError;
          }
        }
      }

      console.log(`[Send Message API] Found ${contactsByDbId.length} contacts by database id`);

      // ALWAYS try by contact_id as well (don't skip even if we found some by id)
      console.log("[Send Message API] Fetching contacts by contact_id...");
      const contactsByContactId: any[] = [];

      for (const chunk of chunkArray(contactIds, CONTACT_FETCH_CHUNK)) {
        const chunkQueryPromise = supabaseServer
          .from("contacts")
          .select(`
            id,
            contact_id,
            page_id,
            contact_name,
            page_name
          `)
          .in("contact_id", chunk)
          .eq("user_id", userId);

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Database query timeout")), queryTimeout)
        );

        try {
          const chunkQuery = await Promise.race([chunkQueryPromise, timeoutPromise]) as any;

          if (chunkQuery.error) {
            console.error(`[Send Message API] Error fetching chunk by contact_id:`, chunkQuery.error);
            contactsError = chunkQuery.error;
          } else if (chunkQuery.data && chunkQuery.data.length > 0) {
            contactsByContactId.push(...chunkQuery.data);
          }
        } catch (chunkError: any) {
          console.error(`[Send Message API] Error in chunk query (contact_id):`, chunkError);
          if (!contactsError) {
            contactsError = chunkError;
          }
        }
      }

      console.log(`[Send Message API] Found ${contactsByContactId.length} contacts by contact_id`);

      // Merge both results and remove duplicates
      const allContacts = [...contactsByDbId, ...contactsByContactId];
      const uniqueContacts = new Map<string, any>();
      const seenContactIds = new Set<string>();

      for (const contact of allContacts) {
        // CRITICAL: Use contact_id as the unique key (contact_id is globally unique per Facebook)
        // contact_id should always be present (NOT NULL in schema), but add safety check
        if (!contact.contact_id) {
          console.warn(`[Send Message API] ⚠️ Contact missing contact_id (unexpected!):`, {
            id: contact.id,
            name: contact.contact_name,
            page_id: contact.page_id
          });
          // Still include it using database id as fallback, but this shouldn't happen
          const fallbackKey = `db_${contact.id}`;
          if (!uniqueContacts.has(fallbackKey)) {
            uniqueContacts.set(fallbackKey, contact);
          }
          continue;
        }

        const contactId = String(contact.contact_id); // Ensure it's a string for Set comparison
        if (!seenContactIds.has(contactId)) {
          seenContactIds.add(contactId);
          uniqueContacts.set(contactId, contact);
        } else {
          console.log(`[Send Message API] Skipping duplicate contact: ${contact.contact_name} (contact_id: ${contact.contact_id})`);
        }
      }

      contacts = Array.from(uniqueContacts.values());
      console.log(`[Send Message API] Total unique contacts after merge: ${contacts.length} (removed ${allContacts.length - contacts.length} duplicates)`);

      // Log contact details for debugging
      if (contacts.length === 0) {
        console.error(`[Send Message API] ⚠️ NO CONTACTS FOUND after deduplication!`, {
          contactIdsRequested: contactIds.length,
          contactsByDbId: contactsByDbId.length,
          contactsByContactId: contactsByContactId.length,
          allContactsBeforeDedup: allContacts.length
        });
      } else {
        console.log(`[Send Message API] Sample contacts:`, contacts.slice(0, 3).map(c => ({
          id: c.id,
          contact_id: c.contact_id,
          name: c.contact_name,
          page_id: c.page_id
        })));
      }
    } catch (dbError: any) {
      console.error("[Send Message API] Database error fetching contacts:", dbError);
      contactsError = dbError;

      // If it's a timeout, provide a more helpful error message
      if (dbError.message?.includes("timeout")) {
        contactsError = {
          message: "Database connection timeout. Please try again in a moment.",
          code: "TIMEOUT"
        };
      }
    }

    console.log("[Send Message API] Query result:", {
      contactsFound: contacts?.length || 0,
      error: contactsError?.message,
      userId
    });

    if (contactsError) {
      console.error("Error fetching contacts:", contactsError);
      // Check if it's an HTML error (Cloudflare timeout/error)
      const errorMessage = typeof contactsError === 'string' && contactsError.includes('<html>')
        ? "Database connection timeout. Please try again."
        : contactsError.message || "Failed to fetch contacts";

      return NextResponse.json(
        { error: "Failed to fetch contacts", details: errorMessage },
        { status: 500 }
      );
    }

    if (!contacts || contacts.length === 0) {
      return NextResponse.json(
        { error: "No contacts found" },
        { status: 404 }
      );
    }

    // Batches above BACKGROUND_JOB_THRESHOLD already bail out to background jobs to avoid timeouts
    // Remaining sends are handled inline below (small batches or scheduled messages)


    // If scheduleDate is provided, store the message for later instead of sending immediately
    if (scheduleDate) {
      const scheduledDate = new Date(scheduleDate);
      const now = new Date();

      console.log("[Send Message API] Scheduling message:", {
        scheduleDateInput: scheduleDate,
        scheduledDateISO: scheduledDate.toISOString(),
        scheduledDateLocal: scheduledDate.toLocaleString('en-US', { timeZone: 'Asia/Manila' }),
        nowISO: now.toISOString(),
        nowLocal: now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }),
        isFuture: scheduledDate > now,
        timeUntil: scheduledDate.getTime() - now.getTime()
      });

      if (scheduledDate <= now) {
        return NextResponse.json(
          { error: "Scheduled date must be in the future" },
          { status: 400 }
        );
      }

      // Store scheduled message in database
      // CRITICAL: Use unique contact IDs from fetched contacts (already deduplicated)
      const uniqueContactIdsForSchedule = contacts.map((c: any) => {
        return c.contact_id || c.id;
      });

      const { data: scheduledMessage, error: scheduleError } = await supabaseServer
        .from("scheduled_messages")
        .insert({
          user_id: userId,
          contact_ids: uniqueContactIdsForSchedule, // Store deduplicated contact IDs
          message: message.trim(),
          attachment: attachment || null,
          scheduled_for: scheduledDate.toISOString(),
          status: "pending"
        })
        .select()
        .single();

      if (scheduleError) {
        console.error("Error scheduling message:", scheduleError);
        return NextResponse.json(
          { error: "Failed to schedule message", details: scheduleError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        results: {
          total: contactIds.length,
          sent: 0,
          failed: 0,
          errors: [],
          scheduled: true,
          scheduledMessageId: scheduledMessage.id,
          scheduledFor: scheduledDate.toISOString()
        }
      });
    }

    // CRITICAL FIX: Send ONLY ONE message per contact to prevent duplicates
    // - If attachment exists: Send ONLY the media (no separate text)
    // - If no attachment: Send ONLY the text
    // Facebook Messenger API doesn't support text+media in one message, so we must choose one

    // Group contacts by page
    const contactsByPage = new Map<string, any[]>();
    for (const contact of contacts) {
      const pageId = contact.page_id;
      if (!contactsByPage.has(pageId)) {
        contactsByPage.set(pageId, []);
      }
      contactsByPage.get(pageId)!.push(contact);
    }

    // Track which contacts we've already sent to (prevents duplicates within this request)
    const sentTextToContacts = new Set<string>();

    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
      scheduled: false
    };

    // Track start time for timeout protection
    const startTime = Date.now();
    const VERCEL_TIMEOUT = 280000; // 280 seconds (leave 20s buffer before 300s limit)

    console.log(`[Send Message API] Starting send operation for ${contacts.length} contacts across ${contactsByPage.size} pages`);
    console.log(`[Send Message API] Mode: ${attachment && attachment.url ? 'MEDIA-ONLY' : 'TEXT-ONLY'}`);

    if (contacts.length === 0) {
      console.error(`[Send Message API] ⚠️ CRITICAL: No contacts to send to!`);
      return NextResponse.json({
        success: false,
        error: "No contacts found to send messages to",
        results: {
          total: 0,
          sent: 0,
          failed: 0,
          errors: [{ error: "No contacts found after processing" }]
        }
      }, { status: 400 });
    }

    // Process each page
    for (const [pageId, pageContacts] of contactsByPage.entries()) {
      console.log(`[Send Message API] Processing page ${pageId} with ${pageContacts.length} contacts`);

      // Check timeout
      if (Date.now() - startTime > VERCEL_TIMEOUT) {
        console.warn(`[Send Message API] Timeout approaching, stopping`);
        break;
      }

      // Get page access token
      const { data: pageData, error: pageError } = await supabaseServer
        .from("facebook_pages")
        .select("page_id, page_access_token")
        .eq("page_id", pageId)
        .maybeSingle();

      if (pageError || !pageData?.page_access_token) {
        console.error(`[Send Message API] No access token for page ${pageId}`);
        results.failed += pageContacts.length;
        results.errors.push({
          page: pageContacts[0]?.page_name || pageId,
          error: "No access token available for this page"
        });
        continue;
      }

      const pageAccessToken = pageData.page_access_token;

      // Send message to each contact on this page
      for (const contact of pageContacts) {
        // Skip contacts without contact_id (can't send without it)
        if (!contact.contact_id) {
          console.warn(`[Send Message API] ⚠️ Skipping contact without contact_id: ${contact.contact_name} (id: ${contact.id})`);
          results.failed++;
          results.errors.push({
            contact: contact.contact_name,
            page: contact.page_name,
            error: "Missing contact_id"
          });
          continue;
        }

        // CRITICAL: Skip if already sent to this contact (check BEFORE processing)
        const contactIdStr = String(contact.contact_id);
        if (sentTextToContacts.has(contactIdStr)) {
          console.warn(`[Send Message API] ⚠️ DUPLICATE PREVENTION: Skipping duplicate send to ${contact.contact_name} (contact_id: ${contact.contact_id})`);
          continue;
        }

        // Mark as processing IMMEDIATELY to prevent concurrent sends to same contact
        sentTextToContacts.add(contactIdStr);

        try {
          let payload: any;
          let messageType: string;

          if (attachment && attachment.url) {
            // SEND MEDIA ONLY (when attachment exists)
            messageType = 'MEDIA';
            const attachmentType = attachment.type || "file";
            console.log(`[Send Message API] Sending MEDIA to ${contact.contact_name} (${contact.contact_id})...`);

            payload = {
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
          } else {
            // SEND TEXT ONLY (when no attachment)
            messageType = 'TEXT';
            let personalizedMessage = message;
            const firstName = contact.contact_name?.split(' ')[0] || 'there';
            personalizedMessage = personalizedMessage.replace(/{FirstName}/g, firstName);

            console.log(`[Send Message API] Sending TEXT to ${contact.contact_name} (${contact.contact_id})...`);

            payload = {
              recipient: { id: contact.contact_id },
              message: { text: personalizedMessage },
              messaging_type: "MESSAGE_TAG",
              tag: "ACCOUNT_UPDATE"
            };
          }

          const response = await fetch(
            `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }
          );

          const data = await response.json();

          if (response.ok && !data.error) {
            results.success++;
            console.log(`✅ Sent ${messageType} to ${contact.contact_name} (${contact.contact_id})`);
          } else {
            // Remove from sent set if send failed (allow retry)
            sentTextToContacts.delete(String(contact.contact_id));
            results.failed++;
            const errorMsg = data.error?.message || "Unknown error";
            console.error(`❌ Failed ${messageType} to ${contact.contact_name} (${contact.contact_id}): ${errorMsg}`);
            results.errors.push({
              contact: contact.contact_name,
              page: contact.page_name,
              error: errorMsg
            });
          }

          // Rate limiting (50ms for faster processing)
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error: any) {
          // Remove from sent set on error (allow retry)
          sentTextToContacts.delete(String(contact.contact_id));
          results.failed++;
          console.error(`❌ Error sending to ${contact.contact_name} (${contact.contact_id}):`, error);
          results.errors.push({
            contact: contact.contact_name,
            page: contact.page_name,
            error: error.message || "Unknown error"
          });
        }
      }
    }

    console.log(`[Send Message API] Operation complete: ${results.success} success, ${results.failed} failed`);

    return NextResponse.json({
      success: true,
      results: {
        total: contactIds.length,
        sent: results.success,
        failed: results.failed,
        errors: results.errors,
        scheduled: results.scheduled
      }
    });
  } catch (error: any) {
    console.error("Error in send message route:", error);
    // Always return JSON, even on errors, to prevent frontend JSON parsing issues
    try {
      return NextResponse.json(
        {
          success: false,
          error: "Internal server error",
          details: error.message || "An unexpected error occurred"
        },
        {
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    } catch (jsonError) {
      // Fallback if JSON.stringify fails (shouldn't happen)
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: "Internal server error",
          details: "An unexpected error occurred"
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }
  }
}
