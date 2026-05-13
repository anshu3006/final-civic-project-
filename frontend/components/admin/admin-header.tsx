"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { ShieldCheck } from "lucide-react";

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
}

export function AdminHeader({ title, subtitle }: AdminHeaderProps) {
  const { user } = useUser();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 bg-background/95 backdrop-blur-md px-6">
      {/* Page title */}
      <div>
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {/* Profile — top-right */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-sm font-medium leading-none text-foreground">
            {user?.fullName ?? "Admin"}
          </span>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            <ShieldCheck className="h-2.5 w-2.5" />
            Admin
          </span>
        </div>
        <UserButton
          afterSignOutUrl="/"
          appearance={{ elements: { avatarBox: "h-9 w-9" } }}
        />
      </div>
    </header>
  );
}
