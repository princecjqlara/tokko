import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseServer } from "@/lib/supabase-server";

// Force dynamic rendering
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

type SendJobRecord = {
  id: number;
  user_id: string;
  contact_ids: any;
  message: string;
  attachment?: any;
  status: string;
  sent_count: number;
  failed_count: number;
  total_count: number;
  errors: any[];
  updated_at?: string;
  started_at?: string;
};

type ContactRecord = {
  id: number;
  contact_id: string;
  page_id: string;
  contact_name: string;
  page_name: string;
};

const MESSAGE_SEND_THROTTLE_MS = 50; // rate limit between sends (increased from 100ms for faster processing)
const ATTACHMENT_THROTTLE_MS = 300; // give media a moment to settle (reduced from 500ms)
const PAGE_CHUNK_SIZE = 300; // break huge pages into smaller chunks so we can checkpoint progress
const TIMEOUT_BUFFER_MS = 15000; // stop ~15s before the Vercel limit so we can persist progress safely

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const logEvent = (event: string, details?: Record<string, any>) => {
  if (details) {
    console.log(`[Process Send Job] ${event}`, JSON.stringify(details));
  } else {
    console.log(`[Process Send Job] ${event}`);
  }
};

const logError = (event: string, error: any, details?: Record<string, any>) => {
  const payload = {
    message: error?.message,
    stack: error?.stack,
    ...details
  };
  console.error(`[Process Send Job] ${event}`, JSON.stringify(payload));
};

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

function coerceContactIds(raw: any): (string | number)[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((value: any) => {
    if (value && typeof value === "object") {
      return "id" in value ? (value as any).id : "contact_id" in value ? (value as any).contact_id : value;
    }
    return value;
  });
}

async function fetchContactsForSendJob(userId: string, contactIds: (string | number)[]): Promise<ContactRecord[]> {
  // CRITICAL: First, deduplicate the contactIds array to prevent fetching the same contact multiple times
  const uniqueContactIds = Array.from(new Set(contactIds));
  if (uniqueContactIds.length !== contactIds.length) {
    console.log(`[fetchContactsForSendJob] Removed ${contactIds.length - uniqueContactIds.length} duplicate contact IDs before fetching`);
  }

  const contacts: ContactRecord[] = [];
  const seenContactIds = new Set<string>(); // Track by contact_id to prevent duplicates

  // Fetch in chunks to avoid Supabase IN() limits
  const chunkSize = 200;
  for (let i = 0; i < uniqueContactIds.length; i += chunkSize) {
    const chunk = uniqueContactIds.slice(i, i + chunkSize);

    // Try by database id first
    const { data: byId, error: idError } = await supabaseServer
      .from("contacts")
      .select("id, contact_id, page_id, contact_name, page_name")
      .in("id", chunk)
      .eq("user_id", userId);

    if (!idError && byId) {
      byId.forEach(c => {
        // Use contact_id as the unique key (globally unique)
        if (!seenContactIds.has(c.contact_id)) {
          seenContactIds.add(c.contact_id);
          contacts.push(c);
        }
      });
    }

    // Also try by contact_id
    const { data: byContactId, error: contactIdError } = await supabaseServer
      .from("contacts")
      .select("id, contact_id, page_id, contact_name, page_name")
      .in("contact_id", chunk)
      .eq("user_id", userId);

    if (!contactIdError && byContactId) {
      // Use contact_id as the unique key to prevent duplicates
      byContactId.forEach(c => {
        if (!seenContactIds.has(c.contact_id)) {
          seenContactIds.add(c.contact_id);
          contacts.push(c);
        }
      });
    }
  }

  console.log(`[fetchContactsForSendJob] Fetched ${contacts.length} unique contacts from ${uniqueContactIds.length} contact IDs`);
  return contacts;
}

async function sendMessageToContact(pageAccessToken: string, contact: ContactRecord, message: string, attachment: any) {
  const firstName = contact.contact_name?.split(" ")[0] || "there";
  const personalizedMessage = message.replace(/{FirstName}/g, firstName);

  let textSent = false;
  let attachmentSent = false;
  let lastError: string | null = null;

  // STEP 1: Always send TEXT message first
  try {
    console.log(`[Background Job] Sending TEXT to ${contact.contact_name}...`);
    const textPayload: any = {
      recipient: { id: contact.contact_id },
      message: { text: personalizedMessage },
      messaging_type: "MESSAGE_TAG",
      tag: "ACCOUNT_UPDATE"
    };

    const textResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(textPayload),
      }
    );

    const textData = await textResponse.json();
    if (textResponse.ok && !textData.error) {
      textSent = true;
      console.log(`✅ [Background Job] Sent TEXT to ${contact.contact_name}`);
    } else {
      lastError = textData.error?.message || "Failed to send text";
      console.error(`❌ [Background Job] Failed TEXT to ${contact.contact_name}: ${lastError}`);
    }
  } catch (error: any) {
    lastError = error?.message || "Failed to send text";
    console.error(`❌ [Background Job] Error sending TEXT to ${contact.contact_name}:`, error);
  }

  // STEP 2: Send MEDIA if attachment exists (after text)
  if (attachment && attachment.url) {
    // Wait a moment to ensure proper ordering
    await sleep(300);

    try {
      const attachmentType = attachment.type || "file";
      console.log(`[Background Job] Sending ${attachmentType} to ${contact.contact_name}...`);

      const mediaPayload: any = {
        recipient: { id: contact.contact_id },
        message: {
          attachment: {
            type: attachmentType,
            payload: {
              url: attachment.url,
              is_reusable: true
            }
          }
        },
        messaging_type: "MESSAGE_TAG",
        tag: "ACCOUNT_UPDATE"
      };

      const mediaResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mediaPayload),
        }
      );

      const mediaData = await mediaResponse.json();
      if (mediaResponse.ok && !mediaData.error) {
        attachmentSent = true;
        console.log(`✅ [Background Job] Sent MEDIA to ${contact.contact_name}`);
      } else {
        const mediaError = mediaData.error?.message || `Failed to send ${attachmentType}`;
        console.error(`❌ [Background Job] Failed MEDIA to ${contact.contact_name}: ${mediaError}`);
        // Don't overwrite lastError if text failed - text failure is more important
        if (!lastError) lastError = mediaError;
      }
    } catch (error: any) {
      console.error(`❌ [Background Job] Error sending MEDIA to ${contact.contact_name}:`, error);
      if (!lastError) lastError = error?.message || "Failed to send media";
    }
  }

  // Success if text was sent (primary message)
  return {
    success: textSent,
    attachmentSent,
    error: textSent ? null : lastError
  };
}

async function sendMessagesForPage(pageId: string, contacts: ContactRecord[], message: string, attachment: any, userAccessToken: string | null, sentContactIds?: Set<string>) {
  const { data: pageData, error: pageError } = await supabaseServer
    .from("facebook_pages")
    .select("page_id, page_access_token, page_name")
    .eq("page_id", pageId)
    .single();

  if (pageError || !pageData || !pageData.page_access_token) {
    // Try fetching from Facebook API as fallback (only if we have user access token)
    if (userAccessToken) {
      try {
        const pagesResponse = await fetch(
          `https://graph.facebook.com/v18.0/me/accounts?access_token=${userAccessToken}&fields=id,name,access_token&limit=1000`
        );

        if (pagesResponse.ok) {
          const pagesData = await pagesResponse.json();
          const pages = pagesData.data || [];
          const foundPage = pages.find((p: any) => p.id === pageId);

          if (foundPage) {
            await supabaseServer
              .from("facebook_pages")
              .upsert({
                page_id: foundPage.id,
                page_name: foundPage.name,
                page_access_token: foundPage.access_token,
                updated_at: new Date().toISOString(),
              }, {
                onConflict: "page_id",
              });

            const retryResult = await supabaseServer
              .from("facebook_pages")
              .select("page_id, page_access_token, page_name")
              .eq("page_id", pageId)
              .single();

            if (!retryResult.error && retryResult.data) {
              // Pass sentContactIds to prevent duplicates on retry
              return await sendMessagesForPage(pageId, contacts, message, attachment, userAccessToken, sentContactIds);
            }
          }
        }
      } catch (fetchError) {
        console.error(`Error fetching page from Facebook API:`, fetchError);
      }
    }

    return {
      success: 0,
      failed: contacts.length,
      errors: [
        {
          page: contacts[0]?.page_name || pageId,
          error: pageError?.message || "No access token available for this page. Please fetch pages first."
        }
      ]
    };
  }

  let success = 0;
  let failed = 0;
  const errors: any[] = [];

  // Track sent contacts in this job to prevent duplicates
  // Use the provided Set or create a new one
  const localSentIds = sentContactIds || new Set<string>();

  for (const contact of contacts) {
    // CRITICAL: Skip if we've already sent to this contact in this job run
    // Check BEFORE marking to prevent race conditions
    if (localSentIds.has(contact.contact_id)) {
      console.warn(`⏭️ [sendMessagesForPage] ⚠️ DUPLICATE PREVENTION: Skipping duplicate contact: ${contact.contact_name} (contact_id: ${contact.contact_id}) - already marked as sent in this job`);
      continue;
    }

    // CRITICAL: Mark as "processing" immediately BEFORE sending to prevent race conditions
    // This ensures that even if the function is called concurrently, we won't send twice
    // Add to both local and shared Sets atomically
    localSentIds.add(contact.contact_id);
    if (sentContactIds) {
      sentContactIds.add(contact.contact_id);
    }

    console.log(`[sendMessagesForPage] Processing contact: ${contact.contact_name} (contact_id: ${contact.contact_id}) - marked as sending`);

    const sendResult = await sendMessageToContact(pageData.page_access_token, contact, message, attachment);

    if (sendResult.success) {
      success++;
      console.log(`✅ [sendMessagesForPage] Sent message to ${contact.contact_name} (${contact.contact_id}) - total sent in this run: ${localSentIds.size}`);
    } else {
      failed++;
      const errorMsg = sendResult.error || "Unknown error";
      console.error(`❌ [sendMessagesForPage] Failed to send message to ${contact.contact_name} (${contact.contact_id}):`, errorMsg);
      errors.push({
        contact: contact.contact_name,
        page: contact.page_name,
        error: errorMsg
      });
      // Remove from sent set if send failed, so it can be retried
      // BUT: Only if it's a retryable error (not a duplicate error from Facebook)
      if (errorMsg.includes("DUPLICATE") || errorMsg.includes("already sent")) {
        // Keep it marked as sent to prevent retrying duplicates
        console.log(`⚠️ [sendMessagesForPage] Keeping ${contact.contact_id} marked as sent (duplicate detected by Facebook)`);
      } else {
        // For other errors, remove from sent set to allow retry
        localSentIds.delete(contact.contact_id);
        if (sentContactIds) {
          sentContactIds.delete(contact.contact_id);
        }
      }
    }

    await sleep(MESSAGE_SEND_THROTTLE_MS);
  }

  // Update the passed Set so caller can track sent contacts across pages
  // (Already done above during processing, but ensure all are synced)
  if (sentContactIds) {
    localSentIds.forEach(id => sentContactIds.add(id));
  }

  return { success, failed, errors };
}

async function processSendJob(sendJob: SendJobRecord, userAccessToken: string | null) {
  // Generate a unique processing ID for this instance
  const processingId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  logEvent("Attempting to claim job", {
    jobId: sendJob.id,
    processingId,
    status: sendJob.status,
    sent_count: sendJob.sent_count,
    failed_count: sendJob.failed_count,
    total_count: sendJob.total_count
  });

  // Check if job is completed or permanently failed
  if (sendJob.status === "completed") {
    console.log(`[Process Send Job] Job ${sendJob.id} is already completed, skipping`);
    return;
  }

  if (sendJob.status === "failed") {
    const totalProcessed = (sendJob.sent_count || 0) + (sendJob.failed_count || 0);
    const totalExpected = sendJob.total_count || 0;

    if (totalProcessed >= totalExpected) {
      console.log(`[Process Send Job] Job ${sendJob.id} failed but processed all contacts, skipping`);
      return;
    }

    console.log(`[Process Send Job] Resuming failed job ${sendJob.id} (${totalProcessed}/${totalExpected} processed)`);
  }

  // CRITICAL: Skip fresh running/processing jobs (updated within stale window) to prevent concurrent processors.
  const STALE_THRESHOLD_SECONDS = 120;
  const lastUpdated = new Date(sendJob.updated_at || sendJob.started_at || new Date().toISOString());
  const secondsSinceLastUpdate = (Date.now() - lastUpdated.getTime()) / 1000;

  if ((sendJob.status === "running" || sendJob.status === "processing") && secondsSinceLastUpdate < STALE_THRESHOLD_SECONDS) {
    logEvent("Skip fresh job (another process likely working)", {
      jobId: sendJob.id,
      status: sendJob.status,
      secondsSinceLastUpdate: secondsSinceLastUpdate.toFixed(1)
    });
    return;
  }

  // Atomically claim the job by updating status and setting a processing marker
  // Two-step claim: try pending/failed first, then stale running/processing
  const staleCutoffIso = new Date(Date.now() - 120 * 1000).toISOString();
  const baseUpdate = {
    status: "running",
    updated_at: new Date().toISOString(),
    errors: [...(sendJob.errors || []).filter((e: any) => !e._processing), { _processing: { id: processingId, started: new Date().toISOString() } }]
  };

  let updateResult;
  let updateError;

  // Step 1: claim if pending/failed
  const pendingClaim = await supabaseServer
    .from("send_jobs")
    .update(baseUpdate)
    .eq("id", sendJob.id)
    .in("status", ["pending", "failed"])
    .select()
    .single();

  if (pendingClaim.error || !pendingClaim.data) {
    // Step 2: claim if stale running/processing
    const staleClaim = await supabaseServer
      .from("send_jobs")
      .update(baseUpdate)
      .eq("id", sendJob.id)
      .or(`and(status.eq.running,updated_at.lte.${staleCutoffIso}),and(status.eq.processing,updated_at.lte.${staleCutoffIso})`)
      .select()
      .single();
    updateResult = staleClaim.data;
    updateError = staleClaim.error;
  } else {
    updateResult = pendingClaim.data;
    updateError = pendingClaim.error;
  }

  if (updateError || !updateResult) {
    logEvent("Job could not be claimed", {
      jobId: sendJob.id,
      updateError: updateError?.message
    });
    return;
  }

  // Wait a moment and verify we still own the job
  await sleep(500);

  const { data: verifyJob } = await supabaseServer
    .from("send_jobs")
    .select("*")
    .eq("id", sendJob.id)
    .single();

  if (verifyJob) {
    // Check if our processing ID is still in the errors array
    const processingMarker = (verifyJob.errors || []).find((e: any) => e._processing?.id === processingId);
    if (!processingMarker) {
      console.log(`[Process Send Job] Job ${sendJob.id} was claimed by another process, our processing ID ${processingId} not found. Skipping.`);
      return;
    }

    // Check if job status changed (cancelled, completed, etc.)
    if (verifyJob.status === "completed" || verifyJob.status === "cancelled") {
      console.log(`[Process Send Job] Job ${sendJob.id} status changed to ${verifyJob.status}, skipping.`);
      return;
    }
  }

  console.log(`[Process Send Job] ✅ Successfully claimed job ${sendJob.id} with processing ID: ${processingId}`);

  // Double-check timing to prevent race conditions
  const jobUpdatedAt = new Date(updateResult.updated_at || updateResult.started_at);
  const now = new Date();
  const secondsSinceUpdate = (now.getTime() - jobUpdatedAt.getTime()) / 1000;

  // If job was updated very recently (within 2 seconds) and we're not the one who updated it, skip
  // This prevents race conditions where multiple cron jobs pick up the same job
  if (secondsSinceUpdate < 2 && updateResult.status === "running") {
    // Check if we're the one who just updated it by comparing timestamps
    const ourUpdateTime = new Date().toISOString();
    const timeDiff = Math.abs(new Date(ourUpdateTime).getTime() - jobUpdatedAt.getTime());
    if (timeDiff > 1000) { // More than 1 second difference means another process updated it
      console.log(`[Process Send Job] Job ${sendJob.id} was just picked up by another process (${secondsSinceUpdate.toFixed(2)}s ago), skipping to prevent duplicate processing`);
      return;
    }
  }

  try {
    const contactIds = coerceContactIds(sendJob.contact_ids);
    const contacts = await fetchContactsForSendJob(sendJob.user_id, contactIds);
    logEvent("Contacts fetched for job", {
      jobId: sendJob.id,
      requestedIds: contactIds.length,
      fetchedContacts: contacts.length
    });

    if (contacts.length === 0) {
      await supabaseServer
        .from("send_jobs")
        .update({
          status: "failed",
          failed_count: sendJob.total_count,
          errors: [{ error: "No contacts found" }],
          completed_at: new Date().toISOString()
        })
        .eq("id", sendJob.id);
      return;
    }

    // CRITICAL: Remove duplicates by contact_id to prevent sending twice to same contact
    // Use contact_id as the unique key (it's globally unique across all pages)
    const uniqueContacts = new Map<string, ContactRecord>();
    for (const contact of contacts) {
      const key = contact.contact_id;
      if (!uniqueContacts.has(key)) {
        uniqueContacts.set(key, contact);
      } else {
        console.warn(`[Process Send Job] ⚠️ DUPLICATE DETECTED: Skipping duplicate contact: ${contact.contact_name} (contact_id: ${contact.contact_id}, page_id: ${contact.page_id})`);
      }
    }
    const deduplicatedContacts = Array.from(uniqueContacts.values());

    if (deduplicatedContacts.length !== contacts.length) {
      console.warn(`[Process Send Job] ⚠️ Removed ${contacts.length - deduplicatedContacts.length} duplicate contacts (${contacts.length} -> ${deduplicatedContacts.length} unique)`);
    }

    // Get already sent contacts from job to prevent duplicates on resume
    // Store sent contact_ids in errors array as metadata
    const alreadySentCount = sendJob.sent_count || 0;
    const alreadyFailedCount = sendJob.failed_count || 0;
    const alreadyProcessed = alreadySentCount + alreadyFailedCount;

    // Extract sent contact IDs from errors array (stored as metadata)
    const sentContactIdsSet = new Set<string>();
    if (sendJob.errors && Array.isArray(sendJob.errors)) {
      for (const error of sendJob.errors) {
        if (error._metadata && error._metadata.sent_contact_ids && Array.isArray(error._metadata.sent_contact_ids)) {
          error._metadata.sent_contact_ids.forEach((id: string) => sentContactIdsSet.add(id));
        }
      }
    }

    console.log(`[Process Send Job] Job ${sendJob.id} resume check:`, {
      status: sendJob.status,
      alreadySentCount,
      alreadyFailedCount,
      alreadyProcessed,
      sentContactIdsFromMetadata: sentContactIdsSet.size,
      totalContacts: deduplicatedContacts.length,
      totalExpected: sendJob.total_count
    });

    // If resuming and we have sent contacts, filter them out
    let contactsToProcess = deduplicatedContacts;
    if (sentContactIdsSet.size > 0) {
      const beforeFilter = contactsToProcess.length;
      contactsToProcess = deduplicatedContacts.filter(c => !sentContactIdsSet.has(c.contact_id));
      console.log(`[Process Send Job] Job ${sendJob.id}: Resuming - filtered out ${beforeFilter - contactsToProcess.length} already sent contacts (${sentContactIdsSet.size} in metadata), processing ${contactsToProcess.length} remaining`);

      // Double-check: verify we're not processing contacts that were already sent
      const duplicateCheck = contactsToProcess.filter(c => sentContactIdsSet.has(c.contact_id));
      if (duplicateCheck.length > 0) {
        console.warn(`[Process Send Job] WARNING: Found ${duplicateCheck.length} contacts that should have been filtered out!`);
        contactsToProcess = contactsToProcess.filter(c => !sentContactIdsSet.has(c.contact_id));
      }
    } else {
      console.log(`[Process Send Job] Job ${sendJob.id}: Starting fresh - processing ${contactsToProcess.length} contacts`);
    }

    // Group remaining contacts by page
    const contactsByPage = new Map<string, ContactRecord[]>();
    for (const contact of contactsToProcess) {
      if (!contactsByPage.has(contact.page_id)) {
        contactsByPage.set(contact.page_id, []);
      }
      contactsByPage.get(contact.page_id)!.push(contact);
    }

    // Start with existing counts if resuming
    let messageSuccess = alreadySentCount;
    let messageFailed = alreadyFailedCount;
    // Filter out metadata entries from errors, keep only actual errors
    const messageErrors: any[] = (sendJob.errors || []).filter((e: any) => !e._metadata);
    const startTime = Date.now();
    const VERCEL_TIMEOUT = 280000; // 280 seconds buffer

    // Track which contacts have been sent (to prevent duplicates on resume)
    // Initialize with already sent contacts
    const sentContactIds = new Set<string>(sentContactIdsSet);

    let processedPages = 0;
    const totalPages = contactsByPage.size;

    for (const [pageId, pageContacts] of contactsByPage.entries()) {
      // Check if job has been cancelled
      const { data: currentJob } = await supabaseServer
        .from("send_jobs")
        .select("status")
        .eq("id", sendJob.id)
        .single();

      if (currentJob?.status === "cancelled") {
        console.log(`[Process Send Job] Job ${sendJob.id} was cancelled by user, stopping processing`);
        return; // Stop immediately
      }

      const pageChunks = chunkArray(pageContacts, PAGE_CHUNK_SIZE);
      console.log(`[Process Send Job] Processing page ${pageId} (${pageContacts.length} contacts, ${processedPages + 1}/${totalPages} pages, ${pageChunks.length} chunk(s))`);

      for (let chunkIndex = 0; chunkIndex < pageChunks.length; chunkIndex++) {
        const elapsed = Date.now() - startTime;
        const chunkNumber = chunkIndex + 1;
        const chunk = pageChunks[chunkIndex];

        if (elapsed > VERCEL_TIMEOUT - TIMEOUT_BUFFER_MS) {
          const sentContactIdsArray = Array.from(sentContactIds);
          const actualErrors = messageErrors.filter((e: any) => !e._metadata);
          const errorsWithMetadata = [
            ...actualErrors,
            {
              error: `Timeout: Processed ${messageSuccess + messageFailed} of ${contactsToProcess.length + alreadyProcessed} contacts. Job will resume on next cron run.`,
              _metadata: {
                sent_contact_ids: sentContactIdsArray,
                last_updated: new Date().toISOString(),
                total_sent: sentContactIdsArray.length,
                page: pageId,
                chunk: chunkNumber,
                chunks_total: pageChunks.length
              }
            }
          ];

          await supabaseServer
            .from("send_jobs")
            .update({
              sent_count: messageSuccess,
              failed_count: messageFailed,
              errors: errorsWithMetadata,
              updated_at: new Date().toISOString(),
              status: "running" // Keep as running so cron can resume it
            })
            .eq("id", sendJob.id);

          console.warn(`[Process Send Job] Approaching timeout (${Math.round(elapsed / 1000)}s), pausing at page ${pageId} chunk ${chunkNumber}/${pageChunks.length}`);
          return; // Exit early, job will be picked up by next cron run
        }

        const result = await sendMessagesForPage(
          pageId,
          chunk,
          sendJob.message,
          sendJob.attachment,
          userAccessToken,
          sentContactIds // Pass sent tracking to prevent duplicates
        );

        messageSuccess += result.success;
        messageFailed += result.failed;
        messageErrors.push(...result.errors);

        // Update progress after each chunk (important for resume on huge pages)
        const sentContactIdsArray = Array.from(sentContactIds);
        const actualErrors = messageErrors.filter((e: any) => !e._metadata);
        const nearTimeout = (Date.now() - startTime) > VERCEL_TIMEOUT - TIMEOUT_BUFFER_MS && chunkIndex < pageChunks.length - 1;
        const metadataEntry: any = {
          _metadata: {
            sent_contact_ids: sentContactIdsArray,
            last_updated: new Date().toISOString(),
            total_sent: sentContactIdsArray.length,
            page: pageId,
            chunk: chunkNumber,
            chunks_total: pageChunks.length
          }
        };
        if (nearTimeout) {
          metadataEntry.error = `Timeout: Processed ${messageSuccess + messageFailed} of ${contactsToProcess.length + alreadyProcessed} contacts. Job will resume on next cron run.`;
        }
        const errorsWithMetadata = [
          ...actualErrors,
          metadataEntry
        ];

        await supabaseServer
          .from("send_jobs")
          .update({
            sent_count: messageSuccess,
            failed_count: messageFailed,
            errors: errorsWithMetadata,
            updated_at: new Date().toISOString(),
            status: "running"
          })
          .eq("id", sendJob.id);

        console.log(`[Process Send Job] Progress: ${messageSuccess} sent, ${messageFailed} failed (${messageSuccess + messageFailed}/${sendJob.total_count || deduplicatedContacts.length} total), page ${pageId} chunk ${chunkNumber}/${pageChunks.length}, sent IDs tracked: ${sentContactIdsArray.length}`);

        // If we're close to timeout after processing this chunk, pause to let cron resume safely
        if (nearTimeout) {
          console.warn(`[Process Send Job] Near timeout after chunk ${chunkNumber}/${pageChunks.length} on page ${pageId}, pausing job ${sendJob.id}`);
          return;
        }
      }

      processedPages++;
    }

    // Final status update
    // Check if we processed all contacts
    const totalProcessed = messageSuccess + messageFailed;
    // totalExpected should be the original total_count from the job
    const totalExpected = sendJob.total_count || deduplicatedContacts.length;
    // Remaining contacts to process = total expected - already processed before this run - newly processed in this run
    const remainingContacts = totalExpected - totalProcessed;

    console.log(`[Process Send Job] Job ${sendJob.id} progress check:`, {
      totalExpected,
      alreadyProcessedBeforeRun: alreadyProcessed,
      newlyProcessedThisRun: totalProcessed - alreadyProcessed,
      totalProcessed,
      remainingContacts,
      contactsToProcessCount: contactsToProcess.length,
      sentContactIdsCount: sentContactIds.size,
      messageSuccess,
      messageFailed
    });

    // If we have no more contacts to process, mark as complete
    // This handles the case where all remaining contacts were already sent in previous runs
    const hasRemainingContacts = contactsToProcess.length > 0 && remainingContacts > 0;

    let finalStatus = "completed";
    if (hasRemainingContacts) {
      // Not all contacts were processed - keep as "running" so cron can resume
      finalStatus = "running";
      const errorsWithMetadata = [
        ...messageErrors,
        {
          error: `Incomplete: Processed ${totalProcessed} of ${totalExpected} contacts. ${remainingContacts} remaining. Job will resume on next cron run.`,
          remaining: remainingContacts,
          _metadata: {
            sent_contact_ids: Array.from(sentContactIds),
            last_updated: new Date().toISOString()
          }
        }
      ];
      console.log(`⏸️ Job ${sendJob.id} incomplete: ${totalProcessed}/${totalExpected} processed. ${remainingContacts} remaining. Will resume on next cron run.`);

      await supabaseServer
        .from("send_jobs")
        .update({
          status: finalStatus,
          sent_count: messageSuccess,
          failed_count: messageFailed,
          errors: errorsWithMetadata,
          completed_at: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", sendJob.id);
    } else if (messageSuccess === 0 && messageFailed > 0 && totalProcessed >= totalExpected) {
      // All contacts processed but all failed
      finalStatus = "failed";
      await supabaseServer
        .from("send_jobs")
        .update({
          status: finalStatus,
          sent_count: messageSuccess,
          failed_count: messageFailed,
          errors: messageErrors,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", sendJob.id);
    } else {
      // All contacts processed successfully
      finalStatus = "completed";
      const errorsWithMetadata = [
        ...messageErrors,
        {
          _metadata: {
            sent_contact_ids: Array.from(sentContactIds),
            last_updated: new Date().toISOString()
          }
        }
      ];
      console.log(`✅ Job ${sendJob.id} completed: ${messageSuccess} sent, ${messageFailed} failed`);

      await supabaseServer
        .from("send_jobs")
        .update({
          status: finalStatus,
          sent_count: messageSuccess,
          failed_count: messageFailed,
          errors: errorsWithMetadata,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", sendJob.id);
    }

    console.log(`✅ Processed send job ${sendJob.id}: ${messageSuccess} sent, ${messageFailed} failed (${totalProcessed}/${totalExpected} total), status: ${finalStatus}`);
  } catch (error: any) {
    console.error(`❌ Error processing send job ${sendJob.id}:`, error);
    await supabaseServer
      .from("send_jobs")
      .update({
        status: "failed",
        errors: [{ error: error.message || "Unknown error" }],
        completed_at: new Date().toISOString()
      })
      .eq("id", sendJob.id);
  }
}

// POST: Process a specific send job (triggered by send route or manually)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, accessToken } = body;

    logEvent("POST received", { jobId, hasAccessToken: !!accessToken });

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    // Try to get session, but allow processing if accessToken is provided (server-side trigger)
    const session = await getServerSession(authOptions);
    let userAccessToken = accessToken || null;

    // If no accessToken provided and no session, require authentication
    if (!userAccessToken && !session) {
      return NextResponse.json({ error: "Unauthorized - session or accessToken required" }, { status: 401 });
    }

    // Use provided access token or get from session
    if (!userAccessToken && session) {
      userAccessToken = (session as any).accessToken || null;
    }

    // For server-side triggers, we need userId from the job itself
    let userId: string | null = null;
    if (session) {
      userId = (session.user as any).id;
    }

    // Fetch the job first to get userId (for server-side triggers)
    const { data: sendJob, error: jobError } = await supabaseServer
      .from("send_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !sendJob) {
      return NextResponse.json({ error: "Job not found", details: jobError?.message }, { status: 404 });
    }

    // If we have a session, verify the job belongs to the user
    if (session) {
      userId = (session.user as any).id;
      if (sendJob.user_id !== userId) {
        return NextResponse.json({ error: "Unauthorized - job does not belong to user" }, { status: 403 });
      }
    } else {
      // For server-side triggers, use the job's userId
      userId = sendJob.user_id;
    }

    // Only process pending/processing/running jobs
    if (!["pending", "processing", "running"].includes(sendJob.status)) {
      return NextResponse.json({
        message: "Job already processed",
        status: sendJob.status
      });
    }

    // Process the job
    await processSendJob(sendJob as SendJobRecord, userAccessToken);

    return NextResponse.json({ success: true, message: "Job processed" });
  } catch (error: any) {
    logError("Fatal error in POST handler", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

// GET: Process pending send jobs (for cron or manual trigger)
export async function GET(request: NextRequest) {
  try {
    logEvent("GET cron/trigger received");

    // Similar auth check as process-scheduled
    const authHeader = request.headers.get("authorization");
    const vercelCronHeader = request.headers.get("x-vercel-cron");
    const vercelSignature = request.headers.get("x-vercel-signature");
    const userAgent = request.headers.get("user-agent") || "";

    const hasVercelHeaders =
      vercelCronHeader === "1" ||
      vercelCronHeader !== null ||
      vercelSignature !== null;

    const hasVercelUserAgent =
      userAgent.toLowerCase().includes("vercel") ||
      userAgent.toLowerCase().includes("cron") ||
      userAgent.toLowerCase().includes("node-fetch") ||
      userAgent === "";

    const isVercelCron = hasVercelHeaders || (hasVercelUserAgent && !authHeader);

    // For manual triggers, require session
    const session = await getServerSession(authOptions);
    if (!isVercelCron && !session) {
      logEvent("GET unauthorized", { isVercelCron, hasSession: !!session });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const MAX_JOBS_PER_RUN = 5;
    const staleCutoff = new Date(Date.now() - 120000).toISOString(); // resume running/processing only if stale (>120s)

    // Fetch pending immediately; only pick up running/processing if stale to avoid double-processing fresh work.
    let query = supabaseServer
      .from("send_jobs")
      .select("*")
      .or(
        `status.eq.pending,status.eq.failed,and(status.eq.running,updated_at.lte.${staleCutoff}),and(status.eq.processing,updated_at.lte.${staleCutoff})`
      )
      .order("started_at", { ascending: true })
      .limit(MAX_JOBS_PER_RUN);

    // If manual trigger with session, filter by user
    if (!isVercelCron && session) {
      const userId = (session.user as any).id;
      query = query.eq("user_id", userId);
    }

    const { data: pendingJobs, error: pendingError } = await query;

    if (pendingError) {
      logError("Error fetching pending send jobs", pendingError);
      return NextResponse.json(
        { error: "Failed to fetch jobs", details: pendingError.message },
        { status: 500 }
      );
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return NextResponse.json({ message: "No pending jobs", processed: 0 });
    }

    logEvent("Jobs fetched for processing", {
      count: pendingJobs.length,
      jobIds: pendingJobs.map((j: any) => j.id),
      statuses: pendingJobs.map((j: any) => j.status)
    });

    // Process jobs sequentially
    let processed = 0;

    for (const job of pendingJobs) {
      // Get user access token if we have a session
      // For cron jobs, we won't have session, so rely on stored page tokens
      // Note: For cron jobs, we can't fetch user access tokens, so we rely on stored page tokens
      const userAccessToken = session ? ((session as any).accessToken || null) : null;

      console.log(`[Process Send Job] Processing job ${job.id} (user: ${job.user_id}, status: ${job.status})`);
      await processSendJob(job as SendJobRecord, userAccessToken);
      processed++;
    }

    return NextResponse.json({
      message: `Processed ${processed} job(s)`,
      processed
    });
  } catch (error: any) {
    logError("Fatal error in GET handler", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
