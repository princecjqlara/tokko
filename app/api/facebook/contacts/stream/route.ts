import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max duration for the stream

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
    
    const stream = new ReadableStream({
      async start(controller) {
        console.log("[Stream Route] Stream started, initializing...");
        
        // Set timeout to force completion
        streamTimeoutId = setTimeout(() => {
          if (!streamCompleted) {
            console.warn("⚠️ [Stream Route] Stream timeout reached, forcing completion...");
            streamCompleted = true;
            try {
              send({ 
                type: "error", 
                message: "Stream timeout - fetch taking too long. Please try syncing again with fewer pages." 
              });
              controller.close();
            } catch (err) {
              console.error("Error in timeout handler:", err);
            }
          }
        }, STREAM_TIMEOUT);
        
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

        try {
          console.log("[Stream Route] Getting session...");
          const session = await getServerSession(authOptions);
        
        if (!session || !(session as any).accessToken) {
          send({ type: "error", message: "Unauthorized" });
          if (streamTimeoutId) clearTimeout(streamTimeoutId);
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
            
            if (existingJob) {
              // Update existing job
              await supabaseServer
                .from("fetch_jobs")
                .update({
                  status: updates.status || "running",
                  is_paused: updates.is_paused || false,
                  current_page_name: updates.current_page_name,
                  current_page_number: updates.current_page_number,
                  total_pages: updates.total_pages,
                  total_contacts: updates.total_contacts,
                  message: updates.message,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", existingJob.id);
            } else {
              // Create new job
              await supabaseServer
                .from("fetch_jobs")
                .insert({
                  user_id: userId,
                  status: updates.status || "running",
                  is_paused: updates.is_paused || false,
                  current_page_name: updates.current_page_name,
                  current_page_number: updates.current_page_number,
                  total_pages: updates.total_pages,
                  total_contacts: updates.total_contacts || 0,
                  message: updates.message,
                  updated_at: new Date().toISOString(),
                });
            }
          } catch (err) {
            console.error("Error updating job status:", err);
            // Don't throw - continue fetching even if status update fails
          }
        };

        // Get existing contact count from database to preserve it
        let existingContactCount = 0;
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
                    message: `Rate limit hit, waiting ${Math.round(waitTime/1000)}s before retry...` 
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

        // Fetch pages - try database first, fallback to Facebook API
        let pages: any[] = [];
        
        try {
          // Try to fetch from database
          const { data: userPages, error: dbError } = await supabaseServer
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

          // If database query succeeds and has data, use it
          if (!dbError && userPages && userPages.length > 0) {
            pages = (userPages || [])
              .filter((up: any) => up.facebook_pages)
              .map((up: any) => ({
                id: up.facebook_pages.page_id,
                name: up.facebook_pages.page_name,
                access_token: up.facebook_pages.page_access_token,
              }));
            console.log(`Fetched ${pages.length} pages from database`);
          } else {
            // Database error or no data - fallback to Facebook API
            if (dbError) {
              console.log("Database error, falling back to Facebook API:", dbError.message);
            } else {
              console.log("No pages in database, fetching from Facebook API...");
            }
            
            const pagesResponse = await fetchWithRetry(
              `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}&fields=id,name,access_token&limit=1000`
            );

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
              controller.close();
              return;
            }
          }
        } catch (pagesError: any) {
          console.error("Error fetching pages:", pagesError);
          // Try Facebook API as last resort with retry
          try {
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
              controller.close();
              return;
            }
          } catch (fallbackError: any) {
            console.error("Fallback also failed:", fallbackError);
            send({ type: "error", message: `Error fetching pages: ${pagesError.message || "Unknown error"}` });
            controller.close();
            return;
          }
        }

        if (pages.length === 0) {
          send({ type: "error", message: "No pages found" });
          controller.close();
          return;
        }

        send({ 
          type: "pages_fetched", 
          totalPages: pages.length,
          message: `Found ${pages.length} pages. Starting to fetch contacts...`
        });

        const allContacts: any[] = [];
        let processedPages = 0;
        
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
          const page = pages[pageIndex];
          
          // Skip page if filter is specified and this page doesn't match
          if (filterPageId && page.id !== filterPageId) {
            console.log(`⏭️ Skipping page ${page.name} - not in filter (filter: ${filterPageId})`);
            continue;
          }
          
          // Check if paused before processing each page
          await waitWhilePaused();
          
          processedPages = pageIndex + 1; // Current page number (1-based)
          
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
              
              // Only skip if page was updated very recently (within last 2 minutes) AND we're doing a full sync
              // This allows incremental updates to still work via webhooks
              // For full syncs, skip pages updated within last 2 minutes to avoid duplicate work
              if (minutesSinceUpdate < 2) {
                console.log(`⏭️ Skipping page ${page.name} - processed ${Math.round(minutesSinceUpdate * 10) / 10} minutes ago (too recent)`);
                send({
                  type: "page_start",
                  pageName: page.name,
                  pageId: page.id,
                  currentPage: processedPages,
                  totalPages: pages.length,
                  message: `Skipping ${page.name} (processed ${Math.round(minutesSinceUpdate * 10) / 10} min ago)`,
                  progress: Math.round((processedPages / pages.length) * 100)
                });
                // Still count as processed for progress
                continue;
              } else {
                console.log(`🔄 Page ${page.name} was last updated ${Math.round(minutesSinceUpdate * 10) / 10} minutes ago - will fetch only new conversations`);
              }
            }
          } catch (err) {
            // If no contacts found or error, proceed with fetching
            console.log(`📄 No previous contacts found for page ${page.name}, will fetch all`);
          }
          
          await updateJobStatus({
            status: "running",
            is_paused: false,
            current_page_name: page.name,
            current_page_number: processedPages,
            total_pages: pages.length,
            total_contacts: existingContactCount + allContacts.length,
            message: `Processing page ${processedPages}/${pages.length}: ${page.name}`
          });
          
            send({
              type: "page_start",
              pageName: page.name,
              pageId: page.id,
              currentPage: processedPages,
              totalPages: pages.length,
              message: `Processing page ${processedPages}/${pages.length}: ${page.name}`,
              progress: Math.round((processedPages / pages.length) * 100)
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
            
            // Fetch conversations with pagination
            while (currentConversationsUrl && paginationIterations < MAX_PAGINATION_ITERATIONS) {
              paginationIterations++;
              
              // Check if paused before each API call
              await waitWhilePaused();
              
              // Add timeout to fetch request (60 seconds for large pages)
              const fetchController = new AbortController();
              const timeoutId = setTimeout(() => fetchController.abort(), 60000);
              
              try {
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
            const seenContactIds = new Set<string>(); // Track contacts to avoid duplicates in this session
            const processedContactKeys = new Set<string>(); // Track contacts already processed in this run
            const contactsToSave: any[] = []; // Batch buffer for database saves
            
            console.log(`   🔄 [Stream Route] Starting conversation processing loop for ${page.name} (${allConversations.length} conversations)`);
            
            const pageProcessingStartTime = Date.now(); // Track processing time per page
            
            // Process conversations in batches for better progress tracking
            const BATCH_SIZE = 50;
            const BATCH_SAVE_SIZE = 100;
            const PROGRESS_UPDATE_INTERVAL = 50; // Update every 50 conversations
            let processedCount = 0;
            const processingStartTime = Date.now();
            const MAX_PROCESSING_TIME = 4 * 60 * 1000; // 4 minutes max per page
            
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
                console.log(`   💓 [Stream Route] Heartbeat: Processed ${processedCount}/${allConversations.length} conversations for ${page.name} (${elapsed}s elapsed, ${allContacts.length} contacts found)`);
                // Send progress update every batch
                send({
                  type: "status",
                  message: `Processing ${page.name}: ${processedCount}/${allConversations.length} conversations, ${allContacts.length} contacts found...`,
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
                  // Quick check: if we've already processed this contact key in this batch, skip
                  if (processedContactKeys.has(contactKey)) {
                    continue;
                  }
                  
                  // Mark as processed
                  processedContactKeys.add(contactKey);
                  
                  // Add to collections
                  allContacts.push(contactData);
                  contactsToSave.push(contactData);
                  pageContacts++;
                  
                  // Send contact immediately for UI updates
                  const totalContacts = existingContactCount + allContacts.length;
                  send({
                    type: "contact",
                    contact: contactData,
                    totalContacts: totalContacts
                  });
                }
              } // End if (contact)
              
              } catch (conversationError: any) {
                // Log error but continue processing - don't let one bad conversation stop everything
                console.warn(`⚠️ [Stream Route] Error processing conversation ${i} for ${page.name}:`, conversationError?.message || conversationError);
                // Continue to next conversation
                continue;
              }
              
              // Batch save contacts to database every BATCH_SAVE_SIZE contacts or at the end
              if (contactsToSave.length >= BATCH_SAVE_SIZE || (i === allConversations.length - 1 && contactsToSave.length > 0)) {
                const batchToSave = contactsToSave.splice(0, BATCH_SAVE_SIZE); // Remove from buffer
                
                if (batchToSave.length > 0) {
                  try {
                    const contactsToUpsert = batchToSave.map((contactData: any) => ({
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
                    }));
                    
                    const dbBatchSavePromise = supabaseServer
                      .from("contacts")
                      .upsert(contactsToUpsert, {
                        onConflict: "contact_id,page_id,user_id"
                      });
                    
                    const saveTimeoutPromise = new Promise((_, reject) => 
                      setTimeout(() => reject(new Error("Database batch save timeout")), 30000) // 30s for batch
                    );
                    
                    try {
                      await Promise.race([
                        dbBatchSavePromise,
                        saveTimeoutPromise
                      ]);
                      console.log(`   💾 Batch saved ${batchToSave.length} contacts to database (${allContacts.length} total so far)`);
                    } catch (batchError: any) {
                      if (batchError.message?.includes("timeout")) {
                        console.warn(`⏱️ Database batch save timeout, ${batchToSave.length} contacts may not be saved`);
                      } else {
                        console.error(`❌ Error batch saving contacts:`, batchError);
                      }
                    }
                  } catch (batchError: any) {
                    console.error(`❌ Exception batch saving contacts:`, batchError);
                  }
                }
              }
              
              // Update job status and send progress updates more frequently (every PROGRESS_UPDATE_INTERVAL)
              const totalContacts = existingContactCount + allContacts.length;
              if (processedCount % PROGRESS_UPDATE_INTERVAL === 0 || i === allConversations.length - 1) {
                // Don't await status updates - fire and forget to avoid blocking
                updateJobStatus({
                  status: "running",
                  is_paused: false,
                  current_page_name: page.name,
                  current_page_number: processedPages,
                  total_pages: pages.length,
                  total_contacts: totalContacts,
                  message: `Processing ${page.name}: ${processedCount}/${allConversations.length} conversations, ${allContacts.length} contacts found...`
                }).catch((statusError) => {
                  console.warn(`⚠️ Could not update job status:`, statusError);
                });
                
                send({
                  type: "status",
                  message: `Processing ${page.name}: ${processedCount}/${allConversations.length} conversations, ${allContacts.length} contacts...`,
                  totalContacts: totalContacts,
                  currentPage: processedPages,
                  totalPages: pages.length,
                  progress: Math.round((processedCount / allConversations.length) * 100)
                });
              }
            }
            
            // Final batch save for any remaining contacts in buffer
            if (contactsToSave.length > 0) {
              const remainingBatch = contactsToSave.splice(0); // Clear buffer
              console.log(`   💾 [Stream Route] Saving final batch of ${remainingBatch.length} contacts for ${page.name}...`);
              try {
                const contactsToUpsert = remainingBatch.map((contactData: any) => ({
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
                }));
                
                const dbBatchSavePromise = supabaseServer
                  .from("contacts")
                  .upsert(contactsToUpsert, {
                    onConflict: "contact_id,page_id,user_id"
                  });
                
                const saveTimeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error("Database batch save timeout")), 30000)
                );
                
                try {
                  await Promise.race([
                    dbBatchSavePromise,
                    saveTimeoutPromise
                  ]);
                  console.log(`   ✅ [Stream Route] Final batch saved ${remainingBatch.length} contacts to database for ${page.name}`);
                } catch (batchError: any) {
                  if (batchError.message?.includes("timeout")) {
                    console.warn(`⏱️ [Stream Route] Final database batch save timeout for ${page.name}, ${remainingBatch.length} contacts may not be saved`);
                  } else {
                    console.error(`❌ [Stream Route] Error final batch saving contacts for ${page.name}:`, batchError);
                  }
                  // Continue even if save fails - don't block stream completion
                }
              } catch (batchError: any) {
                console.error(`❌ [Stream Route] Exception final batch saving contacts for ${page.name}:`, batchError);
                // Continue even if save fails - don't block stream completion
              }
            } else {
              console.log(`   ℹ️ [Stream Route] No remaining contacts to save for ${page.name}`);
            }

            const pageProcessingTime = ((Date.now() - pageProcessingStartTime) / 1000).toFixed(1);
            if (pageContacts > 0) {
              console.log(`   ✅ [Stream Route] Page ${page.name}: Added ${pageContacts} new contacts (${processedCount}/${allConversations.length} conversations processed in ${pageProcessingTime}s)`);
            } else {
              console.log(`   ⏭️ [Stream Route] Page ${page.name}: No new contacts (${processedCount}/${allConversations.length} conversations processed in ${pageProcessingTime}s)`);
            }
            
            const totalContacts = existingContactCount + allContacts.length;
            console.log(`   📊 [Stream Route] Sending page_complete event for ${page.name} (${pageContacts} contacts, ${totalContacts} total)`);
            send({
              type: "page_complete",
              pageName: page.name,
              contactsCount: pageContacts,
              totalContacts: totalContacts,
              currentPage: processedPages,
              totalPages: pages.length,
              message: `✓ Completed ${page.name}: ${pageContacts} new contacts (${totalContacts} total)`
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

        // Clear timeout since we're completing normally
        if (streamTimeoutId) {
          clearTimeout(streamTimeoutId);
          streamTimeoutId = null;
        }
        
        // Update job to completed with total count including existing
        const finalTotalContacts = existingContactCount + allContacts.length;
        
        try {
          await updateJobStatus({
            status: "completed",
            is_paused: false,
            total_contacts: finalTotalContacts,
            total_pages: pages.length,
            message: `Finished! Found ${finalTotalContacts} total contacts (${allContacts.length} new) from ${pages.length} pages.`,
            completed_at: new Date().toISOString()
          });
          console.log(`✅ [Stream Route] Job status updated to completed`);
        } catch (statusError) {
          console.error("❌ [Stream Route] Error updating job status to completed:", statusError);
        }

        try {
          send({
            type: "complete",
            totalContacts: finalTotalContacts,
            totalPages: pages.length,
            message: `Finished! Found ${finalTotalContacts} total contacts (${allContacts.length} new) from ${pages.length} pages.`,
            newContactsCount: allContacts.length
          });
          console.log(`✅ [Stream Route] Completion event sent`);
        } catch (sendError) {
          console.error("❌ [Stream Route] Error sending completion event:", sendError);
        }
        
        console.log(`✅ [Stream Route] Completed fetch: ${allContacts.length} new contacts, ${finalTotalContacts} total contacts from ${pages.length} pages`);
        
        // Mark as completed
        streamCompleted = true;

        // Always close the controller at the end
        console.log(`✅ [Stream Route] Stream processing complete. Closing stream...`);
        try {
          controller.close();
          console.log(`✅ [Stream Route] Stream closed successfully`);
        } catch (closeError) {
          console.error("❌ [Stream Route] Error closing controller:", closeError);
        }
        } catch (error: any) {
          // Clear timeout on error
          if (streamTimeoutId) {
            clearTimeout(streamTimeoutId);
            streamTimeoutId = null;
          }
          
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

