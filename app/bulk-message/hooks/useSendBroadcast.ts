import { useRef, useState } from "react";
import type { MessageTag } from "./useMessageFormState";

type Attachment = { url: string; type?: string } | null;

type UseSendBroadcastParams = {
  onStart?: () => void;
  onFinish?: (success: boolean) => void;
  onSuccess?: (sent: number, failed: number) => void;
  onBackground?: (jobId: number, total: number) => void;
  onScheduled?: (notice: { id: number; scheduledFor: string; total: number }) => void;
  onError?: (message: string) => void;
};

const parseJson = async (response: Response) => {
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    const text = await response.text();
    if (!text.trim()) throw new Error("Empty response from server");
    return JSON.parse(text);
  }
  const text = await response.text();
  const statusText = response.statusText || "Unknown";
  const status = response.status || "Unknown";
  const match = text.match(/<title>(.*?)<\/title>/i) || text.match(/<h1>(.*?)<\/h1>/i);
  const message = match?.[1] || (text.length < 200 ? text : `Server error (${status} ${statusText}). Please try again.`);
  throw new Error(message);
};

export function useSendBroadcast({ onStart, onFinish, onSuccess, onBackground, onScheduled, onError }: UseSendBroadcastParams = {}) {
  const [activeSends, setActiveSends] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [scheduledNotice, setScheduledNotice] = useState<{ id: number; scheduledFor: string; total: number } | null>(null);
  const [isCancellingSchedule, setIsCancellingSchedule] = useState(false);
  const sendAbortControllerRef = useRef<AbortController | null>(null);
  const isSendingRef = useRef(false);
  const lastSendRequestIdRef = useRef<string | null>(null);
  const activeSignatureRef = useRef<string | null>(null);
  const activeJobIdRef = useRef<number | null>(null);
  const jobLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [isCancellingJob, setIsCancellingJob] = useState(false);

  const setJobId = (id: number | null) => {
    if (jobLockTimeoutRef.current) {
      clearTimeout(jobLockTimeoutRef.current);
      jobLockTimeoutRef.current = null;
    }
    activeJobIdRef.current = id;
    setActiveJobId(id);
    if (!id) {
      activeSignatureRef.current = null;
    } else {
      jobLockTimeoutRef.current = setTimeout(() => {
        activeJobIdRef.current = null;
        setActiveJobId(null);
        activeSignatureRef.current = null;
      }, 10 * 60 * 1000); // auto-release after 10 minutes to avoid stale lock
    }
  };

  const buildSignature = (params: {
    selectedContactIds: (string | number)[];
    message: string;
    scheduleDate: string;
    messageTag: MessageTag;
    attachedFile: File | null;
  }) => {
    const { selectedContactIds, message, scheduleDate, messageTag, attachedFile } = params;
    const sortedIds = [...new Set(selectedContactIds.map(id => String(id)))].sort();
    const attachmentKey = attachedFile ? `${attachedFile.name}:${attachedFile.size}` : "no-file";
    return [sortedIds.join(","), message.trim(), scheduleDate || "immediate", messageTag, attachmentKey].join("|");
  };

  const cancelActiveJob = async () => {
    if (!activeJobIdRef.current) return;
    setIsCancellingJob(true);
    try {
      const res = await fetch("/api/facebook/messages/cancel-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: activeJobIdRef.current })
      });
      const data = await parseJson(res);
      if (!res.ok || !data.success) {
        if (data.status && data.status !== "pending" && data.status !== "running" && data.status !== "processing") {
          setJobId(null);
          throw new Error(data.error || data.details || "Job already finished");
        }
        throw new Error(data.error || data.details || "Failed to cancel job");
      }
      setJobId(null);
    } catch (error: any) {
      onError?.(error.message || "Failed to cancel job");
    } finally {
      setIsCancellingJob(false);
    }
  };

  const sendBroadcast = async (params: {
    selectedContactIds: (string | number)[];
    message: string;
    scheduleDate: string;
    attachedFile: File | null;
    messageTag: MessageTag;
    setMessage: (v: string) => void;
    setSelectedContactIds: (v: (string | number)[]) => void;
    setScheduleDate: (v: string) => void;
    setAttachedFile: (v: File | null) => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
  }) => {
    const { selectedContactIds, message, scheduleDate, attachedFile, messageTag, setMessage, setSelectedContactIds, setScheduleDate, setAttachedFile, fileInputRef } = params;
    if (!message.trim()) return onError?.("Please enter a message");
    const uniqueContactIds = Array.from(new Set(selectedContactIds));
    if (uniqueContactIds.length === 0) return onError?.("Please select at least one contact");

    const signature = buildSignature({ selectedContactIds: uniqueContactIds, message, scheduleDate, messageTag, attachedFile });
    if (activeSignatureRef.current && activeSignatureRef.current === signature) {
      return onError?.("This broadcast is already sending. Please wait or cancel the active job.");
    }
    if (activeJobIdRef.current) return onError?.("A broadcast job is already running. Cancel it before starting a new one.");
    if (isSendingRef.current) return;

    isSendingRef.current = true;
    activeSignatureRef.current = signature;
    const requestId = `broadcast_${signature.split("").reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0).toString(36)}`;
    lastSendRequestIdRef.current = requestId;
    sendAbortControllerRef.current = new AbortController();
    setActiveSends(prev => prev + 1);
    setIsSending(true);
    onStart?.();

    try {
      let attachment: Attachment = null;
      if (attachedFile) {
        setIsUploadingFile(true);
        const formData = new FormData();
        formData.append("file", attachedFile);
        const uploadResponse = await fetch("/api/upload", { method: "POST", body: formData });
        const uploadData = await parseJson(uploadResponse);
        if (!uploadResponse.ok || !uploadData.success) {
          throw new Error(uploadData.error || uploadData.details || "Failed to upload file");
        }
        attachment = { url: uploadData.url, type: uploadData.type || "file" };
        setIsUploadingFile(false);
      }

      let scheduleDateISO: string | null = null;
      if (scheduleDate) {
        const [datePart, timePart] = scheduleDate.split("T");
        const [year, month, day] = datePart.split("-").map(Number);
        const [hours, minutes] = (timePart || "00:00").split(":").map(Number);
        const philippineDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
        scheduleDateISO = new Date(philippineDate.getTime() - 8 * 60 * 60 * 1000).toISOString();
      }

      const response = await fetch("/api/facebook/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Request-ID": requestId },
        signal: sendAbortControllerRef.current?.signal,
        body: JSON.stringify({ contactIds: uniqueContactIds, message: message.trim(), scheduleDate: scheduleDateISO, attachment, messageTag })
      });
      const data = await parseJson(response);

      if (response.ok && data.success) {
        if (data.results?.scheduled) {
          const notice = { id: data.results.scheduledMessageId, scheduledFor: data.results.scheduledFor, total: data.results.total || selectedContactIds.length };
          setScheduledNotice(notice);
          onScheduled?.(notice);
        } else if (data.results?.backgroundJob) {
          setJobId(data.results.jobId);
          onBackground?.(data.results.jobId, data.results.total || selectedContactIds.length);
        } else if (data.results?.partial) {
          onError?.(data.results.message);
        } else {
          onSuccess?.(data.results?.sent || 0, data.results?.failed || 0);
        }
        setMessage("");
        setSelectedContactIds([]);
        setScheduleDate("");
        setAttachedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else if (response.status !== 409) {
        onError?.(data.error || data.details || "Unknown error");
      }
    } catch (error: any) {
      if (error.name !== "AbortError") onError?.(error.message || "Failed to send messages");
    } finally {
      isSendingRef.current = false;
      if (!activeJobIdRef.current) {
        activeSignatureRef.current = null;
      }
      sendAbortControllerRef.current = null;
      lastSendRequestIdRef.current = null;
      setActiveSends(prev => Math.max(0, prev - 1));
      setIsSending(false);
      onFinish?.(true);
    }
  };

  return {
    activeSends,
    setActiveSends,
    isSending,
    isUploadingFile,
    setIsUploadingFile,
    scheduledNotice,
    setScheduledNotice,
    isCancellingSchedule,
    setIsCancellingSchedule,
    isCancellingJob,
    isSendingRef,
    activeJobId,
    cancelActiveJob,
    sendAbortControllerRef,
    lastSendRequestIdRef,
    sendBroadcast
  };
}
