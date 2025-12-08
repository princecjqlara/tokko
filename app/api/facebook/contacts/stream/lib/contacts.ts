import { supabaseServer } from "@/lib/supabase-server";
import { fetchConversations } from "@/app/api/facebook/contacts/fetch-server/lib/fetch-conversations";
import { StreamContext } from "./sse";

const CONTACT_BATCH_SIZE = 100;

export async function processPageContacts(ctx: StreamContext, page: any, send: (data: any) => void) {
  const { userId } = ctx;
  if (!page.access_token) {
    send({ type: "page_error", pageName: page.name, error: "Page has no access token" });
    return;
  }

  send({ type: "page_start", pageName: page.name, currentPage: ctx.processedPagesCount + 1, totalPages: ctx.pages.length });

  let since: string | undefined;
  try {
    const { data: lastContact } = await supabaseServer
      .from("contacts")
      .select("updated_at")
      .eq("page_id", page.id)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastContact?.updated_at) {
      since = Math.floor((new Date(lastContact.updated_at).getTime() - 60000) / 1000).toString();
    }
  } catch {
    // ignore
  }

  const conversations = await fetchConversations(page, since);
  const contactsToInsert: any[] = [];
  for (const conversation of conversations) {
    const participants = conversation.participants?.data || [];
    const messages = conversation.messages?.data || [];
    const contact = participants.find((p: any) => p.id !== page.id);
    if (contact && messages.length > 0) {
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
        created_at: new Date().toISOString()
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
        ignoreDuplicates: false
      })
      .select();
    if (error) {
      send({ type: "page_error", pageName: page.name, error: error.message });
      return;
    }

    inserted += data?.length || 0;
    data?.forEach((contact: any) => {
      const contactPayload = {
        id: contact.contact_id,
        name: contact.contact_name,
        page: contact.page_name,
        pageId: contact.page_id,
        lastMessage: contact.last_message || "",
        lastMessageTime: contact.last_message_time,
        lastContactMessageDate: contact.last_contact_message_date,
        updatedTime: contact.updated_at,
        tags: contact.tags || [],
        role: contact.role || "",
        avatar: contact.avatar || (contact.contact_name || contact.contact_id || "U").substring(0, 2).toUpperCase(),
        date: contact.date || (contact.updated_at ? new Date(contact.updated_at).toISOString().split("T")[0] : null)
      };
      ctx.allContacts.push(contactPayload);
      ctx.lastSentContactCount = Math.max(ctx.lastSentContactCount, ctx.allContacts.length + ctx.existingContactCount);
      send({ type: "contact", contact: contactPayload, totalContacts: ctx.lastSentContactCount });
    });
  }

  ctx.processedPagesCount += 1;
  const finalTotal = Math.max(ctx.lastSentContactCount, ctx.allContacts.length + ctx.existingContactCount);
  send({
    type: "page_complete",
    pageName: page.name,
    contactsCount: inserted,
    totalContacts: finalTotal,
    currentPage: ctx.processedPagesCount,
    totalPages: ctx.pages.length
  });
}
