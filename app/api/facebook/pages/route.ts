import { NextRequest, NextResponse } from "next/server";
import { requirePageSession } from "./lib/session";
import { fetchAllPages } from "./lib/fetch-pages";
import { storePages } from "./lib/store-pages";
import { deleteUserPages } from "./lib/delete-pages";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePageSession();
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const { pagesWithTokens, uniquePages } = await fetchAllPages(session.accessToken);
    await storePages(session.userId, pagesWithTokens, uniquePages);

    const responsePages = pagesWithTokens;
    return NextResponse.json({ pages: responsePages });
  } catch (error: any) {
    const isRateLimit = error.message?.includes("rate limit") || error.code === 4;
    const status = isRateLimit ? 429 : 500;
    const body = isRateLimit
      ? {
          error: "Facebook API rate limit reached",
          details: "Please wait a few minutes and try again. Facebook limits the number of API requests per hour.",
          isTransient: true,
          retryAfter: 3600
        }
      : { error: "Internal server error", details: error.message };
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requirePageSession();
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const body = await request.json();
    const pageIds = body.pageIds;
    if (!pageIds || !Array.isArray(pageIds) || pageIds.length === 0) {
      return NextResponse.json({ error: "pageIds must be a non-empty array" }, { status: 400 });
    }

    const { deletedPages, deletedContacts, errors } = await deleteUserPages(session.userId, pageIds);
    if (errors.length === pageIds.length) {
      return NextResponse.json({ error: "Failed to delete pages", errors }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deletedPages: deletedPages.length,
      deletedContacts,
      requestedCount: pageIds.length,
      deletedPageIds: deletedPages,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
