"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useIcons } from "./hooks/useIcons";
import { useSendBroadcast } from "./hooks/useSendBroadcast";
import { useContactFilters } from "./hooks/useContactFilters";
import { useContacts } from "./hooks/useContacts";
import { usePageManager } from "./hooks/usePageManager";
import { useMessageFormState } from "./hooks/useMessageFormState";
import { useContactDeletion } from "./hooks/useContactDeletion";
import { HeaderBar } from "./components/HeaderBar";
import { ProgressPanel } from "./components/ProgressPanel";
import { FiltersBar } from "./components/FiltersBar";
import { ContactList } from "./components/ContactList";
import { MessageComposer } from "./components/MessageComposer";
import { ReconnectModal } from "./components/ReconnectModal";

export default function BulkMessagePage() {
  const { data: session, status } = useSession();
  const icons = useIcons();
  const [selectedTag, setSelectedTag] = useState("All");
  const [tags, setTags] = useState<string[]>(["All"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<(string | number)[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const msg = useMessageFormState();
  const pm = usePageManager();
  const { contacts, setContacts, progress, isLoading, startSync, stopSync, togglePause } = useContacts(pm.selectedPage);
  const { deleteByIds } = useContactDeletion(setContacts, () => setSelectedContactIds([]));

  const {
    activeSends,
    isSending,
    isUploadingFile,
    scheduledNotice,
    setScheduledNotice,
    isCancellingSchedule,
    setIsCancellingSchedule,
    isCancellingJob,
    isSendingRef,
    activeJobId,
    cancelActiveJob,
    sendAbortControllerRef,
    sendBroadcast
  } = useSendBroadcast({
    onBackground: (jobId, total) => alert(`Sending ${total} messages. Job ${jobId} created.`),
    onScheduled: notice => setScheduledNotice(notice),
    onSuccess: (sent, failed) => alert(`Successfully sent ${sent} message(s)!${failed > 0 ? `\n${failed} failed.` : ""}`),
    onError: message => alert(message || "Failed to send messages")
  });

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);
  useEffect(() => setCurrentPage(1), [selectedTag, pm.selectedPage, debouncedSearchQuery, dateFilter]);
  useEffect(() => {
    const all = new Set<string>(["All"]);
    contacts.forEach((c: any) => c.tags?.forEach((t: string) => all.add(t)));
    setTags(Array.from(all));
  }, [contacts]);

  const filters = useContactFilters({
    contacts,
    selectedTag,
    selectedPage: pm.selectedPage,
    debouncedSearchQuery,
    dateFilter,
    selectedContactIds,
    setSelectedContactIds,
    currentPage,
    itemsPerPage
  });

  const handleSend = () => {
    sendBroadcast({
      selectedContactIds,
      message: msg.message,
      scheduleDate: msg.scheduleDate,
      attachedFile: msg.attachedFile,
      messageTag: msg.messageTag,
      setMessage: msg.setMessage,
      setSelectedContactIds,
      setScheduleDate: msg.setScheduleDate,
      setAttachedFile: msg.setAttachedFile,
      fileInputRef: msg.fileInputRef
    });
  };

  const handleCancelSend = async () => {
    if (isSendingRef.current) {
      sendAbortControllerRef.current?.abort();
      isSendingRef.current = false;
    }
    if (activeJobId) {
      await cancelActiveJob();
    }
  };

  const handleCancelScheduled = async () => {
    if (!scheduledNotice) return;
    setIsCancellingSchedule(true);
    try {
      const res = await fetch("/api/facebook/messages/cancel-scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledMessageId: scheduledNotice.id })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setScheduledNotice(null);
        alert("Scheduled message cancelled");
      } else {
        alert(data.error || "Failed to cancel scheduled message");
      }
    } catch (error: any) {
      alert(error.message || "Failed to cancel");
    } finally {
      setIsCancellingSchedule(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedContactIds.length === 0) return alert("No contacts selected");
    if (confirm(`Delete ${selectedContactIds.length} contact(s)?`)) await deleteByIds(selectedContactIds);
  };

  const handleDeleteFiltered = async () => {
    const ids = filters.filteredContacts.map(c => c.id || c.contact_id || c.contactId).filter(Boolean);
    if (ids.length === 0) return alert("No contacts to delete");
    if (confirm(`Delete ${ids.length} filtered contact(s)?`)) await deleteByIds(ids);
  };

  const handleSignOut = async () => {
    stopSync();
    await signOut({ callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 relative">
      <HeaderBar session={session} status={status} icons={icons} onSync={startSync} onReconnect={() => pm.setShowReconnectModal(true)} onSignOut={handleSignOut} isFetching={progress.isFetching} />

      <main className="relative z-10 mx-auto max-w-5xl px-6 py-8 space-y-6">
        <ProgressPanel progress={progress} isLoading={isLoading} onStart={startSync} onPause={togglePause} onStop={stopSync} />

        <FiltersBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} tags={tags} selectedTag={selectedTag} setSelectedTag={setSelectedTag} selectedPage={pm.selectedPage} setSelectedPage={pm.setSelectedPage} pages={pm.pages} showPageDropdown={pm.showPageDropdown} setShowPageDropdown={pm.setShowPageDropdown} dateFilter={dateFilter} setDateFilter={setDateFilter} onManagePages={() => pm.setShowReconnectModal(true)} icons={icons} />

        <MessageComposer
          message={msg.message}
          setMessage={msg.setMessage}
          scheduleDate={msg.scheduleDate}
          setScheduleDate={msg.setScheduleDate}
          attachedFile={msg.attachedFile}
          setAttachedFile={msg.setAttachedFile}
          messageTag={msg.messageTag}
          setMessageTag={msg.setMessageTag}
          fileInputRef={msg.fileInputRef}
          onSend={handleSend}
          onCancelSend={handleCancelSend}
          isUploadingFile={isUploadingFile}
          isSending={isSending}
          activeSends={activeSends}
          hasActiveJob={!!activeJobId}
          isCancellingJob={isCancellingJob}
          onCancelJob={cancelActiveJob}
          icons={icons}
          scheduledNotice={scheduledNotice}
          onCancelScheduled={handleCancelScheduled}
          isCancellingSchedule={isCancellingSchedule}
        />

        <ContactList paginatedContacts={filters.paginatedContacts} toggleSelection={filters.toggleSelection} toggleSelectPage={filters.toggleSelectPage} selectAllFiltered={filters.selectAllFiltered} clearSelection={filters.clearSelection} isPageSelected={filters.isPageSelected} isAllFilteredSelected={filters.isAllFilteredSelected} currentPage={currentPage} setCurrentPage={setCurrentPage} totalPages={filters.totalPages} selectedContactIds={selectedContactIds} icons={icons} />

        <div className="flex flex-wrap gap-3 text-sm text-zinc-300">
          <button onClick={handleDeleteSelected} className="rounded-lg border border-white/10 px-3 py-2 hover:border-red-400 hover:text-red-200">
            Delete selected
          </button>
          <button onClick={handleDeleteFiltered} className="rounded-lg border border-white/10 px-3 py-2 hover:border-red-400 hover:text-red-200">
            Delete filtered
          </button>
        </div>
      </main>

      <ReconnectModal open={pm.showReconnectModal} onClose={() => pm.setShowReconnectModal(false)} availablePages={pm.availablePages} paginatedModalPages={pm.paginatedModalPages} modalTotalPages={pm.modalTotalPages} pageModalCurrentPage={pm.pageModalCurrentPage} setPageModalCurrentPage={pm.setPageModalCurrentPage} connectedPageIds={pm.connectedPageIds} selectedAvailablePageIds={pm.selectedAvailablePageIds} toggleAvailableSelection={pm.toggleAvailableSelection} toggleAllAvailable={pm.toggleAllAvailable} saveSelection={pm.saveSelection} pageSearchQuery={pm.pageSearchQuery} setPageSearchQuery={pm.setPageSearchQuery} icons={icons} />
    </div>
  );
}
