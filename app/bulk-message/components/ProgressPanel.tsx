type ProgressProps = {
  progress: {
    isFetching: boolean;
    isPaused: boolean;
    totalContacts: number;
    currentPage?: string;
    currentPageNumber?: number;
    totalPages?: number;
    message?: string;
    recentContacts?: any[];
  };
  isLoading: boolean;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
};

export function ProgressPanel({ progress, isLoading, onStart, onPause, onStop }: ProgressProps) {
  const { isFetching, isPaused, totalContacts, currentPage, currentPageNumber, totalPages, message, recentContacts } = progress;
  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-zinc-900/40 p-4 shadow-lg shadow-black/40">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <p className="text-sm text-zinc-400">Contacts synced</p>
          <p className="text-3xl font-semibold text-white">{totalContacts}</p>
          {currentPage && (
            <p className="text-xs text-zinc-500 mt-1">
              {currentPage} {currentPageNumber && totalPages ? `(Page ${currentPageNumber}/${totalPages})` : ""}
            </p>
          )}
          {message && <p className="text-xs text-indigo-200 mt-1">{message}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onStart}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
            disabled={isFetching}
          >
            {isFetching ? "Syncing..." : "Sync contacts"}
          </button>
          <button
            onClick={onPause}
            disabled={!isFetching}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white hover:border-indigo-400 transition disabled:opacity-60"
          >
            {isPaused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={onStop}
            disabled={!isFetching && !isLoading}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:border-red-400 hover:text-red-200 transition disabled:opacity-60"
          >
            Stop
          </button>
        </div>
      </div>

      {recentContacts && recentContacts.length > 0 && (
        <div className="mt-3 text-xs text-zinc-400">
          <p className="font-semibold text-zinc-300 mb-1">Recent contacts</p>
          <div className="flex flex-wrap gap-2">
            {recentContacts.map((c: any) => (
              <span key={c.id || c.contact_id || c.contactId} className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-white">
                {c.name || c.first_name || "Contact"}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
