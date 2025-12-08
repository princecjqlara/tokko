import { useCallback, useEffect, useMemo, useState } from "react";

const MODAL_PAGE_SIZE = 5;

export function usePageManager() {
  const [pages, setPages] = useState<string[]>(["All Pages"]);
  const [pageData, setPageData] = useState<any[]>([]);
  const [availablePages, setAvailablePages] = useState<any[]>([]);
  const [connectedPageIds, setConnectedPageIds] = useState<string[]>([]);
  const [selectedPage, setSelectedPage] = useState("All Pages");
  const [showPageDropdown, setShowPageDropdown] = useState(false);
  const [showReconnectModal, setShowReconnectModal] = useState(false);
  const [pageSearchQuery, setPageSearchQuery] = useState("");
  const [pageModalCurrentPage, setPageModalCurrentPage] = useState(1);
  const [selectedAvailablePageIds, setSelectedAvailablePageIds] = useState<string[]>([]);

  const loadPages = useCallback(async () => {
    try {
      const res = await fetch("/api/facebook/pages");
      if (!res.ok) return;
      const data = await res.json();
      const fetched = data.pages || [];
      setPageData(fetched);
      setAvailablePages(fetched);
      const names = ["All Pages", ...fetched.map((p: any) => p.name)];
      setPages(names);
      setConnectedPageIds(fetched.map((p: any) => p.id));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  const filteredAvailablePages = useMemo(() => {
    const query = pageSearchQuery.toLowerCase();
    return availablePages.filter((p: any) => !query || p.name?.toLowerCase().includes(query));
  }, [availablePages, pageSearchQuery]);

  const modalTotalPages = Math.max(1, Math.ceil(filteredAvailablePages.length / MODAL_PAGE_SIZE));
  const paginatedModalPages = useMemo(() => {
    const start = (pageModalCurrentPage - 1) * MODAL_PAGE_SIZE;
    return filteredAvailablePages.slice(start, start + MODAL_PAGE_SIZE);
  }, [filteredAvailablePages, pageModalCurrentPage]);

  const toggleAvailableSelection = (pageId: string) => {
    setSelectedAvailablePageIds(prev =>
      prev.includes(pageId) ? prev.filter(id => id !== pageId) : [...prev, pageId]
    );
  };

  const toggleAllAvailable = () => {
    const remaining = filteredAvailablePages
      .filter((p: any) => !connectedPageIds.includes(p.id))
      .map((p: any) => p.id);
    const allSelected = remaining.every(id => selectedAvailablePageIds.includes(id));
    setSelectedAvailablePageIds(allSelected ? [] : remaining);
  };

  const saveSelection = async (action: "connect" | "disconnect") => {
    if (selectedAvailablePageIds.length === 0) return;
    try {
      const res = await fetch("/api/facebook/pages/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageIds: selectedAvailablePageIds, action })
      });
      if (res.ok) {
        const nextConnected = action === "connect"
          ? Array.from(new Set([...connectedPageIds, ...selectedAvailablePageIds]))
          : connectedPageIds.filter(id => !selectedAvailablePageIds.includes(id));
        setConnectedPageIds(nextConnected);
        const nextPageData = action === "connect"
          ? Array.from(
              new Map([...pageData, ...availablePages].map((p: any) => [p.id, p])).values()
            )
          : pageData.filter(p => !selectedAvailablePageIds.includes(p.id));
        setPageData(nextPageData);
        setPages(["All Pages", ...nextPageData.map((p: any) => p.name)]);
        setSelectedAvailablePageIds([]);
      } else {
        const message = await res.text();
        alert(message || `Failed to ${action} pages`);
      }
    } catch (error: any) {
      alert(error.message || `Failed to ${action} pages`);
    }
  };

  return {
    pages,
    pageData,
    availablePages,
    connectedPageIds,
    selectedPage,
    setSelectedPage,
    showPageDropdown,
    setShowPageDropdown,
    showReconnectModal,
    setShowReconnectModal,
    pageSearchQuery,
    setPageSearchQuery,
    pageModalCurrentPage,
    setPageModalCurrentPage,
    paginatedModalPages,
    modalTotalPages,
    selectedAvailablePageIds,
    toggleAvailableSelection,
    toggleAllAvailable,
    saveSelection,
    reloadPages: loadPages
  };
}
