import { supabaseServer } from "@/lib/supabase-server";
import { MESSAGE_SEND_THROTTLE_MS } from "./constants";
import { sendMessageToContact } from "./send-contact";
import { ContactRecord } from "./types";
import { chunkArray, sleep } from "./utils";

async function markContactSending(contactId: number | null | undefined, jobId: number | undefined) {
  if (!contactId) return true;
  try {
    const { data, error } = await supabaseServer
      .from("contacts")
      .update({ last_send_status: "sending", last_send_job_id: jobId || null, last_send_at: new Date().toISOString() })
      .eq("id", contactId)
      .neq("last_send_status", "sent")
      .select("id")
      .limit(1);
    if (error || !data?.length) {
      console.warn("[Process Scheduled] Skip contact due to lock failure", { contactId, jobId, error: error?.message });
      return false;
    }
    return true;
  } catch (error: any) {
    console.warn("[Process Scheduled] Skip contact due to lock exception", { contactId, jobId, error: error.message });
    return false;
  }
}

async function updateContactStatus(contactId: number | null | undefined, jobId: number | undefined, status: "sent" | "failed" | null) {
  if (!contactId) return;
  const updates: any = {
    last_send_status: status,
    last_send_job_id: status ? jobId || null : null,
    last_send_at: status ? new Date().toISOString() : null
  };
  try {
    await supabaseServer.from("contacts").update(updates).eq("id", contactId);
  } catch (error) {
    console.warn("[Process Scheduled] Failed to mark contact status", { contactId, status, jobId, error: (error as any)?.message });
  }
}

export async function sendMessagesForPage(
  pageId: string,
  contacts: ContactRecord[],
  message: string,
  attachment: any,
  messageTag: string = "ACCOUNT_UPDATE"
) {
  const { data: pageData, error: pageError } = await supabaseServer
    .from("facebook_pages")
    .select("page_id, page_access_token, page_name")
    .eq("page_id", pageId)
    .single();

  if (pageError || !pageData?.page_access_token) {
    return {
      success: 0,
      failed: contacts.length,
      errors: [
        {
          page: contacts[0]?.page_name || pageId,
          error: pageError?.message || "No access token available for this page"
        }
      ]
    };
  }

  let success = 0;
  let failed = 0;
  const errors: any[] = [];

  for (const contactChunk of chunkArray(contacts, 25)) {
    for (const contact of contactChunk) {
      if (contact.last_send_status === "sent") continue;
      const locked = await markContactSending(contact.id, undefined);
      if (!locked) continue;
      const sendResult = await sendMessageToContact(pageData.page_access_token, contact, message, attachment, messageTag);

      if (sendResult.success) {
        success++;
        await updateContactStatus(contact.id, undefined, "sent");
      } else {
        failed++;
        const errorMsg = sendResult.error || "Unknown error";
        errors.push({
          contact: contact.contact_name,
          page: contact.page_name,
          error: errorMsg
        });
        await updateContactStatus(contact.id, undefined, "failed");
      }

      await sleep(MESSAGE_SEND_THROTTLE_MS);
    }
  }

  return { success, failed, errors };
}
