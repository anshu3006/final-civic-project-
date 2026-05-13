"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5500").replace(/\/$/, "");

export type Designation = "Nayak" | "Rakshak" | "Mitra" | "Newcomer";

export interface UserProfile {
  _id: string;
  clerkUserId: string;
  fullName: string;
  email: string;
  imageUrl?: string;
  points: number;
  designation: Designation;
  role: string;
}

// Thresholds must match backend/utils/points.js
export const DESIGNATION_LEVELS: { name: Designation; min: number; color: string; emoji: string }[] = [
  { name: "Nayak",    min: 700, color: "text-amber-500",  emoji: "🏆" },
  { name: "Rakshak", min: 300, color: "text-blue-500",   emoji: "🛡️" },
  { name: "Mitra",   min: 100, color: "text-green-500",  emoji: "🌱" },
  { name: "Newcomer", min: 0,  color: "text-muted-foreground", emoji: "👤" },
];

export function getDesignationInfo(designation: Designation) {
  return DESIGNATION_LEVELS.find((d) => d.name === designation) ?? DESIGNATION_LEVELS[3];
}

/** Returns progress 0–100 toward next designation level. */
export function getProgressToNext(
  points: number,
  designation: Designation
): { progressPct: number; nextName: Designation | null; nextMin: number; current: number } {
  const idx = DESIGNATION_LEVELS.findIndex((d) => d.name === designation);
  const currentLevel = DESIGNATION_LEVELS[idx];
  const prevLevel = DESIGNATION_LEVELS[idx - 1]; // next higher tier

  if (!prevLevel) {
    // Already at top
    return { progressPct: 100, nextName: null, nextMin: currentLevel.min, current: points };
  }

  const range = prevLevel.min - currentLevel.min;
  const earned = points - currentLevel.min;
  const progressPct = Math.min(100, Math.round((earned / range) * 100));

  return { progressPct, nextName: prevLevel.name, nextMin: prevLevel.min, current: points };
}

export function useProfile() {
  const { getToken, isSignedIn } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isSignedIn) { setLoading(false); return; }
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch profile");
      const json = await res.json();
      setProfile(json.data);
    } catch {
      // silent — nav still works
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => { refresh(); }, [refresh]);

  return { profile, loading, refresh };
}
