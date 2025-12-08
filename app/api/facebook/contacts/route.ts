import { NextRequest, NextResponse } from "next/server";
import { requireContactsSession } from "./lib/session";
import { loadContactsFromDb } from "./lib/pagination";
import { loadUserPages } from "./lib/pages";
import { deleteContacts } from "./lib/delete-contacts";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireContactsSession();
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });
    const { userId, accessToken } = session;

    const pageId = request.nextUrl.searchParams.get("pageId");
    const fromDatabase = request.nextUrl.searchParams.get("fromDatabase") !== "false";
    const paginationLimit = request.nextUrl.searchParams.get("limit");
    const paginationPage = request.nextUrl.searchParams.get("page");
    const usePagination = paginationLimit && paginationPage;
    const limit = usePagination ? Math.min(parseInt(paginationLimit || "0") || 1000, 5000) : null;
    const page = usePagination ? Math.max(parseInt(paginationPage || "1") || 1, 1) : null;

    if (fromDatabase && !pageId) {
      try {
        const result = await loadContactsFromDb(userId, limit, page);
        return NextResponse.json({ contacts: result.contacts, fromDatabase: true, pagination: result.pagination, totalCount: result.totalCount, expectedCount: result.totalCount });
      } catch {
        // fall through to API fetch
      }
    }

    const pages = pageId ? await loadUserPages(userId, accessToken) : await loadUserPages(userId, accessToken);
    if (!pages || pages.length === 0) return NextResponse.json({ contacts: [] });

    if (!pageId) {
      return NextResponse.json({
        contacts: [],
        debug: {
          pagesProcessed: pages.length,
          totalPages: pages.length,
          totalContacts: 0,
          pagesWithContacts: 0,
          pagesWithErrors: 0,
          pagesWithNoToken: 0,
          pagesWithNoConversations: 0,
          permissionErrors: 0,
          tokenErrors: 0,
          pageNames: pages.map((p: any) => p.name),
          errors: []
        }
      });
    }

    const pageMatch = pages.find((p: any) => p.id === pageId);
    if (!pageMatch) return NextResponse.json({ error: "Page not found" }, { status: 404 });

    const conversationsResponse = await fetch(
      `https://graph.facebook.com/v18.0/${pageMatch.id}/conversations?access_token=${pageMatch.access_token}&fields=participants,updated_time,messages.limit(1){from,message,created_time}`
    );
    if (!conversationsResponse.ok) {
      const errorData = await conversationsResponse.json();
      return NextResponse.json({ error: "Failed to fetch conversations", details: errorData }, { status: conversationsResponse.status });
    }
    const conversationsData = await conversationsResponse.json();
    const conversations = conversationsData.data || [];
    const contacts: any[] = [];
    for (const conversation of conversations) {
      const participants = conversation.participants?.data || [];
      const messages = conversation.messages?.data || [];
      const contact = participants.find((p: any) => p.id !== pageMatch.id);
      if (contact && messages.length > 0) {
        const lastMessage = messages[0];
        contacts.push({
          id: contact.id,
          name: contact.name || `User ${contact.id}`,
          page: pageMatch.name,
          pageId: pageMatch.id,
          lastMessage: lastMessage.message,
          lastMessageTime: lastMessage.created_time,
          updatedTime: conversation.updated_time,
          tags: [],
          role: "",
          avatar: contact.id.substring(0, 2).toUpperCase(),
          date: new Date(conversation.updated_time).toISOString().split("T")[0]
        });
      }
    }
    return NextResponse.json({ contacts });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireContactsSession();
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const body = await request.json();
    const contactIds = body.contactIds;
    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ error: "contactIds must be a non-empty array" }, { status: 400 });
    }

    const result = await deleteContacts(session.userId, contactIds);
    return NextResponse.json({
      success: true,
      deletedCount: result.deleted,
      requestedCount: contactIds.length,
      deletedPages: result.deletedPages.length,
      deletedUserPages: result.deletedUserPages.length,
      deletedPageIds: result.deletedPages
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
