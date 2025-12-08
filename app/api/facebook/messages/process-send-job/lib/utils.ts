import { supabaseServer } from "@/lib/supabase-server";

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export function coerceContactIds(raw: any): (string | number)[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((value: any) => {
    if (value && typeof value === "object") {
      return "id" in value ? (value as any).id : "contact_id" in value ? (value as any).contact_id : value;
    }
    return value;
  });
}

export async function isJobCancelled(jobId: number): Promise<boolean> {
  try {
    const { data: job } = await supabaseServer
      .from("send_jobs")
      .select("status")
      .eq("id", jobId)
      .single();

    return job?.status === "cancelled";
  } catch (error) {
    console.error(`[Process Send Job] Error checking cancellation for job ${jobId}:`, error);
    return false;
  }
}
