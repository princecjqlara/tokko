import { supabaseServer } from "@/lib/supabase-server";
import { SendJobRecord } from "./types";
import { isJobCancelled } from "./utils";

const ACTIVE_JOB_STATUSES = ["pending", "running", "processing"];

async function hasOtherActiveJobs(userId: string, excludeJobId?: number) {
  const query = supabaseServer
    .from("send_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ACTIVE_JOB_STATUSES);
  if (excludeJobId !== undefined) query.neq("id", excludeJobId);
  const { count, error } = await query;
  if (error) {
    console.warn("[Send Job] Active job check failed", error.message);
    return true; // assume active to be safe
  }
  return (count || 0) > 0;
}

type ProgressParams = {
  job: SendJobRecord;
  status: string;
  messageSuccess: number;
  messageFailed: number;
  messageErrors: any[];
  sentContactIds: Set<string>;
  timeout?: boolean;
  pageId?: string;
  chunkNumber?: number;
  chunksTotal?: number;
  pendingContactIds?: string[];
  clearStatusIds?: number[];
};

type FinalizeParams = {
  job: SendJobRecord;
  messageSuccess: number;
  messageFailed: number;
  messageErrors: any[];
  totalExpected: number;
  sentContactIds: Set<string>;
  pendingContactIds?: string[];
  clearStatusIds?: number[];
};

export async function persistProgress(params: ProgressParams) {
  const {
    job,
    status,
    messageSuccess,
    messageFailed,
    messageErrors,
    sentContactIds,
    timeout,
    pageId,
    chunkNumber,
    chunksTotal,
    pendingContactIds,
    clearStatusIds
  } =
    params;
  const sentContactIdsArray = Array.from(sentContactIds);
  const pendingIds = pendingContactIds || job.contact_ids || [];
  const actualErrors = messageErrors.filter((e: any) => !e._metadata);
  const metadataEntry: any = {
    _metadata: {
      sent_contact_ids: sentContactIdsArray,
      pending_contact_ids: pendingIds,
      last_updated: new Date().toISOString(),
      total_sent: sentContactIdsArray.length
    }
  };
  if (timeout) {
    metadataEntry.error = `Timeout: Processed ${messageSuccess + messageFailed} of ${job.total_count} contacts. Job will resume on next cron run.`;
    metadataEntry._metadata.page = pageId;
    metadataEntry._metadata.chunk = chunkNumber;
    metadataEntry._metadata.chunks_total = chunksTotal;
  }

  await supabaseServer
    .from("send_jobs")
    .update({
      sent_count: messageSuccess,
      failed_count: messageFailed,
      errors: [...actualErrors, metadataEntry],
      contact_ids: pendingIds,
      updated_at: new Date().toISOString(),
      status
    })
    .eq("id", job.id);

  // Clear per-contact status if the job was cancelled or timed out
  if (clearStatusIds && clearStatusIds.length > 0 && (status === "cancelled" || timeout)) {
    const active = await hasOtherActiveJobs(job.user_id, job.id);
    if (!active) {
      const CHUNK = 500;
      for (let i = 0; i < clearStatusIds.length; i += CHUNK) {
        const chunk = clearStatusIds.slice(i, i + CHUNK);
        await supabaseServer
          .from("contacts")
          .update({ last_send_status: null, last_send_job_id: null, last_send_at: null })
          .in("id", chunk);
      }
    }
  }
}

export async function finalizeJob(params: FinalizeParams) {
  const { job, messageSuccess, messageFailed, messageErrors, totalExpected, sentContactIds, pendingContactIds, clearStatusIds } = params;
  const totalProcessed = messageSuccess + messageFailed;
  const remainingContacts = totalExpected - totalProcessed;
  const sentContactIdsArray = Array.from(sentContactIds);
  const remainingIds = pendingContactIds || [];

  if (await isJobCancelled(job.id)) return;

  let finalStatus = "completed";
  let errorsToPersist = messageErrors;
  if (remainingContacts > 0) {
    finalStatus = "running";
    errorsToPersist = [
      ...messageErrors,
      {
        error: `Incomplete: Processed ${totalProcessed} of ${totalExpected} contacts. ${remainingContacts} remaining. Job will resume on next cron run.`,
        remaining: remainingContacts,
        _metadata: {
          sent_contact_ids: sentContactIdsArray,
          last_updated: new Date().toISOString()
        }
      }
    ];
  } else {
    errorsToPersist = [
      ...messageErrors,
      {
        _metadata: {
          sent_contact_ids: sentContactIdsArray,
          pending_contact_ids: remainingIds,
          last_updated: new Date().toISOString()
        }
      }
    ];
  }

  await supabaseServer
    .from("send_jobs")
    .update({
      status: finalStatus,
      sent_count: messageSuccess,
      failed_count: messageFailed,
      errors: errorsToPersist,
      contact_ids: finalStatus === "completed" ? [] : remainingIds,
      completed_at: finalStatus === "completed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq("id", job.id);

  // Clear per-contact status when the job is done (completed or running with remaining)
  if (clearStatusIds && clearStatusIds.length > 0) {
    const active = await hasOtherActiveJobs(job.user_id, job.id);
    if (!active) {
      const CHUNK = 500;
      for (let i = 0; i < clearStatusIds.length; i += CHUNK) {
        const chunk = clearStatusIds.slice(i, i + CHUNK);
        await supabaseServer
          .from("contacts")
          .update({ last_send_status: null, last_send_job_id: null, last_send_at: null })
          .in("id", chunk);
      }
    }
  }
}
