import { supabaseServer } from "@/lib/supabase-server";
import { CONTACT_FETCH_CHUNK } from "./constants";
import { chunkArray } from "./chunk";

export type ContactRecord = {
  id: number;
  contact_id: string;
  page_id: string;
  contact_name: string;
  page_name: string;
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
        .select("id, contact_id, page_id, contact_name, page_name")
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
        .select("id, contact_id, page_id, contact_name, page_name")
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

  return {
    contacts: Array.from(uniqueContacts.values()),
    contactsError
  };
}
