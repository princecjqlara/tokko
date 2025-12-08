import { PAGE_SIZE, MAX_ITERATIONS } from "./constants";
import { supabaseServer } from "@/lib/supabase-server";

export async function loadContactsFromDb(userId: string, limit?: number | null, page?: number | null) {
  const { count: totalCount, error: countError } = await supabaseServer
    .from("contacts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError) {
    console.error("Error getting contact count:", countError);
  }

  if (limit && page) {
    const offset = (page - 1) * limit;
    const { data, error } = await supabaseServer
      .from("contacts")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(error.message);
    }

    const contacts = transformContacts(data || []);
    return {
      contacts,
      totalCount: totalCount || 0,
      pagination: {
        page,
        limit,
        totalCount: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
        hasMore: offset + contacts.length < (totalCount || 0)
      }
    };
  }

  let allContacts: any[] = [];
  let from = 0;
  let hasMore = true;
  let iteration = 0;
  while (hasMore && iteration < MAX_ITERATIONS) {
    iteration++;
    const { data, error } = await supabaseServer
      .from("contacts")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) break;
    if (data && data.length > 0) {
      allContacts.push(...data);
      from += PAGE_SIZE;
      const countVal = typeof totalCount === "number" ? totalCount : null;
      hasMore = data.length === PAGE_SIZE || (countVal !== null && allContacts.length < countVal);
    } else {
      hasMore = false;
    }
  }

  return { contacts: transformContacts(allContacts), totalCount: totalCount || allContacts.length };
}

const transformContacts = (rows: any[]) =>
  rows.map((c: any) => ({
    id: c.contact_id,
    name: c.contact_name,
    page: c.page_name,
    pageId: c.page_id,
    lastMessage: c.last_message || "",
    lastMessageTime: c.last_message_time,
    lastContactMessageDate: c.last_contact_message_date,
    updatedTime: c.updated_at,
    tags: c.tags || [],
    role: c.role || "",
    avatar: c.avatar || (c.contact_name || c.contact_id || "U").substring(0, 2).toUpperCase(),
    date: c.date || (c.updated_at ? new Date(c.updated_at).toISOString().split("T")[0] : null)
  }));
