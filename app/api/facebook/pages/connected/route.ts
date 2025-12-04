import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !(session as any).accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // Fetch connected page IDs for this user from database
    const { data: userPages, error } = await supabaseServer
      .from("user_pages")
      .select("page_id")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching connected pages:", error);
      return NextResponse.json(
        { error: "Failed to fetch connected pages", details: error.message },
        { status: 500 }
      );
    }

    const pageIds = (userPages || []).map((up: any) => up.page_id);

    return NextResponse.json({ pageIds });
  } catch (error: any) {
    console.error("Error in connected pages API:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

