import { supabaseServer } from "@/lib/supabase-server";
import { ContactRecord, ProcessResult, ScheduledMessageRecord } from "./types";
import { fetchContactsForScheduledMessage } from "./fetch-contacts";
import { sendMessagesForPage } from "./send-page";
import { coerceContactIds } from "./utils";
import { ACTIVE_JOB_STATUSES } from "../../send/lib/constants";

async function hasActiveSendJobs(userId: string) {
  const { count, error } = await supabaseServer
    .from("send_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ACTIVE_JOB_STATUSES);
  if (error) {
    console.warn("[Process Scheduled] Active job check failed", error.message);
    return true;
  }
  return (count || 0) > 0;
}

export async function processScheduledMessage(scheduledMessage: ScheduledMessageRecord): Promise<ProcessResult> {
  const messageTag = scheduledMessage.attachment?._meta?.messageTag || "ACCOUNT_UPDATE";
  await supabaseServer
    .from("scheduled_messages")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", scheduledMessage.id);

  try {
    const contacts = await fetchContactsForScheduledMessage(
      scheduledMessage.user_id,
      coerceContactIds(scheduledMessage.contact_ids)
    );

    const uniqueContacts = new Map<string, ContactRecord>();
    for (const contact of contacts) {
      const key = contact.contact_id;
      if (!uniqueContacts.has(key)) uniqueContacts.set(key, contact);
    }
    const deduplicatedContacts = Array.from(uniqueContacts.values());

    const contactsByPage = new Map<string, ContactRecord[]>();
    for (const contact of deduplicatedContacts) {
      if (!contactsByPage.has(contact.page_id)) contactsByPage.set(contact.page_id, []);
      contactsByPage.get(contact.page_id)!.push(contact);
    }

    let messageSuccess = 0;
    let messageFailed = 0;
    const messageErrors: any[] = [];

    for (const [pageId, pageContacts] of contactsByPage.entries()) {
      const result = await sendMessagesForPage(pageId, pageContacts, scheduledMessage.message, scheduledMessage.attachment, messageTag);
      messageSuccess += result.success;
      messageFailed += result.failed;
      messageErrors.push(...result.errors);
    }

    const finalStatus = messageSuccess > 0 ? "sent" : "failed";
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

    // Clear contact send markers only if no active background send jobs
    const activeJobs = await hasActiveSendJobs(scheduledMessage.user_id);
    if (!activeJobs) {
      try {
        const contactDbIds = deduplicatedContacts.map(c => c.id).filter(Boolean);
        const CHUNK = 1000;
        for (let i = 0; i < contactDbIds.length; i += CHUNK) {
          const idsChunk = contactDbIds.slice(i, i + CHUNK);
          await supabaseServer
            .from("contacts")
            .update({ last_send_status: null, last_send_job_id: null, last_send_at: null })
            .in("id", idsChunk);
        }
      } catch (error) {
        console.warn("[Process Scheduled] Failed to clear contact send status:", (error as any)?.message);
      }
    }

    return {
      processed: 1,
      success: finalStatus === "sent" ? 1 : 0,
      failed: finalStatus === "failed" ? 1 : 0,
      errors: finalStatus === "failed" ? [{ scheduledMessageId: scheduledMessage.id, errors: messageErrors }] : []
    };
  } catch (error: any) {
    await supabaseServer
      .from("scheduled_messages")
      .update({
        status: "failed",
        errors: [{ error: error.message || "Unknown error" }],
        processed_at: new Date().toISOString()
      })
      .eq("id", scheduledMessage.id);

    return {
      processed: 1,
      success: 0,
      failed: 1,
      errors: [{ scheduledMessageId: scheduledMessage.id, error: error.message || "Unknown error" }]
    };
  }
}
