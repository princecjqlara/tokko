import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !(session as any).accessToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { pageIds, action } = body;

    if (!Array.isArray(pageIds)) {
      return NextResponse.json(
        { error: "pageIds must be an array" },
        { status: 400 }
      );
    }

    if (action === "connect") {
      // Connect pages - add user-page relationships
      if (pageIds.length === 0) {
        return NextResponse.json(
          { error: "At least one page ID is required" },
          { status: 400 }
        );
      }

      // Insert user-page relationships
      const userPageRelations = pageIds.map((pageId: string) => ({
        user_id: userId,
        page_id: pageId,
        connected_at: new Date().toISOString(),
      }));

      const { error: insertError } = await supabaseServer
        .from("user_pages")
        .upsert(userPageRelations, {
          onConflict: "user_id,page_id",
          ignoreDuplicates: false,
        });

      if (insertError) {
        console.error("Error connecting pages:", insertError);
        return NextResponse.json(
          { error: "Failed to connect pages", details: insertError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Successfully connected ${pageIds.length} page(s)`,
        connectedCount: pageIds.length,
      });
    } else if (action === "disconnect") {
      // Disconnect pages - remove user-page relationships
      if (pageIds.length === 0) {
        return NextResponse.json(
          { error: "At least one page ID is required" },
          { status: 400 }
        );
      }

      const { error: deleteError } = await supabaseServer
        .from("user_pages")
        .delete()
        .eq("user_id", userId)
        .in("page_id", pageIds);

      if (deleteError) {
        console.error("Error disconnecting pages:", deleteError);
        return NextResponse.json(
          { error: "Failed to disconnect pages", details: deleteError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Successfully disconnected ${pageIds.length} page(s)`,
        disconnectedCount: pageIds.length,
      });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'connect' or 'disconnect'" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Error in pages connect endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

