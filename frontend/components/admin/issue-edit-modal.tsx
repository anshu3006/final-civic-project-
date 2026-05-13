"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { X, Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";

const BACKEND_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5500"
).replace(/\/$/, "");

export interface AdminIssue {
  _id: string;
  title: string;
  description: string;
  location?: string | { lat: number; lng: number };
  locationText?: string;
  imageUrl?: string;
  category?: string;
  predictedIssueType?: string;
  severity?: string;
  confidence?: number;
  severityScore?: number;
  department?: string;
  suggestedDepartment?: string;
  status: "reported" | "approved" | "in_progress" | "resolved";
  upvotes: string[];
  reportedBy?: string;
  createdAt: string;
  updatedAt?: string;
  coordinates?: { lat: number; lng: number };
  verificationImageUrl?: string;
  verificationStatus?: "pending_verification" | "verified";
  verificationUpvotes?: string[];
}

const DEPARTMENTS = [
  "Electrical",
  "Plumbing",
  "Civil",
  "Housekeeping",
  "Lift",
  "Security",
  "Other",
];

const STATUSES: { value: AdminIssue["status"]; label: string }[] = [
  { value: "reported", label: "Reported" },
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
];

interface IssueEditModalProps {
  issue: AdminIssue;
  onClose: () => void;
  onSaved: (updated: AdminIssue) => void;
}

export function IssueEditModal({
  issue,
  onClose,
  onSaved,
}: IssueEditModalProps) {
  const { getToken } = useAuth();

  const [status, setStatus] = useState<AdminIssue["status"]>(issue.status);
  const [severity, setSeverity] = useState<string>(
    issue.severityScore?.toString() ?? ""
  );
  const [department, setDepartment] = useState(
    issue.suggestedDepartment ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const body: Record<string, unknown> = { status, suggestedDepartment: department || undefined };
      if (severity !== "") body.severityScore = parseFloat(severity);

      const res = await fetch(`${BACKEND_URL}/api/issues/${issue._id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || "Failed to update");
      }

      const json = await res.json();
      onSaved(json.data as AdminIssue);
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
          <h2 className="font-semibold text-foreground">Edit Issue</h2>
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
          {/* Issue title (read-only) */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Issue</p>
            <p className="text-sm font-medium text-foreground line-clamp-2">
              {issue.title}
            </p>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setStatus(value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                    status === value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Severity Score */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Severity Score{" "}
              <span className="font-normal">(0–10)</span>
            </label>
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              placeholder="e.g. 7.5"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Department */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">— Select department —</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
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
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
