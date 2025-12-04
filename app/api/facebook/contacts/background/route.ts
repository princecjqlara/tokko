import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseServer } from "@/lib/supabase-server";

// Background job endpoint - starts contact fetching in background
// This runs independently of the client connection
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
    
    // Check if there's already a running job
    const { data: existingJob } = await supabaseServer
      .from("fetch_jobs")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["running", "paused", "pending"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();
    
    if (existingJob && existingJob.status === "running") {
      return NextResponse.json({ 
        success: true,
        message: "Background job already running",
        jobId: existingJob.id.toString(),
        status: existingJob.status
      });
    }
    
    // Create job record (insert new, don't update existing)
    const { data: job, error: jobError } = await supabaseServer
      .from("fetch_jobs")
      .insert({
        user_id: userId,
        status: "pending",
        is_paused: false,
        message: "Starting background fetch...",
        total_contacts: 0,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (jobError) {
      console.error("Error creating job:", jobError);
    }
    
    // Start background job (non-blocking)
    // This will run even if the client disconnects
    const origin = request.nextUrl.origin;
    const cookie = request.headers.get("cookie") || "";
    
    // Use a fire-and-forget approach - don't wait for response
    fetch(`${origin}/api/facebook/contacts/stream`, {
      method: "GET",
      headers: {
        Cookie: cookie,
      },
    }).catch(err => {
      console.error("Background job error:", err);
      // Update job status to failed
      supabaseServer
        .from("fetch_jobs")
        .update({
          status: "failed",
          error: err.message,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("status", "pending");
    });

    return NextResponse.json({ 
      success: true,
      message: "Background contact fetching started",
      jobId: job?.id?.toString() || `contact-fetch-${userId}-${Date.now()}`
    });
  } catch (error: any) {
    console.error("Error starting background job:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

// Get background job status
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
    
    // Get the most recent fetch job for this user
    const { data: job, error: jobError } = await supabaseServer
      .from("fetch_jobs")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();
    
    // Check if contacts exist in database
    const { count, error: countError } = await supabaseServer
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    
    if (countError) {
      console.error("Error checking contacts:", countError);
    }

    // If there's a job, return its status; otherwise return "idle"
    const status = job?.status || "idle";
    
    return NextResponse.json({
      status: status,
      totalContacts: count || 0,
      userId,
      job: job ? {
        id: job.id,
        status: job.status,
        is_paused: job.is_paused,
        message: job.message,
        total_contacts: job.total_contacts,
        current_page_name: job.current_page_name,
        current_page_number: job.current_page_number,
        total_pages: job.total_pages,
        error: job.error,
        updated_at: job.updated_at
      } : null
    });
  } catch (error: any) {
    // If no job found (single() throws error), return idle status
    if (error.code === 'PGRST116') {
      const session = await getServerSession(authOptions);
      const userId = (session?.user as any)?.id;
      
      const { count } = await supabaseServer
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      
      return NextResponse.json({
        status: "idle",
        totalContacts: count || 0,
        userId,
        job: null
      });
    }
    
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
