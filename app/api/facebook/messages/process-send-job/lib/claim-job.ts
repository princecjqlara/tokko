import { supabaseServer } from "@/lib/supabase-server";
import { STALE_THRESHOLD_SECONDS } from "./constants";
import { logEvent } from "./logging";
import { SendJobRecord } from "./types";

export async function claimJob(sendJob: SendJobRecord) {
  const lastUpdated = new Date(sendJob.updated_at || sendJob.started_at || new Date().toISOString());
  const secondsSinceLastUpdate = (Date.now() - lastUpdated.getTime()) / 1000;

  if ((sendJob.status === "running" || sendJob.status === "processing") && secondsSinceLastUpdate < STALE_THRESHOLD_SECONDS) {
    logEvent("Skip fresh job (another process likely working)", {
      jobId: sendJob.id,
      status: sendJob.status,
      secondsSinceLastUpdate: secondsSinceLastUpdate.toFixed(1)
    });
    return null;
  }

  const previousUpdatedAt = sendJob.updated_at || sendJob.started_at || new Date(0).toISOString();
  const claimableStatuses = ["pending", "running", "processing", "failed"];
  const claim = await supabaseServer
    .from("send_jobs")
    .update({
      status: "running",
      updated_at: new Date().toISOString()
    })
    .eq("id", sendJob.id)
    .eq("updated_at", previousUpdatedAt)
    .in("status", claimableStatuses)
    .select()
    .maybeSingle();

  if (claim.error || !claim.data) {
    logEvent("Job claim skipped (likely already claimed by another processor)", {
      jobId: sendJob.id,
      previousStatus: sendJob.status,
      previousUpdatedAt,
      claimError: claim.error?.message || null
    });
    return null;
  }

  logEvent("Job claimed", {
    jobId: sendJob.id,
    status: claim.data.status,
    updated_at: claim.data.updated_at
  });

  return claim.data as SendJobRecord;
}
