import { supabaseServer } from "@/lib/supabase-server";
import { FUTURE_BUFFER_MS, MAX_MESSAGES_PER_RUN, STUCK_PROCESSING_MINUTES } from "./constants";
import { ScheduledMessageRecord } from "./types";

export async function fetchScheduledMessages() {
  const oneMinuteFromNow = new Date(Date.now() + FUTURE_BUFFER_MS).toISOString();
  const thirtyMinutesAgo = new Date(Date.now() - STUCK_PROCESSING_MINUTES * 60 * 1000).toISOString();

  const { data: pendingMessages, error: pendingError } = await supabaseServer
    .from("scheduled_messages")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", oneMinuteFromNow)
    .order("scheduled_for", { ascending: true })
    .limit(MAX_MESSAGES_PER_RUN);

  const { data: stuckMessages, error: stuckError } = await supabaseServer
    .from("scheduled_messages")
    .select("*")
    .eq("status", "processing")
    .lte("updated_at", thirtyMinutesAgo)
    .order("scheduled_for", { ascending: true })
    .limit(5);

  const scheduledMessages = [...(pendingMessages || []), ...(stuckMessages || [])].slice(0, MAX_MESSAGES_PER_RUN);
  const fetchError = pendingError || stuckError;

  return { scheduledMessages: scheduledMessages as ScheduledMessageRecord[], fetchError };
}
