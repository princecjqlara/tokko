import { supabaseServer } from "@/lib/supabase-server";

type DeleteResult = {
  deletedPages: string[];
  deletedContacts: number;
  errors: { pageId: string; step: string; error: string }[];
};

export async function deleteUserPages(userId: string, pageIds: string[]): Promise<DeleteResult> {
  const errors: DeleteResult["errors"] = [];
  let deletedContacts = 0;
  const deletedPages: string[] = [];

  for (const pageId of pageIds) {
    try {
      const { data: deletedContactsData, error: contactsDeleteError } = await supabaseServer
        .from("contacts")
        .delete()
        .eq("user_id", userId)
        .eq("page_id", pageId)
        .select();

      if (contactsDeleteError) {
        errors.push({ pageId, step: "delete_contacts", error: contactsDeleteError.message });
        continue;
      }

      deletedContacts += deletedContactsData?.length || 0;

      const { error: userPagesDeleteError } = await supabaseServer
        .from("user_pages")
        .delete()
        .eq("user_id", userId)
        .eq("page_id", pageId);

      if (userPagesDeleteError) {
        errors.push({ pageId, step: "delete_user_pages", error: userPagesDeleteError.message });
        continue;
      }

      const { count: totalPageContacts, error: totalCountError } = await supabaseServer
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("page_id", pageId);

      if (totalCountError) {
        errors.push({ pageId, step: "check_remaining_contacts", error: totalCountError.message });
        continue;
      }

      if (totalPageContacts === 0) {
        const { error: pageDeleteError } = await supabaseServer.from("facebook_pages").delete().eq("page_id", pageId);
        if (pageDeleteError) {
          errors.push({ pageId, step: "delete_page", error: pageDeleteError.message });
        } else {
          deletedPages.push(pageId);
        }
      }
    } catch (error: any) {
      errors.push({ pageId, step: "unknown", error: error.message });
    }
  }

  return { deletedPages, deletedContacts, errors };
}
