import { useRef, useState } from "react";

type UseSendBroadcastParams = {
  onStart?: () => void;
  onFinish?: (success: boolean) => void;
};

export function useSendBroadcast({ onStart, onFinish }: UseSendBroadcastParams = {}) {
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

  return {
    activeSends,
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
    cancelSend
  };
}
