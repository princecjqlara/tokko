import { supabaseServer } from "@/lib/supabase-server";
import { chunkArray } from "./utils";
import { ContactRecord } from "./types";

const CONTACT_FETCH_CHUNK = 200;

export async function fetchContactsForSendJob(userId: string, contactIds: (string | number)[]) {
  const contacts: ContactRecord[] = [];
  const seenContactIds = new Set<string>();

  for (let i = 0; i < contactIds.length; i += CONTACT_FETCH_CHUNK) {
    const chunk = contactIds.slice(i, i + CONTACT_FETCH_CHUNK);

    const { data: byId, error: idError } = await supabaseServer
      .from("contacts")
      .select("id, contact_id, page_id, contact_name, page_name, last_send_status, last_send_job_id, last_send_at")
      .in("id", chunk)
      .eq("user_id", userId);

    if (!idError && byId) {
      byId.forEach(c => {
        if (c.contact_id && !seenContactIds.has(c.contact_id)) {
          seenContactIds.add(c.contact_id);
          contacts.push(c);
        }
      });
    }

    const { data: byContactId, error: contactIdError } = await supabaseServer
      .from("contacts")
      .select("id, contact_id, page_id, contact_name, page_name, last_send_status, last_send_job_id, last_send_at")
      .in("contact_id", chunk)
      .eq("user_id", userId);

    if (!contactIdError && byContactId) {
      byContactId.forEach(c => {
        if (c.contact_id && !seenContactIds.has(c.contact_id)) {
          seenContactIds.add(c.contact_id);
          contacts.push(c);
        }
      });
    }
  }

  return contacts;
}
