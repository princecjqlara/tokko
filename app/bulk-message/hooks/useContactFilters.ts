import { useMemo } from "react";

type Params = {
  contacts: any[];
  selectedTag: string;
  selectedPage: string;
  debouncedSearchQuery: string;
  dateFilter: string;
  selectedContactIds: (string | number)[];
  setSelectedContactIds: (ids: (string | number)[]) => void;
  currentPage: number;
  itemsPerPage: number;
};

export function useContactFilters({
  contacts,
  selectedTag,
  selectedPage,
  debouncedSearchQuery,
  dateFilter,
  selectedContactIds,
  setSelectedContactIds,
  currentPage,
  itemsPerPage
}: Params) {
  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const matchesTag = selectedTag === "All" || (contact.tags && contact.tags.includes(selectedTag));
      const contactPageName = contact.page || contact.page_name || contact.pageName;
      const matchesPage = selectedPage === "All Pages" || contactPageName === selectedPage;
      const searchLower = debouncedSearchQuery.toLowerCase();
      const matchesSearch = !debouncedSearchQuery ||
        contact.name?.toLowerCase().includes(searchLower) ||
        contact.role?.toLowerCase().includes(searchLower);
      const contactMessageDate = contact.lastContactMessageDate || contact.date;
      const matchesDate = !dateFilter || contactMessageDate === dateFilter;
      return matchesTag && matchesSearch && matchesPage && matchesDate;
    });
  }, [selectedTag, selectedPage, debouncedSearchQuery, dateFilter, contacts]);

  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
  const paginatedContacts = filteredContacts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const isPageSelected = paginatedContacts.length > 0 && paginatedContacts.every(c => {
    const contactId = c.id || c.contact_id || c.contactId;
    return contactId && selectedContactIds.includes(contactId);
  });

  const isAllFilteredSelected = filteredContacts.length > 0 && filteredContacts.every(c => {
    const contactId = c.id || c.contact_id || c.contactId;
    return contactId && selectedContactIds.includes(contactId);
  });

  const toggleSelection = (id: string | number | undefined | null) => {
    if (!id) return;
    setSelectedContactIds(
      selectedContactIds.includes(id)
        ? selectedContactIds.filter((cid) => cid !== id)
        : [...selectedContactIds, id]
    );
  };

  const toggleSelectPage = () => {
    const pageIds = paginatedContacts
      .map(c => c.id || c.contact_id || c.contactId)
      .filter(id => id !== undefined && id !== null) as (string | number)[];
    const pageSelected = pageIds.length > 0 && pageIds.every(id => selectedContactIds.includes(id));
    setSelectedContactIds(pageSelected ? selectedContactIds.filter(id => !pageIds.includes(id)) : [...new Set([...selectedContactIds, ...pageIds])]);
  };

  const selectAllFiltered = () => {
    const allIds = filteredContacts
      .map(c => c.id || c.contact_id || c.contactId)
      .filter(id => id !== undefined && id !== null) as (string | number)[];
    setSelectedContactIds(allIds);
  };

  const clearSelection = () => setSelectedContactIds([]);

  return {
    filteredContacts,
    paginatedContacts,
    totalPages,
    isPageSelected,
    isAllFilteredSelected,
    toggleSelection,
    toggleSelectPage,
    selectAllFiltered,
    clearSelection
  };
}
