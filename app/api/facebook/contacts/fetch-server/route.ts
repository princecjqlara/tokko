import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

/**
 * Server-side contact fetching function
 * This can be called without a user session, using page access tokens from the database
 * Used by webhooks to fetch contacts for all users when a message arrives
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, pageId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    console.log(`[Server Fetch] Starting server-side fetch for user ${userId}${pageId ? `, page ${pageId}` : ''}`);

    // Get user's pages from database
    const { data: userPages, error: dbError } = await supabaseServer
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

    if (dbError || !userPages || userPages.length === 0) {
      console.error(`[Server Fetch] Error fetching pages for user ${userId}:`, dbError);
      return NextResponse.json(
        { error: "No pages found for user", details: dbError?.message },
        { status: 404 }
      );
    }

    // Filter pages if pageId is specified
    let pages = (userPages || [])
      .filter((up: any) => up.facebook_pages)
      .map((up: any) => ({
        id: up.facebook_pages.page_id,
        name: up.facebook_pages.page_name,
        access_token: up.facebook_pages.page_access_token,
      }));

    if (pageId) {
      pages = pages.filter((p: any) => p.id === pageId);
      if (pages.length === 0) {
        return NextResponse.json(
          { error: `Page ${pageId} not found for user ${userId}` },
          { status: 404 }
        );
      }
    }

    if (pages.length === 0) {
      return NextResponse.json({ error: "No pages found" }, { status: 404 });
    }

    console.log(`[Server Fetch] Found ${pages.length} page(s) for user ${userId}`);

    // Get existing contact count
    const { count: existingCount } = await supabaseServer
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    let allContacts: any[] = [];
    const globalSeenContactKeys = new Set<string>();

    // Fetch conversations from each page
    for (const page of pages) {
      if (!page.access_token) {
        console.error(`[Server Fetch] Page ${page.name} (${page.id}) has no access token, skipping`);
        continue;
      }

      try {
        console.log(`[Server Fetch] Fetching conversations for page: ${page.name} (${page.id})`);

        // Get last update time for this page to fetch only new conversations
        const { data: lastContact } = await supabaseServer
          .from("contacts")
          .select("updated_at")
          .eq("page_id", page.id)
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let conversationsUrl: string;
        if (lastContact?.updated_at) {
          const sinceTime = Math.floor((new Date(lastContact.updated_at).getTime() - 60000) / 1000);
          conversationsUrl = `https://graph.facebook.com/v18.0/${page.id}/conversations?access_token=${page.access_token}&fields=participants,updated_time,messages.limit(10){from,message,created_time}&limit=100&since=${sinceTime}`;
        } else {
          conversationsUrl = `https://graph.facebook.com/v18.0/${page.id}/conversations?access_token=${page.access_token}&fields=participants,updated_time,messages.limit(10){from,message,created_time}&limit=100`;
        }

        // Fetch conversations with pagination (limit to first page for webhook-triggered fetches)
        let allConversations: any[] = [];
        let currentUrl: string | null = conversationsUrl;
        let paginationCount = 0;
        const MAX_PAGES = 5; // Limit pagination for webhook-triggered fetches

        while (currentUrl && paginationCount < MAX_PAGES) {
          paginationCount++;
          const response: Response = await fetch(currentUrl);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`[Server Fetch] Error fetching conversations for ${page.name}:`, errorData);
            break;
          }

          const data = await response.json();
          const conversations = data.data || [];
          allConversations.push(...conversations);

          currentUrl = data.paging?.next || null;
        }

        console.log(`[Server Fetch] Found ${allConversations.length} conversations for page ${page.name}`);

        // Process conversations into contacts
        for (const conversation of allConversations) {
          const participants = conversation.participants?.data || [];
          const messages = conversation.messages?.data || [];
          const contact = participants.find((p: any) => p.id !== page.id);

          if (contact && messages.length > 0) {
            const contactKey = `${contact.id}-${page.id}`;

            if (globalSeenContactKeys.has(contactKey)) {
              continue;
            }
            globalSeenContactKeys.add(contactKey);

            const lastMessage = messages[0];
            const messageDate = new Date(lastMessage.created_time).toISOString().split('T')[0];
            const contactName = contact.name || contact.id || `User ${contact.id}`;

            allContacts.push({
              contact_id: contact.id,
              page_id: page.id,
              user_id: userId,
              contact_name: contactName,
              page_name: page.name,
              last_message: lastMessage.message || "",
              last_message_time: lastMessage.created_time,
              last_contact_message_date: messageDate,
              tags: [],
              role: "",
              avatar: contactName.substring(0, 2).toUpperCase(),
              date: messageDate,
              updated_at: new Date().toISOString()
            });
          }
        }
      } catch (pageError: any) {
        console.error(`[Server Fetch] Error processing page ${page.name}:`, pageError);
        // Continue with other pages
      }
    }

    // Save contacts to database
    if (allContacts.length > 0) {
      const { error: upsertError } = await supabaseServer
        .from("contacts")
        .upsert(allContacts, {
          onConflict: "contact_id,page_id,user_id"
        });

      if (upsertError) {
        console.error(`[Server Fetch] Error saving contacts:`, upsertError);
        return NextResponse.json(
          { error: "Failed to save contacts", details: upsertError.message },
          { status: 500 }
        );
      }

      console.log(`[Server Fetch] ✅ Saved ${allContacts.length} contact(s) for user ${userId}`);
    } else {
      console.log(`[Server Fetch] No new contacts found for user ${userId}`);
    }

    return NextResponse.json({
      success: true,
      contactsFound: allContacts.length,
      totalContacts: (existingCount || 0) + allContacts.length
    });

  } catch (error: any) {
    console.error("[Server Fetch] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}






