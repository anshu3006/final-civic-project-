"use client";

import { useState } from "react";
import { CheckCircle2, Clock3, ImageIcon, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "@/lib/time";
import { ImagePreviewModal } from "@/components/admin/image-preview-modal";

interface IssueListItemProps {
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  department: string;
  severityScore: number;
  createdAt: string;
  onEdit?: () => void;
  onResolve?: () => void;
  canResolve?: boolean;
}

export function IssueListItem({
  title,
  description,
  imageUrl,
  category,
  department,
  severityScore,
  createdAt,
  onEdit,
  onResolve,
  canResolve = false,
}: IssueListItemProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const isHighPriority = severityScore > 8.5;

  return (
    <>
      <div
        className={cn(
          "rounded-2xl transition-all duration-300",
          isHighPriority
            ? "bg-gradient-to-r from-red-950 via-red-800 to-red-600 p-[2px]"
            : ""
        )}
      >
        <article
          className={cn(
            "group rounded-[14px] border bg-background p-4 shadow-sm transition-all duration-300",
            "hover:bg-slate-800/90 hover:scale-[1.01]",
            isHighPriority
              ? "border-transparent hover:bg-red-950/75"
              : "border-border"
          )}
        >
          <div className="flex items-start gap-4">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border/70 bg-muted">
              {imageUrl ? (
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="block h-full w-full cursor-zoom-in"
                  aria-label={`Preview image for ${title}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
                </button>
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-muted-foreground/50 transition-colors duration-200 group-hover:text-white/80" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <h3 className="line-clamp-1 text-base font-semibold text-foreground transition-colors duration-200 group-hover:text-white">
                  {title}
                </h3>

                {isHighPriority && (
                  <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 transition-colors duration-200 group-hover:bg-white/15 group-hover:text-white dark:bg-red-900/35 dark:text-red-300">
                    High Priority
                  </span>
                )}
              </div>

              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground transition-colors duration-200 group-hover:text-white/90">
                {description}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground transition-colors duration-200 group-hover:text-white/85">
                <span className="max-w-full truncate">Category: {category}</span>
                <span className="text-border transition-colors duration-200 group-hover:text-white/60">
                  |
                </span>
                <span className="max-w-full truncate">Department: {department}</span>
                <span className="text-border transition-colors duration-200 group-hover:text-white/60">
                  |
                </span>
                <span>Severity: {Number.isFinite(severityScore) ? severityScore.toFixed(1) : "—"}</span>
                <span className="text-border transition-colors duration-200 group-hover:text-white/60">
                  |
                </span>
                <span className="flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5 transition-colors duration-200 group-hover:text-white/85" />
                  {formatDistanceToNow(createdAt)}
                </span>
              </div>
            </div>
          </div>

          {(onEdit || (onResolve && canResolve)) && (
            <div className="mt-3 flex items-center gap-2">
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors duration-200 hover:border-white/60 hover:text-white"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
              )}

              {onResolve && canResolve && (
                <button
                  onClick={onResolve}
                  className="flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-[11px] font-medium text-white transition-colors duration-200 hover:bg-green-700"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Resolve
                </button>
              )}
            </div>
          )}
        </article>
      </div>

      <ImagePreviewModal
        isOpen={previewOpen}
        imageUrl={imageUrl}
        alt={title}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
}
