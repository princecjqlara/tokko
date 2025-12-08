import { useRef, useState } from "react";

export function useMessageFormState() {
  const [message, setMessage] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
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
    fileInputRef,
    clearAttachment
  };
}
