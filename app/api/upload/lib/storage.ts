import { supabaseServer } from "@/lib/supabase-server";

export async function uploadFileToStorage(file: File, userId: string, messengerType: string) {
  const fileExt = file.name.split(".").pop();
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  let buffer: Buffer;
  try {
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } catch (error: any) {
    return { ok: false as const, status: 500, error: "Failed to process file", details: error.message };
  }

  let data, error;
  try {
    const result = await supabaseServer.storage
      .from("message-attachments")
      .upload(fileName, buffer, { contentType: file.type, upsert: false });
    data = result.data;
    error = result.error;
  } catch (uploadException: any) {
    return { ok: false as const, status: 500, error: "Failed to upload file to storage", details: uploadException.message };
  }

  if (error) {
    if (error.message?.includes("Bucket not found") || error.message?.includes("does not exist")) {
      return {
        ok: false as const,
        status: 500,
        error: "Storage bucket 'message-attachments' not found. Please create it in Supabase Storage settings and make it public.",
        details: error.message
      };
    }
    return { ok: false as const, status: 500, error: "Failed to upload file", details: error.message };
  }

  const { data: urlData } = supabaseServer.storage.from("message-attachments").getPublicUrl(fileName);
  if (!urlData?.publicUrl) {
    return { ok: false as const, status: 500, error: "Failed to generate public URL for uploaded file" };
  }
  if (!data?.path) {
    return { ok: false as const, status: 500, error: "Upload succeeded but file path is missing" };
  }

  return {
    ok: true as const,
    url: urlData.publicUrl,
    path: data.path,
    type: messengerType,
    mimeType: file.type
  };
}
