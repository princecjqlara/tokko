import { supabaseServer } from "@/lib/supabase-server";

const CONTACT_BATCH_SIZE = 100;

export async function processConversations(userId: string, page: any, conversations: any[], globalSeen: Set<string>) {
  const contactsToInsert: any[] = [];

  for (const conversation of conversations) {
    const participants = conversation.participants?.data || [];
    const messages = conversation.messages?.data || [];
    const contact = participants.find((p: any) => p.id !== page.id);

    if (contact && messages.length > 0) {
      const key = `${contact.id}-${page.id}`;
      if (globalSeen.has(key)) continue;
      globalSeen.add(key);

      const lastMessage = messages[0];
      const messageDate = new Date(lastMessage.created_time).toISOString().split("T")[0];
      const contactName = contact.name || contact.id || `User ${contact.id}`;

      contactsToInsert.push({
        contact_id: contact.id,
        page_id: page.id,
        user_id: userId,
        contact_name: contactName,
        page_name: page.name,
        last_message: lastMessage.message || "",
        last_message_time: lastMessage.created_time,
        last_contact_message_date: messageDate,
        tags: [],
        role: "",
        avatar: contactName.substring(0, 2).toUpperCase(),
        date: messageDate,
        updated_at: new Date().toISOString()
      });
    }
  }

  let inserted = 0;
  for (let i = 0; i < contactsToInsert.length; i += CONTACT_BATCH_SIZE) {
    const chunk = contactsToInsert.slice(i, i + CONTACT_BATCH_SIZE);
    const { data, error } = await supabaseServer
      .from("contacts")
      .upsert(chunk, { onConflict: "contact_id,page_id,user_id" })
      .select();
    if (error) {
      console.error(`[Server Fetch] Error saving contacts batch ${i / CONTACT_BATCH_SIZE + 1}:`, error);
      continue;
    }
    inserted += data?.length || 0;
  }

  return inserted;
}
