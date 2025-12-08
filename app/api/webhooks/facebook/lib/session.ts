import { supabaseServer } from "@/lib/supabase-server";

export async function getUserPages(userId: string, pageId?: string) {
  const { data: userPages, error } = await supabaseServer
    .from("user_pages")
    .select(`
      page_id,
      facebook_pages!inner (
        page_id,
        page_name,
        page_access_token
      )
    `)
    .eq("user_id", userId);

  if (error || !userPages || userPages.length === 0) {
    return { ok: false as const, status: 404, error: error?.message || "No pages found for user" };
  }

  let pages = (userPages || [])
    .filter((up: any) => up.facebook_pages)
    .map((up: any) => ({
      id: up.facebook_pages.page_id,
      name: up.facebook_pages.page_name,
      access_token: up.facebook_pages.page_access_token
    }));

  if (pageId) {
    pages = pages.filter((p: any) => p.id === pageId);
    if (pages.length === 0) {
      return { ok: false as const, status: 404, error: `Page ${pageId} not found for user ${userId}` };
    }
  }

  return { ok: true as const, pages };
}
