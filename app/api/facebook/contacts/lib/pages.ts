import { supabaseServer } from "@/lib/supabase-server";

export async function loadUserPages(userId: string, accessToken: string) {
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

  if (!error && userPages && userPages.length > 0) {
    return (userPages || [])
      .filter((up: any) => up.facebook_pages)
      .map((up: any) => ({
        id: up.facebook_pages.page_id,
        name: up.facebook_pages.page_name,
        access_token: up.facebook_pages.page_access_token
      }));
  }

  const response = await fetch(
    `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}&fields=id,name,access_token&limit=1000`
  );
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Failed to fetch pages");
  }
  const data = await response.json();
  return data.data || [];
}
