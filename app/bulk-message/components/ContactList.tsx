type ContactListProps = {
  paginatedContacts: any[];
  toggleSelection: (id: string | number | undefined | null) => void;
  toggleSelectPage: () => void;
  selectAllFiltered: () => void;
  clearSelection: () => void;
  isPageSelected: boolean;
  isAllFilteredSelected: boolean;
  currentPage: number;
  setCurrentPage: (v: number) => void;
  totalPages: number;
  selectedContactIds: (string | number)[];
  icons: any;
};

export function ContactList({
  paginatedContacts,
  toggleSelection,
  toggleSelectPage,
  selectAllFiltered,
  clearSelection,
  isPageSelected,
  isAllFilteredSelected,
  currentPage,
  setCurrentPage,
  totalPages,
  selectedContactIds,
  icons
}: ContactListProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4 shadow-lg shadow-black/40 space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-300">
        <button onClick={toggleSelectPage} className="px-3 py-1 rounded-full border border-white/10 hover:border-indigo-400">
          {isPageSelected ? "Deselect page" : "Select page"}
        </button>
        <button onClick={selectAllFiltered} className="px-3 py-1 rounded-full border border-white/10 hover:border-indigo-400">
          Select all filtered
        </button>
        <button onClick={clearSelection} className="px-3 py-1 rounded-full border border-white/10 hover:border-red-400">
          Clear
        </button>
        <span className="text-xs text-indigo-200">Selected {selectedContactIds.length}</span>
      </div>

      <div className="grid gap-3">
        {paginatedContacts.map(contact => {
          const id = contact.id || contact.contact_id || contact.contactId;
          const isSelected = selectedContactIds.includes(id);
          return (
            <div
              key={id || Math.random()}
              className={`rounded-xl border border-white/10 bg-zinc-900/60 p-3 flex items-start justify-between gap-3 ${isSelected ? "ring-1 ring-indigo-500" : ""}`}
            >
              <div>
                <p className="font-semibold text-white">{contact.name || contact.first_name || "Unknown"}</p>
                <p className="text-xs text-zinc-400">{contact.page || contact.page_name || contact.pageName || "Unknown page"}</p>
                {contact.tags && contact.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {contact.tags.map((tag: string) => (
                      <span key={tag} className="text-[10px] rounded-full bg-zinc-800 px-2 py-1 text-zinc-200">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => toggleSelection(id)}
                className={`h-6 w-6 rounded-full border ${isSelected ? "bg-indigo-500 border-indigo-400" : "border-white/20"}`}
              >
                {isSelected && icons.CheckIcon?.()}
              </button>
            </div>
          );
        })}
        {paginatedContacts.length === 0 && <p className="text-sm text-zinc-400">No contacts match your filters.</p>}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-sm text-zinc-300">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded-lg border border-white/10 hover:border-indigo-400 disabled:opacity-50"
          >
            Prev
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded-lg border border-white/10 hover:border-indigo-400 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
