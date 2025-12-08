import { supabaseServer } from "@/lib/supabase-server";
import { CONTACT_FETCH_CHUNK } from "./constants";
import { ContactRecord } from "./types";
import { chunkArray, normalizeContactIds } from "./utils";

export async function fetchContactsForScheduledMessage(userId: string, contactIds: (string | number)[]) {
  if (!contactIds.length) {
    throw new Error("No contact ids were stored with this scheduled message");
  }

  const normalized = normalizeContactIds(contactIds);
  const contacts: ContactRecord[] = [];
  const remainingByDbId = new Set(normalized.dbIds);
  const remainingByContactId = new Set(normalized.contactIds);

  if (normalized.dbIds.length > 0) {
    for (const chunk of chunkArray([...normalized.dbIds], CONTACT_FETCH_CHUNK)) {
      const { data, error } = await supabaseServer
        .from("contacts")
        .select("id, contact_id, page_id, contact_name, page_name, last_send_status, last_send_job_id, last_send_at")
        .in("id", chunk)
        .eq("user_id", userId);

      if (error) throw new Error(`Failed to fetch contacts by id: ${error.message}`);

      if (data?.length) {
        contacts.push(...(data as ContactRecord[]));
        data.forEach((row: any) => {
          remainingByDbId.delete(row.id);
          remainingByContactId.delete(row.contact_id);
        });
      }
    }
  }

  if (remainingByContactId.size > 0) {
    for (const chunk of chunkArray([...remainingByContactId], CONTACT_FETCH_CHUNK)) {
      const { data, error } = await supabaseServer
        .from("contacts")
        .select("id, contact_id, page_id, contact_name, page_name, last_send_status, last_send_job_id, last_send_at")
        .in("contact_id", chunk)
        .eq("user_id", userId);

      if (error) throw new Error(`Failed to fetch contacts by contact_id: ${error.message}`);

      if (data?.length) {
        contacts.push(...(data as ContactRecord[]));
        data.forEach((row: any) => {
          remainingByContactId.delete(row.contact_id);
          remainingByDbId.delete(row.id);
        });
      }
    }
  }

  if (!contacts.length) {
    throw new Error("No contacts found for scheduled message");
  }

  const filtered = contacts.filter(c => c.last_send_status !== "sent");
  const skipped = contacts.length - filtered.length;
  if (skipped > 0) {
    console.warn(`[Process Scheduled] Skipped ${skipped} contact(s) already marked sent`);
  }

  return filtered;
}
