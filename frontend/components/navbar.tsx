"use client";

import { SignedIn, UserButton } from "@clerk/nextjs";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <span className=" font-bold text-2xl tracking-tight">Civix.</span>

        <div className="hidden items-center gap-8 md:flex">
          <nav className="flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="transition hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" className="transition hover:text-foreground">
              How It Works
            </a>
            <a href="#contact" className="transition hover:text-foreground">
              Contact
            </a>
          </nav>

          {/* Clerk auth state */}
          <SignedIn>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: { avatarBox: "h-8 w-8" },
              }}
            />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
