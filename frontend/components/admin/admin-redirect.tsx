"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserRole } from "@/lib/hooks/use-user-role";

/**
 * Placed in the user dashboard layout.
 * Silently redirects admins to the admin panel.
 */
export function AdminRedirect() {
  const { role, loading } = useUserRole();
  const router = useRouter();

  useEffect(() => {
    if (!loading && role === "admin") {
      router.replace("/admin/issues");
    }
  }, [role, loading, router]);

  return null;
}
