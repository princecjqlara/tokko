import { supabaseServer } from "@/lib/supabase-server";
import { ContactRecord, PageSendResult } from "./types";
import { isJobCancelled, sleep } from "./utils";
import { MESSAGE_SEND_THROTTLE_MS } from "./constants";
import { sendMessageToContact } from "./send-contact";

type Params = {
  pageId: string;
  contacts: ContactRecord[];
  message: string;
  attachment: any;
  userAccessToken: string | null;
  sentContactIds?: Set<string>;
  jobId?: number;
};

export async function sendMessagesForPage(params: Params): Promise<PageSendResult> {
  const { pageId, contacts, message, attachment, userAccessToken, sentContactIds, jobId } = params;

  const { data: pageData, error: pageError } = await supabaseServer
    .from("facebook_pages")
    .select("page_id, page_access_token, page_name")
    .eq("page_id", pageId)
    .single();

  if (pageError || !pageData?.page_access_token) {
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
            await supabaseServer.from("facebook_pages").upsert(
              {
                page_id: foundPage.id,
                page_name: foundPage.name,
                page_access_token: foundPage.access_token,
                updated_at: new Date().toISOString()
              },
              { onConflict: "page_id" }
            );

            const retryResult = await supabaseServer
              .from("facebook_pages")
              .select("page_id, page_access_token, page_name")
              .eq("page_id", pageId)
              .single();

            if (!retryResult.error && retryResult.data) {
              return await sendMessagesForPage({ ...params });
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
  const localSentIds = sentContactIds || new Set<string>();

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];

    if (localSentIds.has(contact.contact_id)) {
      continue;
    }

    if (jobId !== undefined && i % 10 === 0) {
      const cancelled = await isJobCancelled(jobId);
      if (cancelled) {
        return { success, failed, errors, cancelled: true };
      }
    }

    if (localSentIds.has(contact.contact_id)) {
      continue;
    }

    localSentIds.add(contact.contact_id);
    if (sentContactIds) {
      sentContactIds.add(contact.contact_id);
    }

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
      if (!errorMsg.includes("DUPLICATE") && !errorMsg.includes("already sent")) {
        localSentIds.delete(contact.contact_id);
        if (sentContactIds) sentContactIds.delete(contact.contact_id);
      }
    }

    await sleep(MESSAGE_SEND_THROTTLE_MS);
  }

  if (sentContactIds) {
    localSentIds.forEach(id => sentContactIds.add(id));
  }

  return { success, failed, errors };
}
