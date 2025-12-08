import { supabaseServer } from "@/lib/supabase-server";
import { MESSAGE_SEND_THROTTLE_MS } from "./constants";
import { sendMessageToContact } from "./send-contact";
import { ContactRecord } from "./types";
import { chunkArray, sleep } from "./utils";

export async function sendMessagesForPage(pageId: string, contacts: ContactRecord[], message: string, attachment: any) {
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
      const sendResult = await sendMessageToContact(pageData.page_access_token, contact, message, attachment);

      if (sendResult.success) {
        success++;
      } else {
        failed++;
        const errorMsg = sendResult.error || "Unknown error";
        errors.push({
          contact: contact.contact_name,
          page: contact.page_name,
          error: errorMsg
        });
      }

      await sleep(MESSAGE_SEND_THROTTLE_MS);
    }
  }

  return { success, failed, errors };
}
