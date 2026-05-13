"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { syncUserToBackend } from "@/components/google-sign-in-button";

/**
 * Runs once per session to sync the Clerk user to the backend MongoDB.
 */
export function UserSync() {
  const { isSignedIn, getToken } = useAuth();
  const hasSynced = useRef(false);

  useEffect(() => {
    if (!isSignedIn || hasSynced.current) return;
    hasSynced.current = true;

    (async () => {
      const token = await getToken();
      if (token) {
        await syncUserToBackend(token);
      }
    })();
  }, [isSignedIn, getToken]);

  return null; // renders nothing
}
