import { supabaseServer } from "@/lib/supabase-server";

export async function loadPages(userId: string, accessToken: string, filterPageId?: string) {
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

  let pages: any[] = [];

  if (!error && userPages && userPages.length > 0) {
    pages = userPages
      .filter((up: any) => up.facebook_pages)
      .map((up: any) => ({
        id: up.facebook_pages.page_id,
        name: up.facebook_pages.page_name,
        access_token: up.facebook_pages.page_access_token
      }));
  } else {
    const resp = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}&fields=id,name,access_token&limit=1000`);
    if (resp.ok) {
      const data = await resp.json();
      pages = data.data || [];
    }
  }

  if (filterPageId) {
    pages = pages.filter((p: any) => p.id === filterPageId);
  }

  return pages;
}
