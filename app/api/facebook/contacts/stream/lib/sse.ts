import { HEARTBEAT_MS, STREAM_TIMEOUT_MS, VERCEL_TIMEOUT_MS } from "./constants";
import { supabaseServer } from "@/lib/supabase-server";

export type StreamContext = {
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
  userId: string;
  allContacts: any[];
  pages: any[];
  processedPagesCount: number;
  existingContactCount: number;
  lastSentContactCount: number;
};

export function createSse(controller: ReadableStreamDefaultController<Uint8Array>) {
  const encoder = new TextEncoder();
  const ctx: StreamContext = {
    controller,
    encoder,
    userId: "",
    allContacts: [],
    pages: [],
    processedPagesCount: 0,
    existingContactCount: 0,
    lastSentContactCount: 0
  };

  const send = (data: any) => {
    try {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      controller.enqueue(encoder.encode(message));
    } catch (error: any) {
      if (error?.message?.includes("closed") || error?.code === "ERR_INVALID_STATE") return;
      console.error("Error sending data:", error);
    }
  };

  let streamTimeoutId: NodeJS.Timeout | null = null;
  let hardStopTimeout: NodeJS.Timeout | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;
  let completed = false;
  const streamStartTime = Date.now();

  const clearTimers = () => {
    if (streamTimeoutId) clearTimeout(streamTimeoutId);
    if (hardStopTimeout) clearTimeout(hardStopTimeout);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
  };

  streamTimeoutId = setTimeout(() => {
    if (completed) return;
    completed = true;
    clearTimers();
    send({
      type: "complete",
      message: "Sync partially completed due to timeout. You can sync again to continue.",
      totalContacts: ctx.allContacts.length,
      newContactsCount: ctx.allContacts.length
    });
    controller.close();
  }, VERCEL_TIMEOUT_MS);

  hardStopTimeout = setTimeout(async () => {
    if (completed) return;
    completed = true;
    clearTimers();
    let timeoutTotal = ctx.lastSentContactCount || ctx.existingContactCount || 0;
    try {
      const { count } = await supabaseServer.from("contacts").select("*", { count: "exact", head: true }).eq("user_id", ctx.userId);
      timeoutTotal = count ?? timeoutTotal;
    } catch {
      // ignore
    }
    send({
      type: "complete",
      message: "Sync timed out. Some pages may be incomplete, please resync.",
      totalContacts: timeoutTotal,
      newContactsCount: ctx.allContacts.length
    });
    controller.close();
  }, STREAM_TIMEOUT_MS);

  heartbeatInterval = setInterval(async () => {
    if (completed) return;
    let safeTotal = ctx.existingContactCount + ctx.allContacts.length;
    try {
      const { count } = await supabaseServer.from("contacts").select("*", { count: "exact", head: true }).eq("user_id", ctx.userId);
      if (count !== null) {
        ctx.existingContactCount = Math.max(0, count - ctx.allContacts.length);
        safeTotal = Math.max(count, ctx.lastSentContactCount);
        ctx.lastSentContactCount = safeTotal;
      }
    } catch {
      safeTotal = Math.max(ctx.existingContactCount + ctx.allContacts.length, ctx.lastSentContactCount);
      ctx.lastSentContactCount = safeTotal;
    }
    send({
      type: "status",
      message: "Still syncing contacts...",
      totalContacts: safeTotal,
      currentPage: ctx.processedPagesCount || undefined,
      totalPages: ctx.pages.length || undefined
    });
  }, HEARTBEAT_MS);

  const checkTimeout = () => {
    const elapsed = Date.now() - streamStartTime;
    const remaining = VERCEL_TIMEOUT_MS - elapsed;
    return remaining < 30000;
  };

  const finish = (message: string, total: number) => {
    if (completed) return;
    completed = true;
    clearTimers();
    send({ type: "complete", message, totalContacts: total, newContactsCount: ctx.allContacts.length });
    controller.close();
  };

  return { send, ctx, finish, checkTimeout, clearTimers, markCompleted: () => { completed = true; clearTimers(); controller.close(); } };
}
