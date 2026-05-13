"use client";

import { useState, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { X, Loader2, Upload, CheckCircle2, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminIssue } from "./issue-edit-modal";

const BACKEND_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5500"
).replace(/\/$/, "");

interface ResolveWithProofModalProps {
  issue: AdminIssue;
  onClose: () => void;
  onResolved: (updated: AdminIssue) => void;
}

export function ResolveWithProofModal({
  issue,
  onClose,
  onResolved,
}: ResolveWithProofModalProps) {
  const { getToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setError(null);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }

  async function handleResolve() {
    if (!selectedFile) {
      setError("Please upload a verification proof image before resolving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append("verificationImage", selectedFile);

      const res = await fetch(`${BACKEND_URL}/api/issues/${issue._id}/resolve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || "Failed to resolve issue");
      }

      const json = await res.json();
      onResolved(json.data as AdminIssue);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold text-foreground">Resolve Issue</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-accent transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Issue title */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Resolving issue</p>
            <p className="text-sm font-medium text-foreground line-clamp-2">
              {issue.title}
            </p>
          </div>

          {/* Verification image upload */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Verification Proof Image{" "}
              <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Upload a photo proving the issue has been resolved. This will be
              visible to residents for confirmation.
            </p>

            {/* Preview */}
            {preview ? (
              <div className="relative mb-2 overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Proof preview"
                  className="h-40 w-full object-cover"
                />
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  aria-label="Remove image"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
                  "border-border hover:border-primary/50 hover:bg-muted/40"
                )}
              >
                <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                <span className="text-sm text-muted-foreground">
                  Click to upload proof image
                </span>
                <span className="text-xs text-muted-foreground/70">
                  JPEG, PNG, WebP or GIF · max 5 MB
                </span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFileChange}
            />

            {selectedFile && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Upload className="h-3 w-3" />
                Change image
              </button>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleResolve}
            disabled={saving || !selectedFile}
            title={!selectedFile ? "Upload a verification image first" : undefined}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Mark Resolved
          </button>
        </div>
      </div>
    </div>
  );
}
