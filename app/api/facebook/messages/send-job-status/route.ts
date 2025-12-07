import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const logStatusEvent = (event: string, details?: Record<string, any>) => {
  if (details) {
    console.log(`[Send Job Status] ${event}`, JSON.stringify(details));
  } else {
    console.log(`[Send Job Status] ${event}`);
  }
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    logStatusEvent("GET received", { jobId, userId });

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const { data: job, error } = await supabaseServer
      .from("send_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", userId)
      .single();

    if (error || !job) {
      logStatusEvent("Job not found or fetch error", { jobId, error: error?.message });
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    logStatusEvent("Job status fetched", {
      jobId,
      status: job.status,
      sent_count: job.sent_count,
      failed_count: job.failed_count,
      total_count: job.total_count
    });

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        sent_count: job.sent_count,
        failed_count: job.failed_count,
        total_count: job.total_count,
        errors: job.errors,
        started_at: job.started_at,
        completed_at: job.completed_at,
        updated_at: job.updated_at
      }
    });
  } catch (error: any) {
    console.error("[Send Job Status] Error in send-job-status route:", {
      message: error?.message,
      stack: error?.stack
    });
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}


