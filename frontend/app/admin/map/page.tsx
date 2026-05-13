"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  MapPin,
  Search,
  X,
  Building2,
  ImageIcon,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useGeolocation } from "@/lib/hooks/use-geolocation";
import { AdminHeader } from "@/components/admin/admin-header";
import type { AdminIssue } from "@/components/admin/issue-edit-modal";
import { MARKER_COLORS } from "@/components/map/admin-issue-map";
import { cn } from "@/lib/utils";

const BACKEND_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5500"
).replace(/\/$/, "");

// ── Dynamic import ── no SSR ─────────────────────────────────────────────
const AdminIssueMap = dynamic(
  () =>
    import("@/components/map/admin-issue-map").then((m) => m.AdminIssueMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-muted/30 rounded-xl">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

// ── Constants ─────────────────────────────────────────────────────────────
const ALL_DEPARTMENTS = [
  "Electrical",
  "Plumbing",
  "Civil",
  "Housekeeping",
  "Lift",
  "Security",
  "Other",
] as const;

const STATUS_OPTIONS = [
  { value: "reported", label: "Reported" },
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
] as const;

const SEVERITY_OPTIONS = [
  { value: "high", label: "High ≥7" },
  { value: "medium", label: "Medium 4–6" },
  { value: "low", label: "Low <4" },
];

const LEGEND = [
  { color: "#dc2626", label: "Critical severity" },
  { color: "#f87171", label: "High severity" },
  { color: "#3b82f6", label: "Low / Medium severity" },
  { color: "#1d4ed8", label: "Your Location" },
];

// ── Status styles ─────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  reported: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  approved: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  resolved:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const STATUS_LABELS: Record<string, string> = {
  reported: "Reported",
  approved: "Approved",
  in_progress: "In Progress",
  resolved: "Resolved",
};

// ── Department filter chip group ──────────────────────────────────────────
interface DeptFilterProps {
  selected: string[];
  counts: Record<string, number>;
  onToggle: (dept: string) => void;
  onClear: () => void;
}

function DepartmentFilter({
  selected,
  counts,
  onToggle,
  onClear,
}: DeptFilterProps) {
  const hasSelection = selected.length > 0;

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            Department
          </span>
          {hasSelection && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {selected.length}
            </span>
          )}
        </div>
        {hasSelection && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {/* All chip */}
        <button
          onClick={onClear}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150",
            !hasSelection
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
          )}
        >
          All
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
              !hasSelection
                ? "bg-white/20 text-white"
                : "bg-muted text-foreground"
            )}
          >
            {Object.values(counts).reduce((a, b) => a + b, 0)}
          </span>
        </button>

        {/* Per-department chips */}
        {ALL_DEPARTMENTS.map((dept) => {
          const isActive = selected.includes(dept);
          const count = counts[dept] ?? 0;
          return (
            <button
              key={dept}
              onClick={() => onToggle(dept)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150",
                isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : count === 0
                  ? "border-border/50 text-muted-foreground/40 cursor-default"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
              disabled={!isActive && count === 0}
              title={`${dept}: ${count} issue${count !== 1 ? "s" : ""}`}
            >
              {isActive && <span className="h-1.5 w-1.5 rounded-full bg-white/80" />}
              {dept}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-muted text-foreground"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected summary */}
      {hasSelection && (
        <p className="mt-2.5 text-xs text-muted-foreground">
          Showing issues from:{" "}
          <span className="font-medium text-foreground">
            {selected.join(", ")}
          </span>
        </p>
      )}
    </div>
  );
}

// ── Issue list panel ──────────────────────────────────────────────────────
interface IssueListPanelProps {
  issues: AdminIssue[];
  loading: boolean;
  totalWithCoords: number;
}

function IssueListPanel({
  issues,
  loading,
  totalWithCoords,
}: IssueListPanelProps) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-background overflow-hidden shadow-sm h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
        <span className="text-sm font-semibold text-foreground">
          Issues
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {issues.length} / {totalWithCoords} geotagged
        </span>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && issues.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
            <MapPin className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              No issues match the current filters.
            </p>
            <p className="text-xs text-muted-foreground/60">
              Try changing or clearing the department filter.
            </p>
          </div>
        )}

        {!loading &&
          issues.map((issue) => (
            <div
              key={issue._id}
              className="flex items-start gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors"
            >
              {/* Thumbnail */}
              <div className="h-11 w-11 shrink-0 rounded-lg border border-border overflow-hidden bg-muted flex items-center justify-center">
                {issue.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={issue.imageUrl}
                    alt={issue.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground line-clamp-1">
                  {issue.title}
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {/* Status */}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      STATUS_STYLES[issue.status]
                    )}
                  >
                    {STATUS_LABELS[issue.status]}
                  </span>

                  {/* Department */}
                  {issue.suggestedDepartment && (
                    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {issue.suggestedDepartment}
                    </span>
                  )}

                  {/* Severity */}
                  {issue.severityScore != null && (
                    <span className="text-[10px] text-muted-foreground">
                      ⚡ {issue.severityScore.toFixed(1)}
                    </span>
                  )}

                  {/* Upvotes */}
                  <span className="ml-auto flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <ChevronUp className="h-3 w-3" />
                    {issue.upvotes?.length ?? 0}
                  </span>
                </div>

                {/* Location / coords */}
                {(issue.location || issue.coordinates) && (
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                    <MapPin className="h-2.5 w-2.5 shrink-0" />
                    {(typeof issue.location === "string"
                      ? issue.location
                      : issue.locationText) ??
                      `${issue.coordinates!.lat.toFixed(4)}, ${issue.coordinates!.lng.toFixed(4)}`}
                  </p>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Status stat badge ─────────────────────────────────────────────────────
function StatBadge({
  color,
  label,
  count,
  active,
  onClick,
}: {
  color: string;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all",
        active
          ? "border-transparent text-white shadow-sm"
          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
      style={active ? { background: color } : {}}
    >
      <span
        className="h-2 w-2 rounded-full shrink-0"
        style={{ background: active ? "rgba(255,255,255,0.8)" : color }}
      />
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
          active ? "bg-white/20 text-white" : "bg-muted text-foreground"
        )}
      >
        {count}
      </span>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function AdminMapPage() {
  const { getToken } = useAuth();
  const {
    status: geoStatus,
    coords,
    error: geoError,
    requestLocation,
  } = useGeolocation();

  // ── Data ──
  const [issues, setIssues] = useState<AdminIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Filters ──
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterDepts, setFilterDepts] = useState<string[]>([]); // multi-select
  const [filterSeverity, setFilterSeverity] = useState<string>("");

  // ── Fetch ──
  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/issues`);
      if (!res.ok) throw new Error(`Failed to load issues (${res.status})`);
      const json = await res.json();
      setIssues(json.data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIssues();
    requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Status change (from map popup) ──
  const handleStatusChange = useCallback(
    async (id: string, newStatus: AdminIssue["status"]) => {
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/api/issues/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || "Failed to update status");
      }
      const json = await res.json();
      const updated = json.data as AdminIssue;
      setIssues((prev) =>
        prev.map((i) => (i._id === id ? { ...i, ...updated } : i))
      );
    },
    [getToken]
  );

  // ── Department toggle ──
  function toggleDept(dept: string) {
    setFilterDepts((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  }

  function toggleStatusFilter(status: string) {
    setFilterStatus((prev) => (prev === status ? "" : status));
  }

  // ── Per-department counts (from geotagged issues only) ──
  const deptCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const issue of issues) {
      if (!issue.coordinates) continue;
      // Fall back to suggestedDepartment only
      const d = issue.suggestedDepartment;
      if (d) counts[d] = (counts[d] ?? 0) + 1;
    }
    return counts;
  }, [issues]);

  // ── Per-status counts (geotagged) ──
  const statusCounts = useMemo(() => {
    const base = { reported: 0, approved: 0, in_progress: 0, resolved: 0 };
    for (const issue of issues) {
      if (!issue.coordinates) continue;
      const s = issue.status as keyof typeof base;
      if (s in base) base[s]++;
    }
    return { ...base, all: Object.values(base).reduce((a, b) => a + b, 0) };
  }, [issues]);

  // ── Unified filtering → visibleIds for map + filteredIssues for list ──
  const { visibleIds, filteredIssues } = useMemo(() => {
    const q = search.toLowerCase().trim();

      const filtered = issues.filter((issue) => {
        if (!issue.coordinates) return false;
        const locationSearchText =
          typeof issue.location === "string"
            ? issue.location.toLowerCase()
            : issue.locationText?.toLowerCase() ?? "";

      // Resolved issues are hidden from the map by default.
      // They only appear when the admin explicitly selects the "Resolved" filter.
      if (issue.status === "resolved" && filterStatus !== "resolved")
        return false;

        if (
          q &&
          !issue.title.toLowerCase().includes(q) &&
          !issue.description.toLowerCase().includes(q) &&
          !locationSearchText.includes(q)
        )
          return false;

      if (filterStatus && issue.status !== filterStatus) return false;

      // Multi-dept: show if issue dept is in selected list (empty = show all)
      if (filterDepts.length > 0) {
        const dept = (issue.suggestedDepartment ?? "").toLowerCase();
        if (!filterDepts.some((d) => d.toLowerCase() === dept)) return false;
      }

      if (filterSeverity) {
        const s = issue.severityScore ?? 0;
        if (filterSeverity === "high" && s < 7) return false;
        if (filterSeverity === "medium" && (s < 4 || s >= 7)) return false;
        if (filterSeverity === "low" && s >= 4) return false;
      }

      return true;
    });

    return {
      visibleIds: new Set(filtered.map((i) => i._id)),
      filteredIssues: filtered,
    };
  }, [issues, search, filterStatus, filterDepts, filterSeverity]);

  const activeFilterCount =
    (filterStatus ? 1 : 0) +
    filterDepts.length +
    (filterSeverity ? 1 : 0) +
    (search ? 1 : 0);

  function clearAllFilters() {
    setSearch("");
    setFilterStatus("");
    setFilterDepts([]);
    setFilterSeverity("");
  }

  return (
    <div className="flex flex-col min-h-screen">
      <AdminHeader
        title="Map"
        subtitle={`${statusCounts.all} geotagged · ${visibleIds.size} active marker${visibleIds.size !== 1 ? "s" : ""}`}
      />

      <main className="flex-1 flex flex-col gap-4 p-4 sm:p-5">

        {/* ── Row 1: Search + Status/Severity selects + Refresh ───────── */}
        <div className="flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search issues…"
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

          {/* Status select */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Severity select */}
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">All Severities</option>
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Clear all */}
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Clear ({activeFilterCount})
            </button>
          )}

          {/* Refresh */}
          <button
            onClick={() => { fetchIssues(); requestLocation(); }}
            disabled={loading}
            title="Refresh"
            className="flex items-center justify-center rounded-xl border border-border p-2.5 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        {/* ── Row 2: Department filter chips ──────────────────────────── */}
        <DepartmentFilter
          selected={filterDepts}
          counts={deptCounts}
          onToggle={toggleDept}
          onClear={() => setFilterDepts([])}
        />

        {/* ── Row 3: Status stat badges ────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterStatus("")}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all",
              filterStatus === ""
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            All
            <span className="rounded-full bg-muted text-foreground px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
              {statusCounts.all}
            </span>
          </button>
          {(
            [
              { status: "reported", label: "Reported" },
              { status: "approved", label: "Approved" },
              { status: "in_progress", label: "In Progress" },
              { status: "resolved", label: "Resolved" },
            ] as const
          ).map(({ status, label }) => (
            <StatBadge
              key={status}
              color={MARKER_COLORS[status]}
              label={label}
              count={statusCounts[status]}
              active={filterStatus === status}
              onClick={() => toggleStatusFilter(status)}
            />
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            {visibleIds.size} active marker{visibleIds.size !== 1 ? "s" : ""}
            {filterStatus !== "resolved" && statusCounts.resolved > 0 && (
              <span className="ml-1 text-muted-foreground/50">
                · {statusCounts.resolved} resolved hidden
              </span>
            )}
          </span>
        </div>

        {/* ── Geo / API status banners ─────────────────────────────────── */}
        {geoStatus === "loading" && (
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 text-xs text-blue-700 dark:text-blue-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            Detecting your location…
          </div>
        )}
        {geoStatus === "success" && coords && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 px-4 py-2 text-xs text-green-700 dark:text-green-400">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            Location detected — map centered on your position
          </div>
        )}
        {(geoStatus === "denied" ||
          geoStatus === "unavailable" ||
          geoStatus === "timeout" ||
          geoStatus === "error") && (
          <div className="flex items-center gap-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 px-4 py-2.5 text-xs text-orange-700 dark:text-orange-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">{geoError}</span>
            <button onClick={requestLocation} className="underline underline-offset-2">
              Retry
            </button>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={fetchIssues} className="text-xs underline underline-offset-2">
              Retry
            </button>
          </div>
        )}

        {/* ── Row 4: Split layout — Issues list + Map ──────────────────── */}
        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-[520px]">

          {/* Issues list panel */}
          <div className="lg:w-72 xl:w-80 shrink-0 h-[300px] lg:h-auto">
            <IssueListPanel
              issues={filteredIssues}
              loading={loading}
              totalWithCoords={statusCounts.all}
            />
          </div>

          {/* Map */}
          <div className="relative flex-1 min-h-[380px] rounded-xl border border-border overflow-hidden shadow-sm">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && !error && statusCounts.all === 0 && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/60 backdrop-blur-sm pointer-events-none">
                <MapPin className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground text-center max-w-xs px-4">
                  No geotagged issues yet. Issues submitted with GPS will appear here.
                </p>
              </div>
            )}
            <AdminIssueMap
              issues={issues}
              visibleIds={visibleIds}
              userLocation={geoStatus === "success" ? coords : null}
              onStatusChange={handleStatusChange}
              height="100%"
            />
          </div>
        </div>

        {/* ── Legend ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-background px-5 py-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="text-xs font-medium text-muted-foreground">
              Legend:
            </span>
            {LEGEND.map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded-full border-2 border-white shadow-sm"
                  style={{ background: color }}
                />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground/60">
            Click a marker to update status · Resolved issues hidden by default
          </p>
        </div>
      </main>
    </div>
  );
}
