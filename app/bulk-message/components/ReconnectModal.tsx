type ReconnectProps = {
  open: boolean;
  onClose: () => void;
  availablePages: any[];
  paginatedModalPages: any[];
  modalTotalPages: number;
  pageModalCurrentPage: number;
  setPageModalCurrentPage: (v: number) => void;
  connectedPageIds: string[];
  selectedAvailablePageIds: string[];
  toggleAvailableSelection: (id: string) => void;
  toggleAllAvailable: () => void;
  saveSelection: (action: "connect" | "disconnect") => void;
  pageSearchQuery: string;
  setPageSearchQuery: (v: string) => void;
  icons: any;
};

export function ReconnectModal({
  open,
  onClose,
  availablePages,
  paginatedModalPages,
  modalTotalPages,
  pageModalCurrentPage,
  setPageModalCurrentPage,
  connectedPageIds,
  selectedAvailablePageIds,
  toggleAvailableSelection,
  toggleAllAvailable,
  saveSelection,
  pageSearchQuery,
  setPageSearchQuery,
  icons
}: ReconnectProps) {
  if (!open) return null;
  const totalAvailable = availablePages.filter((p: any) => !connectedPageIds.includes(p.id)).length;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h3 className="text-lg font-semibold text-white">Manage Facebook Pages</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            ✕
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search pages..."
                value={pageSearchQuery}
                onChange={(e) => setPageSearchQuery(e.target.value)}
                className="w-full rounded-lg bg-zinc-900/70 border border-white/10 px-3 py-2 text-sm text-white focus:border-indigo-500/50"
              />
            </div>
            <button
              onClick={() => saveSelection("connect")}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500"
            >
              Connect selected
            </button>
            <button
              onClick={() => saveSelection("disconnect")}
              className="px-4 py-2 rounded-lg border border-white/10 text-sm text-white hover:border-red-400"
            >
              Disconnect selected
            </button>
          </div>

          <div className="flex items-center justify-between text-sm text-zinc-300">
            <span>{selectedAvailablePageIds.length} selected</span>
            <button onClick={toggleAllAvailable} className="text-indigo-300 hover:text-indigo-200">
              {selectedAvailablePageIds.length === totalAvailable ? "Deselect all" : "Select all available"}
            </button>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-auto pr-1">
            {paginatedModalPages.length === 0 && <p className="text-zinc-400">No pages found.</p>}
            {paginatedModalPages.map((page: any) => {
              const isConnected = connectedPageIds.includes(page.id);
              const isSelected = selectedAvailablePageIds.includes(page.id);
              return (
                <button
                  key={page.id}
                  onClick={() => toggleAvailableSelection(page.id)}
                  className={`w-full flex items-center justify-between rounded-lg border p-3 text-left transition-all ${
                    isConnected ? "border-indigo-500 bg-indigo-500/10" : isSelected ? "border-indigo-400 bg-indigo-500/5" : "border-white/10 hover:border-indigo-400"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {icons.FacebookIcon?.()}
                    <div>
                      <p className="text-sm font-semibold text-white">{page.name}</p>
                      <p className="text-xs text-zinc-400">{page.category || "Page"}</p>
                    </div>
                  </div>
                  <span className="text-xs text-zinc-300">{isConnected ? "Connected" : isSelected ? "Selected" : "Tap to select"}</span>
                </button>
              );
            })}
          </div>

          {modalTotalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-sm text-zinc-300">
              <button
                onClick={() => setPageModalCurrentPage(Math.max(1, pageModalCurrentPage - 1))}
                disabled={pageModalCurrentPage === 1}
                className="px-3 py-1 rounded-lg border border-white/10 hover:border-indigo-400 disabled:opacity-50"
              >
                Prev
              </button>
              <span>
                Page {pageModalCurrentPage} of {modalTotalPages}
              </span>
              <button
                onClick={() => setPageModalCurrentPage(Math.min(modalTotalPages, pageModalCurrentPage + 1))}
                disabled={pageModalCurrentPage === modalTotalPages}
                className="px-3 py-1 rounded-lg border border-white/10 hover:border-indigo-400 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
