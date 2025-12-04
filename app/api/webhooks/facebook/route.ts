import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabase-server";

// Ensure this route is dynamic (not statically generated)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Facebook Webhook Verification Token (set in environment variables)
const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || "your_webhook_verify_token";

// Handle GET request for webhook verification
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // Log verification attempt for debugging
  console.log("[Webhook] Verification attempt:", {
    mode,
    tokenProvided: !!token,
    tokenMatch: token === VERIFY_TOKEN,
    hasChallenge: !!challenge,
    verifyTokenSet: !!VERIFY_TOKEN
  });

  // Verify the webhook
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[Webhook] ✅ Verified successfully");
    return new NextResponse(challenge, { 
      status: 200,
      headers: {
        "Content-Type": "text/plain"
      }
    });
  } else {
    console.log("[Webhook] ❌ Verification failed:", {
      modeMatch: mode === "subscribe",
      tokenMatch: token === VERIFY_TOKEN,
      expectedToken: VERIFY_TOKEN ? "SET" : "NOT SET"
    });
    return NextResponse.json({ 
      error: "Forbidden",
      details: mode !== "subscribe" ? "Invalid mode" : "Invalid token"
    }, { status: 403 });
  }
}

// Handle POST request for webhook events
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const signature = request.headers.get("x-hub-signature-256");

    // Verify webhook signature (optional but recommended)
    if (process.env.FACEBOOK_APP_SECRET && signature) {
      const expectedSignature = crypto
        .createHmac("sha256", process.env.FACEBOOK_APP_SECRET)
        .update(JSON.stringify(body))
        .digest("hex");
      
      const providedSignature = signature.replace("sha256=", "");
      
      if (expectedSignature !== providedSignature) {
        console.error("Invalid webhook signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    // Handle webhook events
    if (body.object === "page") {
      for (const entry of body.entry || []) {
        const pageId = entry.id;
        
        // Handle messaging events
        for (const event of entry.messaging || []) {
          await handleMessagingEvent(event, pageId);
        }

        // Handle conversation events
        for (const event of entry.conversations || []) {
          await handleConversationEvent(event, pageId);
        }
      }

      return NextResponse.json({ success: true }, { status: 200 });
    }

    return NextResponse.json({ error: "Unknown object" }, { status: 400 });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

// Handle messaging events (new messages)
async function handleMessagingEvent(event: any, pageId: string) {
  try {
    const senderId = event.sender?.id;
    const recipientId = event.recipient?.id;
    const message = event.message;
    const timestamp = event.timestamp;

    if (!senderId || !message) return;

    // Store the event for processing
    // In a real app, you'd store this in a database or queue
    console.log("New message event:", {
      senderId,
      pageId,
      message: message.text,
      timestamp,
    });

    // You can emit this to connected clients via SSE or WebSocket
    // For now, we'll store it in a way that the frontend can poll
    await storeNewContact(senderId, pageId, message, timestamp);
  } catch (error) {
    console.error("Error handling messaging event:", error);
  }
}

// Handle conversation events (new conversations)
async function handleConversationEvent(event: any, pageId: string) {
  try {
    const conversationId = event.id;
    const participants = event.participants?.data || [];
    const updatedTime = event.updated_time;

    // Find the contact (not the page)
    const contact = participants.find((p: any) => p.id !== pageId);
    
    if (contact) {
      console.log("New conversation event:", {
        conversationId,
        contactId: contact.id,
        contactName: contact.name,
        pageId,
        updatedTime,
      });

      await storeNewContact(contact.id, pageId, null, updatedTime, contact.name);
    }
  } catch (error) {
    console.error("Error handling conversation event:", error);
  }
}

// Store new contact in Supabase and trigger automatic fetching
async function storeNewContact(
  contactId: string,
  pageId: string,
  message: any,
  timestamp: string | number,
  contactName?: string
) {
  try {
    const lastMessageTime = new Date(parseInt(timestamp.toString()) * 1000).toISOString();
    const messageDate = lastMessageTime.split('T')[0];
    
    // Get page name from database
    const { data: pageData } = await supabaseServer
      .from("facebook_pages")
      .select("page_name")
      .eq("page_id", pageId)
      .single();
    
    const pageName = pageData?.page_name || `Page ${pageId}`;
    
    // Get all users connected to this page
    const { data: userPages } = await supabaseServer
      .from("user_pages")
      .select("user_id")
      .eq("page_id", pageId);
    
    if (!userPages || userPages.length === 0) {
      console.log(`No users connected to page ${pageId}, skipping contact storage`);
      return null;
    }
    
    // Store/update contact for each user connected to this page
    const contactData = {
      contact_id: contactId,
      page_id: pageId,
      contact_name: contactName || `User ${contactId}`,
      page_name: pageName,
      last_message: message?.text || "",
      last_message_time: lastMessageTime,
      last_contact_message_date: messageDate,
      updated_at: new Date().toISOString(),
      tags: [],
      role: "",
      avatar: (contactName || contactId || "U").substring(0, 2).toUpperCase(),
      date: messageDate,
    };
    
    // Upsert contact for each user
    for (const userPage of userPages) {
      const userId = userPage.user_id;
      
      const { error: upsertError } = await supabaseServer
        .from("contacts")
        .upsert({
          ...contactData,
          user_id: userId,
        }, {
          onConflict: "contact_id,page_id,user_id",
        });
      
      if (upsertError) {
        console.error(`Error storing contact ${contactId} for user ${userId}:`, upsertError);
      } else {
        console.log(`✅ Stored/updated contact ${contactId} for user ${userId} from page ${pageName}`);
      }
    }
    
    // Trigger automatic fetch for the page (async, don't wait)
    triggerAutoFetch(pageId).catch(err => {
      console.error(`Error triggering auto-fetch for page ${pageId}:`, err);
    });
    
    return contactData;
  } catch (error) {
    console.error("Error storing new contact:", error);
    return null;
  }
}

// Trigger automatic contact fetching for a specific page
async function triggerAutoFetch(pageId: string) {
  try {
    // Get all users connected to this page
    const { data: userPages } = await supabaseServer
      .from("user_pages")
      .select("user_id")
      .eq("page_id", pageId);
    
    if (!userPages || userPages.length === 0) {
      return;
    }
    
    // For each user, create a background fetch job
    for (const userPage of userPages) {
      const userId = userPage.user_id;
      
      // Create a fetch job that will trigger automatic fetching
      // The frontend will poll for this and start fetching if needed
      await supabaseServer
        .from("fetch_jobs")
        .upsert({
          user_id: userId,
          status: "pending",
          is_paused: false,
          current_page_name: null,
          current_page_number: null,
          total_pages: null,
          total_contacts: null,
          message: `New message detected on page, auto-fetching contacts...`,
        }, {
          onConflict: "user_id",
        });
      
      console.log(`✅ Triggered auto-fetch for user ${userId} due to new message on page ${pageId}`);
    }
  } catch (error) {
    console.error("Error triggering auto-fetch:", error);
  }
}

