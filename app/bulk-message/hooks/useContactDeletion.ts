import { useCallback } from "react";

type ContactId = string | number | undefined | null;

export function useContactDeletion(setContacts: (fn: (prev: any[]) => any[]) => void, clearSelection: () => void) {
  const deleteByIds = useCallback(
    async (ids: ContactId[]) => {
      const validIds = ids.filter(Boolean) as (string | number)[];
      if (validIds.length === 0) return;
      const res = await fetch("/api/facebook/contacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: validIds })
      });
      if (res.ok) {
        setContacts(prev => prev.filter(c => !validIds.includes(c.id || c.contact_id || c.contactId)));
        clearSelection();
        return true;
      }
      return false;
    },
    [setContacts, clearSelection]
  );

  return { deleteByIds };
}
