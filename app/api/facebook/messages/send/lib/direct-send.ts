import { supabaseServer } from "@/lib/supabase-server";
import { ContactRecord } from "./contacts";
import { CONTACT_SEND_THROTTLE_MS, VERCEL_SEND_TIMEOUT_MS } from "./constants";

type DirectSendParams = {
  contacts: ContactRecord[];
  message: string;
  attachment: any;
  messageTag: string;
};

export async function sendDirectMessages(params: DirectSendParams) {
  const contactsByPage = new Map<string, ContactRecord[]>();
  for (const contact of params.contacts) {
    if (contact.last_send_status === "sent") {
      continue;
    }
    const pageId = contact.page_id;
    if (!contactsByPage.has(pageId)) contactsByPage.set(pageId, []);
    contactsByPage.get(pageId)!.push(contact);
  }

  const sentTextToContacts = new Set<string>();
  const processedContactIds: number[] = [];
  const results = {
    success: 0,
    failed: 0,
    errors: [] as any[],
    scheduled: false
  };

  const startTime = Date.now();
  console.log(`[Send Message API] Starting direct send for ${params.contacts.length} contacts across ${contactsByPage.size} pages`);

  for (const [pageId, pageContacts] of contactsByPage.entries()) {
    if (Date.now() - startTime > VERCEL_SEND_TIMEOUT_MS) {
      console.warn("[Send Message API] Timeout approaching during direct send, stopping");
      break;
    }

    const { data: pageData, error: pageError } = await supabaseServer
      .from("facebook_pages")
      .select("page_id, page_access_token")
      .eq("page_id", pageId)
      .maybeSingle();

    if (pageError || !pageData?.page_access_token) {
      console.error(`[Send Message API] No access token for page ${pageId}`);
      results.failed += pageContacts.length;
      results.errors.push({
        page: pageContacts[0]?.page_name || pageId,
        error: "No access token available for this page"
      });
      continue;
    }

    const pageAccessToken = pageData.page_access_token;

    for (const contact of pageContacts) {
      if (!contact.contact_id) {
        console.warn(`[Send Message API] Skipping contact without contact_id: ${contact.contact_name} (id: ${contact.id})`);
        results.failed++;
        results.errors.push({
          contact: contact.contact_name,
          page: contact.page_name,
          error: "Missing contact_id"
        });
        continue;
      }

      const contactIdStr = String(contact.contact_id);
      if (sentTextToContacts.has(contactIdStr)) {
        console.warn(`[Send Message API] Duplicate prevention: Skipping ${contact.contact_name} (contact_id: ${contact.contact_id})`);
        continue;
      }

      // Attempt to lock this contact for sending
      if (contact.id) {
        try {
          const { data, error } = await supabaseServer
            .from("contacts")
            .update({ last_send_status: "sending", last_send_job_id: null, last_send_at: new Date().toISOString() })
            .eq("id", contact.id)
            .neq("last_send_status", "sent")
            .select("id")
            .limit(1);
          if (error || !data?.length) {
            console.warn(`[Send Message API] Skipping ${contact.contact_name} due to lock failure`, error?.message);
            continue;
          }
        } catch (error: any) {
          console.warn(`[Send Message API] Skipping ${contact.contact_name} due to lock exception`, error.message);
          continue;
        }
        processedContactIds.push(contact.id);
      }

      sentTextToContacts.add(contactIdStr);

      try {
        let payload: any;
        let messageType: string;

        if (params.attachment && params.attachment.url) {
          messageType = "MEDIA";
          const attachmentType = params.attachment.type || "file";
          payload = {
            recipient: { id: contact.contact_id },
            message: {
              attachment: {
                type: attachmentType,
                payload: {
                  url: params.attachment.url,
                  is_reusable: true
                }
              }
            },
            messaging_type: "MESSAGE_TAG",
            tag: params.messageTag
          };
        } else {
          messageType = "TEXT";
          const firstName = contact.contact_name?.split(" ")[0] || "there";
          const personalizedMessage = params.message.replace(/{FirstName}/g, firstName);
          payload = {
            recipient: { id: contact.contact_id },
            message: { text: personalizedMessage },
            messaging_type: "MESSAGE_TAG",
            tag: params.messageTag
          };
        }

        const response = await fetch(
          `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          }
        );

        const data = await response.json();

        if (response.ok && !data.error) {
          results.success++;
          console.log(`Sent ${messageType} to ${contact.contact_name} (${contact.contact_id})`);
          await supabaseServer
            .from("contacts")
            .update({ last_send_status: "sent", last_send_job_id: null, last_send_at: new Date().toISOString() })
            .eq("id", contact.id);
        } else {
          sentTextToContacts.delete(contactIdStr);
          results.failed++;
          const errorMsg = data.error?.message || "Unknown error";
          console.error(`Failed ${messageType} to ${contact.contact_name} (${contact.contact_id}): ${errorMsg}`);
          results.errors.push({
            contact: contact.contact_name,
            page: contact.page_name,
            error: errorMsg
          });
          await supabaseServer
            .from("contacts")
            .update({ last_send_status: "failed", last_send_job_id: null, last_send_at: new Date().toISOString() })
            .eq("id", contact.id);
        }

        await new Promise(resolve => setTimeout(resolve, Math.max(CONTACT_SEND_THROTTLE_MS, 50)));
      } catch (error: any) {
        sentTextToContacts.delete(contactIdStr);
        results.failed++;
        console.error(`Error sending to ${contact.contact_name} (${contact.contact_id}):`, error);
        results.errors.push({
          contact: contact.contact_name,
          page: contact.page_name,
          error: error.message || "Unknown error"
        });
        await supabaseServer
          .from("contacts")
          .update({ last_send_status: "failed", last_send_job_id: null, last_send_at: new Date().toISOString() })
          .eq("id", contact.id);
      }
    }
  }

  // Clear markers after the broadcast finishes
  try {
    const CHUNK = 500;
    for (let i = 0; i < processedContactIds.length; i += CHUNK) {
      const chunk = processedContactIds.slice(i, i + CHUNK);
      await supabaseServer
        .from("contacts")
        .update({ last_send_status: null, last_send_job_id: null, last_send_at: null })
        .in("id", chunk);
    }
  } catch (error) {
    console.warn("[Send Message API] Failed to clear contact send status after direct send:", (error as any)?.message);
  }

  console.log(`[Send Message API] Direct send complete: ${results.success} success, ${results.failed} failed`);
  return results;
}
