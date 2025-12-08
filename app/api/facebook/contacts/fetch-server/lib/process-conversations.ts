import { supabaseServer } from "@/lib/supabase-server";

const CONTACT_BATCH_SIZE = 100;

export async function processConversations(userId: string, page: any, conversations: any[], existingCount: number) {
  const seenKeys = new Set<string>();
  const contactsToInsert: any[] = [];

  for (const conversation of conversations) {
    const participants = conversation.participants?.data || [];
    const messages = conversation.messages?.data || [];
    const contact = participants.find((p: any) => p.id !== page.id);

    if (contact && messages.length > 0) {
      const contactKey = `${contact.id}-${page.id}`;
      if (seenKeys.has(contactKey)) continue;
      seenKeys.add(contactKey);

      const lastMessage = messages[0];
      contactsToInsert.push({
        user_id: userId,
        contact_id: contact.id,
        contact_name: contact.name || contact.id,
        page_id: page.id,
        page_name: page.name,
        last_message: lastMessage?.message || "",
        last_message_time: lastMessage?.created_time || conversation.updated_time,
        last_contact_message_date: lastMessage?.created_time?.split("T")[0],
        updated_at: lastMessage?.created_time || conversation.updated_time,
        created_at: new Date().toISOString(),
      });
    }
  }

  let inserted = 0;
  for (let i = 0; i < contactsToInsert.length; i += CONTACT_BATCH_SIZE) {
    const chunk = contactsToInsert.slice(i, i + CONTACT_BATCH_SIZE);
    const { data, error } = await supabaseServer
      .from("contacts")
      .upsert(chunk, {
        onConflict: "user_id,contact_id,page_id",
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error(`[Server Fetch] Error inserting contacts batch ${i / CONTACT_BATCH_SIZE + 1}:`, error);
      continue;
    }
    inserted += data?.length || 0;
  }

  const totalContacts = existingCount + inserted;
  return { inserted, totalContacts };
}
