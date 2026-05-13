"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Search,
  Loader2,
  AlertCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminHeader } from "@/components/admin/admin-header";
import {
  IssueEditModal,
  type AdminIssue,
} from "@/components/admin/issue-edit-modal";
import { ResolveWithProofModal } from "@/components/admin/resolve-with-proof-modal";
import { IssueListItem } from "@/components/admin/issue-list-item";

const BACKEND_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5500"
).replace(/\/$/, "");

const DEPARTMENTS = [
  "Electrical",
  "Plumbing",
  "Civil",
  "Housekeeping",
  "Lift",
  "Security",
  "Other",
];


export default function AdminIssuesPage() {
  const [issues, setIssues] = useState<AdminIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterDept, setFilterDept] = useState<string>("");
  const [filterSeverity, setFilterSeverity] = useState<string>("");

  // Edit modal
  const [editingIssue, setEditingIssue] = useState<AdminIssue | null>(null);

  // Resolve-with-proof modal
  const [resolvingIssue, setResolvingIssue] = useState<AdminIssue | null>(null);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/issues`);
      if (!res.ok) throw new Error(`Failed to load issues (${res.status})`);
      const json = await res.json();
      const sorted = (json.data ?? []).sort((a: AdminIssue, b: AdminIssue) => {
        const pa =
          (a.severityScore ?? 0) + (a.upvotes?.length ?? 0) * 0.5;
        const pb =
          (b.severityScore ?? 0) + (b.upvotes?.length ?? 0) * 0.5;
        return pb - pa;
      });
      setIssues(sorted);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  function handleIssueSaved(updated: AdminIssue) {
    setIssues((prev) =>
      prev.map((i) => (i._id === updated._id ? updated : i))
    );
  }

  // ── Per-status counts ──
  const statusCounts = useMemo(() => {
    const base = { reported: 0, approved: 0, in_progress: 0, resolved: 0 };
    for (const i of issues) {
      const s = i.status as keyof typeof base;
      if (s in base) base[s]++;
    }
    return { ...base, all: issues.length };
  }, [issues]);

  // ── Filtered list ──
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return issues.filter((issue) => {
      const locationSearchText =
        typeof issue.location === "string"
          ? issue.location.toLowerCase()
          : issue.locationText?.toLowerCase() ?? "";
      if (
        q &&
        !issue.title.toLowerCase().includes(q) &&
        !issue.description.toLowerCase().includes(q) &&
        !locationSearchText.includes(q)
      )
        return false;
      if (filterStatus && issue.status !== filterStatus) return false;
      if (filterDept) {
        const dept = (issue.suggestedDepartment ?? "").toLowerCase();
        if (dept !== filterDept.toLowerCase()) return false;
      }
      if (filterSeverity) {
        const s = issue.severityScore ?? 0;
        if (filterSeverity === "high" && s < 7) return false;
        if (filterSeverity === "medium" && (s < 4 || s >= 7)) return false;
        if (filterSeverity === "low" && s >= 4) return false;
      }
      return true;
    });
  }, [issues, search, filterStatus, filterDept, filterSeverity]);

  const activeFilterCount =
    (search ? 1 : 0) +
    (filterStatus ? 1 : 0) +
    (filterDept ? 1 : 0) +
    (filterSeverity ? 1 : 0);

  function clearAllFilters() {
    setSearch("");
    setFilterStatus("");
    setFilterDept("");
    setFilterSeverity("");
  }

  return (
    <div className="flex flex-col min-h-screen">
      <AdminHeader
        title="All Issues"
        subtitle={`${issues.length} total · ${filtered.length} shown`}
      />

      <main className="flex-1 p-4 sm:p-6 space-y-4">
        {/* ── Row 1: Search + Refresh ── */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, description or location…"
              className="w-full rounded-xl border border-border bg-background pl-9 pr-8 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors shrink-0"
            >
              <X className="h-3.5 w-3.5" />
              Clear ({activeFilterCount})
            </button>
          )}

          <button
            onClick={fetchIssues}
            disabled={loading}
            title="Refresh"
            className="flex items-center justify-center rounded-xl border border-border p-2.5 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        {/* ── Row 2: Status tabs ── */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: "", label: "All", count: statusCounts.all },
              { value: "reported", label: "Reported", count: statusCounts.reported },
              { value: "approved", label: "Approved", count: statusCounts.approved },
              { value: "in_progress", label: "In Progress", count: statusCounts.in_progress },
              { value: "resolved", label: "Resolved", count: statusCounts.resolved },
            ] as const
          ).map(({ value, label, count }) => (
            <button
              key={value}
              onClick={() => setFilterStatus(value)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                filterStatus === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                  filterStatus === value
                    ? "bg-white/20 text-white"
                    : "bg-muted text-foreground"
                )}
              >
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Row 3: Dept + Severity dropdowns ── */}
        <div className="flex flex-wrap gap-2">
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className={cn(
              "rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-background text-foreground transition-colors",
              filterDept
                ? "border-primary bg-primary/5 text-primary"
                : "border-border"
            )}
          >
            <option value="">All Departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className={cn(
              "rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-background text-foreground transition-colors",
              filterSeverity
                ? "border-primary bg-primary/5 text-primary"
                : "border-border"
            )}
          >
            <option value="">All Severities</option>
            <option value="high">High (7–10)</option>
            <option value="medium">Medium (4–6)</option>
            <option value="low">Low (0–3)</option>
          </select>

          <span className="ml-auto flex items-center text-xs text-muted-foreground self-center">
            {filtered.length} of {issues.length} issues
          </span>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 py-12 text-center dark:border-red-900/40 dark:bg-red-900/10">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={fetchIssues}
              className="rounded-lg border border-red-200 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Issues List ── */}
        {!loading && !error && (
          <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Search className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No issues match your filters.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((issue) => (
                  <IssueListItem
                    key={issue._id}
                    title={issue.title}
                    description={issue.description}
                    imageUrl={issue.imageUrl ?? ""}
                    category={issue.category || issue.predictedIssueType || "Uncategorized"}
                    department={issue.department || issue.suggestedDepartment || "Unassigned"}
                    severityScore={issue.severityScore ?? 0}
                    createdAt={issue.createdAt}
                    onEdit={() => setEditingIssue(issue)}
                    onResolve={() => setResolvingIssue(issue)}
                    canResolve={issue.status !== "resolved"}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Edit Modal ── */}
      {editingIssue && (
        <IssueEditModal
          issue={editingIssue}
          onClose={() => setEditingIssue(null)}
          onSaved={handleIssueSaved}
        />
      )}

      {/* ── Resolve with Proof Modal ── */}
      {resolvingIssue && (
        <ResolveWithProofModal
          issue={resolvingIssue}
          onClose={() => setResolvingIssue(null)}
          onResolved={handleIssueSaved}
        />
      )}
    </div>
  );
}
