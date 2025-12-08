import { supabaseServer } from "@/lib/supabase-server";
import { MAX_RUNTIME_MS, PAGE_CHUNK_SIZE, TIMEOUT_BUFFER_MS } from "./constants";
import { fetchContactsForSendJob } from "./fetch-contacts";
import { logEvent, logError } from "./logging";
import { sendMessagesForPage } from "./send-page";
import { ContactRecord, SendJobRecord } from "./types";
import { chunkArray, coerceContactIds, isJobCancelled } from "./utils";
import { claimJob } from "./claim-job";
import { finalizeJob, persistProgress } from "./persist";

type ProcessParams = {
  job: SendJobRecord;
  userAccessToken: string | null;
};

export async function processSendJob({ job, userAccessToken }: ProcessParams) {
  const claimedJob = await claimJob(job);
  if (!claimedJob) return;

  try {
    const contactIds = coerceContactIds(claimedJob.contact_ids);
    const contacts = await fetchContactsForSendJob(claimedJob.user_id, contactIds);
    const messageTag = (claimedJob as any).message_tag || claimedJob.attachment?._meta?.messageTag || "ACCOUNT_UPDATE";
    logEvent("Contacts fetched for job", {
      jobId: claimedJob.id,
      requestedIds: contactIds.length,
      fetchedContacts: contacts.length
    });

    if (contacts.length === 0) {
      await supabaseServer
        .from("send_jobs")
        .update({
          status: "failed",
          failed_count: claimedJob.total_count,
          errors: [{ error: "No contacts found" }],
          completed_at: new Date().toISOString()
        })
        .eq("id", claimedJob.id);
      return;
    }

    const uniqueContacts = new Map<string, ContactRecord>();
    for (const contact of contacts) {
      const key = contact.contact_id;
      if (!uniqueContacts.has(key)) {
        uniqueContacts.set(key, contact);
      }
    }
    const deduplicatedContacts = Array.from(uniqueContacts.values());
    const effectiveTotal = deduplicatedContacts.length;

    if ((claimedJob.total_count || 0) !== effectiveTotal) {
      await supabaseServer
        .from("send_jobs")
        .update({
          total_count: effectiveTotal,
          updated_at: new Date().toISOString()
        })
        .eq("id", claimedJob.id);
    }

    const sentContactIdsSet = new Set<string>();
    if (claimedJob.errors && Array.isArray(claimedJob.errors)) {
      for (const error of claimedJob.errors) {
        if (error._metadata && Array.isArray(error._metadata.sent_contact_ids)) {
          error._metadata.sent_contact_ids.forEach((id: string) => sentContactIdsSet.add(id));
        }
      }
    }

    let contactsToProcess = deduplicatedContacts;
    if (sentContactIdsSet.size > 0) {
      contactsToProcess = deduplicatedContacts.filter(c => !sentContactIdsSet.has(c.contact_id));
    }

    const contactsByPage = new Map<string, ContactRecord[]>();
    for (const contact of contactsToProcess) {
      if (!contactsByPage.has(contact.page_id)) {
        contactsByPage.set(contact.page_id, []);
      }
      contactsByPage.get(contact.page_id)!.push(contact);
    }

    let messageSuccess = claimedJob.sent_count || 0;
    let messageFailed = claimedJob.failed_count || 0;
    const messageErrors: any[] = (claimedJob.errors || []).filter((e: any) => !e._metadata);
    const startTime = Date.now();
    const timeoutBuffer = Math.min(TIMEOUT_BUFFER_MS, Math.floor(MAX_RUNTIME_MS * 0.2));
    const timeoutCutoff = Math.max(1000, MAX_RUNTIME_MS - timeoutBuffer);
    const sentContactIds = new Set<string>(sentContactIdsSet);

    for (const [pageId, pageContacts] of contactsByPage.entries()) {
      const pageChunks = chunkArray(pageContacts, PAGE_CHUNK_SIZE);

      for (let chunkIndex = 0; chunkIndex < pageChunks.length; chunkIndex++) {
        const elapsed = Date.now() - startTime;
        const chunkNumber = chunkIndex + 1;
        const chunk = pageChunks[chunkIndex];
        const pendingContactIds = deduplicatedContacts.map(c => c.contact_id).filter(id => !sentContactIds.has(id));

        if (await isJobCancelled(claimedJob.id)) {
          await persistProgress({
            job: claimedJob,
            status: "cancelled",
            messageSuccess,
            messageFailed,
            messageErrors,
            sentContactIds,
            pendingContactIds
          });
          return;
        }

        if (elapsed > timeoutCutoff) {
          await persistProgress({
            job: claimedJob,
            status: "running",
            messageSuccess,
            messageFailed,
            messageErrors,
            sentContactIds,
            timeout: true,
            pageId,
            chunkNumber,
            chunksTotal: pageChunks.length,
            pendingContactIds
          });
          return;
        }

        const result = await sendMessagesForPage({
          pageId,
          contacts: chunk,
          message: claimedJob.message,
          attachment: claimedJob.attachment,
          messageTag,
          userAccessToken,
          sentContactIds,
          jobId: claimedJob.id
        });

        messageSuccess += result.success;
        messageFailed += result.failed;
        messageErrors.push(...result.errors);

        if (result.cancelled) {
          await persistProgress({
            job: claimedJob,
            status: "cancelled",
            messageSuccess,
            messageFailed,
            messageErrors,
            sentContactIds
          });
          return;
        }

        const nearTimeout = (Date.now() - startTime) > timeoutCutoff && chunkIndex < pageChunks.length - 1;
        const remainingAfterChunk = deduplicatedContacts.map(c => c.contact_id).filter(id => !sentContactIds.has(id));
        await persistProgress({
          job: claimedJob,
          status: nearTimeout ? "running" : "running",
          messageSuccess,
          messageFailed,
          messageErrors,
          sentContactIds,
          pageId,
          chunkNumber,
          chunksTotal: pageChunks.length,
          timeout: nearTimeout,
          pendingContactIds: remainingAfterChunk
        });

        if (nearTimeout) return;
      }
    }

    const remainingAfterAll = deduplicatedContacts.map(c => c.contact_id).filter(id => !sentContactIds.has(id));
    await finalizeJob({
      job: claimedJob,
      messageSuccess,
      messageFailed,
      messageErrors,
      totalExpected: effectiveTotal,
      sentContactIds,
      pendingContactIds: remainingAfterAll
    });
  } catch (error: any) {
    logError(`Error processing send job ${claimedJob.id}`, error);
    await supabaseServer
      .from("send_jobs")
      .update({
        status: "failed",
        errors: [{ error: error.message || "Unknown error processing job" }],
        updated_at: new Date().toISOString()
      })
      .eq("id", claimedJob.id);
  }
}
