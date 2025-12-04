import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

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

// Store new contact (in a real app, use a database)
async function storeNewContact(
  contactId: string,
  pageId: string,
  message: any,
  timestamp: string | number,
  contactName?: string
) {
  // In a production app, you'd store this in a database
  // For now, we'll use a simple in-memory store or Supabase
  // This is a placeholder - implement based on your storage solution
  
  const contactData = {
    id: contactId,
    name: contactName || `User ${contactId}`,
    pageId,
    lastMessage: message?.text || "",
    lastMessageTime: new Date(parseInt(timestamp.toString()) * 1000).toISOString(),
    updatedTime: new Date().toISOString(),
    tags: [],
    role: "",
    avatar: (contactName || contactId).substring(0, 2).toUpperCase(),
    date: new Date().toISOString().split('T')[0],
  };

  // Add to events store for real-time updates
  try {
    const { addEvent } = await import("./events/route");
    addEvent({
      type: "new_contact",
      contact: contactData,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Error adding event:", error);
  }

  return contactData;
}

