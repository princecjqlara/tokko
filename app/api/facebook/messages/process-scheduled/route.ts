import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

// This route processes scheduled messages that are due to be sent
// It should be called periodically (e.g., via Vercel Cron or a scheduled task)
// You can also call it manually for testing

export async function GET(request: NextRequest) {
  try {
    // Optional: Add authentication/authorization check here
    // For now, we'll allow it to be called by anyone (you may want to add a secret token)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const now = new Date().toISOString();

    // Find all pending scheduled messages that are due
    const { data: scheduledMessages, error: fetchError } = await supabaseServer
      .from("scheduled_messages")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", now)
      .order("scheduled_for", { ascending: true })
      .limit(10); // Process up to 10 messages at a time to avoid timeouts

    if (fetchError) {
      console.error("Error fetching scheduled messages:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch scheduled messages", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!scheduledMessages || scheduledMessages.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No scheduled messages to process",
        processed: 0
      });
    }

    console.log(`[Process Scheduled] Found ${scheduledMessages.length} scheduled messages to process`);

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
    console.error("Error in process scheduled messages route:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

// Also allow POST for manual triggering
export const POST = GET;

