"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutList, Map, BarChart3, X, Menu } from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/admin/issues", label: "All Issues", icon: LayoutList },
  { href: "/admin/map", label: "Map", icon: Map },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
];

function SidebarNavContent({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 px-5 border-b border-sidebar-border shrink-0">
        <span className="font-bold text-sidebar-foreground text-base tracking-tight">
          <span className="text-2xl font-extrabold">Civix. </span> Admin
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-sidebar-border shrink-0">
        <p className="text-xs text-sidebar-foreground/40">
          © {new Date().getFullYear()} Civix.
        </p>
      </div>
    </>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-60 flex-col bg-sidebar border-r border-sidebar-border">
        <SidebarNavContent
          pathname={pathname}
          onNavigate={() => setMobileOpen(false)}
        />
      </aside>

      {/* ── Mobile: hamburger button (shown in header) ── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 rounded-lg bg-sidebar border border-sidebar-border p-2 text-sidebar-foreground shadow-lg"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* ── Mobile: backdrop ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile: drawer ── */}
      <aside
        className={cn(
          "md:hidden fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-sidebar border-r border-sidebar-border transform transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-4 rounded-lg p-1.5 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarNavContent
          pathname={pathname}
          onNavigate={() => setMobileOpen(false)}
        />
      </aside>
    </>
  );
}
