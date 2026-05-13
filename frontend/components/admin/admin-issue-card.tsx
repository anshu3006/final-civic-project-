"use client";

import { CheckCircle2, ChevronUp, ImageIcon, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminIssue } from "@/components/admin/issue-edit-modal";
import { getSeverityGradient, resolveSeverity } from "@/lib/severity";

const STATUS_STYLES: Record<AdminIssue["status"], string> = {
  reported: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const STATUS_LABELS: Record<AdminIssue["status"], string> = {
  reported: "Reported",
  approved: "Approved",
  in_progress: "In Progress",
  resolved: "Resolved",
};

interface AdminIssueCardProps {
  issue: AdminIssue;
  onEdit: (issue: AdminIssue) => void;
  onResolve: (issue: AdminIssue) => void;
}

export function AdminIssueCard({ issue, onEdit, onResolve }: AdminIssueCardProps) {
  const priority = (issue.severityScore ?? 0) + (issue.upvotes?.length ?? 0) * 0.5;
  const severity = resolveSeverity(issue.severity, issue.severityScore);
  const gradient = getSeverityGradient(issue.severity, issue.severityScore);
  const locationText =
    typeof issue.location === "string"
      ? issue.location
      : issue.locationText ||
        (issue.location?.lat != null && issue.location?.lng != null
          ? `${issue.location.lat.toFixed(4)}, ${issue.location.lng.toFixed(4)}`
          : "—");

  return (
    <article className="relative overflow-hidden rounded-xl border border-border bg-background shadow-sm transition-shadow hover:shadow-md">
      {gradient && <div className={cn("pointer-events-none absolute inset-0", gradient)} />}

      <div className="relative p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted flex items-center justify-center">
            {issue.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={issue.imageUrl} alt={issue.title} className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground line-clamp-1">{issue.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{issue.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_STYLES[issue.status])}>
            {STATUS_LABELS[issue.status]}
          </span>
          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            Severity: {severity}
          </span>
          {issue.suggestedDepartment && (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {issue.suggestedDepartment}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <ChevronUp className="h-3 w-3" />
            {priority.toFixed(1)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground truncate">📍 {locationText || "—"}</span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onEdit(issue)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
            {issue.status !== "resolved" && (
              <button
                onClick={() => onResolve(issue)}
                className="flex items-center gap-1.5 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors"
              >
                <CheckCircle2 className="h-3 w-3" />
                Resolve
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
