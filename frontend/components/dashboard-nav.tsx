"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Rss, Map, CalendarDays, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

import { ProfileBadge } from "@/components/profile-badge";

const NAV_LINKS = [
  { href: "/feed", label: "Feed", icon: Rss },
  { href: "/map", label: "Map", icon: Map },
  { href: "/events", label: "Events", icon: CalendarDays },
];

export function DashboardNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="text-2xl font-extrabold tracking-tight hover:opacity-80 transition-opacity">
          Civix.
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Right: ProfileBadge + UserButton + mobile toggle */}
        <div className="flex items-center gap-2">
          <ProfileBadge variant="compact" className="hidden sm:inline-flex" />
          <UserButton
            afterSignOutUrl="/"
            appearance={{ elements: { avatarBox: "h-8 w-8" } }}
          />
          <button
            className="md:hidden rounded-lg p-2 hover:bg-accent transition-colors"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border/40 bg-background px-4 pb-4 pt-2">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
