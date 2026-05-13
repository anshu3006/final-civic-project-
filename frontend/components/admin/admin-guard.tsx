"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useUserRole } from "@/lib/hooks/use-user-role";

/**
 * Wraps admin pages. Redirects non-admins to /feed.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { role, loading } = useUserRole();
  const router = useRouter();

  useEffect(() => {
    if (!loading && role !== "admin") {
      router.replace("/feed");
    }
  }, [role, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-sidebar">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-sidebar-primary" />
          <p className="text-sm text-sidebar-foreground/60">Loading admin panel…</p>
        </div>
      </div>
    );
  }

  if (role !== "admin") return null;

  return <>{children}</>;
}
