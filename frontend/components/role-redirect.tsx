"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserRole } from "@/lib/hooks/use-user-role";

/**
 * Rendered only when the user is <SignedIn>.
 * Reads the backend role and pushes to the correct dashboard.
 */
export function RoleRedirect() {
  const { role, loading } = useUserRole();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (role === "admin") {
      router.replace("/admin");
    } else {
      // resident (or any other role) → feed
      router.replace("/feed");
    }
  }, [role, loading, router]);

  return null;
}
