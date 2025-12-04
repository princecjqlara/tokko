"use client";

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      basePath="/api/auth"
      refetchInterval={60 * 60 * 24 * 7} // Refetch every 7 days to refresh tokens
      refetchOnWindowFocus={true} // Refetch when window regains focus to check token validity
    >
      {children}
    </SessionProvider>
  );
}

