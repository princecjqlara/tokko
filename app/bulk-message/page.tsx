"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

// --- Default Filter Options ---
// Pages will be fetched from Facebook API when user is authenticated

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
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
        <polyline points="13 2 13 9 20 9"></polyline>
    </svg>
);

const VideoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7"></polygon>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
    </svg>
);

const AudioIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
    </svg>
);

const ImageIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
);


export default function BulkMessagePage() {
    const { data: session, status } = useSession();
    const [tags, setTags] = useState(["All"]);
    const [selectedTag, setSelectedTag] = useState("All");
    const [selectedPage, setSelectedPage] = useState("All Pages");
    const [searchQuery, setSearchQuery] = useState("");
    const [pageSearchQuery, setPageSearchQuery] = useState("");
    const [showPageDropdown, setShowPageDropdown] = useState(false);
    const [dateFilter, setDateFilter] = useState("");
    const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
    const [message, setMessage] = useState("");
    const [contacts, setContacts] = useState<any[]>([]);
    const [pages, setPages] = useState<string[]>(["All Pages"]);
    const [pageData, setPageData] = useState<any[]>([]); // Store full page objects
    const [availablePages, setAvailablePages] = useState<any[]>([]); // All available pages from Facebook
    const [connectedPageIds, setConnectedPageIds] = useState<string[]>([]); // All pages are automatically connected
    const [isClient, setIsClient] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [activeSends, setActiveSends] = useState(0);
    const [scheduleDate, setScheduleDate] = useState("");
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const profileDropdownRef = useRef<HTMLDivElement>(null);
    
    // Real-time fetching state
    const [fetchingProgress, setFetchingProgress] = useState<{
        isFetching: boolean;
        isPaused: boolean;
        currentPage?: string;
        currentPageNumber?: number;
        totalPages?: number;
        totalContacts: number;
        message?: string;
        recentContacts: any[];
        isCollapsed: boolean;
    }>({
        isFetching: false,
        isPaused: false,
        totalContacts: 0,
        recentContacts: [],
        isCollapsed: false
    });
    
    // Track if fetch is already in progress to prevent reload loops
    const isFetchingRef = useRef(false);
    const hasFetchedRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const isPausedRef = useRef(false);
    const isConnectingRef = useRef(false); // Track if we're in the process of connecting
    const fetchContactsRealtimeRef = useRef<(() => void) | null>(null); // Ref to store fetchContactsRealtime function
    const isLoadingContactsRef = useRef(false); // Prevent multiple simultaneous contact loads
    const lastContactLoadTimeRef = useRef<number>(0); // Track last contact load time to prevent rapid successive loads
    const contactLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Debounce timeout

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;
    
    // Modal states
    const [showReconnectModal, setShowReconnectModal] = useState(false);
    const [pageModalCurrentPage, setPageModalCurrentPage] = useState(1);
    const [connectedPagesCurrentPage, setConnectedPagesCurrentPage] = useState(1);
    const connectedPagesItemsPerPage = 5;
    
    // Page selection states
    const [selectedPageIdsForDisconnect, setSelectedPageIdsForDisconnect] = useState<string[]>([]);
    const [selectedAvailablePageIds, setSelectedAvailablePageIds] = useState<string[]>([]);

    // Hydration Fix: Load data only on client
    useEffect(() => {
        setIsClient(true);
        // Initialize with empty contacts array - data will be loaded from API/database
        setContacts([]);
    }, []);

    // Close profile dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
                setShowProfileDropdown(false);
            }
        };

        if (showProfileDropdown) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showProfileDropdown]);

    // Handle reconnect
    const handleReconnect = () => {
        setShowProfileDropdown(false);
        // Open popup window for Facebook login
        const width = 600;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        
        // Use popup callback URL
        const popup = window.open(
            `/api/auth/signin/facebook?callbackUrl=${encodeURIComponent("/api/facebook/callback-popup?popup=true")}`,
            'facebook-login',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );

        // Poll to check if popup is closed (user completed auth)
        const checkClosed = setInterval(() => {
            if (popup?.closed) {
                clearInterval(checkClosed);
                // Reload page to check for new session
                window.location.reload();
            }
        }, 500);

        // Also listen for messages from popup
        const messageHandler = (event: MessageEvent) => {
            if (event.data?.type === 'AUTH_SUCCESS') {
                clearInterval(checkClosed);
                window.removeEventListener('message', messageHandler);
                window.location.reload();
            }
        };
        window.addEventListener('message', messageHandler);
    };

    // Handle sign out
    const handleSignOut = async () => {
        setShowProfileDropdown(false);
        // Cancel any ongoing fetch
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        await signOut({ callbackUrl: "/" });
    };
    
    // Handle stop fetching
    const handleStopFetching = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        isFetchingRef.current = false;
        isPausedRef.current = false;
        setFetchingProgress(prev => ({
            ...prev,
            isFetching: false,
            isPaused: false,
            message: "Fetching stopped by user"
        }));
        setIsLoading(false);
    };
    
    // Handle pause/resume fetching
    const handlePauseResume = async () => {
        const newPausedState = !fetchingProgress.isPaused;
        
        try {
            // Update pause state in database
            const response = await fetch("/api/facebook/contacts/pause", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ isPaused: newPausedState }),
            });

            if (response.ok) {
                isPausedRef.current = newPausedState;
                setFetchingProgress(prev => ({
                    ...prev,
                    isPaused: newPausedState,
                    message: newPausedState 
                        ? "Fetching paused. Click resume to continue."
                        : "Resuming fetch..."
                }));
            } else {
                console.error("Failed to update pause state:", await response.text());
                // Still update UI even if API call fails
                isPausedRef.current = newPausedState;
                setFetchingProgress(prev => ({
                    ...prev,
                    isPaused: newPausedState,
                    message: newPausedState 
                        ? "Fetching paused (local). Click resume to continue."
                        : "Resuming fetch..."
                }));
            }
        } catch (error) {
            console.error("Error updating pause state:", error);
            // Still update UI even if API call fails
            isPausedRef.current = newPausedState;
            setFetchingProgress(prev => ({
                ...prev,
                isPaused: newPausedState,
                message: newPausedState 
                    ? "Fetching paused (local). Click resume to continue."
                    : "Resuming fetch..."
            }));
        }
    };

    // Auto-fetch pages and contacts when user is signed in (only once)
    // Use stable userId to prevent dependency array size changes
    const userId = session?.user?.id || null;
    
    // Define fetchContactsRealtime outside useEffect so it can be called from multiple places
    const fetchContactsRealtime = React.useCallback(async () => {
        // Prevent multiple simultaneous calls - check both refs
        if (isFetchingRef.current || isConnectingRef.current) {
            console.log("[Frontend] fetchContactsRealtime already in progress, skipping duplicate call", {
                isFetching: isFetchingRef.current,
                isConnecting: isConnectingRef.current
            });
            return;
        }
        
        // Abort any existing connection first
        if (abortControllerRef.current) {
            console.log("[Frontend] Aborting existing connection before starting new one");
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        
        // Mark as connecting immediately to prevent race conditions
        isConnectingRef.current = true;
        isFetchingRef.current = true;
        hasFetchedRef.current = true;
        const storageKey = `hasFetched_${userId}`;
        if (userId) localStorage.setItem(storageKey, 'true');
        
        // Get current contact count before starting - preserve existing count
        const currentContactCount = contacts.length || fetchingProgress.totalContacts || 0;
        
        setIsLoading(true);
        setFetchingProgress(prev => ({
            ...prev,
            isFetching: true,
            // NEVER reset totalContacts to 0 if we already have contacts - always preserve the count
            totalContacts: Math.max(currentContactCount, prev.totalContacts),
            recentContacts: prev.recentContacts || [],
            message: currentContactCount > 0 
                ? `Resuming fetch... (${currentContactCount} contacts already loaded)`
                : "Starting to fetch contacts..."
        }));
        
        // Load existing contacts from database first (but still use stream for real-time updates)
        // Skip if we're already loading contacts or fetching
        if (isLoadingContactsRef.current || isFetchingRef.current || fetchingProgress.isFetching) {
            console.log("[Frontend] Skipping initial contact load - already loading or fetching");
        } else {
            isLoadingContactsRef.current = true;
            try {
                console.log("[Frontend] Checking for existing contacts in database...");
                const existingResponse = await fetch("/api/facebook/contacts?fromDatabase=true");
                if (existingResponse.ok) {
                    const existingData = await existingResponse.json();
                    console.log(`[Frontend] Received ${existingData.contacts?.length || 0} contacts from API`);
                    if (existingData.contacts && existingData.contacts.length > 0) {
                        console.log(`[Frontend] Found ${existingData.contacts.length} existing contacts. Loading them into UI...`);
                        setContacts(existingData.contacts);
                        setFetchingProgress(prev => ({
                            ...prev,
                            totalContacts: existingData.contacts.length,
                            message: `Loaded ${existingData.contacts.length} existing contacts. Fetching new ones...`
                        }));
                        // Continue to stream route to get real-time updates and fetch any new contacts
                    } else {
                        console.log("[Frontend] No existing contacts found. Will fetch from Facebook API via stream...");
                        // Reset count to 0 if no contacts found
                        setContacts([]);
                        setFetchingProgress(prev => ({
                            ...prev,
                            totalContacts: 0
                        }));
                    }
                } else {
                    const errorText = await existingResponse.text();
                    let errorData;
                    try {
                        errorData = JSON.parse(errorText);
                    } catch {
                        errorData = { error: errorText };
                    }
                    
                    console.error("[Frontend] Error loading contacts:", errorData);
                    
                    // Check if it's a rate limit error
                    if (errorData.error === "Facebook API rate limit reached" || errorData.details?.includes("rate limit")) {
                        setFetchingProgress(prev => ({
                            ...prev,
                            isFetching: false,
                            message: "⚠️ Facebook API rate limit reached. Please wait a few minutes and try again."
                        }));
                        setIsLoading(false);
                        isFetchingRef.current = false;
                        isLoadingContactsRef.current = false;
                        return;
                    }
                }
            } catch (e) {
                console.error("[Frontend] Error loading existing contacts:", e);
                console.log("No existing contacts found, starting fresh");
            } finally {
                isLoadingContactsRef.current = false;
            }
        }

        // Create abort controller for cancellation
        abortControllerRef.current = new AbortController();

        try {
            if (!abortControllerRef.current) {
                abortControllerRef.current = new AbortController();
            }
            console.log("[Frontend] Starting to fetch contacts from Facebook API via stream...");
            // Build fetch URL with optional page filter
            let fetchUrl = "/api/facebook/contacts/stream";
            if (selectedPage && selectedPage !== "All Pages") {
                // Find page ID from page name
                const selectedPageData = pageData.find((p: any) => p.name === selectedPage);
                if (selectedPageData?.id) {
                    fetchUrl += `?pageId=${selectedPageData.id}`;
                }
            }
            
            const response = await fetch(fetchUrl, {
                signal: abortControllerRef.current.signal
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error("[Frontend] Stream response not OK:", response.status, errorText);
                throw new Error(`Failed to start stream: ${response.status}`);
            }
            
            console.log("[Frontend] Stream connection established. Reading data...");
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error("Stream not available");
            }

            let buffer = "";
            const recentContacts: any[] = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            switch (data.type) {
                                case "status":
                                    setFetchingProgress(prev => ({
                                        ...prev,
                                        totalContacts: Math.max(data.totalContacts || 0, prev.totalContacts, contacts.length),
                                        // Update page number if provided to keep progress bar accurate
                                        ...(data.currentPage !== undefined && {
                                            currentPageNumber: Math.max(data.currentPage, prev.currentPageNumber || 0)
                                        }),
                                        ...(data.totalPages !== undefined && { totalPages: data.totalPages }),
                                        message: data.message || prev.message
                                    }));
                                    break;
                                
                                case "page_progress":
                                    // Update progress bar during page processing without changing page name
                                    setFetchingProgress(prev => ({
                                        ...prev,
                                        totalContacts: Math.max(data.totalContacts || 0, prev.totalContacts, contacts.length),
                                        // Update page number to keep progress bar accurate
                                        currentPageNumber: data.currentPage !== undefined 
                                            ? Math.max(data.currentPage, prev.currentPageNumber || 0)
                                            : prev.currentPageNumber,
                                        totalPages: data.totalPages || prev.totalPages,
                                        message: data.message || prev.message
                                    }));
                                    break;
                                
                                case "pages_fetched":
                                    setFetchingProgress(prev => ({
                                        ...prev,
                                        totalPages: data.totalPages,
                                        message: data.message
                                    }));
                                    break;
                                
                                case "page_start":
                                    // Only update page info when a new page actually starts
                                    setFetchingProgress(prev => ({
                                        ...prev,
                                        currentPage: data.pageName || prev.currentPage,
                                        // NEVER decrease page number - only move forward
                                        currentPageNumber: data.currentPage !== undefined 
                                            ? Math.max(data.currentPage, prev.currentPageNumber || 0)
                                            : prev.currentPageNumber,
                                        totalPages: data.totalPages || prev.totalPages,
                                        message: data.message || prev.message
                                    }));
                                    break;
                                
                                case "page_conversations":
                                    console.log("[Frontend] Page conversations:", data.conversationsCount, "in", data.pageName);
                                    setFetchingProgress(prev => ({
                                        ...prev,
                                        message: `Found ${data.conversationsCount} conversations in ${data.pageName}`
                                    }));
                                    break;
                                
                                case "contact":
                                    // Add contact immediately to the list
                                    setContacts(prev => {
                                        // Avoid duplicates based on contact_id and page_id
                                        const exists = prev.find(c => 
                                            (c.id === data.contact.id || c.contact_id === data.contact.id) && 
                                            (c.pageId === data.contact.pageId || c.page_id === data.contact.pageId)
                                        );
                                        if (exists) {
                                            // Update existing contact with new data
                                            return prev.map(c => 
                                                ((c.id === data.contact.id || c.contact_id === data.contact.id) && 
                                                 (c.pageId === data.contact.pageId || c.page_id === data.contact.pageId))
                                                    ? { ...c, ...data.contact }
                                                    : c
                                            );
                                        }
                                        return [data.contact, ...prev];
                                    });
                                    
                                    // Track recent contacts for animation
                                    recentContacts.unshift(data.contact);
                                    if (recentContacts.length > 5) recentContacts.pop();
                                    
                                    // Update progress with contact count - log every 100 contacts
                                    if (data.totalContacts % 100 === 0) {
                                        console.log("[Frontend] Total contacts so far:", data.totalContacts);
                                    }
                                    
                                    // Calculate the maximum total to ensure count never decreases
                                    const streamTotal = Math.max(data.totalContacts || 0, contacts.length);
                                    
                                    setFetchingProgress(prev => {
                                        const finalTotal = Math.max(streamTotal, prev.totalContacts, contacts.length);
                                        // DON'T update page info from contact events - only update count
                                        // Page info should only change on page_start/page_complete events
                                        // Only update message every 50 contacts to reduce UI flicker
                                        const shouldUpdateMessage = finalTotal % 50 === 0 || prev.totalContacts === 0;
                                        return {
                                            ...prev,
                                            // NEVER decrease totalContacts - always use maximum
                                            totalContacts: finalTotal,
                                            recentContacts: [...recentContacts],
                                            // Only update message periodically to avoid constant UI flicker
                                            // Keep the current page name stable - don't change it on every contact
                                            message: shouldUpdateMessage && prev.currentPage 
                                                ? `Processing ${prev.currentPage}... Found ${finalTotal} contacts so far...`
                                                : prev.message || (prev.currentPage 
                                                    ? `Processing ${prev.currentPage}...`
                                                    : `Found ${finalTotal} contacts so far...`),
                                            // Don't update page number or page name from contact events
                                            // Only update totalPages if provided
                                            ...(data.totalPages !== undefined && { totalPages: data.totalPages })
                                        };
                                    });
                                    
                                    // Extract tags
                                    setTags(prev => {
                                        const allTags = new Set(prev);
                                        data.contact.tags?.forEach((tag: string) => allTags.add(tag));
                                        return Array.from(allTags);
                                    });
                                    break;
                                
                                case "page_complete":
                                    // Ensure total never decreases
                                    const pageCompleteTotal = Math.max(data.totalContacts || 0, contacts.length);
                                    setFetchingProgress(prev => {
                                        const finalTotal = Math.max(pageCompleteTotal, prev.totalContacts, contacts.length);
                                        // NEVER decrease page number - only move forward
                                        const newPageNumber = data.currentPage !== undefined 
                                            ? Math.max(data.currentPage, prev.currentPageNumber || 0)
                                            : prev.currentPageNumber;
                                        return {
                                            ...prev,
                                            totalContacts: finalTotal,
                                            // NEVER decrease page number - only move forward
                                            ...(data.currentPage !== undefined && { currentPageNumber: newPageNumber }),
                                            message: `✓ ${data.pageName}: ${data.contactsCount} contacts (Total: ${finalTotal})`
                                        };
                                    });
                                    break;
                                
                                case "page_error":
                                    setFetchingProgress(prev => ({
                                        ...prev,
                                        message: `⚠ ${data.pageName}: ${data.error}`
                                    }));
                                    break;
                                
                                case "complete":
                                    setFetchingProgress(prev => ({
                                        ...prev,
                                        isFetching: false,
                                        message: data.message || `Sync completed! ${data.newContactsCount || 0} new contacts found. Auto-fetching enabled for new messages.`,
                                        // NEVER decrease totalContacts - always use maximum of all sources
                                        totalContacts: Math.max(data.totalContacts || 0, prev.totalContacts, contacts.length)
                                    }));
                                    setIsLoading(false);
                                    isFetchingRef.current = false;
                                    isConnectingRef.current = false;
                                    abortControllerRef.current = null;
                                    // Keep hasFetchedRef as true since we completed successfully
                                    console.log(`✅ [Frontend] Sync completed. Auto-fetching enabled - will check for new messages every 3 seconds.`);
                                    break;
                                
                                case "error":
                                    setFetchingProgress(prev => ({
                                        ...prev,
                                        isFetching: false,
                                        message: `Error: ${data.message || "Unknown error occurred"}`
                                    }));
                                    setIsLoading(false);
                                    isFetchingRef.current = false;
                                    isConnectingRef.current = false;
                                    abortControllerRef.current = null;
                                    // Reset hasFetchedRef on error to allow retry
                                    hasFetchedRef.current = false;
                                    if (userId) {
                                        const storageKey = `hasFetched_${userId}`;
                                        localStorage.removeItem(storageKey);
                                    }
                                    console.error(`❌ [Frontend] Fetch error: ${data.message}`);
                                    break;
                            }
                        } catch (e) {
                            console.error("Error parsing SSE data:", e);
                        }
                    }
                }
            }
        } catch (error: any) {
            console.error("[Frontend] Error fetching contacts:", error);
            if (error.name !== "AbortError") {
                setFetchingProgress(prev => ({
                    ...prev,
                    isFetching: false,
                    message: error.message || "Error fetching contacts"
                }));
                setIsLoading(false);
                // Reset refs to allow retry
                isFetchingRef.current = false;
                isConnectingRef.current = false;
                hasFetchedRef.current = false; // Reset to allow manual retry
            } else {
                // AbortError means user cancelled, still reset refs
                isFetchingRef.current = false;
                isConnectingRef.current = false;
            }
            abortControllerRef.current = null;
        }
    }, [userId, contacts.length, fetchingProgress.totalContacts, selectedPage, pageData]);
    
    useEffect(() => {
        if (status !== "authenticated" || !session || !userId) {
            console.log("[Frontend] Not authenticated yet, skipping...");
            return;
        }
        
        // Clear any pending debounce timeout
        if (contactLoadTimeoutRef.current) {
            clearTimeout(contactLoadTimeoutRef.current);
            contactLoadTimeoutRef.current = null;
        }
        
        // Debounce contact loading - only load if it's been more than 2 seconds since last load
        const now = Date.now();
        const timeSinceLastLoad = now - lastContactLoadTimeRef.current;
        const DEBOUNCE_DELAY = 2000; // 2 seconds
        
        if (timeSinceLastLoad < DEBOUNCE_DELAY) {
            console.log(`[Frontend] Debouncing contact load - only ${timeSinceLastLoad}ms since last load`);
            // Schedule a delayed load
            contactLoadTimeoutRef.current = setTimeout(() => {
                contactLoadTimeoutRef.current = null;
                // Re-trigger this effect logic after debounce
                if (status === "authenticated" && session && userId && !isFetchingRef.current && !fetchingProgress.isFetching && !isLoadingContactsRef.current) {
                    lastContactLoadTimeRef.current = Date.now();
                    // Will be handled by the effect running again
                }
            }, DEBOUNCE_DELAY - timeSinceLastLoad);
            return;
        }
        
        // Always load existing contacts from database first on mount/refresh
        // BUT skip if we're currently fetching (to avoid resetting the UI)
        const loadExistingContacts = async () => {
            // STRICT: Don't reload contacts if we're actively fetching or already loading
            // This prevents UI resets during stream processing
            if (isFetchingRef.current || fetchingProgress.isFetching || isLoadingContactsRef.current || isConnectingRef.current) {
                console.log("[Frontend] STRICT: Skipping contact load - fetch/connect in progress");
                return contacts.length;
            }
            
            // Check if we already have contacts - don't reload unnecessarily
            if (contacts.length > 0) {
                console.log(`[Frontend] Already have ${contacts.length} contacts, skipping reload`);
                return contacts.length;
            }
            
            isLoadingContactsRef.current = true;
            lastContactLoadTimeRef.current = Date.now();
            try {
                console.log("[Frontend] Loading contacts from database...");
                const existingResponse = await fetch("/api/facebook/contacts?fromDatabase=true");
                if (existingResponse.ok) {
                    const existingData = await existingResponse.json();
                    if (existingData.contacts && existingData.contacts.length > 0) {
                        console.log(`[Frontend] Loaded ${existingData.contacts.length} existing contacts from database`);
                        setContacts(existingData.contacts);
                        setFetchingProgress(prev => ({
                            ...prev,
                            totalContacts: existingData.contacts.length,
                            message: `Loaded ${existingData.contacts.length} contacts from database`
                        }));
                        isLoadingContactsRef.current = false;
                        return existingData.contacts.length;
                    } else {
                        // No contacts found - reset to 0
                        setContacts([]);
                        setFetchingProgress(prev => ({
                            ...prev,
                            totalContacts: 0
                        }));
                    }
                }
            } catch (e) {
                console.error("[Frontend] Error loading existing contacts:", e);
                // On error, only reset if we don't have contacts
                if (contacts.length === 0) {
                    setContacts([]);
                    setFetchingProgress(prev => ({
                        ...prev,
                        totalContacts: 0
                    }));
                }
            } finally {
                isLoadingContactsRef.current = false;
            }
            return 0;
        };
        
        // First, check if there's a running job in the database
        const checkAndReconnect = async () => {
            try {
                const jobResponse = await fetch("/api/facebook/contacts/pause");
                if (jobResponse.ok) {
                    const jobData = await jobResponse.json();
                    const job = jobData.job;
                    
                    // If there's a running or paused job, we should reconnect
                    if (job && (job.status === "running" || job.status === "paused")) {
                        console.log("[Frontend] Found active job, will reconnect to stream");
                        // Only load existing contacts if we don't have any and we're not fetching
                        // This prevents resetting the UI during an active fetch
                        // Also check debounce - don't load if we just loaded recently
                        const now = Date.now();
                        const timeSinceLastLoad = now - lastContactLoadTimeRef.current;
                        if (!isFetchingRef.current && !fetchingProgress.isFetching && contacts.length === 0 && !isLoadingContactsRef.current && timeSinceLastLoad > 2000) {
                            isLoadingContactsRef.current = true;
                            lastContactLoadTimeRef.current = Date.now();
                            try {
                                console.log("[Frontend] Loading contacts for reconnect...");
                                const existingResponse = await fetch("/api/facebook/contacts?fromDatabase=true");
                                if (existingResponse.ok) {
                                    const existingData = await existingResponse.json();
                                    if (existingData.contacts && existingData.contacts.length > 0) {
                                        console.log(`[Frontend] Loaded ${existingData.contacts.length} existing contacts from database`);
                                        setContacts(existingData.contacts);
                                        setFetchingProgress(prev => ({
                                            ...prev,
                                            totalContacts: existingData.contacts.length,
                                            isFetching: job.status === "running" && !job.is_paused,
                                            isPaused: job.is_paused || job.status === "paused",
                                            currentPage: job.current_page_name,
                                            // NEVER decrease page number - only move forward
                                            currentPageNumber: job.current_page_number !== undefined && job.current_page_number !== null
                                                ? Math.max(job.current_page_number, prev.currentPageNumber || 0)
                                                : prev.currentPageNumber,
                                            totalPages: job.total_pages,
                                            message: job.message || `Resuming fetch... (${existingData.contacts.length} contacts loaded)`
                                        }));
                                    } else {
                                        // No contacts found - update progress but don't reset contacts if we have some
                                        if (contacts.length === 0) {
                                            setContacts([]);
                                        }
                                        setFetchingProgress(prev => ({
                                            ...prev,
                                            totalContacts: contacts.length || 0,
                                            isFetching: job.status === "running" && !job.is_paused,
                                            isPaused: job.is_paused || job.status === "paused",
                                            currentPage: job.current_page_name,
                                            currentPageNumber: job.current_page_number || prev.currentPageNumber,
                                            totalPages: job.total_pages,
                                            message: job.message || "No contacts found"
                                        }));
                                    }
                                }
                            } catch (e) {
                                console.error("[Frontend] Error loading existing contacts:", e);
                                // Don't reset contacts on error if we have some
                                if (contacts.length === 0) {
                                    setContacts([]);
                                }
                            } finally {
                                isLoadingContactsRef.current = false;
                            }
                        } else {
                            // Just update the fetching progress state without reloading contacts
                            setFetchingProgress(prev => ({
                                ...prev,
                                isFetching: job.status === "running" && !job.is_paused,
                                isPaused: job.is_paused || job.status === "paused",
                                currentPage: job.current_page_name,
                                currentPageNumber: job.current_page_number !== undefined && job.current_page_number !== null
                                    ? Math.max(job.current_page_number, prev.currentPageNumber || 0)
                                    : prev.currentPageNumber,
                                totalPages: job.total_pages,
                                totalContacts: Math.max(prev.totalContacts, contacts.length, job.total_contacts || 0),
                                message: job.message || prev.message
                            }));
                        }
                        
                        // Reconnect to stream if job is running and not paused
                        // Only reconnect if we're NOT already fetching (to prevent duplicate connections)
                        if (job.status === "running" && !job.is_paused && !isFetchingRef.current) {
                            // Only reset hasFetchedRef if we're not already connected
                            // Don't reset isFetchingRef - let fetchContactsRealtime handle that
                            hasFetchedRef.current = false;
                            return true; // Signal that we should start fetching
                        } else {
                            // Job is paused, just update UI
                            setFetchingProgress(prev => ({
                                ...prev,
                                isFetching: false,
                                isPaused: true,
                                // NEVER reset totalContacts to 0 - always preserve the maximum count
                                totalContacts: job.total_contacts !== undefined && job.total_contacts !== null
                                    ? Math.max(job.total_contacts, prev.totalContacts, contacts.length)
                                    : Math.max(prev.totalContacts, contacts.length),
                                message: "Fetching paused. Click resume to continue."
                            }));
                            return false; // Don't start fetching
                        }
                    }
                }
            } catch (error) {
                console.error("[Frontend] Error checking job status:", error);
            }
            return false;
        };
        
        // Check localStorage to see if we've already fetched for this user
        const storageKey = `hasFetched_${userId}`;
        
        // Load existing contacts first
        loadExistingContacts().then(existingCount => {
            const storedHasFetched = userId ? localStorage.getItem(storageKey) === 'true' : false;
            
            console.log("[Frontend] useEffect triggered:", {
                status,
                userId,
                isFetchingRef: isFetchingRef.current,
                hasFetchedRef: hasFetchedRef.current,
                storedHasFetched,
                existingContactsCount: existingCount
            });
            
            // Prevent multiple simultaneous fetches
            if (isFetchingRef.current) {
                console.log("[Frontend] Fetch already in progress, skipping...");
                return;
            }
            
            // Check for running job first (before checking hasFetchedRef)
            checkAndReconnect().then(shouldReconnect => {
                if (shouldReconnect) {
                    // Job is running, reconnect to stream
                    console.log("[Frontend] Reconnecting to active job...");
                    // Continue to fetchContactsRealtime below
                } else if (hasFetchedRef.current && storedHasFetched && !fetchingProgress.isFetching) {
                    console.log("[Frontend] Already fetched for this user and no active job, skipping automatic fetch...");
                    // Don't return - still allow manual fetch if user wants
                    // Only skip if we're not in a fetching state
                } else {
                    console.log("[Frontend] Starting new contact fetch process...");
                }
                
                // Now proceed with fetching if needed
                if (status === "authenticated" && session) {
                    // Fetch pages first
                    fetch("/api/facebook/pages").then(pagesResponse => {
                        let fetchedPages: any[] = [];
                        if (pagesResponse.ok) {
                            return pagesResponse.json().then(pagesData => {
                                fetchedPages = pagesData.pages || [];
                                
                                // All fetched pages are automatically connected
                                const allPageIds = fetchedPages.map((p: any) => p.id);
                                setConnectedPageIds(allPageIds);
                                setAvailablePages(fetchedPages);
                                setPageData(fetchedPages);
                                const pageNames = ["All Pages", ...fetchedPages.map((p: any) => p.name)];
                                setPages(pageNames);
                                
                                // Then fetch contacts in real-time (only if not already fetching and should fetch)
                                if (!isFetchingRef.current && (shouldReconnect || !storedHasFetched)) {
                                    fetchContactsRealtime();
                                }
                            });
                        }
                    }).catch(error => {
                        console.error("Error fetching data:", error);
                        setIsLoading(false);
                        isFetchingRef.current = false;
                    });
                }
            });
        });
        
        // Cleanup: clear any pending debounce timeout
        return () => {
            if (contactLoadTimeoutRef.current) {
                clearTimeout(contactLoadTimeoutRef.current);
                contactLoadTimeoutRef.current = null;
            }
        };
    }, [status, userId, fetchContactsRealtime]); // Use stable userId variable to keep array size constant
    
    // Poll for job status and update UI (but don't trigger new connections)
    useEffect(() => {
        if (status !== "authenticated" || !userId) return;
        
        const pollJobStatus = async () => {
            try {
                const response = await fetch("/api/facebook/contacts/pause");
                if (response.ok) {
                    const data = await response.json();
                    const job = data.job;
                    
                    if (job && (job.status === "running" || job.status === "paused")) {
                        // Only update UI if we're not already fetching (to avoid conflicts)
                        if (!isFetchingRef.current) {
                            // Update UI with job status from database
                            setFetchingProgress(prev => ({
                                ...prev,
                                isFetching: job.status === "running" && !job.is_paused,
                                isPaused: job.is_paused || job.status === "paused",
                                // NEVER reset totalContacts to 0 - always preserve the maximum count
                                totalContacts: job.total_contacts !== undefined && job.total_contacts !== null
                                    ? Math.max(job.total_contacts, prev.totalContacts, contacts.length)
                                    : Math.max(prev.totalContacts, contacts.length),
                                currentPage: job.current_page_name || prev.currentPage,
                                // NEVER decrease page number - only move forward
                                currentPageNumber: job.current_page_number !== undefined && job.current_page_number !== null
                                    ? Math.max(job.current_page_number, prev.currentPageNumber || 0)
                                    : prev.currentPageNumber,
                                totalPages: job.total_pages || prev.totalPages,
                                message: job.message || "Fetching in background..."
                            }));
                            
                            // Sync pause state
                            isPausedRef.current = job.is_paused || false;
                        } else {
                            // We're connected, just sync the pause state and update progress
                            if (job.is_paused !== fetchingProgress.isPaused) {
                                isPausedRef.current = job.is_paused || false;
                                setFetchingProgress(prev => ({
                                    ...prev,
                                    isPaused: job.is_paused || false,
                                    message: job.is_paused 
                                        ? "Fetching paused. Click resume to continue."
                                        : prev.message
                                }));
                            }
                            
                            // Update progress from job (but don't override if stream is sending updates)
                            // Always update, but never decrease the count - preserve maximum
                            if (job.total_contacts !== undefined && job.total_contacts !== null) {
                                setFetchingProgress(prev => ({
                                    ...prev,
                                    // NEVER decrease totalContacts - always use maximum of all sources
                                    totalContacts: Math.max(prev.totalContacts, job.total_contacts, contacts.length),
                                    currentPage: job.current_page_name || prev.currentPage,
                                    // NEVER decrease page number - only move forward
                                    currentPageNumber: job.current_page_number !== undefined && job.current_page_number !== null
                                        ? Math.max(job.current_page_number, prev.currentPageNumber || 0)
                                        : prev.currentPageNumber,
                                    totalPages: job.total_pages || prev.totalPages,
                                    message: job.message || prev.message
                                }));
                            }
                        }
                    } else if (job && job.status === "completed") {
                        // Job completed, update UI
                        if (fetchingProgress.isFetching) {
                            setFetchingProgress(prev => ({
                                ...prev,
                                isFetching: false,
                                // NEVER reset totalContacts to 0 - always preserve the maximum count
                                totalContacts: job.total_contacts !== undefined && job.total_contacts !== null
                                    ? Math.max(job.total_contacts, prev.totalContacts, contacts.length)
                                    : Math.max(prev.totalContacts, contacts.length),
                                message: job.message || "Fetching completed"
                            }));
                            setIsLoading(false);
                            isFetchingRef.current = false;
                        }
                    } else if (!job) {
                        // Job doesn't exist or was cleared - preserve the count from contacts array
                        // Don't reset if we have contacts
                        if (contacts.length > 0) {
                            setFetchingProgress(prev => ({
                                ...prev,
                                // Preserve the maximum count - never reset to 0 if we have contacts
                                totalContacts: Math.max(prev.totalContacts, contacts.length),
                                isFetching: false
                            }));
                        }
                    }
                }
            } catch (error) {
                console.error("[Frontend] Error polling job status:", error);
            }
        };
        
        // Poll every 10 seconds (reduced frequency to avoid conflicts and excessive requests)
        const interval = setInterval(pollJobStatus, 10000);
        
        // Poll immediately
        pollJobStatus();
        
        return () => clearInterval(interval);
    }, [status, userId]); // Removed fetchingProgress from deps to avoid re-triggering
    
    // Manual trigger for background fetch
    const handleStartBackgroundFetch = async () => {
        if (isFetchingRef.current) {
            console.log("Fetch already in progress");
            return;
        }
        
        // Reset refs to allow new fetch
        hasFetchedRef.current = false;
        isFetchingRef.current = false;
        
        // Trigger background job (server-side)
        try {
            const response = await fetch("/api/facebook/contacts/background", {
                method: "POST"
            });
            if (response.ok) {
                console.log("Background fetch started");
            }
        } catch (error) {
            console.error("Error starting background fetch:", error);
        }
    };

    // Poll for new contacts and auto-fetch when new messages arrive
    // This runs continuously after initial sync to catch new messages immediately
    useEffect(() => {
        if (status !== "authenticated" || !session) return;

        let pollInterval = setInterval(async () => {
            try {
                // Only check if we're not currently fetching
                if (isFetchingRef.current || fetchingProgress.isFetching) {
                    return;
                }

                // Check for pending fetch jobs (triggered by webhooks)
                const jobResponse = await fetch("/api/facebook/contacts/background");
                if (jobResponse.ok) {
                    const jobData = await jobResponse.json();
                    const job = jobData.job;
                    
                    // If there's a pending job triggered by webhook, start fetching immediately
                    if (job && job.status === "pending" && !isFetchingRef.current && !fetchingProgress.isFetching) {
                        console.log("[Frontend] 🚀 New message detected via webhook, starting immediate auto-fetch...");
                        // Reset refs to allow fetch
                        hasFetchedRef.current = false;
                        fetchContactsRealtime();
                    } else if (job && job.status === "running" && job.is_paused) {
                        // Resume paused job if needed
                        console.log("[Frontend] Resuming paused fetch job...");
                        await fetch("/api/facebook/contacts/pause", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ isPaused: false }),
                        });
                    }
                }
            } catch (error) {
                console.error("Error checking for new messages:", error);
            }
        }, 10000); // Poll every 10 seconds (reduced to avoid excessive requests during fetch)

        return () => clearInterval(pollInterval);
    }, [status, session, fetchingProgress.isFetching, fetchContactsRealtime]);

    // All pages are automatically connected - no modal needed

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedTag, selectedPage, searchQuery, dateFilter]);

    // Computed total contacts - use actual contacts length when not fetching
    // Only use fetchingProgress.totalContacts during active fetching
    const displayTotalContacts = useMemo(() => {
        // If we're actively fetching, show the progress count
        if (fetchingProgress.isFetching) {
            return Math.max(
                fetchingProgress.totalContacts || 0,
                contacts.length || 0
            );
        }
        // When not fetching, always use the actual contacts array length
        return contacts.length || 0;
    }, [fetchingProgress.totalContacts, fetchingProgress.isFetching, contacts.length]);

    // Filter contacts - show contacts from all connected pages by default, or filter by selected page
    const filteredContacts = useMemo(() => {
        return contacts.filter((contact) => {
            const matchesTag = selectedTag === "All" || (contact.tags && contact.tags.includes(selectedTag));
            
            // Page filtering: "All Pages" shows everything, otherwise filter by selected page
            // Check both contact.page and contact.page_name for compatibility
            const contactPageName = contact.page || contact.page_name || contact.pageName;
            const matchesPage = selectedPage === "All Pages" || contactPageName === selectedPage;
            
            const matchesSearch = contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                contact.role?.toLowerCase().includes(searchQuery.toLowerCase());
            
            // Date filtering: Match if contact has activity (message or conversation) on that date
            // Use lastContactMessageDate if available (contact sent message), otherwise use date (conversation date)
            const contactMessageDate = contact.lastContactMessageDate || contact.date;
            const matchesDate = !dateFilter || contactMessageDate === dateFilter;

            return matchesTag && matchesSearch && matchesPage && matchesDate;
        });
    }, [selectedTag, selectedPage, searchQuery, dateFilter, contacts, tags]);
    
    // Update pages list from contacts when contacts change
    useEffect(() => {
        const uniquePages = new Set<string>(["All Pages"]);
        contacts.forEach(contact => {
            const pageName = contact.page || contact.page_name || contact.pageName;
            if (pageName) {
                uniquePages.add(pageName);
            }
        });
        setPages(Array.from(uniquePages).sort());
    }, [contacts]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
    const paginatedContacts = filteredContacts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );
    
    // Modal computed values
    const filteredAvailablePages = useMemo(() => {
        return availablePages.filter((page: any) => 
            page.name.toLowerCase().includes(pageSearchQuery.toLowerCase())
        );
    }, [availablePages, pageSearchQuery]);
    
    const modalItemsPerPage = 5;
    const modalTotalPages = Math.ceil(filteredAvailablePages.length / modalItemsPerPage);
    const paginatedModalPages = filteredAvailablePages.slice(
        (pageModalCurrentPage - 1) * modalItemsPerPage,
        pageModalCurrentPage * modalItemsPerPage
    );
    
    // Page selection functions
    const clearConnectedPageSelection = () => {
        setSelectedPageIdsForDisconnect([]);
    };
    
    const selectAllConnectedPages = () => {
        setSelectedPageIdsForDisconnect([...connectedPageIds]);
    };
    
    const toggleConnectedPageSelection = (pageId: string) => {
        setSelectedPageIdsForDisconnect(prev => 
            prev.includes(pageId) 
                ? prev.filter(id => id !== pageId)
                : [...prev, pageId]
        );
    };
    
    const handleBulkDisconnect = async () => {
        if (selectedPageIdsForDisconnect.length === 0) return;
        // Implementation would go here
        console.log("Bulk disconnect:", selectedPageIdsForDisconnect);
        setSelectedPageIdsForDisconnect([]);
    };
    
    const clearAvailablePageSelection = () => {
        setSelectedAvailablePageIds([]);
    };
    
    const selectAllAvailablePages = () => {
        const unconnectedPages = filteredAvailablePages
            .filter((p: any) => !connectedPageIds.includes(p.id))
            .map((p: any) => p.id);
        setSelectedAvailablePageIds(unconnectedPages);
    };
    
    const handleBulkConnectAvailablePages = async () => {
        if (selectedAvailablePageIds.length === 0) return;
        // Implementation would go here
        console.log("Bulk connect:", selectedAvailablePageIds);
        setSelectedAvailablePageIds([]);
    };
    
    const handleBulkDeleteAvailablePages = async () => {
        if (selectedAvailablePageIds.length === 0) return;
        // Implementation would go here
        console.log("Bulk delete:", selectedAvailablePageIds);
        setSelectedAvailablePageIds([]);
    };

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
        const allIds = filteredContacts.map(c => c.id || c.contact_id || c.contactId);
        setSelectedContactIds(allIds.filter(id => id !== undefined && id !== null));
    };

    const clearSelection = () => {
        setSelectedContactIds([]);
    };

    const handleDelete = async () => {
        if (confirm(`Are you sure you want to delete ${selectedContactIds.length} contacts?`)) {
            try {
                // Delete from database
                const response = await fetch("/api/facebook/contacts", {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ contactIds: selectedContactIds }),
                });

                if (response.ok) {
                    // Remove from UI
                    setContacts(prev => {
                        const updated = prev.filter(c => !selectedContactIds.includes(c.id));
                        // Reset fetching progress totalContacts to match actual contacts count
                        setFetchingProgress(prevProgress => ({
                            ...prevProgress,
                            totalContacts: updated.length
                        }));
                        return updated;
                    });
                    setSelectedContactIds([]);
                } else {
                    const error = await response.json();
                    alert(`Error deleting contacts: ${error.error || "Unknown error"}`);
                }
            } catch (error) {
                console.error("Error deleting contacts:", error);
                alert("Error deleting contacts. Please try again.");
            }
        }
    };

    // Page management removed - pages are now automatically synced from Facebook and stored in database
    // Multiple users can access the same pages simultaneously
    // All pages are automatically connected when user logs in

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
            // Validate file size (25MB limit)
            if (file.size > 25 * 1024 * 1024) {
                alert("File size exceeds 25MB limit.");
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
                return;
            }
            
            // Validate file type (images, videos, audio, and common document types)
            const validMediaTypes = [
                // Images
                "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
                // Videos
                "video/mp4", "video/quicktime", "video/x-msvideo", "video/x-ms-wmv", "video/webm",
                // Audio
                "audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm",
                // Documents
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
                "application/vnd.ms-powerpoint",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation" // .pptx
            ];
            
            if (!validMediaTypes.includes(file.type)) {
                alert("Unsupported file type. Please use images, videos, audio, or documents (PDF, DOC, XLS, PPT).");
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
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

    // Send broadcast message
    const handleSendBroadcast = async () => {
        if (!message.trim()) {
            alert("Please enter a message");
            return;
        }

        if (selectedContactIds.length === 0) {
            alert("Please select at least one contact");
            return;
        }

        setActiveSends(prev => prev + 1);

        try {
            // Upload file if attached
            let attachment = null;
            if (attachedFile) {
                try {
                    // Upload file to storage
                    const uploadFormData = new FormData();
                    uploadFormData.append("file", attachedFile);
                    
                    const uploadResponse = await fetch("/api/upload", {
                        method: "POST",
                        body: uploadFormData,
                    });

                    // Check if response has content before parsing
                    const contentType = uploadResponse.headers.get("content-type");
                    let uploadData;
                    
                    if (contentType && contentType.includes("application/json")) {
                        const text = await uploadResponse.text();
                        if (!text || text.trim() === "") {
                            throw new Error("Empty response from server");
                        }
                        try {
                            uploadData = JSON.parse(text);
                        } catch (parseError) {
                            console.error("Failed to parse JSON response:", text);
                            throw new Error(`Server returned invalid response: ${text.substring(0, 100)}`);
                        }
                    } else {
                        const text = await uploadResponse.text();
                        const statusText = uploadResponse.statusText || "Unknown";
                        const status = uploadResponse.status || "Unknown";
                        
                        // Log full response for debugging
                        console.error("Non-JSON response received:", {
                            status,
                            statusText,
                            contentType,
                            responseText: text.substring(0, 500),
                            headers: Object.fromEntries(uploadResponse.headers.entries())
                        });
                        
                        // Try to extract error message from HTML if it's an error page
                        let errorMessage = `Server returned non-JSON response (Status: ${status} ${statusText})`;
                        if (text) {
                            // Try to find error message in HTML
                            const errorMatch = text.match(/<title>(.*?)<\/title>/i) || text.match(/<h1>(.*?)<\/h1>/i);
                            if (errorMatch) {
                                errorMessage += `: ${errorMatch[1]}`;
                            } else if (text.length < 200) {
                                errorMessage += `: ${text}`;
                            }
                        }
                        
                        throw new Error(errorMessage);
                    }

                    if (!uploadResponse.ok || !uploadData.success) {
                        throw new Error(uploadData.error || uploadData.details || "Failed to upload file");
                    }

                    // Set attachment with the uploaded URL and detected type
                    attachment = {
                        url: uploadData.url,
                        type: uploadData.type || "file" // Type is determined by the upload API
                    };
                } catch (uploadError: any) {
                    console.error("Error uploading file:", uploadError);
                    alert(`Failed to upload file: ${uploadError.message || "Unknown error"}`);
                    // Don't decrement here - let finally block handle it
                    return;
                }
            }

            const response = await fetch("/api/facebook/messages/send", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    contactIds: selectedContactIds,
                    message: message.trim(),
                    scheduleDate: scheduleDate || null,
                    attachment: attachment
                }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                alert(`✅ Successfully sent ${data.results.sent} message(s)!${data.results.failed > 0 ? `\n⚠️ ${data.results.failed} failed.` : ''}`);
            } else {
                alert(`❌ Failed to send messages: ${data.error || "Unknown error"}`);
            }
        } catch (error: any) {
            console.error("Error sending broadcast:", error);
            alert(`❌ Error: ${error.message || "Failed to send messages"}`);
        } finally {
            setActiveSends(prev => {
                const newCount = prev - 1;
                // Clear form only if this was the last active send
                if (newCount === 0) {
                    setMessage("");
                    setSelectedContactIds([]);
                    setScheduleDate("");
                    setAttachedFile(null);
                    if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                    }
                }
                return newCount;
            });
        }
    };

    const isPageSelected = paginatedContacts.length > 0 && paginatedContacts.every(c => {
        const contactId = c.id || c.contact_id || c.contactId;
        return contactId && selectedContactIds.includes(contactId);
    });
    const isAllFilteredSelected = filteredContacts.length > 0 && filteredContacts.every(c => {
        const contactId = c.id || c.contact_id || c.contactId;
        return contactId && selectedContactIds.includes(contactId);
    });

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
                    {status === "loading" ? (
                        <div className="flex items-center gap-2 rounded-full bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-400">
                            Loading...
                        </div>
                    ) : session ? (
                        <div className="relative" ref={profileDropdownRef}>
                            <button
                                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                                className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                            >
                                {session.user?.image && (
                                    <img
                                        src={session.user.image}
                                        alt={session.user.name || "User"}
                                        className="h-8 w-8 rounded-full ring-2 ring-indigo-500/50"
                                    />
                                )}
                                <span className="text-sm font-medium text-white">
                                    {session.user?.name || session.user?.email}
                                </span>
                                <svg 
                                    className={`w-4 h-4 text-zinc-400 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} 
                                    fill="none" 
                                    viewBox="0 0 24 24" 
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            
                            {showProfileDropdown && (
                                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-zinc-900 border border-white/10 shadow-2xl z-50 overflow-hidden">
                                    <div className="p-2">
                                        <div className="px-3 py-2 mb-2 border-b border-white/10">
                                            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Account</p>
                                            <p className="text-sm text-white truncate">{session.user?.name || session.user?.email}</p>
                                            {session.user?.email && (
                                                <p className="text-xs text-zinc-500 truncate mt-0.5">{session.user.email}</p>
                                            )}
                                        </div>
                                        
                                        <button
                                            onClick={() => {
                                                hasFetchedRef.current = false;
                                                isFetchingRef.current = false;
                                                isConnectingRef.current = false;
                                                if (userId) {
                                                    const storageKey = `hasFetched_${userId}`;
                                                    localStorage.removeItem(storageKey);
                                                }
                                                fetchContactsRealtime();
                                            }}
                                            disabled={fetchingProgress.isFetching}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-300 hover:bg-indigo-500/20 hover:text-indigo-400 rounded-lg transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            <span>{fetchingProgress.isFetching ? "Syncing..." : "Sync Contacts"}</span>
                                        </button>
                                        
                                        <button
                                            onClick={handleReconnect}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-300 hover:bg-indigo-500/20 hover:text-indigo-400 rounded-lg transition-colors text-left mt-1"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                            </svg>
                                            <span>Reconnect Facebook</span>
                                        </button>
                                        
                                        <button
                                            onClick={handleSignOut}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-lg transition-colors text-left mt-1"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                            </svg>
                                            <span>Sign Out</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={() => {
                                // Open popup window for Facebook login
                                const width = 600;
                                const height = 700;
                                const left = (window.screen.width - width) / 2;
                                const top = (window.screen.height - height) / 2;
                                
                                // Use popup callback URL
                                const popup = window.open(
                                    `/api/auth/signin/facebook?callbackUrl=${encodeURIComponent("/api/facebook/callback-popup?popup=true")}`,
                                    'facebook-login',
                                    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
                                );

                                // Poll to check if popup is closed (user completed auth)
                                const checkClosed = setInterval(() => {
                                    if (popup?.closed) {
                                        clearInterval(checkClosed);
                                        // Reload page to check for new session
                                        window.location.reload();
                                    }
                                }, 500);

                                // Also listen for messages from popup
                                const messageHandler = (event: MessageEvent) => {
                                    if (event.data?.type === 'AUTH_SUCCESS') {
                                        clearInterval(checkClosed);
                                        window.removeEventListener('message', messageHandler);
                                        window.location.reload();
                                    }
                                };
                                window.addEventListener('message', messageHandler);
                            }}
                            className="flex items-center gap-2 rounded-full bg-[#1877F2] hover:bg-[#166fe5] px-4 py-2 text-sm font-semibold text-white transition-all shadow-lg shadow-blue-900/20 hover:scale-105 active:scale-95"
                        >
                        <FacebookIcon />
                        <span>Sign in with Facebook</span>
                    </button>
                    )}
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
                    <div className="relative page-dropdown-container">
                        <button
                            type="button"
                            onClick={() => setShowPageDropdown(!showPageDropdown)}
                            disabled={isLoading || pages.length === 1 || fetchingProgress.isFetching}
                            className="w-full flex items-center justify-between rounded-xl bg-zinc-900/50 border border-white/10 py-3 px-4 text-sm text-zinc-100 outline-none transition-all focus:bg-zinc-900 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span>{selectedPage}</span>
                            <svg className={`w-4 h-4 text-zinc-400 transition-transform ${showPageDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {showPageDropdown && (
                            <div className="absolute top-full left-0 right-0 mt-2 rounded-xl bg-zinc-900 border border-white/10 shadow-2xl z-50 max-h-96 overflow-hidden flex flex-col">
                                <div className="relative p-2 border-b border-white/10">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2">
                                        <SearchIcon />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Search pages..."
                                        value={pageSearchQuery}
                                        onChange={(e) => setPageSearchQuery(e.target.value)}
                                        className="w-full rounded-lg bg-zinc-800/50 border border-white/10 py-2 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all focus:bg-zinc-800 focus:border-indigo-500/50"
                                        autoFocus
                                    />
                                </div>
                                <div className="overflow-y-auto max-h-80">
                                    {pages
                                        .filter(page => page.toLowerCase().includes(pageSearchQuery.toLowerCase()))
                                        .map(page => (
                                            <button
                                                key={page}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedPage(page);
                                                    setShowPageDropdown(false);
                                                    setPageSearchQuery("");
                                                }}
                                                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                                                    selectedPage === page
                                                        ? "bg-indigo-500/20 text-indigo-400"
                                                        : "text-zinc-300 hover:bg-zinc-800/50"
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        ))
                                    }
                                    {pages.filter(page => page.toLowerCase().includes(pageSearchQuery.toLowerCase())).length === 0 && (
                                        <div className="px-4 py-8 text-center text-sm text-zinc-500">
                                            No pages found
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
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



                {/* Loading Indicator (fallback) */}
                {isLoading && !fetchingProgress.isFetching && (
                    <div className="mb-4 flex items-center justify-center py-8">
                        <div className="flex items-center gap-3 text-sm text-zinc-400">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
                            <span>Loading pages and contacts...</span>
                        </div>
                    </div>
                )}

                {/* List Header */}
                <div className="mb-4 space-y-2">
                    <div className="flex items-center justify-between px-2 h-10">
                        <button
                            onClick={toggleSelectPage}
                            disabled={isLoading || fetchingProgress.isFetching}
                            className="flex items-center gap-3 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
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
                                disabled={fetchingProgress.isFetching}
                                className={`ml-2 font-semibold text-indigo-400 hover:underline ${fetchingProgress.isFetching ? "opacity-50 cursor-not-allowed" : ""}`}
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
                                disabled={fetchingProgress.isFetching}
                                className={`ml-2 font-semibold text-indigo-400 hover:underline ${fetchingProgress.isFetching ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                                Clear selection
                            </button>
                        </div>
                    )}
                </div>

                {/* Contact List */}
                <div className="space-y-2 min-h-[400px]">
                    {paginatedContacts.map((contact, index) => {
                        const contactId = contact.id || contact.contact_id || contact.contactId;
                        const isSelected = contactId && selectedContactIds.includes(contactId);
                        return (
                            <div
                                key={contact.id || contact.contact_id || contact.contactId}
                                onClick={() => toggleSelection(contactId)}
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

                    {!isLoading && paginatedContacts.length === 0 && (
                        <div className="py-20 text-center animate-in fade-in zoom-in-95 duration-300">
                            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 mb-4">
                                <SearchIcon />
                            </div>
                            {contacts.length === 0 ? (
                                <>
                            <h3 className="text-zinc-300 font-medium">No contacts found</h3>
                                    <p className="text-zinc-500 text-sm mt-1 max-w-md mx-auto">
                                        No conversations found on your connected pages. Contacts will appear here when someone messages your Facebook Pages.
                                    </p>
                                    <div className="mt-4 text-xs text-zinc-600 space-y-1">
                                        <p>Make sure:</p>
                                        <ul className="list-disc list-inside space-y-1">
                                            <li>Your pages have received messages</li>
                                            <li>The <code className="bg-zinc-800 px-1 rounded">pages_messaging</code> permission is granted</li>
                                            <li>Webhooks are configured for real-time updates</li>
                                        </ul>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h3 className="text-zinc-300 font-medium">No contacts match your filters</h3>
                                    <p className="text-zinc-500 text-sm mt-1">Try adjusting your filters or search query</p>
                                </>
                            )}
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

            {/* Real-time Fetching Progress - Bottom (Collapsible) */}
            {(fetchingProgress.isFetching || displayTotalContacts > 0) && (
                <div className="fixed inset-x-0 bottom-0 z-40 transition-all duration-300" style={{ bottom: selectedContactIds.length > 0 ? '200px' : '0' }}>
                    <div className="mx-auto max-w-4xl px-4 pb-2">
                        {fetchingProgress.isCollapsed ? (
                            // Collapsed Widget
                            <button
                                onClick={() => setFetchingProgress(prev => ({ ...prev, isCollapsed: false }))}
                                className="w-full rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-3 backdrop-blur-sm shadow-2xl hover:from-indigo-500/15 hover:to-purple-500/15 transition-all"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {fetchingProgress.isFetching && (
                                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent flex-shrink-0"></div>
                                        )}
                                        <span className="text-xs font-medium text-white">
                                            {fetchingProgress.isFetching ? 'Fetching...' : 'Completed'}
                                        </span>
                                        {fetchingProgress.currentPage && fetchingProgress.totalPages && (
                                            <span className="text-xs text-zinc-400">
                                                ({fetchingProgress.currentPageNumber}/{fetchingProgress.totalPages})
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-bold text-indigo-400">{displayTotalContacts.toLocaleString()}</span>
                                        <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                            </button>
                        ) : (
                            // Expanded Widget
                            <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-sm shadow-2xl">
                                <div className="p-4">
                                    <div className="flex items-start justify-between mb-3 gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                {fetchingProgress.isFetching && (
                                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent flex-shrink-0"></div>
                                                )}
                                                <h3 className="text-sm font-semibold text-white truncate flex-1">Fetching Contacts in Real-Time</h3>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    {fetchingProgress.isFetching && (
                                                        <>
                                                            <button
                                                                onClick={handlePauseResume}
                                                                className="p-1.5 hover:bg-yellow-500/20 rounded transition-colors text-yellow-400 hover:text-yellow-300"
                                                                title={fetchingProgress.isPaused ? "Resume Fetching" : "Pause Fetching"}
                                                            >
                                                                {fetchingProgress.isPaused ? (
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                    </svg>
                                                                ) : (
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                    </svg>
                                                                )}
                                                            </button>
                                                        </>
                                                    )}
                                                    <button
                                                        onClick={() => setFetchingProgress(prev => ({ ...prev, isCollapsed: true }))}
                                                        className="p-1 hover:bg-white/10 rounded transition-colors"
                                                        title="Collapse"
                                                    >
                                                        <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                {fetchingProgress.currentPage && fetchingProgress.currentPageNumber !== undefined && fetchingProgress.totalPages !== undefined && (
                                                    <p className="text-xs text-zinc-400 truncate">
                                                        Processing: <span className="text-indigo-400 font-medium">{fetchingProgress.currentPage}</span>
                                                        <span className="text-zinc-500 ml-1">({fetchingProgress.currentPageNumber}/{fetchingProgress.totalPages})</span>
                                                    </p>
                                                )}
                                                {fetchingProgress.message && (
                                                    <p className="text-xs text-zinc-500 truncate">{fetchingProgress.message}</p>
                                                )}
                                                {displayTotalContacts > 0 && (
                                                    <p className="text-xs text-indigo-400 font-medium">
                                                        Total Contacts: {displayTotalContacts.toLocaleString()}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className="text-2xl font-bold text-indigo-400">{displayTotalContacts.toLocaleString()}</div>
                                            <div className="text-xs text-zinc-500">contacts</div>
                                        </div>
                                    </div>
                                    
                                    
                                    {/* Recent Contacts */}
                                    {fetchingProgress.recentContacts.length > 0 && (
                                        <div className="pt-3 border-t border-white/10">
                                            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Recently Added</p>
                                            <div className="flex flex-wrap gap-2">
                                                {fetchingProgress.recentContacts.slice(0, 5).map((contact, idx) => (
                                                    <div
                                                        key={`${contact.id}-${contact.pageId}-${idx}`}
                                                        className="flex items-center gap-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-1.5 animate-in fade-in slide-in-from-right-2"
                                                        style={{ animationDelay: `${idx * 100}ms` }}
                                                    >
                                                        <div className="h-5 w-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                                                            {contact.avatar}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-medium text-white truncate">{contact.name}</p>
                                                            <p className="text-[10px] text-zinc-400 truncate">{contact.page}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

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
                            {attachedFile && (() => {
                                const getFileIcon = () => {
                                    if (attachedFile.type.startsWith("image/")) return <ImageIcon />;
                                    if (attachedFile.type.startsWith("video/")) return <VideoIcon />;
                                    if (attachedFile.type.startsWith("audio/")) return <AudioIcon />;
                                    return <FileIcon />;
                                };
                                
                                const getFileTypeLabel = () => {
                                    if (attachedFile.type.startsWith("image/")) return "Image";
                                    if (attachedFile.type.startsWith("video/")) return "Video";
                                    if (attachedFile.type.startsWith("audio/")) return "Audio";
                                    return "File";
                                };
                                
                                return (
                                    <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 rounded-lg bg-white/5 p-2 border border-white/10 animate-in fade-in slide-in-from-bottom-2">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-500/20 text-indigo-400">
                                            {getFileIcon()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-zinc-200 truncate">{attachedFile.name}</p>
                                            <p className="text-[10px] text-zinc-500">{getFileTypeLabel()} • {(attachedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                        </div>
                                        <button
                                            onClick={handleRemoveFile}
                                            className="p-1.5 hover:bg-white/10 rounded-full text-zinc-500 hover:text-red-400 transition-colors"
                                        >
                                            <XIcon size={14} />
                                        </button>
                                    </div>
                                );
                            })()}
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
                                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-zinc-400 hover:text-indigo-300 transition-colors bg-white/5 p-1.5 rounded-lg hover:bg-indigo-500/20 border border-transparent hover:border-indigo-500/30"
                                    title="Attach media (images, videos, audio, documents - max 25MB)"
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
                            <button 
                                onClick={handleSendBroadcast}
                                disabled={!message.trim() || selectedContactIds.length === 0}
                                className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                <span>
                                    {activeSends > 0 
                                        ? `Sending... (${activeSends})` 
                                        : scheduleDate 
                                            ? "Schedule" 
                                            : "Send Broadcast"}
                                </span>
                                <SendIcon />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Reconnect Modal - Removed: All pages are automatically connected */}
            {false && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={() => setShowReconnectModal(false)}
                    />
                    <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-white/10">
                            <div>
                                <h2 className="text-xl font-bold text-white">Manage Facebook Pages</h2>
                                <p className="text-sm text-zinc-400 mt-1">Select which pages to connect</p>
        </div>
                            <button
                                onClick={() => setShowReconnectModal(false)}
                                className="rounded-lg p-2 hover:bg-zinc-800 transition-colors"
                            >
                                <XIcon size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {/* Search */}
                            <div className="relative mb-4">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                    <SearchIcon />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search pages..."
                                    value={pageSearchQuery}
                                    onChange={(e) => {
                                        setPageSearchQuery(e.target.value);
                                        setPageModalCurrentPage(1);
                                        setConnectedPagesCurrentPage(1);
                                    }}
                                    className="w-full rounded-lg bg-zinc-800/50 border border-white/10 py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all focus:bg-zinc-800 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>

                            {/* Connected Pages Section */}
                            {connectedPageIds.length > 0 && (() => {
                                const connectedPages = availablePages.filter((p: any) => connectedPageIds.includes(p.id));
                                const connectedPagesTotalPages = Math.ceil(connectedPages.length / connectedPagesItemsPerPage);
                                const paginatedConnectedPages = connectedPages.slice(
                                    (connectedPagesCurrentPage - 1) * connectedPagesItemsPerPage,
                                    connectedPagesCurrentPage * connectedPagesItemsPerPage
                                );

                                return (
                                    <div className="mb-6">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                                                Connected Pages ({connectedPageIds.length})
                                            </h3>
                                            <div className="flex items-center gap-2">
                                                {selectedPageIdsForDisconnect.length > 0 && (
                                                    <>
                                                        <button
                                                            onClick={clearConnectedPageSelection}
                                                            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                                                        >
                                                            Clear ({selectedPageIdsForDisconnect.length})
                                                        </button>
                                                        <button
                                                            onClick={handleBulkDisconnect}
                                                            className="flex items-center gap-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors"
                                                        >
                                                            <TrashIcon />
                                                            Disconnect Selected
                                                        </button>
                                                    </>
                                                )}
                                                <button
                                                    onClick={selectedPageIdsForDisconnect.length === connectedPageIds.length ? clearConnectedPageSelection : selectAllConnectedPages}
                                                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                                                >
                                                    {selectedPageIdsForDisconnect.length === connectedPageIds.length ? "Deselect All" : "Select All"}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="space-y-2 mb-4">
                                            {paginatedConnectedPages.map((page: any) => {
                                                const isSelected = selectedPageIdsForDisconnect.includes(page.id);
                                                return (
                                                    <button
                                                        key={page.id}
                                                        onClick={() => toggleConnectedPageSelection(page.id)}
                                                        className={`w-full flex items-center justify-between rounded-lg border p-3 text-left transition-all ${
                                                            isSelected
                                                                ? "border-red-500/50 bg-red-500/10"
                                                                : "border-green-500/30 bg-green-500/10 hover:border-green-500/50"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                            <span className="text-sm font-medium text-white truncate">{page.name}</span>
                                                        </div>
                                                        <span className={`text-xs ${isSelected ? "text-red-400" : "text-green-400"}`}>
                                                            {isSelected ? "Selected" : "Connected"}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {/* Connected Pages Pagination */}
                                        {connectedPagesTotalPages > 1 && (
                                            <div className="flex items-center justify-between pt-4 border-t border-white/10">
                                                <button
                                                    onClick={() => setConnectedPagesCurrentPage(prev => Math.max(1, prev - 1))}
                                                    disabled={connectedPagesCurrentPage === 1}
                                                    className="flex items-center gap-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <ChevronLeftIcon />
                                                    Previous
                                                </button>
                                                <span className="text-sm text-zinc-400">
                                                    Page {connectedPagesCurrentPage} of {connectedPagesTotalPages}
                                                </span>
                                                <button
                                                    onClick={() => setConnectedPagesCurrentPage(prev => Math.min(connectedPagesTotalPages, prev + 1))}
                                                    disabled={connectedPagesCurrentPage === connectedPagesTotalPages}
                                                    className="flex items-center gap-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Next
                                                    <ChevronRightIcon />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Available Pages Section */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                                        Available Pages ({filteredAvailablePages.length})
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        {selectedAvailablePageIds.length > 0 && (
                                            <>
                                                <button
                                                    onClick={clearAvailablePageSelection}
                                                    className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                                                >
                                                    Clear ({selectedAvailablePageIds.length})
                                                </button>
                                                <button
                                                    onClick={handleBulkConnectAvailablePages}
                                                    className="flex items-center gap-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-400 transition-colors"
                                                >
                                                    <CheckIcon />
                                                    Connect Selected
                                                </button>
                                                <button
                                                    onClick={handleBulkDeleteAvailablePages}
                                                    className="flex items-center gap-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors"
                                                >
                                                    <TrashIcon />
                                                    Delete Selected
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => {
                                                const unconnectedPages = filteredAvailablePages
                                                    .filter((p: any) => !connectedPageIds.includes(p.id))
                                                    .map((p: any) => p.id);
                                                if (selectedAvailablePageIds.length === unconnectedPages.length) {
                                                    clearAvailablePageSelection();
                                                } else {
                                                    selectAllAvailablePages();
                                                }
                                            }}
                                            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                                        >
                                            {selectedAvailablePageIds.length === filteredAvailablePages.filter((p: any) => !connectedPageIds.includes(p.id)).length ? "Deselect All" : "Select All"}
                                        </button>
                                    </div>
                                </div>
                                
                                {paginatedModalPages.length === 0 ? (
                                    <div className="text-center py-8 text-zinc-400">
                                        <p>No pages found. Try reconnecting your Facebook account.</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-2 mb-4">
                                            {paginatedModalPages.map((page: any) => {
                                                const isConnected = connectedPageIds.includes(page.id);
                                                const isSelectedForBulk = selectedAvailablePageIds.includes(page.id);
                                                return (
                                                    <button
                                                        key={page.id}
                                                        onClick={async () => {
                                                            if (!isConnected) {
                                                                // Connect the page
                                                                try {
                                                                    const response = await fetch("/api/facebook/pages/connect", {
                                                                        method: "POST",
                                                                        headers: {
                                                                            "Content-Type": "application/json",
                                                                        },
                                                                        body: JSON.stringify({
                                                                            pageIds: [page.id],
                                                                            action: "connect",
                                                                        }),
                                                                    });

                                                                    if (response.ok) {
                                                                        // Update local state
                                                                        setConnectedPageIds(prev => [...prev, page.id]);
                                                                        const connectedPages = [...pageData, page].filter((p: any, index: number, self: any[]) => 
                                                                            index === self.findIndex((t: any) => t.id === p.id)
                                                                        );
                                                                        setPageData(connectedPages);
                                                                        const pageNames = ["All Pages", ...connectedPages.map((p: any) => p.name)];
                                                                        setPages(pageNames);
                                                                        
                                                                        // Refresh contacts (only if not fetching)
                                                                        if (!isFetchingRef.current && !fetchingProgress.isFetching && !isLoadingContactsRef.current) {
                                                                            try {
                                                                                const contactsResponse = await fetch("/api/facebook/contacts");
                                                                                if (contactsResponse.ok) {
                                                                                    const contactsData = await contactsResponse.json();
                                                                                    setContacts(contactsData.contacts || []);
                                                                                }
                                                                            } catch (error) {
                                                                                console.error("Error fetching contacts:", error);
                                                                            }
                                                                        } else {
                                                                            console.log("[Frontend] Skipping contact refresh - fetch in progress");
                                                                        }
                                                                    } else {
                                                                        const errorData = await response.json();
                                                                        alert(`Failed to connect page: ${errorData.error || "Unknown error"}`);
                                                                    }
                                                                } catch (error) {
                                                                    console.error("Error connecting page:", error);
                                                                    alert("An error occurred while connecting the page");
                                                                }
                                                            } else {
                                                                // Disconnect the page
                                                                try {
                                                                    const response = await fetch("/api/facebook/pages/connect", {
                                                                        method: "POST",
                                                                        headers: {
                                                                            "Content-Type": "application/json",
                                                                        },
                                                                        body: JSON.stringify({
                                                                            pageIds: [page.id],
                                                                            action: "disconnect",
                                                                        }),
                                                                    });

                                                                    if (response.ok) {
                                                                        // Update local state
                                                                        setConnectedPageIds(prev => prev.filter(id => id !== page.id));
                                                                        const connectedPages = pageData.filter((p: any) => p.id !== page.id);
                                                                        setPageData(connectedPages);
                                                                        const pageNames = ["All Pages", ...connectedPages.map((p: any) => p.name)];
                                                                        setPages(pageNames);
                                                                        
                                                                        // Update contacts to remove contacts from disconnected page
                                                                        setContacts(prev => prev.filter(c => c.pageId !== page.id));
                                                                    } else {
                                                                        const errorData = await response.json();
                                                                        alert(`Failed to disconnect page: ${errorData.error || "Unknown error"}`);
                                                                    }
                                                                } catch (error) {
                                                                    console.error("Error disconnecting page:", error);
                                                                    alert("An error occurred while disconnecting the page");
                                                                }
                                                            }
                                                        }}
                                                        className={`w-full flex items-center justify-between rounded-lg border p-3 text-left transition-all cursor-pointer ${
                                                            isConnected
                                                                ? "border-indigo-500 bg-indigo-500/10 hover:bg-indigo-500/20"
                                                                : isSelectedForBulk
                                                                ? "border-indigo-500/50 bg-indigo-500/10 hover:bg-indigo-500/20"
                                                                : "border-white/10 bg-zinc-800/30 hover:border-indigo-500/50 hover:bg-indigo-500/10"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                            <span className="text-sm font-medium text-white truncate">{page.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {isSelectedForBulk && (
                                                                <span className="text-xs text-indigo-400">Selected</span>
                                                            )}
                                                            {isConnected ? (
                                                                <span className="text-xs text-indigo-400">Connected - Click to disconnect</span>
                                                            ) : (
                                                                <span className="text-xs text-zinc-400">Click to connect</span>
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Pagination */}
                                        {modalTotalPages > 1 && (
                                            <div className="flex items-center justify-between pt-4 border-t border-white/10">
                                                <button
                                                    onClick={() => setPageModalCurrentPage(prev => Math.max(1, prev - 1))}
                                                    disabled={pageModalCurrentPage === 1}
                                                    className="flex items-center gap-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <ChevronLeftIcon />
                                                    Previous
                                                </button>
                                                <span className="text-sm text-zinc-400">
                                                    Page {pageModalCurrentPage} of {modalTotalPages}
                                                </span>
                                                <button
                                                    onClick={() => setPageModalCurrentPage(prev => Math.min(modalTotalPages, prev + 1))}
                                                    disabled={pageModalCurrentPage === modalTotalPages}
                                                    className="flex items-center gap-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Next
                                                    <ChevronRightIcon />
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
                            <button
                                onClick={() => setShowReconnectModal(false)}
                                className="rounded-lg bg-zinc-800/50 hover:bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReconnect}
                                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 px-4 py-2 text-sm font-medium text-white transition-all shadow-lg shadow-indigo-500/25"
                            >
                                <FacebookIcon />
                                Save Connected Pages ({connectedPageIds.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
