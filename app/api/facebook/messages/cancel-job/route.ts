import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseServer } from "@/lib/supabase-server";

// Force dynamic rendering
export const dynamic = "force-dynamic";

// POST: Cancel a running send job
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = (session.user as any).id;
        const body = await request.json();
        const { jobId } = body;

        if (!jobId) {
            return NextResponse.json({ error: "jobId is required" }, { status: 400 });
        }

        console.log(`[Cancel Job] User ${userId} requesting to cancel job ${jobId}`);

        // Fetch the job first to verify ownership
        const { data: job, error: fetchError } = await supabaseServer
            .from("send_jobs")
            .select("*")
            .eq("id", jobId)
            .single();

        if (fetchError || !job) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        // Verify ownership
        if (job.user_id !== userId) {
            return NextResponse.json({ error: "Unauthorized - job does not belong to user" }, { status: 403 });
        }

        // Check if job can be cancelled (only pending, processing, or running jobs)
        if (!["pending", "processing", "running"].includes(job.status)) {
            return NextResponse.json({
                error: `Job cannot be cancelled (status: ${job.status})`,
                status: job.status
            }, { status: 400 });
        }

        // Cancel the job by setting status to 'cancelled'
        const { data: updatedJob, error: updateError } = await supabaseServer
            .from("send_jobs")
            .update({
                status: "cancelled",
                completed_at: new Date().toISOString(),
                errors: [...(job.errors || []), {
                    error: "Job cancelled by user",
                    cancelled_at: new Date().toISOString(),
                    cancelled_by: userId
                }]
            })
            .eq("id", jobId)
            .select()
            .single();

        if (updateError) {
            console.error(`[Cancel Job] Error updating job ${jobId}:`, updateError);
            return NextResponse.json({
                error: "Failed to cancel job",
                details: updateError.message
            }, { status: 500 });
        }

        console.log(`[Cancel Job] ✅ Job ${jobId} cancelled successfully`);

        return NextResponse.json({
            success: true,
            message: "Job cancelled successfully",
            job: {
                id: updatedJob.id,
                status: updatedJob.status,
                sent_count: updatedJob.sent_count,
                failed_count: updatedJob.failed_count,
                total_count: updatedJob.total_count
            }
        });
    } catch (error: any) {
        console.error("[Cancel Job] Error:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error.message },
            { status: 500 }
        );
    }
}
