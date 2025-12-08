import { supabaseServer } from "@/lib/supabase-server";
import { CONTACT_FETCH_CHUNK } from "./constants";

export async function deleteContacts(userId: string, contactIds: (string | number)[]) {
  let contactsToDelete: any[] = [];
  let fetchError: any = null;

  for (const chunk of chunkArray(contactIds, CONTACT_FETCH_CHUNK)) {
    const { data, error } = await supabaseServer
      .from("contacts")
      .select("id, contact_id, page_id")
      .eq("user_id", userId)
      .in("contact_id", chunk);
    if (error) {
      fetchError = error;
      break;
    }
    if (data && data.length > 0) contactsToDelete.push(...data);
  }

  if (contactsToDelete.length === 0) {
    for (const chunk of chunkArray(contactIds, CONTACT_FETCH_CHUNK)) {
      const { data, error } = await supabaseServer
        .from("contacts")
        .select("id, contact_id, page_id")
        .eq("user_id", userId)
        .in("id", chunk);
      if (error) {
        fetchError = error;
        break;
      }
      if (data) contactsToDelete.push(...data);
    }
  }

  if (fetchError) throw new Error(fetchError.message);
  if (contactsToDelete.length === 0) return { deleted: 0, deletedPages: [], deletedUserPages: [] };

  const unique = Array.from(new Map(contactsToDelete.map(c => [c.id, c])).values());
  const affectedPageIds = Array.from(new Set(unique.map((c: any) => c.page_id)));

  const contactDbIds = unique.map((c: any) => c.id);
  const batchSize = 1000;
  let totalDeleted = 0;

  for (let i = 0; i < contactDbIds.length; i += batchSize) {
    const batch = contactDbIds.slice(i, i + batchSize);
    const { data, error } = await supabaseServer.from("contacts").delete().eq("user_id", userId).in("id", batch).select();
    if (error) throw new Error(error.message);
    totalDeleted += data?.length || 0;
  }

  const { deletedPages, deletedUserPages } = await cleanupPages(userId, affectedPageIds);
  return { deleted: totalDeleted, deletedPages, deletedUserPages };
}

async function cleanupPages(userId: string, affectedPageIds: string[]) {
  const deletedPages: string[] = [];
  const deletedUserPages: string[] = [];

  for (const pageId of affectedPageIds) {
    const { count } = await supabaseServer
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("page_id", pageId);

    if (count === 0) {
      const { error: userPagesDeleteError } = await supabaseServer.from("user_pages").delete().eq("user_id", userId).eq("page_id", pageId);
      if (!userPagesDeleteError) deletedUserPages.push(pageId);

      const { count: totalPageContacts } = await supabaseServer.from("contacts").select("*", { count: "exact", head: true }).eq("page_id", pageId);
      if (totalPageContacts === 0) {
        const { error: pageDeleteError } = await supabaseServer.from("facebook_pages").delete().eq("page_id", pageId);
        if (!pageDeleteError) deletedPages.push(pageId);
      }
    }
  }

  return { deletedPages, deletedUserPages };
}

const chunkArray = <T,>(arr: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
};
