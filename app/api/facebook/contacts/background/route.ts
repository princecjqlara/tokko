import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseServer } from "@/lib/supabase-server";

// GET: Check if there's a pending background fetch job
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    try {
      // Get the most recent fetch job (prioritize pending/running jobs)
      const { data: activeJob, error: activeError } = await supabaseServer
        .from("fetch_jobs")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["pending", "running", "paused"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // If no active job, get the most recent job (including completed/failed)
      let job = activeJob;
      if (!job) {
        const { data: recentJob, error: recentError } = await supabaseServer
          .from("fetch_jobs")
          .select("*")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (recentError && recentError.code !== "PGRST116") {
          console.error("Error fetching recent job:", recentError);
          throw recentError;
        } else {
          job = recentJob;
        }
      }

      if (activeError && activeError.code !== "PGRST116" && !job) {
        console.error("Error fetching active job:", activeError);
        throw activeError;
      }

      const jobStatus = (job as any)?.status || "none";
      
      // Log for debugging if there's a pending job
      if (jobStatus === "pending") {
        console.log(`[Background API] Found pending job for user ${userId}:`, {
          jobId: (job as any)?.id,
          message: (job as any)?.message,
          pageName: (job as any)?.current_page_name
        });
      }

      return NextResponse.json({
        job: job || null,
        status: jobStatus,
        hasPendingJob: jobStatus === "pending",
      });
    } catch (dbError: any) {
      console.error("Database error in background fetch GET:", dbError);
      // Return a safe response even if database query fails
      return NextResponse.json({
        job: null,
        status: "none",
        hasPendingJob: false,
        error: "Database query failed"
      }, { status: 200 }); // Return 200 to prevent frontend from breaking
    }
  } catch (error: any) {
    console.error("Error in background fetch GET:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

// POST: Start a background fetch job
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // Check if there's already a running or pending job
    const { data: existingJob } = await supabaseServer
      .from("fetch_jobs")
      .select("id, status, is_paused")
      .eq("user_id", userId)
      .in("status", ["running", "pending", "paused"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const job = existingJob as any;
    if (job) {
      if (job.status === "paused") {
        // Resume the paused job
        await supabaseServer
          .from("fetch_jobs")
          .update({
            status: "running",
            is_paused: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        
        return NextResponse.json({
          success: true,
          message: "Resumed existing job",
          jobId: job.id,
        });
      } else {
        return NextResponse.json({
          success: false,
          message: "Job already running or pending",
          jobId: job.id,
        });
      }
    }

    // Get current contact count
    const { count } = await supabaseServer
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    // Create a new pending job
    const { data: newJob, error } = await supabaseServer
      .from("fetch_jobs")
      .insert({
        user_id: userId,
        status: "pending",
        is_paused: false,
        message: "Background fetch initiated",
        total_contacts: count || 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating fetch job:", error);
      return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Background fetch job created",
      jobId: newJob.id,
    });
  } catch (error: any) {
    console.error("Error in background fetch POST:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
