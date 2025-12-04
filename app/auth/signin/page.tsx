"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignInButton() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  return (
    <button
      onClick={async () => {
        // Check if opened in popup
        if (window.opener) {
          // This is a popup window
          await signIn("facebook", { 
            callbackUrl,
            redirect: true 
          });
        } else {
          // Regular page, use popup
          const width = 600;
          const height = 700;
          const left = (window.screen.width - width) / 2;
          const top = (window.screen.height - height) / 2;
          
          window.open(
            `/api/auth/signin/facebook?callbackUrl=${encodeURIComponent(callbackUrl)}`,
            'facebook-login',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
          );
        }
      }}
      className="flex w-full items-center justify-center gap-3 rounded-lg bg-[#1877F2] px-4 py-3 text-white transition-colors hover:bg-[#166fe5]"
    >
      <svg
        className="h-5 w-5"
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
          clipRule="evenodd"
        />
      </svg>
      Continue with Facebook
    </button>
  );
}

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
        <h1 className="mb-6 text-2xl font-bold text-black dark:text-white">
          Sign in to your account
        </h1>
        <Suspense fallback={
          <button
            disabled
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-[#1877F2] px-4 py-3 text-white opacity-50"
          >
            Loading...
          </button>
        }>
          <SignInButton />
        </Suspense>
      </div>
    </div>
  );
}

