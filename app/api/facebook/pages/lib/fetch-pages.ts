type Page = { id: string; name: string; access_token?: string };

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchWithRetry(url: string, retries = 3, delay = 1000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url);
    if (response.ok) return response;

    const errorData = await response.json().catch(() => ({}));
    if ((errorData.error?.code === 4 || errorData.error?.is_transient) && i < retries - 1) {
      const wait = delay * Math.pow(2, i);
      await sleep(wait);
      continue;
    }
    return response;
  }
  throw new Error("Max retries exceeded");
}

async function fetchPaginated(url: string, allPages: Page[], limit = 10000) {
  let nextUrl: string | undefined | null = url;
  while (nextUrl && allPages.length < limit) {
    const response = await fetchWithRetry(nextUrl);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.error?.code === 4) break;
      return;
    }
    const data = await response.json();
    allPages.push(...(data.data || []));
    nextUrl = data.paging?.next;
    if (nextUrl) await sleep(200);
  }
}

export async function fetchAllPages(accessToken: string) {
  const allPages: Page[] = [];

  try {
    const initial = `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}&fields=id,name,access_token&limit=1000`;
    await fetchPaginated(initial, allPages);
  } catch (error) {
    console.error("Error fetching user pages:", error);
  }

  try {
    await sleep(500);
    const businessUrl = `https://graph.facebook.com/v18.0/me/businesses?access_token=${accessToken}&fields=id,name&limit=1000`;
    const businessRes = await fetchWithRetry(businessUrl);
    if (businessRes.ok) {
      const businessData = await businessRes.json();
      const businesses = businessData.data || [];
      for (const business of businesses) {
        await sleep(300);
        const ownedUrl = `https://graph.facebook.com/v18.0/${business.id}/owned_pages?access_token=${accessToken}&fields=id,name,access_token&limit=1000`;
        await fetchPaginated(ownedUrl, allPages);
      }
    }
  } catch (error) {
    console.error("Error fetching business pages:", error);
  }

  const uniquePages = Array.from(new Map(allPages.map(p => [p.id, p])).values());
  const pagesWithTokens = uniquePages.filter(p => p.access_token);
  return { pagesWithTokens, uniquePages };
}
