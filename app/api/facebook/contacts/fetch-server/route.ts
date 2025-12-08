import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getUserPages } from "./lib/session";
import { fetchConversations } from "./lib/fetch-conversations";
import { processConversations } from "./lib/process-conversations";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, pageId } = body;
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

    const pagesResult = await getUserPages(userId, pageId);
    if (!pagesResult.ok) return NextResponse.json({ error: pagesResult.error }, { status: pagesResult.status });

    const pages = pagesResult.pages;
    const { count: existingCount } = await supabaseServer.from("contacts").select("*", { count: "exact", head: true }).eq("user_id", userId);

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
      const result = await processConversations(userId, page, conversations, existingCount || 0);
      inserted += result.inserted;
    }

    return NextResponse.json({ success: true, inserted });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
