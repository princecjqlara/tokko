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

        // Find and cancel any running/paused/pending fetch jobs for this user
        const { data: existingJob, error: findError } = await supabaseServer
            .from("fetch_jobs")
            .select("id, status")
            .eq("user_id", userId)
            .in("status", ["running", "paused", "pending"])
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (findError && findError.code !== "PGRST116") {
            console.error("Error finding job to cancel:", findError);
            return NextResponse.json(
                { error: "Failed to find job", details: findError.message },
                { status: 500 }
            );
        }

        if (!existingJob) {
            return NextResponse.json({
                success: true,
                message: "No active fetch job to cancel",
                cancelled: false
            });
        }

        // Update job status to cancelled
        const { data: updatedJob, error: updateError } = await supabaseServer
            .from("fetch_jobs")
            .update({
                status: "cancelled",
                is_paused: false,
                updated_at: new Date().toISOString(),
                message: "Cancelled by user"
            })
            .eq("id", existingJob.id)
            .select()
            .single();

        if (updateError) {
            console.error("Error cancelling job:", updateError);
            return NextResponse.json(
                { error: "Failed to cancel job", details: updateError.message },
                { status: 500 }
            );
        }

        console.log(`[Cancel Fetch] User ${userId} cancelled fetch job ${existingJob.id}`);

        return NextResponse.json({
            success: true,
            message: "Fetch job cancelled successfully",
            cancelled: true,
            job: updatedJob
        });
    } catch (error: any) {
        console.error("Error in cancel endpoint:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error.message },
            { status: 500 }
        );
    }
}
