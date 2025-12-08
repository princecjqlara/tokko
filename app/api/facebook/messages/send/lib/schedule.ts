import { supabaseServer } from "@/lib/supabase-server";
import { ContactRecord } from "./contacts";

type ScheduleParams = {
  userId: string;
  contacts: ContactRecord[];
  message: string;
  attachment: any;
  scheduleDate: string;
};

export async function scheduleMessageSend(params: ScheduleParams) {
  const scheduledDate = new Date(params.scheduleDate);
  const now = new Date();

  if (scheduledDate <= now) {
    return { error: "Scheduled date must be in the future", status: 400 };
  }

  const uniqueContactIdsForSchedule = params.contacts.map(c => c.contact_id || c.id);

  const { data: scheduledMessage, error: scheduleError } = await supabaseServer
    .from("scheduled_messages")
    .insert({
      user_id: params.userId,
      contact_ids: uniqueContactIdsForSchedule,
      message: params.message.trim(),
      attachment: params.attachment || null,
      scheduled_for: scheduledDate.toISOString(),
      status: "pending"
    })
    .select()
    .single();

  if (scheduleError) {
    console.error("[Send Message API] Error scheduling message:", scheduleError);
    return { error: "Failed to schedule message", details: scheduleError.message, status: 500 };
  }

  return {
    scheduledMessage,
    result: {
      success: true,
      results: {
        total: params.contacts.length,
        sent: 0,
        failed: 0,
        errors: [],
        scheduled: true,
        scheduledMessageId: scheduledMessage.id,
        scheduledFor: scheduledDate.toISOString()
      }
    }
  };
}
