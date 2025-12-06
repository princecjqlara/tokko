import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Vercel Pro allows up to 300 seconds (5 minutes), Hobby plan allows 10 seconds
// For large syncs, consider using background jobs instead
export const maxDuration = 300; // 5 minutes max duration (requires Vercel Pro plan)

export async function GET(request: NextRequest) {
  console.log("[Stream Route] GET /api/facebook/contacts/stream called");

  // Set a global timeout to ensure stream completes (10 minutes to handle large datasets)
  const STREAM_TIMEOUT = 600000; // 10 minutes

  // Get optional page filter from query params
  const searchParams = request.nextUrl.searchParams;
  const filterPageId = searchParams.get("pageId"); // Optional: filter by specific page ID

  try {
    const encoder = new TextEncoder();
    let streamCompleted = false;
    let streamTimeoutId: NodeJS.Timeout | null = null;
    // Declare userId and accessToken at outer scope for error handler access
    let userId: string | undefined;
    let accessToken: string | undefined;
    // Declare allContacts and existingContactCount at outer scope for timeout handler access
    let allContacts: any[] = [];
    let processedPagesCount = 0;
    let existingContactCount = 0;
    let pages: any[] = [];
    let heartbeatInterval: NodeJS.Timeout | null = null;
    let hardStopTimeout: NodeJS.Timeout | null = null;
    let lastSentContactCount = 0; // Track last sent count to ensure it never decreases

    const stream = new ReadableStream({
      async start(controller) {
        console.log("[Stream Route] Stream started, initializing...");
        const streamStartTime = Date.now();
        const VERCEL_TIMEOUT = 280000; // 280 seconds (leave 20s buffer before Vercel's 300s limit)

        // Set timeout to force completion before Vercel timeout
        streamTimeoutId = setTimeout(() => {
          if (!streamCompleted) {
            console.warn("⚠️ [Stream Route] Approaching Vercel timeout, forcing completion...");
            streamCompleted = true;
            clearTimers();
            try {
              send({
                type: "complete",
                message: "Sync partially completed due to timeout. Some pages may not have been processed. You can sync again to continue.",
                totalContacts: allContacts.length,
                newContactsCount: allContacts.length
              });
              controller.close();
            } catch (err) {
              console.error("Error in timeout handler:", err);
            }
          }
        }, VERCEL_TIMEOUT);

        // Helper to check if we're approaching timeout
        const checkTimeout = () => {
          const elapsed = Date.now() - streamStartTime;
          const remaining = VERCEL_TIMEOUT - elapsed;
          if (remaining < 30000) { // Less than 30 seconds remaining
            console.warn(`⚠️ [Stream Route] Only ${Math.round(remaining / 1000)}s remaining, will complete soon`);
            return true;
          }
          return false;
        };

        const send = (data: any) => {
          try {
            // Check if controller is still open before sending
            if (controller.desiredSize === null) {
              // Controller is closed, don't try to send
              return;
            }
            const message = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(message));
          } catch (error: any) {
            // If controller is closed, that's expected when client disconnects
            if (error?.message?.includes("closed") || error?.code === "ERR_INVALID_STATE") {
              // Silently ignore - client disconnected
              return;
            }
            console.error("Error sending data:", error);
            // Don't throw - just log the error to prevent stream from crashing
          }
        };

        const clearTimers = () => {
          if (streamTimeoutId) {
            clearTimeout(streamTimeoutId);
            streamTimeoutId = null;
          }
          if (hardStopTimeout) {
            clearTimeout(hardStopTimeout);
            hardStopTimeout = null;
          }
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
          }
        };

        // Hard stop after STREAM_TIMEOUT as a final safety to avoid stuck streams
        hardStopTimeout = setTimeout(async () => {
          if (!streamCompleted) {
            console.warn("[Stream Route] Global stream timeout reached, closing stream to avoid getting stuck");
            streamCompleted = true;
            clearTimers();
            try {
              // Get actual database count
              let timeoutTotal = 0;
              try {
                const { count: timeoutCount } = await supabaseServer
                  .from("contacts")
                  .select("*", { count: "exact", head: true })
                  .eq("user_id", userId);

                if (timeoutCount !== null) {
                  timeoutTotal = timeoutCount;
                } else {
                  timeoutTotal = Math.max(lastSentContactCount || existingContactCount || 0, 0);
                }
              } catch (timeoutCountError) {
                timeoutTotal = Math.max(lastSentContactCount || existingContactCount || 0, 0);
              }

              send({
                type: "complete",
                message: "Sync timed out. Some pages may be incomplete, please resync.",
                totalContacts: timeoutTotal,
                newContactsCount: allContacts.length
              });
              controller.close();
            } catch (err) {
              console.error("Error closing stream after global timeout:", err);
              try {
                controller.close();
              } catch (e) {
                // Ignore second close error
              }
            }
          }
        }, STREAM_TIMEOUT);

        // Heartbeat to keep the connection alive and surface progress even if upstream is quiet
        heartbeatInterval = setInterval(async () => {
          if (streamCompleted) return;

          // Query database for actual count in heartbeat to prevent duplication
          let safeTotal = existingContactCount + allContacts.length;
          try {
            const { count: heartbeatCount } = await supabaseServer
              .from("contacts")
              .select("*", { count: "exact", head: true })
              .eq("user_id", userId);

            if (heartbeatCount !== null) {
              // Update existingContactCount to reflect actual database state
              existingContactCount = Math.max(0, heartbeatCount - allContacts.length);
              safeTotal = Math.max(heartbeatCount, lastSentContactCount);
              lastSentContactCount = safeTotal;
            }
          } catch (heartbeatCountError) {
            // If query fails, use calculated value
            safeTotal = Math.max(existingContactCount + allContacts.length, lastSentContactCount);
            lastSentContactCount = safeTotal;
          }

          const totalPages = pages.length > 0 ? pages.length : undefined;
          send({
            type: "status",
            message: "Still syncing contacts...",
            totalContacts: safeTotal,
            currentPage: processedPagesCount || undefined,
            totalPages
          });
        }, 20000);

        try {
          console.log("[Stream Route] Getting session...");
          const session = await getServerSession(authOptions);

          if (!session || !(session as any).accessToken) {
            send({ type: "error", message: "Unauthorized" });
            clearTimers();
            streamCompleted = true;
            controller.close();
            return;
          }

          userId = (session.user as any).id;
          accessToken = (session as any).accessToken;

          // Helper function to check if job is paused
          const checkIfPaused = async (): Promise<boolean> => {
            try {
              const { data, error } = await supabaseServer
                .from("fetch_jobs")
                .select("is_paused, status")
                .eq("user_id", userId)
                .in("status", ["running", "paused"])
                .order("updated_at", { ascending: false })
                .limit(1)
                .single();

              if (error && error.code !== "PGRST116") {
                console.error("Error checking pause state:", error);
                return false; // Continue if we can't check
              }

              return data?.is_paused === true || data?.status === "paused";
            } catch (err) {
              console.error("Exception checking pause state:", err);
              return false; // Continue if error
            }
          };

          // Helper function to check if job was cancelled by user DURING this stream
          // Only returns true if cancellation happened after this stream started
          const checkIfCancelled = async (): Promise<boolean> => {
            try {
              const { data, error } = await supabaseServer
                .from("fetch_jobs")
                .select("status, updated_at")
                .eq("user_id", userId)
                .eq("status", "cancelled")
                .order("updated_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (error && error.code !== "PGRST116") {
                console.error("Error checking cancelled state:", error);
                return false;
              }

              // Only consider it cancelled if it was cancelled AFTER this stream started
              if (data?.status === "cancelled" && data?.updated_at) {
                const cancelledAt = new Date(data.updated_at).getTime();
                // If cancelled after this stream started, it's a real cancellation
                if (cancelledAt > streamStartTime) {
                  console.log(`[Stream Route] Detected cancellation at ${data.updated_at} (stream started at ${new Date(streamStartTime).toISOString()})`);
                  return true;
                }
              }

              return false;
            } catch (err) {
              console.error("Exception checking cancelled state:", err);
              return false;
            }
          };

          // Helper function to wait while paused (with timeout to prevent infinite wait)
          const waitWhilePaused = async (maxWaitTime = 300000): Promise<void> => { // 5 minute max wait
            const startTime = Date.now();
            while (await checkIfPaused()) {
              // Check if we've exceeded max wait time
              if (Date.now() - startTime > maxWaitTime) {
                console.warn("⚠️ Pause wait timeout exceeded, continuing...");
                break;
              }
              send({
                type: "status",
                message: "Fetching paused. Waiting to resume..."
              });
              await new Promise(resolve => setTimeout(resolve, 1000)); // Check every second
            }
          };

          // Helper function to update job status
          const updateJobStatus = async (updates: any) => {
            try {
              // Find existing running/paused job
              const { data: existingJob, error: jobError } = await supabaseServer
                .from("fetch_jobs")
                .select("id")
                .eq("user_id", userId)
                .in("status", ["running", "paused", "pending"])
                .order("updated_at", { ascending: false })
                .limit(1)
                .single();

              // Check for database errors (distinct from PGRST116 "no rows" case)
              if (jobError && jobError.code !== "PGRST116") {
                console.error("Error fetching existing job:", jobError);
                // Continue with creating a new job if we can't fetch existing one
                // This prevents masking the error but allows the process to continue
              }

              // Prepare update object
              const updateData: any = {
                status: updates.status || "running",
                is_paused: updates.is_paused || false,
                current_page_name: updates.current_page_name,
                current_page_number: updates.current_page_number,
                total_pages: updates.total_pages,
                total_contacts: updates.total_contacts,
                message: updates.message,
                updated_at: new Date().toISOString(),
              };

              // Add completed_at if status is completed
              if (updates.status === "completed" && updates.completed_at) {
                updateData.completed_at = updates.completed_at;
              }

              if (existingJob) {
                // Update existing job
                await supabaseServer
                  .from("fetch_jobs")
                  .update(updateData)
                  .eq("id", existingJob.id);
              } else {
                // Create new job
                const insertData: any = {
                  user_id: userId,
                  ...updateData,
                  total_contacts: updates.total_contacts || 0,
                };
                await supabaseServer
                  .from("fetch_jobs")
                  .insert(insertData);
              }
            } catch (err) {
              console.error("Error updating job status:", err);
              // Don't throw - continue fetching even if status update fails
            }
          };

          // Get existing contact count from database to preserve it
          // This is used only for initial display, final count will always come from database
          try {
            const { count, error: countError } = await supabaseServer
              .from("contacts")
              .select("*", { count: "exact", head: true })
              .eq("user_id", userId);

            if (!countError && count !== null) {
              existingContactCount = count;
              console.log(`[Stream Route] Found ${existingContactCount} existing contacts in database`);
            }
          } catch (countErr) {
            console.error("[Stream Route] Error getting existing contact count:", countErr);
            // Continue with 0 if we can't get the count
            existingContactCount = 0;
          }

          // Create initial job record with existing count
          await updateJobStatus({
            status: "running",
            is_paused: false,
            message: "Starting to fetch contacts...",
            total_contacts: existingContactCount
          });

          // Test database connection and table access
          try {
            const { data: testData, error: testError } = await supabaseServer
              .from("contacts")
              .select("id")
              .limit(1);

            if (testError) {
              console.error("❌ Database connection test failed:", {
                code: testError.code,
                message: testError.message,
                details: testError.details,
                hint: testError.hint
              });
              send({
                type: "error",
                message: `Database error: ${testError.message}. Please check if the contacts table exists and RLS is configured correctly.`
              });
              clearTimers();
              streamCompleted = true;
              controller.close();
              return;
            }
            console.log("✅ Database connection test passed - contacts table is accessible");
          } catch (testErr: any) {
            console.error("❌ Database connection test exception:", testErr);
            send({
              type: "error",
              message: `Database connection failed: ${testErr.message}`
            });
            clearTimers();
            streamCompleted = true;
            controller.close();
            return;
          }

          // Helper function to retry with exponential backoff
          const fetchWithRetry = async (url: string, retries = 3, delay = 1000): Promise<Response> => {
            for (let i = 0; i < retries; i++) {
              try {
                const response = await fetch(url);

                if (response.ok) {
                  return response;
                }

                const errorData = await response.json().catch(() => ({}));

                // Check if it's a rate limit error
                if (errorData.error?.code === 4 || errorData.error?.is_transient) {
                  if (i < retries - 1) {
                    const waitTime = delay * Math.pow(2, i);
                    send({
                      type: "status",
                      message: `Rate limit hit, waiting ${Math.round(waitTime / 1000)}s before retry...`
                    });
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                  }
                }

                return response;
              } catch (error) {
                if (i === retries - 1) throw error;
                const waitTime = delay * Math.pow(2, i);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              }
            }
            throw new Error("Max retries exceeded");
          };

          send({ type: "status", message: "Fetching pages...", progress: 0 });
          console.log("[Stream Route] Starting to fetch pages...");

          // Fetch pages - try database first, fallback to Facebook API
          let pages: any[] = [];

          try {
            console.log("[Stream Route] Attempting to fetch pages from database...");
            // Add timeout to database query (10 seconds)
            const dbQueryPromise = supabaseServer
              .from("user_pages")
              .select(`
              page_id,
              facebook_pages!inner (
                page_id,
                page_name,
                page_access_token
              )
            `)
              .eq("user_id", userId);

            const dbTimeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Database query timeout")), 10000)
            );

            const { data: userPages, error: dbError } = await Promise.race([
              dbQueryPromise,
              dbTimeoutPromise
            ]) as any;

            // If database query succeeds and has data, use it
            if (!dbError && userPages && userPages.length > 0) {
              pages = (userPages || [])
                .filter((up: any) => up.facebook_pages)
                .map((up: any) => ({
                  id: up.facebook_pages.page_id,
                  name: up.facebook_pages.page_name,
                  access_token: up.facebook_pages.page_access_token,
                }));
              console.log(`[Stream Route] Fetched ${pages.length} pages from database`);
            } else {
              // Database error or no data - fallback to Facebook API
              if (dbError) {
                console.log("[Stream Route] Database error, falling back to Facebook API:", dbError.message || dbError);
              } else {
                console.log("[Stream Route] No pages in database, fetching from Facebook API...");
              }

              console.log("[Stream Route] Calling Facebook API to fetch pages...");
              const pagesResponse = await fetchWithRetry(
                `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}&fields=id,name,access_token&limit=1000`
              );
              console.log("[Stream Route] Facebook API response status:", pagesResponse.status);

              if (pagesResponse.ok) {
                const pagesData = await pagesResponse.json();
                pages = pagesData.data || [];
                console.log(`Fetched ${pages.length} pages from Facebook API`);
              } else {
                const errorData = await pagesResponse.json().catch(() => ({}));
                console.error("Error fetching pages from Facebook:", errorData);

                if (errorData.error?.code === 4 || errorData.error?.is_transient) {
                  send({
                    type: "error",
                    message: "Facebook API rate limit reached. Please wait a few minutes and try again."
                  });
                } else {
                  send({ type: "error", message: `Failed to fetch pages: ${errorData.error?.message || "Unknown error"}` });
                }
                clearTimers();
                streamCompleted = true;
                controller.close();
                return;
              }
            }
          } catch (pagesError: any) {
            console.error("[Stream Route] Error fetching pages:", pagesError);
            // Check if it's a timeout
            if (pagesError.message?.includes("timeout")) {
              console.warn("[Stream Route] Database query timed out, trying Facebook API...");
            }
            // Try Facebook API as last resort with retry
            try {
              console.log("[Stream Route] Attempting fallback to Facebook API...");
              const pagesResponse = await fetchWithRetry(
                `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}&fields=id,name,access_token&limit=1000`
              );
              if (pagesResponse.ok) {
                const pagesData = await pagesResponse.json();
                pages = pagesData.data || [];
                console.log(`Fallback: Fetched ${pages.length} pages from Facebook API`);
              } else {
                const errorData = await pagesResponse.json().catch(() => ({}));
                if (errorData.error?.code === 4 || errorData.error?.is_transient) {
                  send({
                    type: "error",
                    message: "Facebook API rate limit reached. Please wait a few minutes and try again."
                  });
                } else {
                  send({ type: "error", message: `Error fetching pages: ${pagesError.message || "Unknown error"}` });
                }
                clearTimers();
                streamCompleted = true;
                controller.close();
                return;
              }
            } catch (fallbackError: any) {
              console.error("Fallback also failed:", fallbackError);
              send({ type: "error", message: `Error fetching pages: ${pagesError.message || "Unknown error"}` });
              clearTimers();
              streamCompleted = true;
              controller.close();
              return;
            }
          }

          console.log(`[Stream Route] Total pages found: ${pages.length}`);
          if (pages.length === 0) {
            console.error("[Stream Route] No pages found - cannot proceed with contact fetch");
            send({ type: "error", message: "No pages found. Please make sure you have connected Facebook pages with messaging permissions." });
            clearTimers();
            streamCompleted = true;
            controller.close();
            return;
          }

          send({
            type: "pages_fetched",
            totalPages: pages.length,
            message: `Found ${pages.length} pages. Starting to fetch contacts...`
          });

          // Reset allContacts array for this stream
          allContacts = [];
          // Global pending contacts buffer - accessible by timeout handler
          let globalPendingContacts: any[] = [];
          // Use a global Set to track unique contacts across ALL pages (not just per-page)
          // This prevents counting the same contact multiple times if they appear in multiple pages
          const globalSeenContactKeys = new Set<string>();
          let processedPages = 0; // Track number of pages actually processed (not skipped)
          // Initialize lastSentContactCount with existing count (variable declared at outer scope)
          lastSentContactCount = existingContactCount;

          // Send initial status update with existing count
          send({
            type: "status",
            message: existingContactCount > 0
              ? `Resuming fetch... (${existingContactCount} contacts already loaded)`
              : `Starting to process ${pages.length} pages...`,
            progress: 0,
            totalContacts: existingContactCount
          });

          for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
            // Check if user cancelled the fetch
            if (await checkIfCancelled()) {
              console.log(`🛑 [Stream Route] Fetch cancelled by user after ${processedPages} pages`);

              // Get final database count
              let cancelledTotal = 0;
              try {
                const { count } = await supabaseServer
                  .from("contacts")
                  .select("*", { count: "exact", head: true })
                  .eq("user_id", userId);
                cancelledTotal = count || existingContactCount;
              } catch {
                cancelledTotal = existingContactCount;
              }

              send({
                type: "complete",
                message: `Fetch cancelled. Found ${cancelledTotal} contacts.`,
                totalContacts: cancelledTotal,
                cancelled: true
              });

              clearTimers();
              streamCompleted = true;
              controller.close();
              return;
            }

            // Check if we're approaching timeout before processing each page
            if (checkTimeout()) {
              console.log(`⏰ [Stream Route] Timeout approaching, stopping after ${processedPages} pages`);
              // Update processedPagesCount for timeout handler
              processedPagesCount = processedPages;

              // First, save any pending contacts that haven't been batched yet
              if (globalPendingContacts.length > 0) {
                console.log(`   💾 [Stream Route] Saving ${globalPendingContacts.length} pending contacts before timeout...`);
                try {
                  const { data: pendingData, error: pendingError } = await supabaseServer
                    .from("contacts")
                    .upsert(globalPendingContacts.map((c: any) => c.contactToSave), {
                      onConflict: "contact_id,page_id,user_id"
                    })
                    .select('contact_id');

                  if (pendingError) {
                    console.error(`❌ [Stream Route] Error saving pending contacts:`, pendingError.message);
                  } else {
                    console.log(`   ✅ [Stream Route] TIMEOUT SAVE: Saved ${pendingData?.length || globalPendingContacts.length} pending contacts`);
                    // Mark as saved
                    for (const item of globalPendingContacts) {
                      if (!globalSeenContactKeys.has(item.contactKey)) {
                        globalSeenContactKeys.add(item.contactKey);
                        allContacts.push(item.contactData);
                      }
                    }
                    globalPendingContacts = [];
                  }
                } catch (pendingSaveError) {
                  console.error("❌ [Stream Route] Exception saving pending contacts:", pendingSaveError);
                }
              }

              // Save any remaining contacts before completing (legacy - may not be needed now)
              if (allContacts.length > 0) {
                try {
                  const remainingBatch = [...allContacts];
                  const contactsToUpsert = remainingBatch.map(contact => ({
                    contact_id: contact.contact_id || contact.id,
                    page_id: contact.page_id || contact.pageId,
                    user_id: userId,
                    contact_name: contact.name,
                    page_name: contact.page,
                    last_message: contact.lastMessage || contact.last_message || null,
                    last_message_time: contact.lastMessageTime || contact.last_message_time || null,
                    last_contact_message_date: contact.lastContactMessageDate || null,
                    tags: contact.tags || [],
                    role: contact.role || "",
                    avatar: contact.avatar,
                    date: contact.date || null,
                    updated_at: new Date().toISOString()
                  }));

                  const { data: timeoutUpsertData, error: timeoutUpsertError } = await supabaseServer
                    .from("contacts")
                    .upsert(contactsToUpsert, {
                      onConflict: "contact_id,page_id,user_id"
                    })
                    .select();

                  if (timeoutUpsertError) {
                    console.error(`❌ [Stream Route] Error saving contacts before timeout:`, {
                      code: timeoutUpsertError.code,
                      message: timeoutUpsertError.message,
                      details: timeoutUpsertError.details,
                      hint: timeoutUpsertError.hint
                    });
                  } else {
                    console.log(`   ✅ [Stream Route] Saved ${timeoutUpsertData?.length || remainingBatch.length} contacts before timeout`);
                  }
                } catch (saveError) {
                  console.error("❌ [Stream Route] Exception saving contacts before timeout:", saveError);
                }
              }

              // Get actual database count instead of calculated value
              let timeoutFinalTotal = 0;
              try {
                const { count: timeoutCount } = await supabaseServer
                  .from("contacts")
                  .select("*", { count: "exact", head: true })
                  .eq("user_id", userId);

                if (timeoutCount !== null) {
                  timeoutFinalTotal = timeoutCount;
                } else {
                  timeoutFinalTotal = Math.max(lastSentContactCount || existingContactCount || 0, 0);
                }
              } catch (timeoutCountError) {
                console.error("[Stream Route] Error getting count on timeout:", timeoutCountError);
                timeoutFinalTotal = Math.max(lastSentContactCount || existingContactCount || 0, 0);
              }

              // Update job status - use actual database count
              try {
                await updateJobStatus({
                  status: "completed",
                  is_paused: false,
                  total_contacts: timeoutFinalTotal,
                  total_pages: pages.length,
                  message: `Partially completed: Processed ${processedPages}/${pages.length} pages before timeout. Found ${timeoutFinalTotal} total contacts.`,
                  completed_at: new Date().toISOString()
                });
              } catch (statusError) {
                console.error("❌ [Stream Route] Error updating job status:", statusError);
              }

              // Send complete event
              send({
                type: "complete",
                message: `Processed ${processedPages}/${pages.length} pages before timeout. Found ${timeoutFinalTotal} total contacts. You can sync again to continue.`,
                totalContacts: timeoutFinalTotal,
                newContactsCount: allContacts.length
              });

              // Clear timeout and close stream
              clearTimers();
              streamCompleted = true;
              controller.close();
              return; // Exit the function
            }

            const page = pages[pageIndex];

            // Skip page if filter is specified and this page doesn't match
            if (filterPageId && page.id !== filterPageId) {
              console.log(`⏭️ Skipping page ${page.name} - not in filter (filter: ${filterPageId})`);
              continue;
            }

            // Check if paused before processing each page
            await waitWhilePaused();

            // Use pageIndex + 1 for display (which page in the list we're on)
            const currentPageNumber = pageIndex + 1; // Current page number in list (1-based)

            // Check if this page has been recently processed (within last 5 minutes)
            // Get the most recent contact update time for this page
            let lastPageUpdate: Date | null = null;
            try {
              // Add timeout to database query (10 seconds)
              const lastContactPromise = supabaseServer
                .from("contacts")
                .select("updated_at")
                .eq("page_id", page.id)
                .eq("user_id", userId)
                .order("updated_at", { ascending: false })
                .limit(1)
                .single();

              const lastContactTimeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Database query timeout")), 10000)
              );

              let lastContact: any = null;
              try {
                const result = await Promise.race([
                  lastContactPromise,
                  lastContactTimeoutPromise
                ]) as any;
                lastContact = result?.data;
              } catch (timeoutError: any) {
                if (timeoutError.message?.includes("timeout")) {
                  console.warn(`⏱️ Timeout checking last page update for ${page.name}, proceeding without skip check`);
                }
                // Continue without lastPageUpdate - will fetch all conversations
              }

              if (lastContact?.updated_at) {
                lastPageUpdate = new Date(lastContact.updated_at);
                const minutesSinceUpdate = (Date.now() - lastPageUpdate.getTime()) / (1000 * 60);

                // Skip if page was updated recently to avoid duplicate work on reload
                // For pages updated within last 10 minutes, skip entirely (likely from recent fetch)
                // For pages updated within last 2 minutes, skip (definitely too recent)
                // For pages updated more than 10 minutes ago, fetch only new conversations
                if (minutesSinceUpdate < 2) {
                  console.log(`⏭️ Skipping page ${page.name} - processed ${Math.round(minutesSinceUpdate * 10) / 10} minutes ago (too recent)`);
                  send({
                    type: "page_start",
                    pageName: page.name,
                    pageId: page.id,
                    currentPage: currentPageNumber,
                    totalPages: pages.length,
                    message: `Skipping ${page.name} (processed ${Math.round(minutesSinceUpdate * 10) / 10} min ago)`,
                    progress: Math.round((currentPageNumber / pages.length) * 100)
                  });
                  // Don't increment processedPages since we skipped this page
                  continue;
                } else if (minutesSinceUpdate < 10) {
                  // Page was recently updated (2-10 minutes ago), likely from a recent fetch
                  // Skip to prevent duplicate processing on reload
                  console.log(`⏭️ Skipping page ${page.name} - processed ${Math.round(minutesSinceUpdate * 10) / 10} minutes ago (recent fetch, skipping to prevent duplicates)`);
                  send({
                    type: "page_start",
                    pageName: page.name,
                    pageId: page.id,
                    currentPage: currentPageNumber,
                    totalPages: pages.length,
                    message: `Skipping ${page.name} (recently processed)`,
                    progress: Math.round((currentPageNumber / pages.length) * 100)
                  });
                  continue;
                } else {
                  console.log(`🔄 Page ${page.name} was last updated ${Math.round(minutesSinceUpdate * 10) / 10} minutes ago - will fetch only new conversations`);
                }
              }
            } catch (err) {
              // If no contacts found or error, proceed with fetching
              console.log(`📄 No previous contacts found for page ${page.name}, will fetch all`);
            }

            // Increment processedPages only when we actually start processing a page
            processedPages++;
            processedPagesCount = processedPages; // Update outer scope variable

            await updateJobStatus({
              status: "running",
              is_paused: false,
              current_page_name: page.name,
              current_page_number: currentPageNumber,
              total_pages: pages.length,
              total_contacts: existingContactCount + allContacts.length,
              message: `Processing page ${currentPageNumber}/${pages.length}: ${page.name}`
            });

            send({
              type: "page_start",
              pageName: page.name,
              pageId: page.id,
              currentPage: currentPageNumber,
              totalPages: pages.length,
              message: `Processing page ${currentPageNumber}/${pages.length}: ${page.name}`,
              progress: Math.round((currentPageNumber / pages.length) * 100)
            });

            try {
              if (!page.access_token) {
                console.error(`❌ Page ${page.name} (${page.id}) has no access token`);
                send({
                  type: "page_error",
                  pageName: page.name,
                  error: "No access token"
                });
                continue;
              }

              console.log(`📄 [Stream Route] Starting to fetch conversations for page: ${page.name} (${page.id})`);

              // Fetch conversations - only get updated ones if we have a last update time
              let conversationsUrl: string;
              if (lastPageUpdate) {
                // Only fetch conversations updated since last fetch (with 1 minute buffer)
                const sinceTime = Math.floor((lastPageUpdate.getTime() - 60000) / 1000); // 1 minute before last update
                conversationsUrl = `https://graph.facebook.com/v18.0/${page.id}/conversations?access_token=${page.access_token}&fields=participants,updated_time,messages.limit(10){from,message,created_time}&limit=100&since=${sinceTime}`;
                console.log(`   🔄 Fetching conversations updated since ${new Date(sinceTime * 1000).toISOString()}`);
              } else {
                // Fetch all conversations if no previous data
                conversationsUrl = `https://graph.facebook.com/v18.0/${page.id}/conversations?access_token=${page.access_token}&fields=participants,updated_time,messages.limit(10){from,message,created_time}&limit=100`;
              }

              // Fetch conversations with pagination
              let allConversations: any[] = [];
              let currentConversationsUrl: string | null = conversationsUrl;
              let paginationIterations = 0;
              const MAX_PAGINATION_ITERATIONS = 1000; // Safety limit to prevent infinite loops
              let lastConversationsUrl: string | null = null;
              let stuckPaginationCount = 0;

              // Fetch conversations with pagination
              while (currentConversationsUrl && paginationIterations < MAX_PAGINATION_ITERATIONS) {
                paginationIterations++;

                // Check if paused before each API call
                await waitWhilePaused();

                // Add timeout to fetch request (60 seconds for large pages)
                const fetchController = new AbortController();
                const timeoutId = setTimeout(() => fetchController.abort(), 60000);

                try {
                  // Detect if pagination is stuck on the same URL
                  if (lastConversationsUrl === currentConversationsUrl) {
                    stuckPaginationCount++;
                  } else {
                    stuckPaginationCount = 0;
                  }
                  lastConversationsUrl = currentConversationsUrl;
                  if (stuckPaginationCount >= 3) {
                    console.warn(`ƒsÿ‹,? [Stream Route] Pagination stalled for ${page.name}, skipping to next page`);
                    send({
                      type: "page_error",
                      pageName: page.name,
                      error: "Pagination stalled, moving to next page"
                    });
                    currentConversationsUrl = null;
                    break;
                  }

                  const conversationsResponse: Response = await fetch(currentConversationsUrl, {
                    signal: fetchController.signal
                  });
                  clearTimeout(timeoutId);

                  if (conversationsResponse.ok) {
                    const conversationsData: any = await conversationsResponse.json();
                    const conversations = conversationsData.data || [];
                    allConversations.push(...conversations);

                    console.log(`   ✅ Page ${page.name}: Fetched ${conversations.length} conversations (Total: ${allConversations.length})`);

                    // Check if there are more pages
                    currentConversationsUrl = conversationsData.paging?.next || null;

                    // Send progress update every 100 conversations or when starting a new page
                    if (allConversations.length % 100 === 0 || paginationIterations === 1) {
                      send({
                        type: "page_conversations",
                        pageName: page.name,
                        conversationsCount: allConversations.length,
                        message: `Fetched ${allConversations.length} conversations so far${currentConversationsUrl ? ', fetching more...' : ''}`
                      });
                    }

                    // Safety check: if we've fetched a lot, add a small delay to avoid rate limits
                    if (allConversations.length % 500 === 0 && allConversations.length > 0) {
                      await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay every 500 conversations
                    }
                  } else {
                    clearTimeout(timeoutId);
                    const errorData = await conversationsResponse.json().catch(() => ({}));
                    const errorMessage = errorData.error?.message || errorData.error?.error_user_msg || "Failed to fetch conversations";
                    const errorCode = errorData.error?.code;
                    const errorType = errorData.error?.type;

                    console.error(`❌ Error fetching conversations for page ${page.name} (${page.id}):`, {
                      status: conversationsResponse.status,
                      statusText: conversationsResponse.statusText,
                      errorCode,
                      errorType,
                      errorMessage,
                      fullError: errorData
                    });

                    send({
                      type: "page_error",
                      pageName: page.name,
                      error: `${errorMessage}${errorCode ? ` (Code: ${errorCode})` : ''}`
                    });
                    currentConversationsUrl = null; // Stop pagination on error
                  }
                } catch (fetchError: any) {
                  clearTimeout(timeoutId);
                  if (fetchError.name === 'AbortError') {
                    console.error(`⏱️ Timeout fetching conversations for page ${page.name} (${page.id})`);
                    send({
                      type: "page_error",
                      pageName: page.name,
                      error: "Request timeout (60s) - API is slow, continuing with next page..."
                    });
                  } else {
                    console.error(`❌ Exception fetching conversations for page ${page.name}:`, fetchError);
                    send({
                      type: "page_error",
                      pageName: page.name,
                      error: `Network error: ${fetchError.message}`
                    });
                  }
                  currentConversationsUrl = null; // Stop pagination on error
                }
              }

              // Safety check if we hit pagination limit
              if (paginationIterations >= MAX_PAGINATION_ITERATIONS) {
                console.warn(`⚠️ Hit pagination safety limit (${MAX_PAGINATION_ITERATIONS}) for page ${page.name}`);
                send({
                  type: "page_error",
                  pageName: page.name,
                  error: `Pagination limit reached (${MAX_PAGINATION_ITERATIONS} iterations) - stopping to prevent infinite loop`
                });
              }

              console.log(`   📊 [Stream Route] Page ${page.name}: Processing ${allConversations.length} total conversations`);

              send({
                type: "page_conversations",
                pageName: page.name,
                conversationsCount: allConversations.length,
                message: `Found ${allConversations.length} total conversations`
              });

              // Log heartbeat
              console.log(`   💓 [Stream Route] Heartbeat: Starting to process ${allConversations.length} conversations for ${page.name}`);

              let pageContacts = 0;
              const seenContactIds = new Set<string>(); // Track contacts to avoid duplicates within this page
              const processedContactKeys = new Set<string>(); // Track contacts already processed in this page
              // Use globalPendingContacts buffer for batch saves (accessible by timeout handler)

              console.log(`   🔄 [Stream Route] Starting conversation processing loop for ${page.name} (${allConversations.length} conversations)`);

              const pageProcessingStartTime = Date.now(); // Track processing time per page

              // Process conversations for progress tracking
              const BATCH_SIZE = 50;
              const BATCH_SAVE_SIZE = 10; // Save every 10 contacts - very frequent saves for debugging
              const PROGRESS_UPDATE_INTERVAL = 10; // Update every 10 conversations for real-time feel
              let processedCount = 0;
              const processingStartTime = Date.now();
              const MAX_PROCESSING_TIME = 4 * 60 * 1000; // 4 minutes max per page
              // Use the global lastSentContactCount, initialize page-level if needed
              if (lastSentContactCount < existingContactCount) {
                lastSentContactCount = existingContactCount;
              }

              console.log(`   🚀 [Stream Route] Starting to process ${allConversations.length} conversations for ${page.name}`);

              for (let i = 0; i < allConversations.length; i++) {
                // Check for timeout - don't let a single page take more than 4 minutes
                const elapsedTime = Date.now() - processingStartTime;
                if (elapsedTime > MAX_PROCESSING_TIME) {
                  console.warn(`⏱️ [Stream Route] Max processing time (4min) reached for ${page.name}, stopping at conversation ${i}/${allConversations.length}`);
                  send({
                    type: "status",
                    message: `⚠️ Processing timeout for ${page.name} - saved ${allContacts.length} contacts so far`,
                    progress: Math.round((i / allConversations.length) * 100),
                  });
                  break; // Exit loop, but save what we have
                }

                const conversation = allConversations[i];
                processedCount++;

                // Check if paused periodically while processing conversations
                if (processedCount % BATCH_SIZE === 0) {
                  await waitWhilePaused();
                  const elapsed = ((Date.now() - processingStartTime) / 1000).toFixed(1);
                  const currentTotal = existingContactCount + allContacts.length;
                  const safeCurrentTotal = Math.max(currentTotal, lastSentContactCount);
                  lastSentContactCount = safeCurrentTotal;

                  console.log(`   💓 [Stream Route] Heartbeat: Processed ${processedCount}/${allConversations.length} conversations for ${page.name} (${elapsed}s elapsed, ${safeCurrentTotal} total contacts)`);
                  // Send heartbeat/progress update - always show cumulative total
                  send({
                    type: "status",
                    message: `Processing ${page.name}: ${processedCount}/${allConversations.length} conversations, ${safeCurrentTotal} total contacts (${allContacts.length} new)...`,
                    totalContacts: safeCurrentTotal,
                    currentPage: currentPageNumber,
                    totalPages: pages.length,
                    progress: Math.round((processedCount / allConversations.length) * 100),
                  });
                }

                // Check if stream is completed (timeout or error)
                if (streamCompleted) {
                  console.warn(`⚠️ [Stream Route] Stream marked as completed, stopping conversation processing at ${processedCount}/${allConversations.length}`);
                  break;
                }

                // Add try-catch around each conversation to prevent one bad conversation from stopping everything
                try {

                  const participants = conversation.participants?.data || [];
                  const messages = conversation.messages?.data || [];

                  // Debug logging for first conversation
                  if (pageContacts === 0 && allConversations.indexOf(conversation) === 0) {
                    console.log(`   🔍 Sample conversation structure:`, {
                      hasParticipants: !!conversation.participants,
                      participantsCount: participants.length,
                      participants: participants.map((p: any) => ({ id: p.id, name: p.name })),
                      hasMessages: !!conversation.messages,
                      messagesCount: messages.length,
                      pageId: page.id
                    });
                  }

                  const contact = participants.find((p: any) => p.id !== page.id);

                  if (contact) {
                    // Create unique key for this contact on this page
                    const contactKey = `${contact.id}-${page.id}`;

                    // Skip if we've already seen this contact in this session
                    if (seenContactIds.has(contactKey)) {
                      continue;
                    }
                    seenContactIds.add(contactKey);

                    // Check if we've already processed this contact in this run
                    if (processedContactKeys.has(contactKey)) {
                      continue;
                    }

                    const contactMessages = messages.filter((msg: any) => msg.from?.id === contact.id);
                    const lastContactMessage = contactMessages.length > 0 ? contactMessages[0] : null;
                    const lastMessage = messages.length > 0 ? messages[0] : null;

                    let contactData: any = null;

                    if (lastContactMessage) {
                      const messageDate = new Date(lastContactMessage.created_time).toISOString().split('T')[0];
                      contactData = {
                        id: contact.id,
                        name: contact.name || contact.id || `User ${contact.id}`,
                        page: page.name,
                        pageId: page.id,
                        lastMessage: lastContactMessage.message || "",
                        lastMessageTime: lastContactMessage.created_time,
                        lastContactMessageDate: messageDate,
                        updatedTime: conversation.updated_time,
                        tags: [],
                        role: "",
                        avatar: (contact.name || contact.id || "U").substring(0, 2).toUpperCase(),
                        date: messageDate
                      };
                    } else if (messages.length > 0) {
                      const conversationDate = new Date(conversation.updated_time).toISOString().split('T')[0];
                      contactData = {
                        id: contact.id,
                        name: contact.name || contact.id || `User ${contact.id}`,
                        page: page.name,
                        pageId: page.id,
                        lastMessage: lastMessage?.message || "",
                        lastMessageTime: lastMessage?.created_time || conversation.updated_time,
                        lastContactMessageDate: null,
                        updatedTime: conversation.updated_time,
                        tags: [],
                        role: "",
                        avatar: (contact.name || contact.id || "U").substring(0, 2).toUpperCase(),
                        date: conversationDate
                      };
                    } else {
                      const conversationDate = new Date(conversation.updated_time).toISOString().split('T')[0];
                      contactData = {
                        id: contact.id,
                        name: contact.name || contact.id || `User ${contact.id}`,
                        page: page.name,
                        pageId: page.id,
                        lastMessage: "",
                        lastMessageTime: conversation.updated_time,
                        lastContactMessageDate: null,
                        updatedTime: conversation.updated_time,
                        tags: [],
                        role: "",
                        avatar: (contact.name || contact.id || "U").substring(0, 2).toUpperCase(),
                        date: conversationDate
                      };
                    }

                    if (contactData) {
                      // Skip if we've already processed this contact in this session
                      if (processedContactKeys.has(contactKey)) {
                        continue;
                      }
                      processedContactKeys.add(contactKey);

                      // Add to pending batch
                      const contactToSave = {
                        contact_id: contactData.id,
                        page_id: contactData.pageId,
                        user_id: userId,
                        contact_name: contactData.name,
                        page_name: contactData.page,
                        last_message: contactData.lastMessage || null,
                        last_message_time: contactData.lastMessageTime || null,
                        last_contact_message_date: contactData.lastContactMessageDate || null,
                        updated_at: contactData.updatedTime || new Date().toISOString(),
                        tags: contactData.tags || [],
                        role: contactData.role || "",
                        avatar: contactData.avatar,
                        date: contactData.date || null,
                      };
                      globalPendingContacts.push({ contactData, contactToSave, contactKey });
                      console.log(`   📥 [Stream Route] Added contact to pending buffer. Buffer size: ${globalPendingContacts.length}/${BATCH_SAVE_SIZE}`);

                      // Save in batches of 10 contacts - WAIT for confirmation before proceeding
                      if (globalPendingContacts.length >= BATCH_SAVE_SIZE) {
                        const batchToSave = globalPendingContacts.splice(0, BATCH_SAVE_SIZE);
                        console.log(`   💾 [Stream Route] ====== SAVING BATCH OF ${batchToSave.length} CONTACTS ======`);
                        console.log(`   💾 [Stream Route] Sample contact being saved:`, JSON.stringify(batchToSave[0]?.contactToSave, null, 2));

                        try {
                          const { data: savedData, error: upsertError } = await supabaseServer
                            .from("contacts")
                            .upsert(batchToSave.map(c => c.contactToSave), {
                              onConflict: "contact_id,page_id,user_id"
                            })
                            .select('contact_id'); // Select to confirm save worked

                          if (upsertError) {
                            console.error(`❌ [Stream Route] DATABASE ERROR:`, {
                              code: upsertError.code,
                              message: upsertError.message,
                              details: upsertError.details,
                              hint: upsertError.hint
                            });
                            // Send error to client
                            send({
                              type: "status",
                              message: `⚠️ DB Error: ${upsertError.code} - ${upsertError.message}. Check RLS or service key!`,
                              totalContacts: lastSentContactCount
                            });
                          } else {
                            // CONFIRMED: Database saved the records
                            const confirmedCount = savedData?.length || 0;
                            console.log(`   ✅ [Stream Route] CONFIRMED: ${confirmedCount} contacts saved to database`);

                            if (confirmedCount === 0) {
                              console.warn(`   ⚠️ [Stream Route] WARNING: savedData.length is 0 - data may not have been saved!`);
                              send({
                                type: "status",
                                message: `⚠️ Warning: Database returned 0 saved records. Check RLS policies!`,
                                totalContacts: lastSentContactCount
                              });
                            }

                            // Mark as saved successfully
                            for (const item of batchToSave) {
                              if (!globalSeenContactKeys.has(item.contactKey)) {
                                globalSeenContactKeys.add(item.contactKey);
                                allContacts.push(item.contactData);
                                pageContacts++;
                              }
                            }
                          }
                        } catch (saveError: any) {
                          console.error(`❌ [Stream Route] EXCEPTION:`, saveError);
                          send({
                            type: "status",
                            message: `⚠️ Exception: ${saveError.message}`,
                            totalContacts: lastSentContactCount
                          });
                        }

                        // Send progress update after each batch save
                        const currentTotal = existingContactCount + allContacts.length;
                        lastSentContactCount = Math.max(currentTotal, lastSentContactCount);
                        send({
                          type: "status",
                          message: `Saved ${allContacts.length} contacts from ${page.name}...`,
                          totalContacts: lastSentContactCount,
                          currentPage: currentPageNumber,
                          totalPages: pages.length,
                          progress: Math.round((processedCount / allConversations.length) * 100)
                        });
                      }
                    }
                  } // End if (contact)
                } catch (conversationError: any) {
                  // Log error but continue processing - don't let one bad conversation stop everything
                  console.warn(`⚠️ [Stream Route] Error processing conversation ${i} for ${page.name}:`, conversationError?.message || conversationError);
                  continue;
                }

                // Update job status and send progress updates more frequently (every PROGRESS_UPDATE_INTERVAL)
                // Query database for actual count periodically to prevent duplication
                if (processedCount % PROGRESS_UPDATE_INTERVAL === 0 || i === allConversations.length - 1) {
                  let safeTotalContacts = existingContactCount + allContacts.length;

                  // Query database for actual count every 100 contacts to ensure accuracy
                  if (allContacts.length % 100 === 0 || i === allConversations.length - 1) {
                    try {
                      const { count: actualCount } = await supabaseServer
                        .from("contacts")
                        .select("*", { count: "exact", head: true })
                        .eq("user_id", userId);

                      if (actualCount !== null) {
                        // Update existingContactCount to reflect actual database state
                        existingContactCount = Math.max(0, actualCount - allContacts.length);
                        safeTotalContacts = Math.max(actualCount, lastSentContactCount);
                        lastSentContactCount = safeTotalContacts;
                      }
                    } catch (countError) {
                      // If query fails, use calculated value
                      safeTotalContacts = Math.max(existingContactCount + allContacts.length, lastSentContactCount);
                      lastSentContactCount = safeTotalContacts;
                    }
                  } else {
                    // Use calculated value for intermediate updates
                    safeTotalContacts = Math.max(existingContactCount + allContacts.length, lastSentContactCount);
                    lastSentContactCount = safeTotalContacts;
                  }

                  // Don't await status updates - fire and forget to avoid blocking
                  updateJobStatus({
                    status: "running",
                    is_paused: false,
                    current_page_name: page.name,
                    current_page_number: currentPageNumber,
                    total_pages: pages.length,
                    total_contacts: safeTotalContacts,
                    message: `Processing ${page.name}: ${processedCount}/${allConversations.length} conversations, ${safeTotalContacts} total contacts (${allContacts.length} new)...`
                  }).catch((statusError) => {
                    console.warn(`⚠️ Could not update job status:`, statusError);
                  });

                  // Send heartbeat/progress update - always show cumulative total, not per-page
                  send({
                    type: "status",
                    message: `Processing ${page.name}: ${processedCount}/${allConversations.length} conversations, ${safeTotalContacts} total contacts (${allContacts.length} new in this sync)...`,
                    totalContacts: safeTotalContacts,
                    currentPage: currentPageNumber,
                    totalPages: pages.length,
                    progress: Math.round((processedCount / allConversations.length) * 100)
                  });
                }
              } // End for loop

              // Save any remaining pending contacts
              if (globalPendingContacts.length > 0) {
                const remainingBatch = globalPendingContacts.splice(0);
                console.log(`   💾 [Stream Route] Saving final batch of ${remainingBatch.length} contacts for ${page.name}...`);
                try {
                  const { error: finalUpsertError } = await supabaseServer
                    .from("contacts")
                    .upsert(remainingBatch.map(c => c.contactToSave), {
                      onConflict: "contact_id,page_id,user_id"
                    });

                  if (finalUpsertError) {
                    console.error(`❌ [Stream Route] Final batch save error:`, finalUpsertError.message);
                  } else {
                    // Mark as saved successfully
                    for (const item of remainingBatch) {
                      if (!globalSeenContactKeys.has(item.contactKey)) {
                        globalSeenContactKeys.add(item.contactKey);
                        allContacts.push(item.contactData);
                        pageContacts++;
                      }
                    }
                    console.log(`   ✅ [Stream Route] Saved final batch of ${remainingBatch.length} contacts (${allContacts.length} total)`);
                  }
                } catch (saveError: any) {
                  console.error(`❌ [Stream Route] Final batch save exception:`, saveError.message);
                }
              }

              console.log(`   ✅ [Stream Route] Finished processing ${allConversations.length} conversations for ${page.name}. ${pageContacts} new contacts saved.`);

              const pageProcessingTime = ((Date.now() - pageProcessingStartTime) / 1000).toFixed(1);
              if (pageContacts > 0) {
                console.log(`   ✅ [Stream Route] Page ${page.name}: Added ${pageContacts} new contacts (${processedCount}/${allConversations.length} conversations processed in ${pageProcessingTime}s)`);
              } else {
                console.log(`   ⏭️ [Stream Route] Page ${page.name}: No new contacts (${processedCount}/${allConversations.length} conversations processed in ${pageProcessingTime}s)`);
              }

              // Query database for actual count at page completion to prevent duplication
              let pageCompleteTotal = existingContactCount + allContacts.length;
              try {
                const { count: pageActualCount } = await supabaseServer
                  .from("contacts")
                  .select("*", { count: "exact", head: true })
                  .eq("user_id", userId);

                if (pageActualCount !== null) {
                  // Update existingContactCount to reflect actual database state
                  existingContactCount = Math.max(0, pageActualCount - allContacts.length);
                  pageCompleteTotal = Math.max(pageActualCount, lastSentContactCount);
                  lastSentContactCount = pageCompleteTotal;
                }
              } catch (pageCountError) {
                // If query fails, use calculated value
                pageCompleteTotal = Math.max(existingContactCount + allContacts.length, lastSentContactCount);
                lastSentContactCount = pageCompleteTotal;
              }

              console.log(`   📊 [Stream Route] Sending page_complete event for ${page.name} (${pageContacts} contacts, ${pageCompleteTotal} total)`);
              send({
                type: "page_complete",
                pageName: page.name,
                contactsCount: pageContacts,
                totalContacts: pageCompleteTotal,
                currentPage: currentPageNumber,
                totalPages: pages.length,
                message: `✓ Completed ${page.name}: ${pageContacts} new contacts (${pageCompleteTotal} total)`
              });
              console.log(`   ✅ [Stream Route] Page ${page.name} processing complete, moving to next page...`);
            } catch (pageError: any) {
              console.error(`❌ [Stream Route] Error processing page ${page.name}:`, pageError);
              console.error(`❌ [Stream Route] Error stack:`, pageError?.stack);
              send({
                type: "page_error",
                pageName: page.name,
                error: pageError?.message || "Unknown error"
              });
              // Continue to next page even if this one fails
              console.log(`   ⚠️ [Stream Route] Continuing to next page after error on ${page.name}...`);
            }
          }

          console.log(`✅ [Stream Route] Finished processing all ${pages.length} pages. Total contacts found: ${allContacts.length}`);

          // Clear timers since we're completing normally
          clearTimers();

          // Wait a moment for any pending database operations to complete
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Get the actual final count from database after all upserts
          // This prevents count doubling when reloading and reprocessing contacts
          // ALWAYS use database count, never calculate from existingContactCount + allContacts.length
          let finalTotalContacts = 0;
          try {
            const { count: finalCount, error: finalCountError } = await supabaseServer
              .from("contacts")
              .select("*", { count: "exact", head: true })
              .eq("user_id", userId);

            if (!finalCountError && finalCount !== null) {
              finalTotalContacts = finalCount;
              console.log(`[Stream Route] Final contact count from database: ${finalTotalContacts}`);
            } else {
              console.error("[Stream Route] Error getting final count:", finalCountError);
              // Fallback: use last sent count or existing count, but log warning
              finalTotalContacts = Math.max(lastSentContactCount || existingContactCount || 0, 0);
              console.warn(`[Stream Route] Using fallback count: ${finalTotalContacts}`);
            }
          } catch (finalCountError) {
            console.error("[Stream Route] Exception getting final count:", finalCountError);
            // Fallback: use last sent count or existing count
            finalTotalContacts = Math.max(lastSentContactCount || existingContactCount || 0, 0);
            console.warn(`[Stream Route] Using fallback count after exception: ${finalTotalContacts}`);
          }

          // Ensure count never decreases - use the last sent count as minimum
          const safeFinalTotalContacts = Math.max(finalTotalContacts, lastSentContactCount || 0);

          // Update job status to completed
          try {
            await updateJobStatus({
              status: "completed",
              is_paused: false,
              total_contacts: safeFinalTotalContacts,
              total_pages: pages.length,
              message: `Finished! Found ${safeFinalTotalContacts} total contacts (${allContacts.length} new contacts processed) from ${pages.length} pages.`,
              completed_at: new Date().toISOString()
            });
            console.log(`✅ [Stream Route] Job status updated to completed`);
          } catch (statusError) {
            console.error("❌ [Stream Route] Error updating job status to completed:", statusError);
          }

          // Send completion event
          try {
            send({
              type: "complete",
              totalContacts: safeFinalTotalContacts,
              totalPages: pages.length,
              message: `Finished! Found ${safeFinalTotalContacts} total contacts (${allContacts.length} new contacts processed) from ${pages.length} pages.`,
              newContactsCount: allContacts.length
            });
            console.log(`✅ [Stream Route] Completion event sent`);
          } catch (sendError) {
            console.error("❌ [Stream Route] Error sending completion event:", sendError);
          }

          console.log(`✅ [Stream Route] Completed fetch: ${allContacts.length} new contacts processed, ${safeFinalTotalContacts} total contacts from ${pages.length} pages`);

          // Mark as completed BEFORE closing to prevent timeout handlers
          streamCompleted = true;

          // Always close the controller at the end - ensure stream ends
          console.log(`✅ [Stream Route] Stream processing complete. Closing stream...`);
          try {
            // Send a final newline to ensure client receives the complete event
            controller.enqueue(encoder.encode("\n\n"));
            controller.close();
            console.log(`✅ [Stream Route] Stream closed successfully`);
          } catch (closeError) {
            console.error("❌ [Stream Route] Error closing controller:", closeError);
            // Try to close anyway even if there's an error
            try {
              controller.close();
            } catch (e) {
              // Ignore second close error
            }
          }
        } catch (error: any) {
          // Clear timers on error
          clearTimers();

          console.error("❌ [Stream Route] Stream error:", error);
          console.error("❌ [Stream Route] Error stack:", error?.stack);

          // Mark as completed to prevent timeout handler from running
          streamCompleted = true;

          // Try to send error message
          try {
            send({ type: "error", message: error.message || "Internal server error" });
          } catch (sendError) {
            console.error("❌ [Stream Route] Error sending error message:", sendError);
          }

          // Update job status to failed (directly since we might be outside updateJobStatus scope)
          if (userId) {
            try {
              const { error: statusError } = await supabaseServer
                .from("fetch_jobs")
                .update({
                  status: "failed",
                  is_paused: false,
                  error: error.message || "Unknown error",
                  message: `Fetch failed: ${error.message || "Unknown error"}`,
                  updated_at: new Date().toISOString(),
                })
                .eq("user_id", userId)
                .in("status", ["running", "paused", "pending"]);

              if (statusError) {
                console.error("❌ [Stream Route] Error updating job status to failed:", statusError);
              } else {
                console.log("✅ [Stream Route] Job status updated to failed");
              }
            } catch (updateError) {
              console.error("❌ [Stream Route] Exception updating job status:", updateError);
            }
          }

          // Always try to close controller
          try {
            controller.close();
          } catch (closeError) {
            console.error("❌ [Stream Route] Error closing controller:", closeError);
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // Disable buffering in nginx
      },
    });
  } catch (error: any) {
    console.error("Route handler error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}



