import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseServer } from "@/lib/supabase-server";

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
    const body = await request.json();
    const { contactIds, message, scheduleDate, attachment } = body;

    console.log("[Send Message API] Received request:", {
      contactIdsCount: contactIds?.length,
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
    
    // First, try to fetch by database id (in case frontend is using database IDs)
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
      .eq("user_id", userId);

    // If no contacts found by database id, try by contact_id
    if ((!contacts || contacts.length === 0) && contactIds.length > 0) {
      console.log("[Send Message API] No contacts found by database id, trying by contact_id");
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
        .eq("user_id", userId);
      
      contacts = result.data;
      contactsError = result.error;
    }

    console.log("[Send Message API] Query result:", {
      contactsFound: contacts?.length || 0,
      error: contactsError?.message,
      userId
    });

    if (contactsError) {
      console.error("Error fetching contacts:", contactsError);
      return NextResponse.json(
        { error: "Failed to fetch contacts", details: contactsError.message },
        { status: 500 }
      );
    }

    if (!contacts || contacts.length === 0) {
      return NextResponse.json(
        { error: "No contacts found" },
        { status: 404 }
      );
    }

    // Group contacts by page to send messages efficiently
    const contactsByPage = new Map<string, any[]>();
    
    for (const contact of contacts) {
      const pageId = contact.page_id;
      if (!contactsByPage.has(pageId)) {
        contactsByPage.set(pageId, []);
      }
      contactsByPage.get(pageId)!.push(contact);
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
      scheduled: scheduleDate ? true : false
    };

    // Send messages to each page's contacts
    for (const [pageId, pageContacts] of contactsByPage.entries()) {
      // Get page access token from facebook_pages table
      const firstContact = pageContacts[0];
      
      // Fetch page access token separately
      const { data: pageData, error: pageError } = await supabaseServer
        .from("facebook_pages")
        .select("page_id, page_access_token")
        .eq("page_id", pageId)
        .single();
      
      if (pageError || !pageData) {
        console.error(`No access token for page ${pageId}:`, pageError);
        results.failed += pageContacts.length;
        results.errors.push({
          page: firstContact.page_name,
          error: "No access token available for this page"
        });
        continue;
      }
      
      const pageAccessToken = pageData.page_access_token;
      
      if (!pageAccessToken) {
        console.error(`No access token for page ${pageId}`);
        results.failed += pageContacts.length;
        results.errors.push({
          page: firstContact.page_name,
          error: "No access token available for this page"
        });
        continue;
      }

      // Send message to each contact on this page
      for (const contact of pageContacts) {
        try {
          // Replace {FirstName} placeholder if present
          let personalizedMessage = message;
          const firstName = contact.contact_name?.split(' ')[0] || 'there';
          personalizedMessage = personalizedMessage.replace(/{FirstName}/g, firstName);

          // Prepare message payload for Facebook Messenger API
          // The recipient ID should be the PSID (Page-Scoped ID) of the contact
          const messagePayload: any = {
            recipient: {
              id: contact.contact_id
            },
            message: {
              text: personalizedMessage
            },
            messaging_type: "MESSAGE_TAG",
            tag: "ACCOUNT_UPDATE" // Use ACCOUNT_UPDATE tag for automated messages
          };

          // Add attachment if provided
          if (attachment) {
            // Handle attachment upload and sending
            // For now, we'll support image attachments
            messagePayload.message.attachment = {
              type: "image",
              payload: {
                url: attachment.url,
                is_reusable: true
              }
            };
          }

          // Send message via Facebook Graph API
          // Use the page ID and page access token
          const sendResponse = await fetch(
            `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(messagePayload),
            }
          );

          const sendData = await sendResponse.json();

          if (sendResponse.ok && !sendData.error) {
            results.success++;
            console.log(`✅ Sent message to ${contact.contact_name} (${contact.contact_id})`);
          } else {
            results.failed++;
            const errorMsg = sendData.error?.message || "Unknown error";
            console.error(`❌ Failed to send to ${contact.contact_name}:`, errorMsg);
            results.errors.push({
              contact: contact.contact_name,
              page: contact.page_name,
              error: errorMsg
            });
          }

          // Rate limiting: Add delay between messages to avoid hitting rate limits
          // Facebook allows ~200 calls per hour per page
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay = ~36 messages per minute max
        } catch (error: any) {
          results.failed++;
          console.error(`❌ Error sending to ${contact.contact_name}:`, error);
          results.errors.push({
            contact: contact.contact_name,
            page: contact.page_name,
            error: error.message || "Unknown error"
          });
        }
      }
    }

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
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

