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
    const { isPaused } = body;

    if (typeof isPaused !== "boolean") {
      return NextResponse.json(
        { error: "isPaused must be a boolean" },
        { status: 400 }
      );
    }

    // First, try to find existing running/paused job
    const { data: existingJob } = await supabaseServer
      .from("fetch_jobs")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["running", "paused"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    let data, error;
    
    if (existingJob) {
      // Update existing job
      const result = await supabaseServer
        .from("fetch_jobs")
        .update({
          is_paused: isPaused,
          status: isPaused ? "paused" : "running",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingJob.id)
        .select()
        .single();
      data = result.data;
      error = result.error;
    } else {
      // Create new job
      const result = await supabaseServer
        .from("fetch_jobs")
        .insert({
          user_id: userId,
          is_paused: isPaused,
          status: isPaused ? "paused" : "running",
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error("Error updating pause state:", error);
      return NextResponse.json(
        { error: "Failed to update pause state", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      isPaused,
      job: data
    });
  } catch (error: any) {
    console.error("Error in pause endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !(session as any).accessToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;

    // Get current job status
    const { data, error } = await supabaseServer
      .from("fetch_jobs")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["running", "paused", "pending"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") { // PGRST116 = no rows returned
      console.error("Error getting job status:", error);
      return NextResponse.json(
        { error: "Failed to get job status", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      job: data || null,
      isPaused: data?.is_paused || false,
      status: data?.status || "none"
    });
  } catch (error: any) {
    console.error("Error in pause GET endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

