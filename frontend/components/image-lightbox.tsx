"use client";

import { useEffect, useCallback } from "react";
import { X, ZoomIn } from "lucide-react";

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    // Prevent background scroll
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [handleKey]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
        aria-label="Close fullscreen"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()} // don't close when clicking the image itself
        className="relative z-10 max-h-[90vh] max-w-[92vw] rounded-lg object-contain shadow-2xl
                   animate-in zoom-in-95 fade-in duration-200"
      />
    </div>
  );
}

/** Small expand-icon overlay shown on image hover */
export function ExpandHint() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover/img:opacity-100">
      <div className="rounded-full bg-black/50 p-2 backdrop-blur-sm">
        <ZoomIn className="h-5 w-5 text-white" />
      </div>
    </div>
  );
}
