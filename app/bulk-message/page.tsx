"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";

// --- Mock Data Generators ---
const INITIAL_TAGS = ["All", "Customers", "Leads", "VIP", "Team"];
const PAGES = ["All Pages", "TechCorp Main", "TechCorp Support", "Personal Brand"];

// --- Icons ---
const SearchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
);

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-black">
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);

const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
);

const XIcon = ({ size = 18 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

const PlusIcon = ({ size = 14 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
);

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
);

const FacebookIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
    </svg>
);

const ChevronLeftIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
);

const ChevronRightIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
);

const CalendarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
);

const PaperclipIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
    </svg>
);

const FileIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
        <polyline points="13 2 13 9 20 9"></polyline>
    </svg>
);

export default function BulkMessagePage() {
    const [tags, setTags] = useState(INITIAL_TAGS);
    const [selectedTag, setSelectedTag] = useState("All");
    const [selectedPage, setSelectedPage] = useState("All Pages");
    const [searchQuery, setSearchQuery] = useState("");
    const [dateFilter, setDateFilter] = useState("");
    const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
    const [message, setMessage] = useState("");
    const [contacts, setContacts] = useState<any[]>([]);
    const [isClient, setIsClient] = useState(false);
    const [scheduleDate, setScheduleDate] = useState("");
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // Hydration Fix: Load data only on client
    useEffect(() => {
        setIsClient(true);
        const roles = ["Product Manager", "CEO", "Lead Developer", "Marketing Head", "Freelancer", "Designer", "Investor"];
        const availableTags = ["Team", "VIP", "Customers", "Leads"];
        const pages = ["TechCorp Main", "TechCorp Support", "Personal Brand"];

        const generated = Array.from({ length: 100 }, (_, i) => {
            const numTags = Math.floor(Math.random() * 2) + 1;
            const shuffledTags = [...availableTags].sort(() => 0.5 - Math.random());
            const contactTags = shuffledTags.slice(0, numTags);

            return {
                id: i + 1,
                name: `User ${i + 1}`,
                role: roles[i % roles.length],
                tags: contactTags,
                avatar: String.fromCharCode(65 + (i % 26)) + String.fromCharCode(65 + ((i + 1) % 26)),
                page: pages[i % pages.length],
                date: `2023-10-${String((i % 30) + 1).padStart(2, '0')}`
            };
        });
        setContacts(generated);
    }, []);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedTag, selectedPage, searchQuery, dateFilter]);

    // Filter contacts
    const filteredContacts = useMemo(() => {
        return contacts.filter((contact) => {
            const matchesTag = selectedTag === "All" || contact.tags.includes(selectedTag);
            const matchesPage = selectedPage === "All Pages" || contact.page === selectedPage;
            const matchesSearch = contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                contact.role.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesDate = !dateFilter || contact.date === dateFilter;

            return matchesTag && matchesSearch && matchesPage && matchesDate;
        });
    }, [selectedTag, selectedPage, searchQuery, dateFilter, contacts, tags]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
    const paginatedContacts = filteredContacts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const getPageNumbers = () => {
        const pageNumbers = [];
        const maxPagesToShow = 5;

        if (totalPages <= maxPagesToShow) {
            for (let i = 1; i <= totalPages; i++) {
                pageNumbers.push(i);
            }
        } else {
            let startPage = Math.max(1, currentPage - 2);
            let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

            if (endPage - startPage < maxPagesToShow - 1) {
                startPage = Math.max(1, endPage - maxPagesToShow + 1);
            }

            for (let i = startPage; i <= endPage; i++) {
                pageNumbers.push(i);
            }
        }
        return pageNumbers;
    };

    // Handlers
    const toggleSelection = (id: number) => {
        setSelectedContactIds((prev) =>
            prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
        );
    };

    // Select Page (only visible contacts)
    const toggleSelectPage = () => {
        const pageIds = paginatedContacts.map(c => c.id);
        const isPageSelected = pageIds.every(id => selectedContactIds.includes(id));

        if (isPageSelected) {
            setSelectedContactIds(prev => prev.filter(id => !pageIds.includes(id)));
        } else {
            setSelectedContactIds(prev => [...new Set([...prev, ...pageIds])]);
        }
    };

    // Select All (all filtered contacts)
    const selectAllFiltered = () => {
        const allIds = filteredContacts.map(c => c.id);
        setSelectedContactIds(allIds);
    };

    const clearSelection = () => {
        setSelectedContactIds([]);
    };

    const handleDelete = () => {
        if (confirm(`Are you sure you want to delete ${selectedContactIds.length} contacts?`)) {
            setContacts(prev => prev.filter(c => !selectedContactIds.includes(c.id)));
            setSelectedContactIds([]);
        }
    };

    const handleCreateTag = () => {
        const newTag = prompt("Enter new tag name:");
        if (newTag && newTag.trim() !== "") {
            if (!tags.includes(newTag)) {
                setTags([...tags, newTag]);
            }
        }
    };

    const handleDeleteTag = (tagToDelete: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(`Delete tag "${tagToDelete}"?`)) {
            setTags(prev => prev.filter(t => t !== tagToDelete));
            if (selectedTag === tagToDelete) setSelectedTag("All");
        }
    };

    const handleAddTagToContact = (contactId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const tagToAdd = prompt("Enter tag to add:");
        if (tagToAdd && tags.includes(tagToAdd)) {
            setContacts(prev => prev.map(c => {
                if (c.id === contactId && !c.tags.includes(tagToAdd)) {
                    return { ...c, tags: [...c.tags, tagToAdd] };
                }
                return c;
            }));
        } else if (tagToAdd) {
            alert("Tag does not exist. Please create it first.");
        }
    };

    const handleRemoveTagFromContact = (contactId: number, tagToRemove: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setContacts(prev => prev.map(c => {
            if (c.id === contactId) {
                return { ...c, tags: c.tags.filter((t: string) => t !== tagToRemove) };
            }
            return c;
        }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 25 * 1024 * 1024) { // 25MB limit
                alert("File size exceeds 25MB limit.");
                return;
            }
            setAttachedFile(file);
        }
    };

    const handleRemoveFile = () => {
        setAttachedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const isPageSelected = paginatedContacts.length > 0 && paginatedContacts.every(c => selectedContactIds.includes(c.id));
    const isAllFilteredSelected = filteredContacts.length > 0 && filteredContacts.every(c => selectedContactIds.includes(c.id));

    // Custom Styles for Animations
    const customStyles = `
    @keyframes blob {
      0% { transform: translate(0px, 0px) scale(1); }
      33% { transform: translate(30px, -50px) scale(1.1); }
      66% { transform: translate(-20px, 20px) scale(0.9); }
      100% { transform: translate(0px, 0px) scale(1); }
    }
    .animate-blob { animation: blob 10s infinite alternate; }
    .animation-delay-2000 { animation-delay: 2s; }
    .animation-delay-4000 { animation-delay: 4s; }
  `;

    if (!isClient) return <div className="min-h-screen bg-black" />; // Prevent hydration mismatch

    return (
        <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-indigo-500/30 relative overflow-hidden">
            <style>{customStyles}</style>

            {/* Enhanced Cooler Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                <div className="absolute inset-0 bg-gradient-to-tr from-black via-zinc-950/90 to-black/80"></div>
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/20 rounded-full mix-blend-screen filter blur-[120px] animate-blob opacity-50" />
                <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-purple-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000 opacity-50" />
                <div className="absolute -bottom-32 left-1/3 w-[600px] h-[600px] bg-blue-600/10 rounded-full mix-blend-screen filter blur-[130px] animate-blob animation-delay-4000 opacity-50" />
                <div className="absolute inset-0 opacity-[0.05] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
            </div>

            {/* Header */}
            <header className="sticky top-0 z-20 border-b border-white/5 bg-black/70 backdrop-blur-xl transition-all duration-300">
                <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                            Broadcast
                        </h1>
                    </div>
                    <button className="flex items-center gap-2 rounded-full bg-[#1877F2] hover:bg-[#166fe5] px-4 py-2 text-sm font-semibold text-white transition-all shadow-lg shadow-blue-900/20 hover:scale-105 active:scale-95">
                        <FacebookIcon />
                        <span>Sign in with Facebook</span>
                    </button>
                </div>
            </header>

            <main className="relative z-10 mx-auto max-w-5xl px-6 py-8 pb-48">
                {/* Controls Grid */}
                <div className="mb-8 grid gap-4 md:grid-cols-[1.5fr_1fr_1fr]">
                    <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-indigo-400">
                            <SearchIcon />
                        </div>
                        <input
                            type="text"
                            placeholder="Search contacts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-xl bg-zinc-900/50 border border-white/10 py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all focus:bg-zinc-900 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 backdrop-blur-sm"
                        />
                    </div>
                    <select
                        value={selectedPage}
                        onChange={(e) => setSelectedPage(e.target.value)}
                        className="w-full appearance-none rounded-xl bg-zinc-900/50 border border-white/10 py-3 px-4 text-sm text-zinc-100 outline-none transition-all focus:bg-zinc-900 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 backdrop-blur-sm"
                    >
                        {PAGES.map(page => <option key={page} value={page}>{page}</option>)}
                    </select>
                    <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="w-full rounded-xl bg-zinc-900/50 border border-white/10 py-3 px-4 text-sm text-zinc-100 outline-none transition-all focus:bg-zinc-900 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 [color-scheme:dark] backdrop-blur-sm"
                    />
                </div>

                {/* Tags Row */}
                <div className="mb-8 flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    <button
                        onClick={handleCreateTag}
                        className="flex items-center gap-1.5 rounded-full border border-dashed border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:border-indigo-500 hover:text-indigo-400 transition-colors backdrop-blur-sm"
                    >
                        <PlusIcon />
                        New Tag
                    </button>
                    <div className="h-4 w-px bg-zinc-800 mx-1" />
                    {tags.map((tag) => (
                        <button
                            key={tag}
                            onClick={() => setSelectedTag(tag)}
                            className={`group flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-300 backdrop-blur-sm ${selectedTag === tag
                                    ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 scale-105"
                                    : "bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-white/5"
                                }`}
                        >
                            {tag}
                            {tag !== "All" && (
                                <span
                                    onClick={(e) => handleDeleteTag(tag, e)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 p-0.5 rounded-full hover:bg-white/10"
                                >
                                    <XIcon size={12} />
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* List Header */}
                <div className="mb-4 space-y-2">
                    <div className="flex items-center justify-between px-2 h-10">
                        <button
                            onClick={toggleSelectPage}
                            className="flex items-center gap-3 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors group"
                        >
                            <div
                                className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all duration-300 ${isPageSelected
                                        ? "border-indigo-500 bg-indigo-500 text-white"
                                        : "border-zinc-700 bg-transparent group-hover:border-zinc-500"
                                    }`}
                            >
                                {isPageSelected && <CheckIcon />}
                            </div>
                            Select Page ({paginatedContacts.length})
                        </button>

                        {selectedContactIds.length > 0 && (
                            <div className="flex items-center gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">
                                    {selectedContactIds.length} Selected
                                </span>
                                <button
                                    onClick={handleDelete}
                                    className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors backdrop-blur-sm"
                                >
                                    <TrashIcon />
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Gmail-style Select All Banner */}
                    {isPageSelected && !isAllFilteredSelected && filteredContacts.length > paginatedContacts.length && (
                        <div className="flex items-center justify-center rounded-lg bg-indigo-500/10 py-2 text-xs text-zinc-300 animate-in fade-in slide-in-from-top-2">
                            <span>All {paginatedContacts.length} contacts on this page are selected.</span>
                            <button
                                onClick={selectAllFiltered}
                                className="ml-2 font-semibold text-indigo-400 hover:underline"
                            >
                                Select all {filteredContacts.length} contacts in this list
                            </button>
                        </div>
                    )}
                    {isAllFilteredSelected && filteredContacts.length > paginatedContacts.length && (
                        <div className="flex items-center justify-center rounded-lg bg-indigo-500/10 py-2 text-xs text-zinc-300 animate-in fade-in slide-in-from-top-2">
                            <span>All {filteredContacts.length} contacts in this list are selected.</span>
                            <button
                                onClick={clearSelection}
                                className="ml-2 font-semibold text-indigo-400 hover:underline"
                            >
                                Clear selection
                            </button>
                        </div>
                    )}
                </div>

                {/* Contact List */}
                <div className="space-y-2 min-h-[400px]">
                    {paginatedContacts.map((contact, index) => {
                        const isSelected = selectedContactIds.includes(contact.id);
                        return (
                            <div
                                key={contact.id}
                                onClick={() => toggleSelection(contact.id)}
                                style={{ animationDelay: `${index * 50}ms` }}
                                className={`group relative flex cursor-pointer items-center gap-4 rounded-2xl border p-3 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 backdrop-blur-sm ${isSelected
                                        ? "border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_20px_-5px_rgba(99,102,241,0.2)]"
                                        : "border-white/5 bg-zinc-900/20 hover:bg-zinc-900/60 hover:border-white/10 hover:translate-x-1"
                                    }`}
                            >
                                <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-indigo-500 transition-all duration-300 ${isSelected ? "opacity-100" : "opacity-0"}`} />

                                <div
                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all duration-300 ml-2 ${isSelected
                                            ? "border-indigo-500 bg-indigo-500 text-white scale-110"
                                            : "border-zinc-700 bg-zinc-950/50 group-hover:border-zinc-500"
                                        }`}
                                >
                                    {isSelected && <CheckIcon />}
                                </div>

                                <div className="relative">
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${isSelected ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white" : "bg-zinc-800 text-zinc-400"
                                        }`}>
                                        {contact.avatar}
                                    </div>
                                    <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-black" />
                                </div>

                                <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                                    <div>
                                        <h3 className={`text-sm font-medium truncate transition-colors ${isSelected ? "text-white" : "text-zinc-200"}`}>
                                            {contact.name}
                                        </h3>
                                        <p className="text-xs text-zinc-500 truncate">{contact.role}</p>
                                    </div>

                                    <div className="hidden md:flex items-center gap-2">
                                        <span className="text-xs text-zinc-500">Page:</span>
                                        <span className="text-xs text-zinc-300">{contact.page}</span>
                                    </div>

                                    <div className="flex items-center justify-end gap-2">
                                        <div className="flex flex-wrap gap-1 justify-end">
                                            {contact.tags.map((tag: string) => (
                                                <span key={tag} className="group/tag inline-flex items-center rounded-md bg-white/5 px-2 py-1 text-[10px] font-medium text-zinc-400 border border-white/5 hover:bg-white/10 transition-colors">
                                                    {tag}
                                                    <button
                                                        onClick={(e) => handleRemoveTagFromContact(contact.id, tag, e)}
                                                        className="ml-1 opacity-0 group-hover/tag:opacity-100 hover:text-red-400 transition-opacity"
                                                    >
                                                        <XIcon size={10} />
                                                    </button>
                                                </span>
                                            ))}
                                            <button
                                                onClick={(e) => handleAddTagToContact(contact.id, e)}
                                                className="inline-flex items-center rounded-md bg-white/5 px-1.5 py-1 text-[10px] text-zinc-500 hover:bg-white/10 hover:text-zinc-300 border border-dashed border-zinc-700 hover:border-zinc-500 transition-all"
                                            >
                                                <PlusIcon size={10} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {paginatedContacts.length === 0 && (
                        <div className="py-20 text-center animate-in fade-in zoom-in-95 duration-300">
                            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 mb-4">
                                <SearchIcon />
                            </div>
                            <h3 className="text-zinc-300 font-medium">No contacts found</h3>
                            <p className="text-zinc-500 text-sm mt-1">Try adjusting your filters</p>
                        </div>
                    )}
                </div>

                {/* Pagination Controls */}
                {filteredContacts.length > 0 && (
                    <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-4">
                        <div className="text-xs text-zinc-500">
                            Showing <span className="text-zinc-300 font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-zinc-300 font-medium">{Math.min(currentPage * itemsPerPage, filteredContacts.length)}</span> of <span className="text-zinc-300 font-medium">{filteredContacts.length}</span> results
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-50 disabled:hover:bg-transparent transition-colors text-zinc-400 hover:text-zinc-200"
                            >
                                <ChevronLeftIcon />
                            </button>

                            <div className="flex items-center gap-1">
                                {getPageNumbers().map((pageNum) => (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`h-8 w-8 rounded-lg text-xs font-medium transition-all ${currentPage === pageNum
                                                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                                                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-50 disabled:hover:bg-transparent transition-colors text-zinc-400 hover:text-zinc-200"
                            >
                                <ChevronRightIcon />
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* Bottom Composer Popup */}
            <div
                className={`fixed inset-x-0 bottom-0 z-50 transition-all duration-500 cubic-bezier(0.32, 0.72, 0, 1) ${selectedContactIds.length > 0 ? "translate-y-0 opacity-100" : "translate-y-[120%] opacity-0"
                    }`}
            >
                <div className="mx-auto max-w-4xl px-4 pb-6">
                    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0A0A0A]/90 p-1 shadow-2xl shadow-indigo-500/10 backdrop-blur-xl ring-1 ring-white/10">
                        <div className="absolute -top-20 -left-20 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

                        <div className="relative flex items-center justify-between px-4 py-3 border-b border-white/5">
                            <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-400">
                                    {selectedContactIds.length}
                                </span>
                                <span className="text-xs font-medium text-zinc-400">recipients selected</span>
                            </div>
                            <button
                                onClick={() => setSelectedContactIds([])}
                                className="p-1.5 hover:bg-white/10 rounded-full text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                                <XIcon />
                            </button>
                        </div>

                        <div className="relative p-2">
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Type your broadcast message..."
                                className="w-full resize-none rounded-xl bg-black/40 p-4 text-sm text-zinc-100 placeholder-zinc-600 outline-none ring-0 transition-all focus:bg-black/60 min-h-[120px]"
                            />

                            {/* Attachment Preview */}
                            {attachedFile && (
                                <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 rounded-lg bg-white/5 p-2 border border-white/10 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-500/20 text-indigo-400">
                                        <FileIcon />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-zinc-200 truncate">{attachedFile.name}</p>
                                        <p className="text-[10px] text-zinc-500">{(attachedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                    <button
                                        onClick={handleRemoveFile}
                                        className="p-1.5 hover:bg-white/10 rounded-full text-zinc-500 hover:text-red-400 transition-colors"
                                    >
                                        <XIcon size={14} />
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="relative flex items-center justify-between px-4 pb-3 pt-1">
                            <div className="flex items-center gap-2">
                                <button className="text-[10px] font-medium text-zinc-400 hover:text-indigo-300 transition-colors bg-white/5 px-2.5 py-1.5 rounded-lg hover:bg-indigo-500/20 border border-transparent hover:border-indigo-500/30">
                                    {`{FirstName}`}
                                </button>
                                <button className="text-[10px] font-medium text-zinc-400 hover:text-indigo-300 transition-colors bg-white/5 px-2.5 py-1.5 rounded-lg hover:bg-indigo-500/20 border border-transparent hover:border-indigo-500/30">
                                    Saved Replies
                                </button>
                                <div className="h-4 w-px bg-zinc-800 mx-1" />

                                {/* Attach File Button */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-zinc-400 hover:text-indigo-300 transition-colors bg-white/5 p-1.5 rounded-lg hover:bg-indigo-500/20 border border-transparent hover:border-indigo-500/30"
                                    title="Attach file (max 25MB)"
                                >
                                    <PaperclipIcon />
                                </button>

                                <div className="h-4 w-px bg-zinc-800 mx-1" />
                                <div className="flex items-center gap-2 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                                    <CalendarIcon />
                                    <input
                                        type="datetime-local"
                                        value={scheduleDate}
                                        onChange={(e) => setScheduleDate(e.target.value)}
                                        className="bg-transparent text-[10px] text-zinc-400 outline-none border-none p-0 w-[110px] [color-scheme:dark]"
                                    />
                                </div>
                            </div>
                            <button className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-105 active:scale-95">
                                <span>{scheduleDate ? "Schedule" : "Send Broadcast"}</span>
                                <SendIcon />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
