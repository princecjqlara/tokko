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

    // Get the most recent fetch job
    const { data: job, error } = await supabaseServer
      .from("fetch_jobs")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching job:", error);
      return NextResponse.json({ error: "Failed to fetch job status" }, { status: 500 });
    }

    return NextResponse.json({
      job: job || null,
      status: (job as any)?.status || "none",
    });
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
