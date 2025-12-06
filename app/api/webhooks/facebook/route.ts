import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { supabaseServer } from "@/lib/supabase-server";

// Import the server-side fetch function logic
async function fetchContactsForUser(userId: string, pageId: string) {
  try {
    console.log(`[Server Fetch] Starting server-side fetch for user ${userId}${pageId ? `, page ${pageId}` : ''}`);

    // Get user's pages from database
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

    if (dbError || !userPages || userPages.length === 0) {
      console.error(`[Server Fetch] Error fetching pages for user ${userId}:`, dbError);
      return { success: false, error: "No pages found for user", contactsFound: 0 };
    }

    // Filter pages if pageId is specified
    let pages = (userPages || [])
      .filter((up: any) => up.facebook_pages)
      .map((up: any) => ({
        id: up.facebook_pages.page_id,
        name: up.facebook_pages.page_name,
        access_token: up.facebook_pages.page_access_token,
      }));

    if (pageId) {
      pages = pages.filter((p: any) => p.id === pageId);
      if (pages.length === 0) {
        return { success: false, error: `Page ${pageId} not found for user ${userId}`, contactsFound: 0 };
      }
    }

    if (pages.length === 0) {
      return { success: false, error: "No pages found", contactsFound: 0 };
    }

    console.log(`[Server Fetch] Found ${pages.length} page(s) for user ${userId}`);

    // Get existing contact count
    const { count: existingCount } = await supabaseServer
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    let allContacts: any[] = [];
    const globalSeenContactKeys = new Set<string>();

    // Fetch conversations from each page
    for (const page of pages) {
      if (!page.access_token) {
        console.error(`[Server Fetch] Page ${page.name} (${page.id}) has no access token, skipping`);
        continue;
      }

      try {
        console.log(`[Server Fetch] Fetching conversations for page: ${page.name} (${page.id})`);

        // Get last update time for this page to fetch only new conversations
        const { data: lastContact } = await supabaseServer
          .from("contacts")
          .select("updated_at")
          .eq("page_id", page.id)
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let conversationsUrl: string;
        if (lastContact?.updated_at) {
          const sinceTime = Math.floor((new Date(lastContact.updated_at).getTime() - 60000) / 1000);
          conversationsUrl = `https://graph.facebook.com/v18.0/${page.id}/conversations?access_token=${page.access_token}&fields=participants,updated_time,messages.limit(10){from,message,created_time}&limit=100&since=${sinceTime}`;
        } else {
          conversationsUrl = `https://graph.facebook.com/v18.0/${page.id}/conversations?access_token=${page.access_token}&fields=participants,updated_time,messages.limit(10){from,message,created_time}&limit=100`;
        }

        // Fetch conversations with pagination (limit to first page for webhook-triggered fetches)
        let allConversations: any[] = [];
        let currentUrl: string | null = conversationsUrl;
        let paginationCount = 0;
        const MAX_PAGES = 5; // Limit pagination for webhook-triggered fetches

        while (currentUrl && paginationCount < MAX_PAGES) {
          paginationCount++;
          const response: Response = await fetch(currentUrl);
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`[Server Fetch] Error fetching conversations for ${page.name}:`, errorData);
            break;
          }

          const data = await response.json();
          const conversations = data.data || [];
          allConversations.push(...conversations);
          
          currentUrl = data.paging?.next || null;
        }

        console.log(`[Server Fetch] Found ${allConversations.length} conversations for page ${page.name}`);

        // Process conversations into contacts
        for (const conversation of allConversations) {
          const participants = conversation.participants?.data || [];
          const messages = conversation.messages?.data || [];
          const contact = participants.find((p: any) => p.id !== page.id);

          if (contact && messages.length > 0) {
            const contactKey = `${contact.id}-${page.id}`;
            
            if (globalSeenContactKeys.has(contactKey)) {
              continue;
            }
            globalSeenContactKeys.add(contactKey);

            const lastMessage = messages[0];

            allContacts.push({
              contact_id: contact.id,
              page_id: page.id,
              user_id: userId,
              name: contact.name || contact.id || `User ${contact.id}`,
              profile_pic: null,
              tags: [],
              last_message: lastMessage.message || "",
              last_message_time: lastMessage.created_time,
              updated_at: new Date().toISOString()
            });
          }
        }
      } catch (pageError: any) {
        console.error(`[Server Fetch] Error processing page ${page.name}:`, pageError);
        // Continue with other pages
      }
    }

    // Save contacts to database
    if (allContacts.length > 0) {
      const { error: upsertError } = await supabaseServer
        .from("contacts")
        .upsert(allContacts, {
          onConflict: "contact_id,page_id,user_id"
        });

      if (upsertError) {
        console.error(`[Server Fetch] Error saving contacts:`, upsertError);
        return { success: false, error: "Failed to save contacts", contactsFound: 0 };
      }

      console.log(`[Server Fetch] ✅ Saved ${allContacts.length} contact(s) for user ${userId}`);
    } else {
      console.log(`[Server Fetch] No new contacts found for user ${userId}`);
    }

    return {
      success: true,
      contactsFound: allContacts.length,
      totalContacts: (existingCount || 0) + allContacts.length
    };

  } catch (error: any) {
    console.error("[Server Fetch] Error:", error);
    return { success: false, error: error.message, contactsFound: 0 };
  }
}

// Background function to trigger fetch and update job status
async function triggerServerSideFetch(userId: string, pageId: string, jobId: string, pageName: string, currentCount: number) {
  try {
    console.log(`[Webhook] Starting server-side fetch for user ${userId}, page ${pageId}, job ${jobId}`);
    const fetchResult = await fetchContactsForUser(userId, pageId);
    
    if (fetchResult.success) {
      console.log(`✅ [Webhook] Server-side fetch completed for user ${userId}: ${fetchResult.contactsFound || 0} new contacts`);
      
      // Update job status to completed
      const { error: updateError } = await supabaseServer
        .from("fetch_jobs")
        .update({
          status: "completed",
          total_contacts: fetchResult.totalContacts || currentCount,
          message: `✅ Fetched ${fetchResult.contactsFound || 0} new contact(s) from ${pageName}`,
          completed_at: new Date().toISOString()
        })
        .eq("id", jobId);

      if (updateError) {
        console.error(`[Webhook] Error updating job ${jobId} to completed:`, updateError);
      }
    } else {
      console.error(`❌ [Webhook] Server-side fetch failed for user ${userId}:`, fetchResult.error);
      
      // Update job status to failed with error message
      const { error: updateError } = await supabaseServer
        .from("fetch_jobs")
        .update({
          status: "failed",
          message: `❌ Failed to fetch contacts: ${fetchResult.error || 'Unknown error'}`,
          completed_at: new Date().toISOString()
        })
        .eq("id", jobId);

      if (updateError) {
        console.error(`[Webhook] Error updating job ${jobId} to failed:`, updateError);
      }
    }
  } catch (error: any) {
    console.error(`❌ [Webhook] Error in background fetch for user ${userId}:`, error);
    
    // Update job status to failed with error details
    const { error: updateError } = await supabaseServer
      .from("fetch_jobs")
      .update({
        status: "failed",
        message: `❌ Error fetching contacts: ${error.message || 'Unknown error'}`,
        completed_at: new Date().toISOString()
      })
      .eq("id", jobId);

    if (updateError) {
      console.error(`[Webhook] Error updating job ${jobId} to failed:`, updateError);
    }
  }
}

// Webhook verification for Facebook
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;

    if (!verifyToken) {
      console.error("FACEBOOK_WEBHOOK_VERIFY_TOKEN is not set");
      return new NextResponse("Server configuration error", { status: 500 });
    }

    if (mode === "subscribe" && token === verifyToken) {
      console.log("✅ Webhook verified successfully");
      return new NextResponse(challenge, { status: 200 });
    } else {
      console.error("❌ Webhook verification failed", { mode, token, expectedToken: verifyToken });
      return new NextResponse("Verification failed", { status: 403 });
    }
  } catch (error: any) {
    console.error("Error in webhook verification:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}

// Handle webhook events from Facebook
export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature for security
    const signature = request.headers.get("x-hub-signature-256");
    const appSecret = process.env.FACEBOOK_APP_SECRET || process.env.FACEBOOK_CLIENT_SECRET;

    if (appSecret && signature) {
      const body = await request.text();
      const expectedSignature = `sha256=${crypto
        .createHmac("sha256", appSecret)
        .update(body)
        .digest("hex")}`;

      if (signature !== expectedSignature) {
        console.error("❌ Invalid webhook signature");
        return new NextResponse("Invalid signature", { status: 403 });
      }

      // Parse the body after verification
      const data = JSON.parse(body);
      await processWebhookEvent(data);
    } else {
      // If no secret configured, log a warning but process anyway (for development)
      if (!appSecret) {
        console.warn("⚠️ FACEBOOK_APP_SECRET not set - skipping signature verification");
      }
      const data = await request.json();
      await processWebhookEvent(data);
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}

async function processWebhookEvent(data: any) {
  try {
    if (data.object !== "page") {
      console.log("Ignoring non-page webhook event");
      return;
    }

    for (const entry of data.entry || []) {
      const pageId = entry.id;
      
      // Handle messaging events (new messages)
      if (entry.messaging && Array.isArray(entry.messaging)) {
        for (const event of entry.messaging) {
          await handleMessagingEvent(pageId, event);
        }
      }

      // Handle conversation updates
      if (entry.conversations && Array.isArray(entry.conversations)) {
        for (const conversation of entry.conversations) {
          await handleConversationEvent(pageId, conversation);
        }
      }
    }
  } catch (error: any) {
    console.error("Error processing webhook event:", error);
  }
}

async function handleMessagingEvent(pageId: string, event: any) {
  try {
    const senderId = event.sender?.id;
    const recipientId = event.recipient?.id;
    
    if (!senderId || !pageId) {
      console.log("Missing sender or page ID in messaging event");
      return;
    }

    // Only process if sender is not the page (i.e., it's a user message)
    if (senderId === pageId) {
      return;
    }

    console.log(`📨 New message event from ${senderId} on page ${pageId}`);

    // Create or update fetch job to trigger contact fetch
    await triggerContactFetch(pageId, senderId);
    
    // Also add event to events store for real-time updates
    try {
      const { addEvent } = await import("./events/route");
      addEvent({
        type: "message",
        pageId,
        senderId,
        timestamp: event.timestamp || Date.now(),
        message: event.message,
      });
    } catch (importError) {
      console.error("Error importing events route:", importError);
    }
  } catch (error: any) {
    console.error("Error handling messaging event:", error);
  }
}

async function handleConversationEvent(pageId: string, conversation: any) {
  try {
    console.log(`💬 New conversation event on page ${pageId}`);
    
    // Get participants
    const participants = conversation.participants?.data || [];
    const contactId = participants.find((p: any) => p.id !== pageId)?.id;
    
    if (contactId) {
      // Trigger contact fetch for this conversation
      await triggerContactFetch(pageId, contactId);
      
      // Add event to events store
      try {
        const { addEvent } = await import("./events/route");
        addEvent({
          type: "conversation",
          pageId,
          contactId,
          timestamp: conversation.updated_time ? new Date(conversation.updated_time).getTime() : Date.now(),
        });
      } catch (importError) {
        console.error("Error importing events route:", importError);
      }
    }
  } catch (error: any) {
    console.error("Error handling conversation event:", error);
  }
}

async function triggerContactFetch(pageId: string, contactId: string) {
  try {
    console.log(`[Webhook] triggerContactFetch called for page ${pageId}, contact ${contactId}`);
    
    // Find all users who have access to this page
    const { data: userPages, error } = await supabaseServer
      .from("user_pages")
      .select("user_id")
      .eq("page_id", pageId);

    if (error) {
      console.error(`[Webhook] Error fetching user_pages for page ${pageId}:`, error);
      return;
    }

    if (!userPages || userPages.length === 0) {
      console.log(`[Webhook] No users found for page ${pageId} - webhook event will be ignored`);
      return;
    }

    console.log(`[Webhook] Found ${userPages.length} user(s) for page ${pageId}`);

    // Get page name for better logging
    const { data: pageData } = await supabaseServer
      .from("facebook_pages")
      .select("page_name")
      .eq("page_id", pageId)
      .maybeSingle();

    const pageName = pageData?.page_name || pageId;

    // Create or update fetch jobs for each user
    for (const userPage of userPages) {
      const userId = userPage.user_id;
      
      try {
        // Check if there's already a running or pending job
        const { data: existingJob, error: jobCheckError } = await supabaseServer
          .from("fetch_jobs")
          .select("id, status, is_paused")
          .eq("user_id", userId)
          .in("status", ["running", "pending", "paused"])
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (jobCheckError) {
          console.error(`[Webhook] Error checking existing job for user ${userId}:`, jobCheckError);
          continue;
        }

        if (!existingJob || existingJob.status === "completed" || existingJob.status === "failed") {
          // Get current contact count
          const { count, error: countError } = await supabaseServer
            .from("contacts")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId);

          if (countError) {
            console.error(`[Webhook] Error getting contact count for user ${userId}:`, countError);
          }

          // Create a new pending job that will trigger a fetch for this specific page
          const { data: newJob, error: insertError } = await supabaseServer
            .from("fetch_jobs")
            .insert({
              user_id: userId,
              status: "pending",
              is_paused: false,
              current_page_name: pageName,
              message: `🔄 New message from ${contactId} on ${pageName} - auto-fetching...`,
              total_contacts: count || 0,
            })
            .select()
            .single();
        
          if (insertError) {
            console.error(`[Webhook] Error creating fetch job for user ${userId}:`, insertError);
          } else {
            console.log(`✅ [Webhook] Created pending fetch job ${newJob.id} for user ${userId} due to new message from ${contactId} on ${pageName}`);
            
            // Trigger server-side fetch immediately for this user
            // This ensures contacts are fetched even if the user is not logged in
            // Call the fetch function directly (don't await to avoid blocking webhook response)
            triggerServerSideFetch(userId, pageId, newJob.id, pageName, count || 0).catch((err) => {
              console.error(`[Webhook] Background fetch error for user ${userId}:`, err);
            });
          }
        } else {
          // If job is paused, resume it
          if (existingJob.status === "paused") {
            const { error: updateError } = await supabaseServer
              .from("fetch_jobs")
              .update({
                status: "running",
                is_paused: false,
                message: `🔄 Resumed due to new message from ${contactId} on ${pageName}`,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingJob.id);
            
            if (updateError) {
              console.error(`[Webhook] Error resuming job ${existingJob.id}:`, updateError);
            } else {
              console.log(`✅ [Webhook] Resumed fetch job ${existingJob.id} for user ${userId} due to new message`);
            }
          } else if (existingJob.status === "running") {
            // Job is already running, just update message
            const { error: updateError } = await supabaseServer
              .from("fetch_jobs")
              .update({
                message: `🔄 Processing - new message from ${contactId} on ${pageName} detected`,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingJob.id);
            
            if (updateError) {
              console.error(`[Webhook] Error updating job ${existingJob.id}:`, updateError);
            }
          } else if (existingJob.status === "pending") {
            // Job is already pending, trigger fetch again in case previous one failed
            // This ensures syncing works even if the previous fetch failed silently
            console.log(`[Webhook] Re-triggering fetch for pending job ${existingJob.id} for user ${userId}`);
            
            // Get current contact count
            const { count } = await supabaseServer
              .from("contacts")
              .select("*", { count: "exact", head: true })
              .eq("user_id", userId);
            
            const { error: updateError } = await supabaseServer
              .from("fetch_jobs")
              .update({
                message: `🔄 New message from ${contactId} on ${pageName} - auto-fetching...`,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingJob.id);
            
            if (updateError) {
              console.error(`[Webhook] Error updating pending job ${existingJob.id}:`, updateError);
            } else {
              console.log(`✅ [Webhook] Updated pending job ${existingJob.id} for user ${userId} with new message info`);
              
              // Re-trigger the fetch in case the previous one failed
              triggerServerSideFetch(userId, pageId, existingJob.id, pageName, count || 0).catch((err) => {
                console.error(`[Webhook] Background fetch error for user ${userId} (retry):`, err);
              });
            }
          }
        }
      } catch (userError: any) {
        console.error(`[Webhook] Error processing user ${userId}:`, userError);
      }
    }
  } catch (error: any) {
    console.error("[Webhook] Error triggering contact fetch:", error);
  }
}
