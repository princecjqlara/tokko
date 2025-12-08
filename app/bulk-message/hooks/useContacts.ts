import { useCallback, useEffect, useRef, useState } from "react";

type Contact = any;

type FetchProgress = {
  isFetching: boolean;
  isPaused: boolean;
  totalContacts: number;
  currentPage?: string;
  currentPageNumber?: number;
  totalPages?: number;
  message?: string;
  recentContacts: Contact[];
  isCollapsed?: boolean;
};

const defaultProgress: FetchProgress = {
  isFetching: false,
  isPaused: false,
  totalContacts: 0,
  recentContacts: [],
  isCollapsed: false
};

const contactId = (contact: any) => contact?.id || contact?.contact_id || contact?.contactId;

export function useContacts(selectedPage: string) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [progress, setProgress] = useState<FetchProgress>(defaultProgress);
  const [isLoading, setIsLoading] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);
  const contactCountRef = useRef(0);

  useEffect(() => {
    contactCountRef.current = contacts.length;
  }, [contacts.length]);

  const closeStream = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }
  }, []);

  const loadFromDatabase = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/facebook/contacts?fromDatabase=true");
      if (res.ok) {
        const data = await res.json();
        const loaded = data.contacts || [];
        setContacts(loaded);
        setProgress(prev => ({
          ...prev,
          totalContacts: loaded.length,
          message: loaded.length ? `Loaded ${loaded.length} contacts` : prev.message
        }));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateProgressCount = useCallback(
    (updates: Partial<FetchProgress> | ((prev: FetchProgress) => Partial<FetchProgress>) = {}) => {
      setProgress(prev => {
        const next = typeof updates === "function" ? updates(prev) : updates;
        return {
          ...prev,
          ...next,
          totalContacts: Math.max(next.totalContacts ?? prev.totalContacts, contactCountRef.current)
        };
      });
    },
    []
  );

  const handleContactEvent = useCallback(
    (data: any) => {
      setContacts(prev => {
        const id = contactId(data.contact);
        if (!id) return prev;
        const exists = prev.some(c => contactId(c) === id);
        const updated = exists ? prev.map(c => (contactId(c) === id ? { ...c, ...data.contact } : c)) : [data.contact, ...prev];
        contactCountRef.current = updated.length;
        return updated;
      });
      updateProgressCount(prev => ({
        totalContacts: Math.max(data.totalContacts || 0, contactCountRef.current),
        recentContacts: [data.contact, ...(prev.recentContacts || [])].slice(0, 5),
        message: data.message || prev.message
      }));
    },
    [updateProgressCount]
  );

  const startSync = useCallback(async () => {
    closeStream();
    await loadFromDatabase();
    setProgress(prev => ({ ...prev, isFetching: true, isPaused: false, recentContacts: [], message: "Syncing contacts..." }));

    const qs = selectedPage && selectedPage !== "All Pages" ? `?page=${encodeURIComponent(selectedPage)}` : "";
    const source = new EventSource(`/api/facebook/contacts/stream${qs}`);
    sourceRef.current = source;

    source.onmessage = (event) => {
      if (!event.data) return;
      let payload: any;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      switch (payload.type) {
        case "contact":
          handleContactEvent(payload);
          break;
        case "page_start":
          updateProgressCount({
            currentPage: payload.pageName,
            currentPageNumber: payload.currentPage,
            totalPages: payload.totalPages,
            message: `Processing ${payload.pageName}...`
          });
          break;
        case "page_complete":
          updateProgressCount({
            currentPage: payload.pageName,
            currentPageNumber: payload.currentPage,
            totalPages: payload.totalPages,
            message: `${payload.pageName} complete (${payload.contactsCount} contacts)`
          });
          break;
        case "complete":
          updateProgressCount({
            isFetching: false,
            isPaused: false,
            totalContacts: payload.totalContacts || contactCountRef.current,
            message: payload.message || "Sync completed"
          });
          closeStream();
          loadFromDatabase();
          break;
        case "error":
          updateProgressCount({ isFetching: false, message: payload.message || "Error fetching contacts" });
          closeStream();
          break;
      }
    };

    source.onerror = () => {
      updateProgressCount({ isFetching: false, message: "Connection lost" });
      closeStream();
    };
  }, [selectedPage, loadFromDatabase, updateProgressCount, handleContactEvent, closeStream]);

  const stopSync = useCallback(async () => {
    closeStream();
    updateProgressCount({ isFetching: false, isPaused: false, message: "Fetching cancelled" });
    try {
      await fetch("/api/facebook/contacts/cancel", { method: "POST", headers: { "Content-Type": "application/json" } });
    } catch {
      // ignore
    }
  }, [closeStream, updateProgressCount]);

  const togglePause = useCallback(async () => {
    const next = !progress.isPaused;
    try {
      await fetch("/api/facebook/contacts/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPaused: next })
      });
    } catch {
      // ignore
    }
    updateProgressCount({
      isPaused: next,
      message: next ? "Fetching paused" : "Resuming..."
    });
  }, [progress.isPaused, updateProgressCount]);

  useEffect(() => {
    loadFromDatabase();
    return () => closeStream();
  }, [loadFromDatabase, closeStream]);

  return {
    contacts,
    setContacts,
    progress,
    isLoading,
    startSync,
    stopSync,
    togglePause,
    reloadContacts: loadFromDatabase
  };
}
