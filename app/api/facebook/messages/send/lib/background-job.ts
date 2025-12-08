import { supabaseServer } from "@/lib/supabase-server";
import { LARGE_SEND_FAST_PATH_THRESHOLD } from "./constants";

type CreateJobParams = {
  userId: string;
  contactIds: (string | number)[];
  message: string;
  attachment: any;
  messageTag: string;
};

export async function createBackgroundSendJob(params: CreateJobParams) {
  const dedupedContactIds = Array.from(new Set(params.contactIds));
  const attachmentWithMeta = params.attachment
    ? { ...params.attachment, _meta: { ...(params.attachment._meta || {}), messageTag: params.messageTag } }
    : { _meta: { messageTag: params.messageTag } };
  const { data: sendJob, error: jobError } = await supabaseServer
    .from("send_jobs")
    .insert({
      user_id: params.userId,
      contact_ids: dedupedContactIds,
      message: params.message.trim(),
      attachment: attachmentWithMeta,
      status: "pending",
      total_count: dedupedContactIds.length,
      started_at: new Date().toISOString()
    })
    .select()
    .single();

  if (jobError) {
    console.error("[Send Message API] Error creating background send job:", jobError);
    return { jobError, sendJob: null };
  }

  console.log(
    `[Send Message API] Background job created: ${sendJob.id} (deduped count: ${dedupedContactIds.length}, mode: ${
      dedupedContactIds.length > LARGE_SEND_FAST_PATH_THRESHOLD ? "FAST-PATH" : "STANDARD"
    })`
  );

  return { sendJob, jobError: null };
}

export async function triggerBackgroundJob(jobId: number, accessToken: string | null) {
  try {
    let triggerUrl = "http://localhost:3000";
    if (process.env.NEXTAUTH_URL) {
      triggerUrl = process.env.NEXTAUTH_URL;
    } else if (process.env.VERCEL_URL) {
      triggerUrl = `https://${process.env.VERCEL_URL}`;
    }
    triggerUrl = `${triggerUrl}/api/facebook/messages/process-send-job`;

    fetch(triggerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId,
        accessToken
      }),
      signal: AbortSignal.timeout(5000)
    })
      .then(response => {
        if (!response.ok) {
          console.warn(`[Send Message API] Background trigger returned ${response.status}, cron will resume job if needed`);
        }
      })
      .catch(err => {
        console.warn(`[Send Message API] Background trigger failed (${err.message}), cron will resume job`);
      });
  } catch (error: any) {
    console.warn(`[Send Message API] Background trigger exception: ${error.message}, cron will resume job`);
  }
}
