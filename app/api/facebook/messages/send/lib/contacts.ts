import { supabaseServer } from "@/lib/supabase-server";
import { CONTACT_FETCH_CHUNK } from "./constants";
import { chunkArray } from "./chunk";

export type ContactRecord = {
  id: number;
  contact_id: string;
  page_id: string;
  contact_name: string;
  page_name: string;
  last_send_status?: string | null;
  last_send_job_id?: number | null;
  last_send_at?: string | null;
};

export async function fetchContactsForSend(userId: string, contactIds: (string | number)[]) {
  const contactsByDbId: ContactRecord[] = [];
  const contactsByContactId: ContactRecord[] = [];
  let contactsError: any = null;

  // Fetch by database id
  for (const chunk of chunkArray(contactIds, CONTACT_FETCH_CHUNK)) {
    try {
      const chunkQuery = await supabaseServer
        .from("contacts")
        .select("id, contact_id, page_id, contact_name, page_name, last_send_status, last_send_job_id, last_send_at")
        .in("id", chunk)
        .eq("user_id", userId);

      if (chunkQuery.error) {
        contactsError = chunkQuery.error;
        console.error("[Send Message API] Error fetching chunk by id:", chunkQuery.error);
      } else if (chunkQuery.data?.length) {
        contactsByDbId.push(...chunkQuery.data);
      }
    } catch (error: any) {
      contactsError = contactsError || error;
      console.error("[Send Message API] Error in chunk query by id:", error);
    }
  }

  // Fetch by contact_id
  for (const chunk of chunkArray(contactIds, CONTACT_FETCH_CHUNK)) {
    try {
      const chunkQuery = await supabaseServer
        .from("contacts")
        .select("id, contact_id, page_id, contact_name, page_name, last_send_status, last_send_job_id, last_send_at")
        .in("contact_id", chunk)
        .eq("user_id", userId);

      if (chunkQuery.error) {
        contactsError = chunkQuery.error;
        console.error("[Send Message API] Error fetching chunk by contact_id:", chunkQuery.error);
      } else if (chunkQuery.data?.length) {
        contactsByContactId.push(...chunkQuery.data);
      }
    } catch (error: any) {
      contactsError = contactsError || error;
      console.error("[Send Message API] Error in chunk query (contact_id):", error);
    }
  }

  // Merge and deduplicate using contact_id as unique key
  const allContacts = [...contactsByDbId, ...contactsByContactId];
  const uniqueContacts = new Map<string, ContactRecord>();

  for (const contact of allContacts) {
    if (!contact.contact_id) {
      console.warn("[Send Message API] Contact missing contact_id:", {
        id: contact.id,
        name: contact.contact_name,
        page_id: contact.page_id
      });
      const fallbackKey = `db_${contact.id}`;
      if (!uniqueContacts.has(fallbackKey)) {
        uniqueContacts.set(fallbackKey, contact);
      }
      continue;
    }

    const contactId = String(contact.contact_id);
    if (!uniqueContacts.has(contactId)) {
      uniqueContacts.set(contactId, contact);
    } else {
      console.log("[Send Message API] Skipping duplicate contact:", contact.contact_id);
    }
  }

  const merged = Array.from(uniqueContacts.values());
  const filtered = merged.filter(c => c.last_send_status !== "sent");
  const skipped = merged.length - filtered.length;
  if (skipped > 0) {
    console.warn(`[Send Message API] Skipped ${skipped} contact(s) already marked sent`);
  }

  return {
    contacts: filtered,
    contactsError
  };
}
