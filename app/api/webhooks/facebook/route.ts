import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { supabaseServer } from "@/lib/supabase-server";
import { getUserPages } from "./lib/session";
import { fetchConversations } from "./lib/fetch-conversations";
import { processConversations } from "./lib/process-conversations";

export async function GET(request: NextRequest) {
  const verifyToken = process.env.FACEBOOK_VERIFY_TOKEN;
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge || "OK", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-hub-signature-256");
    const bodyText = await request.text();

    if (!validateSignature(signature, bodyText)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const payload = JSON.parse(bodyText);
    const entries = payload.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const pageId = change.value?.page_id;
        const userId = change.value?.user_id || change.value?.recipient_id;
        if (!pageId || !userId) continue;
        await handleFetch(userId, pageId);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Webhook processing failed", details: error.message }, { status: 500 });
  }
}

async function handleFetch(userId: string, pageId: string) {
  const pagesResult = await getUserPages(userId, pageId);
  if (!pagesResult.ok) return;

  const pages = pagesResult.pages;
  const { count: existingCount } = await supabaseServer.from("contacts").select("*", { count: "exact", head: true }).eq("user_id", userId);
  const globalSeen = new Set<string>();

  let inserted = 0;
  for (const page of pages) {
    if (!page.access_token) continue;

    const { data: lastContact } = await supabaseServer
      .from("contacts")
      .select("updated_at")
      .eq("page_id", page.id)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const since = lastContact?.updated_at ? Math.floor((new Date(lastContact.updated_at).getTime() - 60000) / 1000).toString() : undefined;
    const conversations = await fetchConversations(page, since);
    inserted += await processConversations(userId, page, conversations, globalSeen);
  }

  if (inserted > 0) {
    await supabaseServer.from("fetch_jobs").insert({
      user_id: userId,
      page_id: pageId,
      status: "completed",
      total_contacts: (existingCount || 0) + inserted,
      message: `Fetched ${inserted} new contact(s) from webhook`
    });
  }
}

function validateSignature(signature: string | null, body: string) {
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appSecret || !signature) return false;
  const hash = `sha256=${crypto.createHmac("sha256", appSecret).update(body).digest("hex")}`;
  return hash === signature;
}
