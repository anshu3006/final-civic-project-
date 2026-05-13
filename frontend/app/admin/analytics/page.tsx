"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { AdminHeader } from "@/components/admin/admin-header";
import { cn } from "@/lib/utils";
import type { AdminIssue } from "@/components/admin/issue-edit-modal";

const BACKEND_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5500"
).replace(/\/$/, "");

// ─── Stat Card ────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </p>
          <p className="mt-1.5 text-3xl font-bold text-foreground">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            color
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

// ─── Horizontal Bar Chart ─────────────────────────────────────────────────
function HBarChart({
  title,
  data,
  colorClass,
}: {
  title: string;
  data: { label: string; value: number; pct: number }[];
  colorClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      {data.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">
          No data available
        </p>
      ) : (
        <div className="space-y-3">
          {data.map((d) => (
            <div key={d.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-foreground">
                  {d.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {d.value} ({d.pct.toFixed(0)}%)
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    colorClass ?? "bg-primary"
                  )}
                  style={{ width: `${d.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Donut / Pie Chart (SVG) ──────────────────────────────────────────────
const PIE_COLORS = [
  "#3b82f6", // blue
  "#a855f7", // purple
  "#f59e0b", // amber
  "#22c55e", // green
  "#ef4444", // red
  "#14b8a6", // teal
  "#f97316", // orange
];

function DonutChart({
  title,
  data,
}: {
  title: string;
  data: { label: string; value: number }[];
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const size = 140;
  const strokeWidth = 22;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;

  const segments = data.reduce<
    {
      color: string;
      dash: number;
      gap: number;
      offset: number;
      label: string;
      value: number;
      pct: number;
    }[]
  >((acc, d, i) => {
    const currentOffset =
      acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0;
    const pct = total ? d.value / total : 0;
    const dash = pct * circ;
    const gap = circ - dash;

    acc.push({
      color: PIE_COLORS[i % PIE_COLORS.length],
      dash,
      gap,
      offset: currentOffset,
      label: d.label,
      value: d.value,
      pct: pct * 100,
    });

    return acc;
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      {data.length === 0 || total === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">
          No data available
        </p>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Donut SVG */}
          <div className="relative shrink-0">
            <svg
              width={size}
              height={size}
              style={{ transform: "rotate(-90deg)" }}
            >
              {segments.map((seg, i) => (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${seg.dash} ${seg.gap}`}
                  strokeDashoffset={-seg.offset}
                  className="transition-all duration-700"
                />
              ))}
            </svg>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-foreground">
                {total}
              </span>
              <span className="text-[10px] text-muted-foreground">total</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-2 min-w-0 flex-1">
            {segments.map((seg) => (
              <div key={seg.label} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: seg.color }}
                />
                <span className="text-xs text-muted-foreground truncate flex-1">
                  {seg.label}
                </span>
                <span className="text-xs font-medium text-foreground shrink-0">
                  {seg.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Severity Histogram ───────────────────────────────────────────────────
function SeverityHistogram({ issues }: { issues: AdminIssue[] }) {
  const bins: Record<string, number> = {
    "0–2": 0,
    "3–4": 0,
    "5–6": 0,
    "7–8": 0,
    "9–10": 0,
  };
  for (const iss of issues) {
    const s = iss.severityScore ?? -1;
    if (s < 0) continue;
    if (s <= 2) bins["0–2"]++;
    else if (s <= 4) bins["3–4"]++;
    else if (s <= 6) bins["5–6"]++;
    else if (s <= 8) bins["7–8"]++;
    else bins["9–10"]++;
  }
  const max = Math.max(...Object.values(bins), 1);
  const binColors = [
    "bg-green-400",
    "bg-lime-400",
    "bg-yellow-400",
    "bg-orange-500",
    "bg-red-600",
  ];

  return (
    <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4">
        Severity Distribution
      </h3>
      <div className="flex items-end justify-around gap-2 h-36">
        {Object.entries(bins).map(([label, count], i) => {
          const heightPct = (count / max) * 100;
          return (
            <div
              key={label}
              className="flex flex-col items-center gap-1.5 flex-1"
            >
              <span className="text-xs font-semibold text-foreground">
                {count > 0 ? count : ""}
              </span>
              <div className="w-full flex items-end" style={{ height: 80 }}>
                <div
                  className={cn(
                    "w-full rounded-t-md transition-all duration-700",
                    binColors[i]
                  )}
                  style={{
                    height: `${Math.max(heightPct, count > 0 ? 8 : 2)}%`,
                    opacity: count === 0 ? 0.2 : 1,
                  }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground text-center">
        Severity score buckets (0–10)
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────
export default function AdminAnalyticsPage() {
  const [issues, setIssues] = useState<AdminIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/issues`);
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
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
  }, [fetchIssues]);

  // Computed stats
  const total = issues.length;
  const resolved = issues.filter((i) => i.status === "resolved").length;
  const inProgress = issues.filter((i) => i.status === "in_progress").length;
  const highSeverity = issues.filter(
    (i) => (i.severityScore ?? 0) >= 7
  ).length;
  const resolutionRate = total ? Math.round((resolved / total) * 100) : 0;

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  for (const iss of issues) {
    const lbl =
      iss.status === "in_progress"
        ? "In Progress"
        : iss.status.charAt(0).toUpperCase() + iss.status.slice(1);
    statusCounts[lbl] = (statusCounts[lbl] ?? 0) + 1;
  }

  // Department breakdown
  const deptCounts: Record<string, number> = {};
  for (const iss of issues) {
    const d = iss.suggestedDepartment ?? "Unassigned";
    deptCounts[d] = (deptCounts[d] ?? 0) + 1;
  }

  const deptData = Object.entries(deptCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({
      label,
      value,
      pct: total ? (value / total) * 100 : 0,
    }));

  const statusPieData = Object.entries(statusCounts).map(([label, value]) => ({
    label,
    value,
  }));

  return (
    <div className="flex flex-col min-h-screen">
      <AdminHeader title="Analytics" subtitle="Issue statistics overview" />

      <main className="flex-1 p-4 sm:p-6 space-y-6">
        {/* Refresh */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Data based on all reported civic issues
          </p>
          <button
            onClick={fetchIssues}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", loading && "animate-spin")}
            />
            Refresh
          </button>
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

        {!loading && !error && (
          <>
            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total Issues"
                value={total}
                icon={TrendingUp}
                color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                sub="All time"
              />
              <StatCard
                label="Resolved"
                value={resolved}
                icon={CheckCircle2}
                color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                sub={`${resolutionRate}% resolution rate`}
              />
              <StatCard
                label="In Progress"
                value={inProgress}
                icon={Clock}
                color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                sub="Being addressed"
              />
              <StatCard
                label="High Severity"
                value={highSeverity}
                icon={AlertTriangle}
                color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                sub="Score ≥ 7"
              />
            </div>

            {/* ── Charts Row 1 ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DonutChart title="Issues by Status" data={statusPieData} />
              <SeverityHistogram issues={issues} />
            </div>

            {/* ── Charts Row 2 ── */}
            <HBarChart
              title="Issues by Department"
              data={deptData}
              colorClass="bg-blue-500"
            />

            {/* ── Quick insights ── */}
            {total > 0 && (
              <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Quick Insights
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                    <span className="text-lg">📊</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <span className="font-semibold text-foreground">
                        {resolutionRate}%
                      </span>{" "}
                      of all issues have been resolved.
                    </p>
                  </div>
                  <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                    <span className="text-lg">🚨</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <span className="font-semibold text-foreground">
                        {highSeverity}
                      </span>{" "}
                      high-severity issues need urgent attention.
                    </p>
                  </div>
                  {deptData[0] && (
                    <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                      <span className="text-lg">🏢</span>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        <span className="font-semibold text-foreground">
                          {deptData[0].label}
                        </span>{" "}
                        has the most issues ({deptData[0].value} reports).
                      </p>
                    </div>
                  )}
                  <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                    <span className="text-lg">⏳</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <span className="font-semibold text-foreground">
                        {total - resolved}
                      </span>{" "}
                      issues are still open and awaiting resolution.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
