"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

const BACKEND_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5500"
).replace(/\/$/, "");

export interface BackendUser {
  _id: string;
  clerkUserId: string;
  fullName: string;
  email: string;
  imageUrl?: string;
  role: "resident" | "admin";
  isActive: boolean;
  createdAt: string;
}

export type UserRole = "resident" | "admin" | null;

export function useUserRole() {
  const { isSignedIn, getToken } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [user, setUser] = useState<BackendUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${BACKEND_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled && res.ok) {
          const json = await res.json();
          setRole(json.data.role);
          setUser(json.data);
        }
      } catch {
        // silently fail — role stays null
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);

  return { role, user, loading };
}
