const MAX_PAGES = 5;

export async function fetchConversations(page: any, since?: string) {
  let conversationsUrl = `https://graph.facebook.com/v18.0/${page.id}/conversations?access_token=${page.access_token}&fields=participants,updated_time,messages.limit(10){from,message,created_time}&limit=100`;
  if (since) conversationsUrl += `&since=${since}`;

  const allConversations: any[] = [];
  let currentUrl: string | null = conversationsUrl;
  let paginationCount = 0;

  while (currentUrl && paginationCount < MAX_PAGES) {
    paginationCount++;
    const response: Response = await fetch(currentUrl);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[Server Fetch] Error fetching conversations for ${page.name}:`, errorData);
      break;
    }
    const data = await response.json();
    allConversations.push(...(data.data || []));
    currentUrl = data.paging?.next || null;
  }

  return allConversations;
}
