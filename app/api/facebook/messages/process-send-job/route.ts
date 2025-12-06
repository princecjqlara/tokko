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

async function sendMessagesForPage(pageId: string, contacts: ContactRecord[], message: string, attachment: any, userAccessToken: string | null) {
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

  for (const contact of contacts) {
    const sendResult = await sendMessageToContact(pageData.page_access_token, contact, message, attachment);

    if (sendResult.success) {
      success++;
      console.log(`✅ Sent message to ${contact.contact_name} (${contact.contact_id})`);
    } else {
      failed++;
      const errorMsg = sendResult.error || "Unknown error";
      console.error(`❌ Failed to send message to ${contact.contact_name}:`, errorMsg);
      errors.push({
        contact: contact.contact_name,
        page: contact.page_name,
        error: errorMsg
      });
    }

    await sleep(MESSAGE_SEND_THROTTLE_MS);
  }

  return { success, failed, errors };
}

async function processSendJob(sendJob: SendJobRecord, userAccessToken: string | null) {
  // Move to running state early to avoid duplicate work
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

    // Group by page
    const contactsByPage = new Map<string, ContactRecord[]>();
    for (const contact of contacts) {
      if (!contactsByPage.has(contact.page_id)) {
        contactsByPage.set(contact.page_id, []);
      }
      contactsByPage.get(contact.page_id)!.push(contact);
    }

    let messageSuccess = 0;
    let messageFailed = 0;
    const messageErrors: any[] = [];

    for (const [pageId, pageContacts] of contactsByPage.entries()) {
      const result = await sendMessagesForPage(
        pageId,
        pageContacts,
        sendJob.message,
        sendJob.attachment,
        userAccessToken
      );

      messageSuccess += result.success;
      messageFailed += result.failed;
      messageErrors.push(...result.errors);

      // Update progress periodically
      await supabaseServer
        .from("send_jobs")
        .update({
          sent_count: messageSuccess,
          failed_count: messageFailed,
          errors: messageErrors,
          updated_at: new Date().toISOString()
        })
        .eq("id", sendJob.id);
    }

    // Final status update
    const finalStatus = messageSuccess > 0 ? "completed" : "failed";

    await supabaseServer
      .from("send_jobs")
      .update({
        status: finalStatus,
        sent_count: messageSuccess,
        failed_count: messageFailed,
        errors: messageErrors,
        completed_at: new Date().toISOString()
      })
      .eq("id", sendJob.id);

    console.log(`✅ Processed send job ${sendJob.id}: ${messageSuccess} sent, ${messageFailed} failed`);
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
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { jobId, accessToken } = body;

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }
    
    // Use provided access token or get from session
    const userAccessToken = accessToken || ((session as any).accessToken || null);

    const userId = (session.user as any).id;

    // Fetch the job
    const { data: sendJob, error: jobError } = await supabaseServer
      .from("send_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", userId)
      .single();

    if (jobError || !sendJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
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
    if (!isVercelCron) {
      const session = await getServerSession(authOptions);
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const MAX_JOBS_PER_RUN = 5;
    
    // Find pending jobs
    const { data: pendingJobs, error: pendingError } = await supabaseServer
      .from("send_jobs")
      .select("*")
      .eq("status", "pending")
      .order("started_at", { ascending: true })
      .limit(MAX_JOBS_PER_RUN);
    
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

    // Process jobs (for cron, we'll process them sequentially)
    // For manual triggers with session, process the user's jobs
    let processed = 0;
    const session = await getServerSession(authOptions);
    
    for (const job of pendingJobs) {
      // If manual trigger, only process user's own jobs
      if (!isVercelCron && session) {
        const userId = (session.user as any).id;
        if (job.user_id !== userId) {
          continue;
        }
      }
      
      // Get user access token if we have a session
      // For cron jobs, we won't have session, so rely on stored page tokens
      const userAccessToken = session ? ((session as any).accessToken || null) : null;
      
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
