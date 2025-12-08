import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseServer } from "@/lib/supabase-server";
import { MAX_JOBS_PER_RUN } from "./lib/constants";
import { logEvent, logError } from "./lib/logging";
import { processSendJob } from "./lib/process";
import { SendJobRecord } from "./lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // keep in sync with ./lib/constants

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await request.json();
    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const userId = (session.user as any).id;
    const userAccessToken = (session as any).accessToken || null;

    const { data: sendJob, error } = await supabaseServer
      .from("send_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !sendJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (!["pending", "processing", "running"].includes(sendJob.status)) {
      return NextResponse.json({ message: "Job already processed", status: sendJob.status });
    }

    await processSendJob({ job: sendJob as SendJobRecord, userAccessToken });
    return NextResponse.json({ success: true, message: "Job processed" });
  } catch (error: any) {
    logError("Fatal error in POST handler", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    logEvent("GET cron/trigger received");

    const authHeader = request.headers.get("authorization");
    const vercelCronHeader = request.headers.get("x-vercel-cron");
    const vercelSignature = request.headers.get("x-vercel-signature");
    const userAgent = request.headers.get("user-agent") || "";

    const hasVercelHeaders = vercelCronHeader === "1" || vercelCronHeader !== null || vercelSignature !== null;
    const hasVercelUserAgent =
      userAgent.toLowerCase().includes("vercel") ||
      userAgent.toLowerCase().includes("cron") ||
      userAgent.toLowerCase().includes("node-fetch") ||
      userAgent === "";

    const isVercelCron = hasVercelHeaders || (hasVercelUserAgent && !authHeader);
    const session = await getServerSession(authOptions);
    if (!isVercelCron && !session) {
      logEvent("GET unauthorized", { isVercelCron, hasSession: !!session });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staleCutoff = new Date(Date.now() - 120000).toISOString();
    let query = supabaseServer
      .from("send_jobs")
      .select("*")
      .or(
        `status.eq.pending,status.eq.failed,and(status.eq.running,updated_at.lte.${staleCutoff}),and(status.eq.processing,updated_at.lte.${staleCutoff})`
      )
      .order("started_at", { ascending: true })
      .limit(MAX_JOBS_PER_RUN);

    if (!isVercelCron && session) {
      const userId = (session.user as any).id;
      query = query.eq("user_id", userId);
    }

    const { data: pendingJobs, error: pendingError } = await query;
    if (pendingError) {
      logError("Error fetching pending send jobs", pendingError);
      return NextResponse.json({ error: "Failed to fetch jobs", details: pendingError.message }, { status: 500 });
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return NextResponse.json({ message: "No pending jobs", processed: 0 });
    }

    logEvent("Jobs fetched for processing", {
      count: pendingJobs.length,
      jobIds: pendingJobs.map((j: any) => j.id),
      statuses: pendingJobs.map((j: any) => j.status)
    });

    let processed = 0;
    for (const job of pendingJobs) {
      const userAccessToken = session ? ((session as any).accessToken || null) : null;
      await processSendJob({ job: job as SendJobRecord, userAccessToken });
      processed++;
    }

    return NextResponse.json({ message: `Processed ${processed} job(s)`, processed });
  } catch (error: any) {
    logError("Fatal error in GET handler", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
