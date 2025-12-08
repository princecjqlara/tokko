import { useRef, useState } from "react";

type Attachment = { url: string; type?: string } | null;

type UseSendBroadcastParams = {
  onStart?: () => void;
  onFinish?: (success: boolean) => void;
  onSuccess?: (sent: number, failed: number) => void;
  onBackground?: (jobId: number, total: number) => void;
  onScheduled?: (notice: { id: number; scheduledFor: string; total: number }) => void;
  onError?: (message: string) => void;
};

export function useSendBroadcast({ onStart, onFinish, onSuccess, onBackground, onScheduled, onError }: UseSendBroadcastParams = {}) {
  const [activeSends, setActiveSends] = useState(0);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [scheduledNotice, setScheduledNotice] = useState<{ id: number; scheduledFor: string; total: number } | null>(null);
  const [isCancellingSchedule, setIsCancellingSchedule] = useState(false);
  const sendAbortControllerRef = useRef<AbortController | null>(null);
  const isSendingRef = useRef(false);
  const lastSendRequestIdRef = useRef<string | null>(null);

  const startSend = () => {
    isSendingRef.current = true;
    sendAbortControllerRef.current = new AbortController();
    setActiveSends(prev => prev + 1);
    onStart?.();
  };

  const finishSend = (success: boolean) => {
    isSendingRef.current = false;
    sendAbortControllerRef.current = null;
    lastSendRequestIdRef.current = null;
    setActiveSends(prev => Math.max(0, prev - 1));
    onFinish?.(success);
  };

  const cancelSend = () => {
    if (sendAbortControllerRef.current) {
      sendAbortControllerRef.current.abort();
      sendAbortControllerRef.current = null;
    }
    isSendingRef.current = false;
  };

  const handleSendResponse = (response: Response, data: any, selectedContactIds: (string | number)[], setMessage: (v: string) => void, setSelectedContactIds: (v: (string | number)[]) => void, setScheduleDate: (v: string) => void, setAttachedFile: (v: File | null) => void, fileInputRef: React.RefObject<HTMLInputElement>) => {
    if (response.ok && data.success) {
      if (data.results?.scheduled) {
        const notice = {
          id: data.results.scheduledMessageId,
          scheduledFor: data.results.scheduledFor,
          total: data.results.total || selectedContactIds.length || 0
        };
        setScheduledNotice(notice);
        onScheduled?.(notice);
      } else if (data.results?.backgroundJob) {
        onBackground?.(data.results.jobId, data.results.total || selectedContactIds.length || 0);
      } else if (data.results?.partial) {
        onError?.(data.results.message);
      } else {
        const sent = data.results?.sent || 0;
        const failed = data.results?.failed || 0;
        onSuccess?.(sent, failed);
      }
      // Clear form if last active send
      setMessage("");
      setSelectedContactIds([]);
      setScheduleDate("");
      setAttachedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      if (response.status !== 409) {
        const errorMsg = data.error || data.details || "Unknown error";
        onError?.(errorMsg);
      }
    }
  };

  const sendBroadcast = async (params: {
    selectedContactIds: (string | number)[];
    message: string;
    scheduleDate: string;
    attachedFile: File | null;
    setMessage: (v: string) => void;
    setSelectedContactIds: (v: (string | number)[]) => void;
    setScheduleDate: (v: string) => void;
    setAttachedFile: (v: File | null) => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
  }) => {
    const { selectedContactIds, message, scheduleDate, attachedFile, setMessage, setSelectedContactIds, setScheduleDate, setAttachedFile, fileInputRef } = params;

    if (!message.trim()) {
      onError?.("Please enter a message");
      return;
    }
    if (selectedContactIds.length === 0) {
      onError?.("Please select at least one contact");
      return;
    }
    if (isSendingRef.current) return;

    isSendingRef.current = true;
    const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    lastSendRequestIdRef.current = requestId;
    sendAbortControllerRef.current = new AbortController();
    setActiveSends(prev => prev + 1);
    onStart?.();

    try {
      let attachment: Attachment = null;
      if (attachedFile) {
        setIsUploadingFile(true);
        try {
          const uploadFormData = new FormData();
          uploadFormData.append("file", attachedFile);
          const uploadResponse = await fetch("/api/upload", { method: "POST", body: uploadFormData });
          const contentType = uploadResponse.headers.get("content-type");
          let uploadData: any;
          if (contentType && contentType.includes("application/json")) {
            const text = await uploadResponse.text();
            if (!text || text.trim() === "") throw new Error("Empty response from server");
            uploadData = JSON.parse(text);
          } else {
            const text = await uploadResponse.text();
            const statusText = uploadResponse.statusText || "Unknown";
            const status = uploadResponse.status || "Unknown";
            let errorMessage = `Server returned non-JSON response (Status: ${status} ${statusText})`;
            if (text) {
              const errorMatch = text.match(/<title>(.*?)<\/title>/i) || text.match(/<h1>(.*?)<\/h1>/i);
              if (errorMatch) errorMessage += `: ${errorMatch[1]}`;
              else if (text.length < 200) errorMessage += `: ${text}`;
            }
            throw new Error(errorMessage);
          }
          if (!uploadResponse.ok || !uploadData.success) {
            throw new Error(uploadData.error || uploadData.details || "Failed to upload file");
          }
          attachment = { url: uploadData.url, type: uploadData.type || "file" };
        } catch (uploadError: any) {
          onError?.(`Failed to upload file: ${uploadError.message || "Unknown error"}`);
          setIsUploadingFile(false);
          isSendingRef.current = false;
          return;
        } finally {
          setIsUploadingFile(false);
        }
      }

      let scheduleDateISO = null;
      if (scheduleDate) {
        const [datePart, timePart] = scheduleDate.split("T");
        const [year, month, day] = datePart.split("-").map(Number);
        const [hours, minutes] = (timePart || "00:00").split(":").map(Number);
        const philippineDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
        const utcDate = new Date(philippineDate.getTime() - 8 * 60 * 60 * 1000);
        scheduleDateISO = utcDate.toISOString();
      }

      const response = await fetch("/api/facebook/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId
        },
        signal: sendAbortControllerRef.current?.signal,
        body: JSON.stringify({
          contactIds: selectedContactIds,
          message: message.trim(),
          scheduleDate: scheduleDateISO,
          attachment
        })
      });

      const contentType = response.headers.get("content-type");
      let data: any;
      if (contentType && contentType.includes("application/json")) {
        const text = await response.text();
        if (!text || text.trim() === "") throw new Error("Empty response from server");
        data = JSON.parse(text);
      } else {
        const text = await response.text();
        const statusText = response.statusText || "Unknown";
        const status = response.status || "Unknown";
        let errorMessage = `Server returned non-JSON response (Status: ${status} ${statusText})`;
        if (text) {
          const errorMatch = text.match(/<title>(.*?)<\/title>/i) || text.match(/<h1>(.*?)<\/h1>/i) || text.match(/An error (occurred|o[^<]*)/i);
          if (errorMatch) errorMessage = errorMatch[1] || errorMatch[0];
          else if (text.length < 200) errorMessage = text;
          else errorMessage = `Server error (${status} ${statusText}). Please try again.`;
        }
        throw new Error(errorMessage);
      }

      handleSendResponse(response, data, selectedContactIds, setMessage, setSelectedContactIds, setScheduleDate, setAttachedFile, fileInputRef);
    } catch (error: any) {
      if (error.name !== "AbortError") {
        onError?.(error.message || "Failed to send messages");
      }
    } finally {
      isSendingRef.current = false;
      sendAbortControllerRef.current = null;
      lastSendRequestIdRef.current = null;
      setActiveSends(prev => Math.max(0, prev - 1));
      onFinish?.(true);
    }
  };

  return {
    activeSends,
    setActiveSends,
    isUploadingFile,
    setIsUploadingFile,
    scheduledNotice,
    setScheduledNotice,
    isCancellingSchedule,
    setIsCancellingSchedule,
    isSendingRef,
    sendAbortControllerRef,
    lastSendRequestIdRef,
    startSend,
    finishSend,
    cancelSend,
    sendBroadcast
  };
}
