"use client";

import { useCallback, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImagePreviewModalProps {
  isOpen: boolean;
  imageUrl: string;
  alt: string;
  onClose: () => void;
}

export function ImagePreviewModal({
  isOpen,
  imageUrl,
  alt,
  onClose,
}: ImagePreviewModalProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Issue image preview"
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-200 animate-in fade-in" />

      <button
        type="button"
        onClick={onClose}
        className={cn(
          "absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full",
          "bg-white/10 text-white backdrop-blur-sm transition-colors duration-200 hover:bg-white/20"
        )}
        aria-label="Close image preview"
      >
        <X className="h-5 w-5" />
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={alt}
        onClick={(event) => event.stopPropagation()}
        className="relative z-10 max-h-[90vh] max-w-[92vw] rounded-xl object-contain shadow-2xl transition-opacity duration-200 animate-in fade-in zoom-in-95"
      />
    </div>
  );
}
