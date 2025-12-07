import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseServer } from "@/lib/supabase-server";

// Vercel Pro allows up to 300 seconds (5 minutes), Hobby plan allows 10 seconds
// For large batches (>100 contacts), we use background jobs to avoid timeout
export const maxDuration = 300; // 5 minutes max duration (requires Vercel Pro plan)
export const dynamic = "force-dynamic";

// Threshold for using background jobs (to avoid timeout)
const BACKGROUND_JOB_THRESHOLD = 100;

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
    let { contactIds, message, scheduleDate, attachment } = body;

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

    console.log("[Send Message API] Fetching contacts with IDs:", contactIds);

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

    // For large batches, use background job to avoid timeout
    // If not scheduled and batch is large, create a background job
    if (!scheduleDate && contacts.length > BACKGROUND_JOB_THRESHOLD) {
      console.log(`[Send Message API] Large batch detected (${contacts.length} contacts), creating background job`);

      try {
        // Create job with status 'processing' (not 'pending') so cron doesn't pick it up
        // We're about to trigger the process-send-job endpoint directly
        // CRITICAL: Store deduplicated contactIds (contacts array is already deduplicated)
        // Use the unique contact_ids from the fetched contacts to ensure consistency
        const uniqueContactIdsForJob = contacts.map((c: any) => {
          // Prefer storing contact_id if available, otherwise use database id
          return c.contact_id || c.id;
        });
        
        const { data: sendJob, error: jobError } = await supabaseServer
          .from("send_jobs")
          .insert({
            user_id: userId,
            contact_ids: uniqueContactIdsForJob, // Store deduplicated contact IDs
            message: message.trim(),
            attachment: attachment || null,
            status: "processing", // NOT 'pending' - prevents cron from picking it up
            total_count: contacts.length, // Use deduplicated count
            started_at: new Date().toISOString() // Mark as started
          })
          .select()
          .single();

        if (jobError) {
          console.error("[Send Message API] Error creating send job:", jobError);
          console.error("[Send Message API] Job error details:", JSON.stringify(jobError, null, 2));
          // Check if it's a table not found error
          if (jobError.message?.includes("relation") && jobError.message?.includes("does not exist")) {
            console.error("[Send Message API] send_jobs table does not exist! Please run the migration.");
            return NextResponse.json({
              success: false,
              error: "Database migration required",
              details: "The send_jobs table has not been created. Please run the migration from supabase_migrations/create_send_jobs_table.sql",
              results: {
                total: contacts.length,
                sent: 0,
                failed: 0,
                errors: []
              }
            }, { status: 500 });
          }
          // Fall through to try sending directly (may timeout but better than failing completely)
          console.log("[Send Message API] Failed to create job, attempting direct send (may timeout)");
        } else if (sendJob) {
          console.log(`[Send Message API] Background job created successfully: ${sendJob.id}`);

          // Trigger background processing asynchronously (don't wait for it)
          // Pass the access token so the job processor can fetch pages if needed
          // Note: We don't use Authorization header since process-send-job accepts accessToken in body
          let triggerUrl = 'http://localhost:3000';
          if (process.env.NEXTAUTH_URL) {
            triggerUrl = process.env.NEXTAUTH_URL;
          } else if (process.env.VERCEL_URL) {
            triggerUrl = `https://${process.env.VERCEL_URL}`;
          }
          triggerUrl = `${triggerUrl}/api/facebook/messages/process-send-job`;
          fetch(triggerUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              jobId: sendJob.id,
              accessToken: (session as any).accessToken
            }),
          }).then(response => {
            if (!response.ok) {
              console.error(`[Send Message API] Failed to trigger background job: ${response.status} ${response.statusText}`);
            } else {
              console.log(`[Send Message API] Background job trigger sent successfully for job ${sendJob.id}`);
            }
          }).catch(err => {
            console.error("[Send Message API] Failed to trigger background job:", err);
            // Job will be picked up by cron or manual trigger
          });

          return NextResponse.json({
            success: true,
            results: {
              total: contacts.length,
              sent: 0,
              failed: 0,
              errors: [],
              scheduled: false,
              backgroundJob: true,
              jobId: sendJob.id,
              message: `Large batch detected. Processing ${contacts.length} messages in the background. Check job status for progress.`
            }
          });
        } else {
          console.error("[Send Message API] Job creation returned no data and no error");
          // Fall through to direct send
        }
      } catch (error: any) {
        console.error("[Send Message API] Exception creating send job:", error);
        // Fall through to try sending directly
      }
    }

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

    // NEW LOGIC: Send TEXT first to ALL contacts, then MEDIA to ALL contacts
    // This prevents issues with duplicate sends and ensures proper message ordering

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
    // Use string keys for consistency (contact_id can be string or number)
    const sentTextToContacts = new Set<string>();
    const sentMediaToContacts = new Set<string>();

    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
      scheduled: false
    };

    // Track start time for timeout protection
    const startTime = Date.now();
    const VERCEL_TIMEOUT = 280000; // 280 seconds

    console.log(`[Send Message API] Starting send operation for ${contacts.length} contacts across ${contactsByPage.size} pages`);

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

    // STEP 1: Send TEXT messages to ALL contacts first
    console.log(`[Send Message API] STEP 1: Sending TEXT to all contacts...`);
    for (const [pageId, pageContacts] of contactsByPage.entries()) {
      console.log(`[Send Message API] Processing page ${pageId} with ${pageContacts.length} contacts`);
      // Check timeout
      if (Date.now() - startTime > VERCEL_TIMEOUT) {
        console.warn(`[Send Message API] Timeout approaching during TEXT phase`);
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

      // Send TEXT to each contact on this page
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

        // CRITICAL: Skip if already sent text to this contact (check BEFORE processing)
        // Convert to string for consistent Set comparison
        const contactIdStr = String(contact.contact_id);
        if (sentTextToContacts.has(contactIdStr)) {
          console.warn(`[Send Message API] ⚠️ DUPLICATE PREVENTION: Skipping duplicate TEXT send to ${contact.contact_name} (contact_id: ${contact.contact_id})`);
          continue;
        }

        // Mark as processing IMMEDIATELY to prevent concurrent sends to same contact
        sentTextToContacts.add(contactIdStr);

        try {
          // Replace {FirstName} placeholder
          let personalizedMessage = message;
          const firstName = contact.contact_name?.split(' ')[0] || 'there';
          personalizedMessage = personalizedMessage.replace(/{FirstName}/g, firstName);

          console.log(`[Send Message API] Sending TEXT to ${contact.contact_name} (${contact.contact_id})...`);

          const textPayload = {
            recipient: { id: contact.contact_id },
            message: { text: personalizedMessage },
            messaging_type: "MESSAGE_TAG",
            tag: "ACCOUNT_UPDATE"
          };

          const response = await fetch(
            `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(textPayload),
            }
          );

          const data = await response.json();

          if (response.ok && !data.error) {
            results.success++;
            console.log(`✅ Sent TEXT to ${contact.contact_name} (${contact.contact_id})`);
          } else {
            // Remove from sent set if send failed (allow retry)
            sentTextToContacts.delete(String(contact.contact_id));
            results.failed++;
            const errorMsg = data.error?.message || "Unknown error";
            console.error(`❌ Failed TEXT to ${contact.contact_name} (${contact.contact_id}): ${errorMsg}`);
            results.errors.push({
              contact: contact.contact_name,
              page: contact.page_name,
              error: errorMsg
            });
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error: any) {
          // Remove from sent set on error (allow retry)
          sentTextToContacts.delete(String(contact.contact_id));
          results.failed++;
          console.error(`❌ Error sending TEXT to ${contact.contact_name} (${contact.contact_id}):`, error);
          results.errors.push({
            contact: contact.contact_name,
            page: contact.page_name,
            error: error.message || "Unknown error"
          });
        }
      }
    }

    console.log(`[Send Message API] TEXT phase complete: ${sentTextToContacts.size} sent`);

    // STEP 2: Send MEDIA to ALL contacts (only if attachment exists)
    if (attachment && attachment.url) {
      console.log(`[Send Message API] STEP 2: Sending MEDIA to all contacts...`);

      for (const [pageId, pageContacts] of contactsByPage.entries()) {
        // Check timeout
        if (Date.now() - startTime > VERCEL_TIMEOUT) {
          console.warn(`[Send Message API] Timeout approaching during MEDIA phase`);
          break;
        }

        // Get page access token
        const { data: pageData } = await supabaseServer
          .from("facebook_pages")
          .select("page_id, page_access_token")
          .eq("page_id", pageId)
          .maybeSingle();

        if (!pageData?.page_access_token) {
          continue; // Already logged error in TEXT phase
        }

        const pageAccessToken = pageData.page_access_token;
        const attachmentType = attachment.type || "file";

        // Send MEDIA to each contact on this page
        for (const contact of pageContacts) {
          // Skip contacts without contact_id
          if (!contact.contact_id) {
            continue; // Already logged error in TEXT phase
          }

          // CRITICAL: Skip if already sent media to this contact (check BEFORE processing)
          // Also skip if we haven't sent text to this contact (text must come first)
          const contactIdStr = String(contact.contact_id);
          if (sentMediaToContacts.has(contactIdStr)) {
            console.warn(`[Send Message API] ⚠️ DUPLICATE PREVENTION: Skipping duplicate MEDIA send to ${contact.contact_name} (contact_id: ${contact.contact_id})`);
            continue;
          }

          // Skip if text wasn't sent (media should only be sent after successful text)
          if (!sentTextToContacts.has(contactIdStr)) {
            console.warn(`[Send Message API] ⚠️ Skipping MEDIA for ${contact.contact_name} - text was not sent first`);
            continue;
          }

          // Mark as processing IMMEDIATELY to prevent concurrent sends to same contact
          sentMediaToContacts.add(contactIdStr);

          try {
            console.log(`[Send Message API] Sending MEDIA to ${contact.contact_name} (${contact.contact_id})...`);

            const mediaPayload = {
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

            const response = await fetch(
              `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(mediaPayload),
              }
            );

            const data = await response.json();

            if (response.ok && !data.error) {
              console.log(`✅ Sent MEDIA to ${contact.contact_name} (${contact.contact_id})`);
            } else {
              // Remove from sent set if send failed (allow retry)
              sentMediaToContacts.delete(String(contact.contact_id));
              const errorMsg = data.error?.message || "Unknown error";
              console.error(`❌ Failed MEDIA to ${contact.contact_name} (${contact.contact_id}): ${errorMsg}`);
              // Don't add to failed count since text was already counted
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error: any) {
            // Remove from sent set on error (allow retry)
            sentMediaToContacts.delete(String(contact.contact_id));
            console.error(`❌ Error sending MEDIA to ${contact.contact_name} (${contact.contact_id}):`, error);
          }
        }
      }

      console.log(`[Send Message API] MEDIA phase complete: ${sentMediaToContacts.size} sent`);
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

