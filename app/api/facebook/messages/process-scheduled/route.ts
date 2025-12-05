import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

// This route processes scheduled messages that are due to be sent
// It should be called periodically (e.g., via Vercel Cron or a scheduled task)
// You can also call it manually for testing

export async function GET(request: NextRequest) {
  try {
    // Authentication check for cron endpoint
    // Vercel Cron doesn't automatically send auth headers, so we check for:
    // 1. Authorization header with Bearer token (for manual calls)
    // 2. x-vercel-cron header (from Vercel Cron - if present)
    // 3. User-Agent that indicates Vercel (for Vercel Cron requests)
    const authHeader = request.headers.get("authorization");
    const vercelCronHeader = request.headers.get("x-vercel-cron");
    const userAgent = request.headers.get("user-agent") || "";
    const cronSecret = process.env.CRON_SECRET;
    
    // Check if this is a Vercel Cron request
    const isVercelCron = vercelCronHeader === "1" || userAgent.includes("vercel");
    
    // If CRON_SECRET is set, require authentication unless it's from Vercel Cron
    if (cronSecret) {
      const hasValidAuth = authHeader === `Bearer ${cronSecret}`;
      
      // Allow if: valid Bearer token OR it's a Vercel Cron request
      if (!hasValidAuth && !isVercelCron) {
        console.log("[Process Scheduled] Unauthorized request:", {
          hasAuthHeader: !!authHeader,
          hasVercelCron: !!vercelCronHeader,
          userAgent: userAgent.substring(0, 50)
        });
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    }
    
    console.log("[Process Scheduled] Request authorized", {
      isVercelCron,
      hasAuthHeader: !!authHeader,
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
      .limit(10);

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
    ].slice(0, 10); // Limit to 10 total
    
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
      messageIds: scheduledMessages.map(m => m.id),
      scheduledFor: scheduledMessages.map(m => m.scheduled_for)
    });

    const results = {
      processed: 0,
      success: 0,
      failed: 0,
      errors: [] as any[]
    };

    // Process each scheduled message
    for (const scheduledMessage of scheduledMessages) {
      try {
        // Update status to processing
        await supabaseServer
          .from("scheduled_messages")
          .update({ status: "processing" })
          .eq("id", scheduledMessage.id);

        // Get user's access token from session (we'll need to store this or get it another way)
        // For now, we'll need to get the user's access token from the database or session
        // This is a limitation - we may need to store access tokens or use a different approach
        
        // Fetch contacts for this scheduled message
        const contactIds = scheduledMessage.contact_ids as number[];
        
        let { data: contacts, error: contactsError } = await supabaseServer
          .from("contacts")
          .select(`
            id,
            contact_id,
            page_id,
            contact_name,
            page_name
          `)
          .in("id", contactIds)
          .eq("user_id", scheduledMessage.user_id);

        // If no contacts found by database id, try by contact_id
        if ((!contacts || contacts.length === 0) && contactIds.length > 0) {
          const result = await supabaseServer
            .from("contacts")
            .select(`
              id,
              contact_id,
              page_id,
              contact_name,
              page_name
            `)
            .in("contact_id", contactIds)
            .eq("user_id", scheduledMessage.user_id);
          
          contacts = result.data;
          contactsError = result.error;
        }

        if (contactsError || !contacts || contacts.length === 0) {
          throw new Error("Failed to fetch contacts or no contacts found");
        }

        // Group contacts by page
        const contactsByPage = new Map<string, any[]>();
        for (const contact of contacts) {
          const pageId = contact.page_id;
          if (!contactsByPage.has(pageId)) {
            contactsByPage.set(pageId, []);
          }
          contactsByPage.get(pageId)!.push(contact);
        }

        let messageSuccess = 0;
        let messageFailed = 0;
        const messageErrors: any[] = [];

        // Send messages to each page's contacts
        for (const [pageId, pageContacts] of contactsByPage.entries()) {
          // Get page access token
          const { data: pageData, error: pageError } = await supabaseServer
            .from("facebook_pages")
            .select("page_id, page_access_token")
            .eq("page_id", pageId)
            .single();

          if (pageError || !pageData || !pageData.page_access_token) {
            messageFailed += pageContacts.length;
            messageErrors.push({
              page: pageContacts[0]?.page_name || pageId,
              error: "No access token available for this page"
            });
            continue;
          }

          const pageAccessToken = pageData.page_access_token;

          // Send message to each contact on this page
          for (const contact of pageContacts) {
            try {
              // Replace {FirstName} placeholder if present
              let personalizedMessage = scheduledMessage.message;
              const firstName = contact.contact_name?.split(' ')[0] || 'there';
              personalizedMessage = personalizedMessage.replace(/{FirstName}/g, firstName);

              // If attachment is provided, send media first
              const attachment = scheduledMessage.attachment as any;
              if (attachment && attachment.url) {
                const attachmentType = attachment.type || "file";
                
                const mediaPayload: any = {
                  recipient: {
                    id: contact.contact_id
                  },
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
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify(mediaPayload),
                  }
                );

                const mediaData = await mediaResponse.json();

                if (mediaResponse.ok && !mediaData.error) {
                  console.log(`✅ Sent ${attachmentType} to ${contact.contact_name} (${contact.contact_id})`);
                  await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                  console.error(`❌ Failed to send ${attachmentType} to ${contact.contact_name}:`, mediaData.error?.message);
                }
              }

              // Send text message
              const textPayload: any = {
                recipient: {
                  id: contact.contact_id
                },
                message: {
                  text: personalizedMessage
                },
                messaging_type: "MESSAGE_TAG",
                tag: "ACCOUNT_UPDATE"
              };

              const sendResponse = await fetch(
                `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(textPayload),
                }
              );

              const sendData = await sendResponse.json();

              if (sendResponse.ok && !sendData.error) {
                messageSuccess++;
                console.log(`✅ Sent scheduled message to ${contact.contact_name} (${contact.contact_id})`);
              } else {
                messageFailed++;
                const errorMsg = sendData.error?.message || "Unknown error";
                console.error(`❌ Failed to send scheduled message to ${contact.contact_name}:`, errorMsg);
                messageErrors.push({
                  contact: contact.contact_name,
                  page: contact.page_name,
                  error: errorMsg
                });
              }

              // Rate limiting
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error: any) {
              messageFailed++;
              console.error(`❌ Error sending scheduled message to ${contact.contact_name}:`, error);
              messageErrors.push({
                contact: contact.contact_name,
                page: contact.page_name,
                error: error.message || "Unknown error"
              });
            }
          }
        }

        // Update scheduled message status
        const finalStatus = messageFailed === 0 ? "sent" : (messageSuccess > 0 ? "sent" : "failed");
        
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

        results.processed++;
        if (finalStatus === "sent") {
          results.success++;
        } else {
          results.failed++;
        }

        console.log(`✅ Processed scheduled message ${scheduledMessage.id}: ${messageSuccess} sent, ${messageFailed} failed`);
      } catch (error: any) {
        console.error(`❌ Error processing scheduled message ${scheduledMessage.id}:`, error);
        
        // Update status to failed
        await supabaseServer
          .from("scheduled_messages")
          .update({
            status: "failed",
            errors: [{ error: error.message || "Unknown error" }],
            processed_at: new Date().toISOString()
          })
          .eq("id", scheduledMessage.id);

        results.processed++;
        results.failed++;
        results.errors.push({
          scheduledMessageId: scheduledMessage.id,
          error: error.message || "Unknown error"
        });
      }
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


