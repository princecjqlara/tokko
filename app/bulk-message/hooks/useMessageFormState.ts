import { useRef, useState } from "react";

export type MessageTag = "ACCOUNT_UPDATE" | "CONFIRMED_EVENT_UPDATE" | "POST_PURCHASE_UPDATE" | "HUMAN_AGENT";

export function useMessageFormState() {
  const [message, setMessage] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [messageTag, setMessageTag] = useState<MessageTag>("ACCOUNT_UPDATE");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const clearAttachment = () => {
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return {
    message,
    setMessage,
    scheduleDate,
    setScheduleDate,
    attachedFile,
    setAttachedFile,
    messageTag,
    setMessageTag,
    fileInputRef,
    clearAttachment
  };
}
