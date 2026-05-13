"use client";

import { SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5500").replace(/\/$/, "");

/**
 * GoogleSignInButton
 * - Uses Clerk's hosted sign-in redirect (no browser-side API call, avoids dev rate limits)
 */
export function GoogleSignInButton({ className }: { className?: string }) {
  return (
    <SignInButton mode="redirect" forceRedirectUrl="/feed">
      <Button
        size="lg"
        className={`gap-2 rounded-full px-8 text-base font-semibold ${className ?? ""}`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09a7.12 7.12 0 0 1 0-4.18V7.07H2.18A11.98 11.98 0 0 0 1 12c0 1.94.46 3.77 1.18 5.07l3.66-2.98z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Sign in with Google
      </Button>
    </SignInButton>
  );
}

/**
 * Syncs the authenticated Clerk user to the backend MongoDB.
 * Called once after login completes.
 */
export async function syncUserToBackend(token: string) {
  try {
    await fetch(`${BACKEND_URL}/api/users/sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("Failed to sync user to backend:", err);
  }
}

