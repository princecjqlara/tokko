const VALID_MEDIA_TYPES = [
  "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
  "video/mp4", "video/quicktime", "video/x-msvideo", "video/x-ms-wmv", "video/webm",
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"
];

export function validateFile(file: File | null): { ok: boolean; error?: string; messengerType?: string } {
  if (!file || !(file instanceof File)) {
    return { ok: false, error: "Invalid file object provided" };
  }

  const maxSize = 25 * 1024 * 1024;
  if (file.size > maxSize) {
    return { ok: false, error: "File size exceeds 25MB limit" };
  }

  if (!VALID_MEDIA_TYPES.includes(file.type)) {
    return { ok: false, error: "Unsupported file type. Please use images, videos, audio, or documents (PDF, DOC, XLS, PPT)." };
  }

  let messengerType = "file";
  if (file.type.startsWith("image/")) messengerType = "image";
  else if (file.type.startsWith("video/")) messengerType = "video";
  else if (file.type.startsWith("audio/")) messengerType = "audio";

  return { ok: true, messengerType };
}
