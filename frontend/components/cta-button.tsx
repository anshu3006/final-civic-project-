"use client";

import { SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CTAButton({ className }: { className?: string }) {
  return (
    <SignInButton mode="redirect" forceRedirectUrl="/feed">
      <Button
        size="lg"
        className={`gap-2 rounded-full px-8 text-base font-semibold ${className ?? ""}`}
      >
        Get Started
        <ArrowRight className="h-4 w-4" />
      </Button>
    </SignInButton>
  );
}
