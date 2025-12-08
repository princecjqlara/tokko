type FiltersProps = {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  tags: string[];
  selectedTag: string;
  setSelectedTag: (v: string) => void;
  selectedPage: string;
  setSelectedPage: (v: string) => void;
  pages: string[];
  showPageDropdown: boolean;
  setShowPageDropdown: (v: boolean) => void;
  dateFilter: string;
  setDateFilter: (v: string) => void;
  onManagePages: () => void;
  icons: any;
};

export function FiltersBar({
  searchQuery,
  setSearchQuery,
  tags,
  selectedTag,
  setSelectedTag,
  selectedPage,
  setSelectedPage,
  pages,
  showPageDropdown,
  setShowPageDropdown,
  dateFilter,
  setDateFilter,
  onManagePages,
  icons
}: FiltersProps) {
  return (
    <div className="mb-8 grid gap-4 md:grid-cols-[1.5fr_1fr_1fr]">
      <div className="relative group">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">{icons.SearchIcon?.()}</div>
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl bg-zinc-900/50 border border-white/10 py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all focus:bg-zinc-900 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 backdrop-blur-sm"
        />
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setShowPageDropdown(!showPageDropdown)}
          className="w-full rounded-xl bg-zinc-900/50 border border-white/10 px-4 py-3 text-sm text-left text-zinc-100 hover:border-indigo-500/50 hover:bg-zinc-900"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">{selectedPage}</span>
            <span className="text-xs text-zinc-400">Select Page</span>
          </div>
        </button>
        {showPageDropdown && (
          <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 shadow-2xl">
            <div className="max-h-64 overflow-auto">
              {pages.map((page) => (
                <button
                  key={page}
                  onClick={() => {
                    setSelectedPage(page);
                    setShowPageDropdown(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm ${page === selectedPage ? "bg-indigo-500/20 text-indigo-200" : "text-zinc-100 hover:bg-zinc-800"}`}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setShowPageDropdown(false);
                onManagePages();
              }}
              className="w-full px-4 py-2 text-left text-sm text-indigo-300 hover:bg-indigo-500/10"
            >
              Manage pages
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-1/2 rounded-xl bg-zinc-900/50 border border-white/10 px-3 py-3 text-sm text-zinc-100 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
        />
        <div className="w-1/2 flex flex-wrap gap-2">
          {tags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`rounded-full px-3 py-2 text-xs ${selectedTag === tag ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"}`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
