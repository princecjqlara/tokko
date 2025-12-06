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
};

type ContactRecord = {
  id: number;
  contact_id: string;
  page_id: string;
  contact_name: string;
  page_name: string;
};

const MESSAGE_SEND_THROTTLE_MS = 100; // rate limit between sends
const ATTACHMENT_THROTTLE_MS = 500; // give media a moment to settle

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
  const contacts: ContactRecord[] = [];
  
  // Fetch in chunks to avoid Supabase IN() limits
  const chunkSize = 200;
  for (let i = 0; i < contactIds.length; i += chunkSize) {
    const chunk = contactIds.slice(i, i + chunkSize);
    
    // Try by database id first
    const { data: byId, error: idError } = await supabaseServer
      .from("contacts")
      .select("id, contact_id, page_id, contact_name, page_name")
      .in("id", chunk)
      .eq("user_id", userId);
    
    if (!idError && byId) {
      contacts.push(...byId);
    }
    
    // Also try by contact_id
    const { data: byContactId, error: contactIdError } = await supabaseServer
      .from("contacts")
      .select("id, contact_id, page_id, contact_name, page_name")
      .in("contact_id", chunk)
      .eq("user_id", userId);
    
    if (!contactIdError && byContactId) {
      // Avoid duplicates
      const existingIds = new Set(contacts.map(c => c.id));
      byContactId.forEach(c => {
        if (!existingIds.has(c.id)) {
          contacts.push(c);
        }
      });
    }
  }
  
  return contacts;
}

async function sendMessageToContact(pageAccessToken: string, contact: ContactRecord, message: string, attachment: any) {
  const firstName = contact.contact_name?.split(" ")[0] || "there";
  const personalizedMessage = message.replace(/{FirstName}/g, firstName);

  let firstError: string | null = null;
  let attachmentSent = false;

  // Send attachment first if provided
  if (attachment && attachment.url) {
    try {
      const attachmentType = attachment.type || "file";
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
      if (!mediaResponse.ok || mediaData.error) {
        firstError = mediaData.error?.message || `Failed to send ${attachmentType}`;
      } else {
        attachmentSent = true;
      }
    } catch (error: any) {
      firstError = error?.message || "Failed to send attachment";
    }

    await sleep(ATTACHMENT_THROTTLE_MS);
  }

  // Send text message
  const textPayload: any = {
    recipient: { id: contact.contact_id },
    message: { text: personalizedMessage },
    messaging_type: "MESSAGE_TAG",
    tag: "ACCOUNT_UPDATE"
  };

  const sendResponse = await fetch(
    `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(textPayload),
    }
  );

  const sendData = await sendResponse.json();
  if (sendResponse.ok && !sendData.error) {
    return { success: true, attachmentSent };
  }

  return {
    success: false,
    attachmentSent,
    error: sendData.error?.message || firstError || "Unknown error"
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
              return await sendMessagesForPage(pageId, contacts, message, attachment, userAccessToken);
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
    // Skip if we've already sent to this contact in this job run
    if (localSentIds.has(contact.contact_id)) {
      console.log(`⏭️ [sendMessagesForPage] Skipping duplicate contact: ${contact.contact_name} (${contact.contact_id}) - already sent in this job`);
      continue;
    }
    
    const sendResult = await sendMessageToContact(pageData.page_access_token, contact, message, attachment);

    if (sendResult.success) {
      success++;
      localSentIds.add(contact.contact_id); // Mark as sent IMMEDIATELY
      // Also update the passed Set immediately
      if (sentContactIds) {
        sentContactIds.add(contact.contact_id);
      }
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
      // Don't mark failed sends as sent, so they can be retried if job is rerun
    }

    await sleep(MESSAGE_SEND_THROTTLE_MS);
  }
  
  // Update the passed Set so caller can track sent contacts across pages
  // (Already done above, but ensure all are synced)
  if (sentContactIds) {
    localSentIds.forEach(id => sentContactIds.add(id));
  }
  
  // Update the passed Set so caller can track sent contacts across pages
  if (sentContactIds) {
    localSentIds.forEach(id => sentContactIds.add(id));
  }

  return { success, failed, errors };
}

async function processSendJob(sendJob: SendJobRecord, userAccessToken: string | null) {
  // Allow resuming incomplete jobs (status: "running" but not completed)
  // Check if job is completed or permanently failed
  if (sendJob.status === "completed") {
    console.log(`[Process Send Job] Job ${sendJob.id} is already completed, skipping`);
    return;
  }
  
  if (sendJob.status === "failed") {
    // Check if it's a permanent failure or can be resumed
    const totalProcessed = (sendJob.sent_count || 0) + (sendJob.failed_count || 0);
    const totalExpected = sendJob.total_count || 0;
    
    // If job failed but processed all contacts, don't resume
    if (totalProcessed >= totalExpected) {
      console.log(`[Process Send Job] Job ${sendJob.id} failed but processed all contacts, skipping`);
      return;
    }
    
    // Otherwise, allow resuming failed jobs that didn't complete
    console.log(`[Process Send Job] Resuming failed job ${sendJob.id} (${totalProcessed}/${totalExpected} processed)`);
  }

  // Move to running state (allow resuming from "running" or "failed" status)
  await supabaseServer
    .from("send_jobs")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", sendJob.id);

  try {
    const contactIds = coerceContactIds(sendJob.contact_ids);
    const contacts = await fetchContactsForSendJob(sendJob.user_id, contactIds);

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

    // Remove duplicates by contact_id to prevent sending twice to same contact
    const uniqueContacts = new Map<string, ContactRecord>();
    for (const contact of contacts) {
      const key = contact.contact_id;
      if (!uniqueContacts.has(key)) {
        uniqueContacts.set(key, contact);
      } else {
        console.log(`[Process Send Job] Skipping duplicate contact: ${contact.contact_name} (${contact.contact_id})`);
      }
    }
    const deduplicatedContacts = Array.from(uniqueContacts.values());
    
    if (deduplicatedContacts.length !== contacts.length) {
      console.log(`[Process Send Job] Removed ${contacts.length - deduplicatedContacts.length} duplicate contacts`);
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
    let totalPages = contactsByPage.size;

    for (const [pageId, pageContacts] of contactsByPage.entries()) {
      // Check timeout before processing each page
      const elapsed = Date.now() - startTime;
      if (elapsed > VERCEL_TIMEOUT) {
        console.warn(`[Process Send Job] Approaching timeout (${Math.round(elapsed/1000)}s), stopping at page ${pageId} (${processedPages}/${totalPages} pages processed)`);
        // Update job with partial progress - mark as "running" so it can be resumed
        await supabaseServer
          .from("send_jobs")
          .update({
            sent_count: messageSuccess,
            failed_count: messageFailed,
            errors: [...messageErrors, { 
              error: `Timeout: Processed ${messageSuccess + messageFailed} of ${contactsToProcess.length + alreadyProcessed} contacts. Job will resume on next cron run.`,
              _metadata: { sent_contact_ids: Array.from(sentContactIds) }
            }],
            updated_at: new Date().toISOString(),
            status: "running" // Keep as running so cron can resume it
          })
          .eq("id", sendJob.id);
        console.log(`[Process Send Job] Job ${sendJob.id} paused due to timeout. Will resume on next cron run.`);
        return; // Exit early, job will be picked up by next cron run
      }
      
      console.log(`[Process Send Job] Processing page ${pageId} (${pageContacts.length} contacts, ${processedPages + 1}/${totalPages} pages)`);
      
      const result = await sendMessagesForPage(
        pageId,
        pageContacts,
        sendJob.message,
        sendJob.attachment,
        userAccessToken,
        sentContactIds // Pass sent tracking to prevent duplicates
      );

      messageSuccess += result.success;
      messageFailed += result.failed;
      messageErrors.push(...result.errors);
      processedPages++;

      // Update progress after each page (important for resume)
      // Store sent contact IDs in errors array as metadata for resume
      const sentContactIdsArray = Array.from(sentContactIds);
      // Remove any existing metadata entries and add fresh one
      const actualErrors = messageErrors.filter((e: any) => !e._metadata);
      const errorsWithMetadata = [
        ...actualErrors,
        { 
          _metadata: { 
            sent_contact_ids: sentContactIdsArray,
            last_updated: new Date().toISOString(),
            total_sent: sentContactIdsArray.length
          }
        }
      ];
      
      await supabaseServer
        .from("send_jobs")
        .update({
          sent_count: messageSuccess,
          failed_count: messageFailed,
          errors: errorsWithMetadata,
          updated_at: new Date().toISOString()
        })
        .eq("id", sendJob.id);
        
      console.log(`[Process Send Job] Progress: ${messageSuccess} sent, ${messageFailed} failed (${messageSuccess + messageFailed}/${sendJob.total_count || deduplicatedContacts.length} total), sent IDs tracked: ${sentContactIdsArray.length}`);
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
      sentContactIdsCount: sentContactIds.size
    });
    
    let finalStatus = "completed";
    if (remainingContacts > 0 && contactsToProcess.length > 0) {
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

    // Only process pending jobs
    if (sendJob.status !== "pending" && sendJob.status !== "running") {
      return NextResponse.json({ 
        message: "Job already processed", 
        status: sendJob.status 
      });
    }

    // Process the job
    await processSendJob(sendJob as SendJobRecord, userAccessToken);

    return NextResponse.json({ success: true, message: "Job processed" });
  } catch (error: any) {
    console.error("Error in process-send-job route:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

// GET: Process pending send jobs (for cron or manual trigger)
export async function GET(request: NextRequest) {
  try {
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const MAX_JOBS_PER_RUN = 5;
    
    // Find pending AND running jobs (to resume incomplete jobs)
    // For cron: process all pending/running jobs
    // For manual: only process user's jobs
    let query = supabaseServer
      .from("send_jobs")
      .select("*")
      .in("status", ["pending", "running"]) // Also process running jobs to resume them
      .order("started_at", { ascending: true })
      .limit(MAX_JOBS_PER_RUN);
    
    // If manual trigger with session, filter by user
    if (!isVercelCron && session) {
      const userId = (session.user as any).id;
      query = query.eq("user_id", userId);
    }
    
    const { data: pendingJobs, error: pendingError } = await query;
    
    if (pendingError) {
      console.error("Error fetching pending send jobs:", pendingError);
      return NextResponse.json(
        { error: "Failed to fetch jobs", details: pendingError.message },
        { status: 500 }
      );
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return NextResponse.json({ message: "No pending jobs", processed: 0 });
    }

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
    console.error("Error in process-send-job GET route:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
