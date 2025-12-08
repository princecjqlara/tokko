import { supabaseServer } from "@/lib/supabase-server";

type Page = { id: string; name: string; access_token?: string };

export async function storePages(userId: string, pagesWithTokens: Page[], uniquePages: Page[]) {
  if (pagesWithTokens.length === 0) return;

  const pagesToUpsert = pagesWithTokens.map(page => ({
    page_id: page.id,
    page_name: page.name,
    page_access_token: page.access_token,
    updated_at: new Date().toISOString()
  }));

  const pagesWithoutTokens = uniquePages.filter(page => !page.access_token);
  if (pagesWithoutTokens.length > 0) {
    console.warn(`Skipping ${pagesWithoutTokens.length} pages without access tokens:`, pagesWithoutTokens.map(p => p.name || p.id).join(", "));
  }

  try {
    const { data: insertedPages, error: dbError } = await supabaseServer
      .from("facebook_pages")
      .upsert(pagesToUpsert, { onConflict: "page_id", ignoreDuplicates: false })
      .select();

    if (dbError) {
      console.error("Error storing pages in database:", dbError);
      return;
    }

    const storedIds = insertedPages?.map(p => p.page_id) || pagesToUpsert.map(p => p.page_id);
    const relations = pagesWithTokens
      .filter(page => storedIds.includes(page.id))
      .map(page => ({ user_id: userId, page_id: page.id, connected_at: new Date().toISOString() }));

    if (relations.length > 0) {
      const { error: relationError } = await supabaseServer
        .from("user_pages")
        .upsert(relations, { onConflict: "user_id,page_id", ignoreDuplicates: false });

      if (relationError) {
        console.error("Error storing user-page relations:", relationError);
      } else {
        console.log(`Automatically connected ${relations.length} pages for user ${userId}`);
      }
    }
  } catch (error) {
    console.error("Database error:", error);
  }
}
