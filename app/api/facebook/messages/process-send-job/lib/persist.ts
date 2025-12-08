import { supabaseServer } from "@/lib/supabase-server";
import { SendJobRecord } from "./types";
import { isJobCancelled } from "./utils";

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
  remainingContactIds?: string[];
};

type FinalizeParams = {
  job: SendJobRecord;
  messageSuccess: number;
  messageFailed: number;
  messageErrors: any[];
  totalExpected: number;
  sentContactIds: Set<string>;
  remainingContactIds?: string[];
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
    remainingContactIds
  } =
    params;
  const sentContactIdsArray = Array.from(sentContactIds);
  const actualErrors = messageErrors.filter((e: any) => !e._metadata);
  const metadataEntry: any = {
    _metadata: {
      sent_contact_ids: sentContactIdsArray,
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
      updated_at: new Date().toISOString(),
      status
    })
    .eq("id", job.id);
}

export async function finalizeJob(params: FinalizeParams) {
  const { job, messageSuccess, messageFailed, messageErrors, totalExpected, sentContactIds, remainingContactIds } = params;
  const totalProcessed = messageSuccess + messageFailed;
  const remainingContacts = totalExpected - totalProcessed;
  const sentContactIdsArray = Array.from(sentContactIds);
  const remainingIds = remainingContactIds || [];

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
      contact_ids: remainingIds,
      completed_at: finalStatus === "completed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq("id", job.id);
}
