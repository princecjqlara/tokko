import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { addEvent } from "./events/route";

// Webhook verification token from environment
const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;
const APP_SECRET = process.env.FACEBOOK_APP_SECRET;

// GET endpoint for webhook verification (Facebook calls this to verify)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("[Webhook] Verification request:", { mode, token, challenge });

  // Facebook sends a GET request with these parameters to verify the webhook
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[Webhook] Verification successful");
    // Return the challenge to complete verification
    return new NextResponse(challenge, { status: 200 });
  }

  console.log("[Webhook] Verification failed:", { mode, token, expectedToken: VERIFY_TOKEN });
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST endpoint to receive webhook events from Facebook
export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature for security
    const signature = request.headers.get("x-hub-signature-256");
    if (!signature && APP_SECRET) {
      console.warn("[Webhook] No signature provided, but APP_SECRET is set");
    }

    const body = await request.text();
    
    // Verify signature if APP_SECRET is configured
    if (APP_SECRET && signature) {
      const expectedSignature = `sha256=${crypto
        .createHmac("sha256", APP_SECRET)
        .update(body)
        .digest("hex")}`;
      
      if (signature !== expectedSignature) {
        console.error("[Webhook] Signature verification failed");
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
      }
    }

    const data = JSON.parse(body);
    console.log("[Webhook] Received event:", JSON.stringify(data, null, 2));

    // Handle different webhook event types
    if (data.object === "page") {
      for (const entry of data.entry || []) {
        // Process messaging events
        if (entry.messaging) {
          for (const event of entry.messaging) {
            const webhookEvent = {
              type: "messaging",
              pageId: entry.id,
              sender: event.sender?.id,
              recipient: event.recipient?.id,
              timestamp: event.timestamp,
              message: event.message,
              postback: event.postback,
              read: event.read,
              delivery: event.delivery,
              optin: event.optin,
              raw: event,
            };
            
            // Store event for frontend polling
            addEvent(webhookEvent);
            console.log("[Webhook] Processed messaging event:", webhookEvent);
          }
        }

        // Process conversation events
        if (entry.conversations) {
          for (const conversation of entry.conversations) {
            const webhookEvent = {
              type: "conversation",
              pageId: entry.id,
              conversationId: conversation.id,
              participants: conversation.participants,
              updatedTime: conversation.updated_time,
              raw: conversation,
            };
            
            addEvent(webhookEvent);
            console.log("[Webhook] Processed conversation event:", webhookEvent);
          }
        }
      }
    }

    // Always return 200 OK to acknowledge receipt
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Webhook] Error processing webhook:", error);
    // Still return 200 to prevent Facebook from retrying
    return NextResponse.json(
      { error: "Error processing webhook", details: error.message },
      { status: 200 }
    );
  }
}
