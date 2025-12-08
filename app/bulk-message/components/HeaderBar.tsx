import { Session } from "next-auth";
import { signIn } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type Props = {
  session: Session | null;
  status: "loading" | "authenticated" | "unauthenticated";
  icons: any;
  onSync: () => void;
  onReconnect: () => void;
  onSignOut: () => Promise<void>;
  isFetching: boolean;
};

export function HeaderBar({ session, status, icons, onSync, onReconnect, onSignOut, isFetching }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const signInWithPopup = () => {
    const width = 600;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    const popup = window.open(
      `/api/auth/signin/facebook?callbackUrl=${encodeURIComponent("/api/facebook/callback-popup?popup=true")}`,
      "facebook-login",
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        window.location.reload();
      }
    }, 500);
    const messageHandler = (event: MessageEvent) => {
      if (event.data?.type === "AUTH_SUCCESS") {
        clearInterval(checkClosed);
        window.removeEventListener("message", messageHandler);
        window.location.reload();
      }
    };
    window.addEventListener("message", messageHandler);
  };

  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-black/70 backdrop-blur-xl">
      <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
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
          <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-zinc-800/50 transition-colors cursor-pointer"
            >
              {session.user?.image && (
                <img src={session.user.image} alt={session.user.name || "User"} className="h-8 w-8 rounded-full ring-2 ring-indigo-500/50" />
              )}
              <span className="text-sm font-medium text-white">{session.user?.name || session.user?.email}</span>
              <svg className={`w-4 h-4 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-zinc-900 border border-white/10 shadow-2xl z-50 overflow-hidden">
                <div className="p-2">
                  <button
                    onClick={onSync}
                    disabled={isFetching}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-300 hover:bg-indigo-500/20 hover:text-indigo-400 rounded-lg transition-colors text-left disabled:opacity-50"
                  >
                    {icons.RefreshIcon?.() || (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    <span>{isFetching ? "Syncing..." : "Sync Contacts"}</span>
                  </button>
                  <button
                    onClick={onReconnect}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-300 hover:bg-indigo-500/20 hover:text-indigo-400 rounded-lg transition-colors text-left mt-1"
                  >
                    {icons.FacebookIcon?.() || (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    )}
                    <span>Reconnect Facebook</span>
                  </button>
                  <button
                    onClick={onSignOut}
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
            onClick={() => signInWithPopup()}
            className="flex items-center gap-2 rounded-full bg-[#1877F2] hover:bg-[#166fe5] px-4 py-2 text-sm font-semibold text-white transition-all shadow-lg shadow-blue-900/20 hover:scale-105 active:scale-95"
          >
            {icons.FacebookIcon?.()}
            <span>Sign in with Facebook</span>
          </button>
        )}
      </div>
    </header>
  );
}
