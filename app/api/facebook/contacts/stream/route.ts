import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { requireStreamSession } from "./lib/session";
import { loadPages } from "./lib/pages";
import { createSse } from "./lib/sse";
import { processPageContacts } from "./lib/contacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filterPageId = searchParams.get("pageId");

  const session = await requireStreamSession();
  if (!session.ok) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const { send, ctx, finish } = createSse(controller);
      ctx.userId = session.userId;

      try {
        const { count: existing } = await supabaseServer
          .from("contacts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", session.userId);
        ctx.existingContactCount = existing || 0;
        ctx.lastSentContactCount = existing || 0;

        const pages = await loadPages(session.userId, session.accessToken, filterPageId || undefined);
        ctx.pages = pages;

        if (pages.length === 0) {
          finish("No pages found. Make sure pages are connected.", ctx.existingContactCount);
          return;
        }

        for (const page of pages) {
          await processPageContacts(ctx, page, send);
        }

        const total = Math.max(ctx.lastSentContactCount, ctx.allContacts.length + ctx.existingContactCount);
        finish("Sync completed", total);
      } catch (error: any) {
        send({ type: "error", message: error.message || "Stream failed" });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
