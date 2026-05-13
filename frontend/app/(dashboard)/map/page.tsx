"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Loader2, AlertCircle, RefreshCw, MapPin, Info } from "lucide-react";
import { useGeolocation } from "@/lib/hooks/use-geolocation";
import type { Issue } from "@/components/issue-card";
import { cn } from "@/lib/utils";

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5500").replace(/\/$/, "");

// Dynamically import the map — no SSR
const IssueMap = dynamic(
  () => import("@/components/map/issue-map").then((m) => m.IssueMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-muted/40 rounded-xl">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

const STATUS_LEGEND = [
  { color: "#ef4444", label: "Reported / Open" },
  { color: "#f97316", label: "In Progress" },
  { color: "#22c55e", label: "Resolved" },
  { color: "#3b82f6", label: "Your Location" },
];

export default function MapPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(true);
  const [issueError, setIssueError] = useState<string | null>(null);

  const { status: geoStatus, coords, error: geoError, requestLocation } = useGeolocation();

  // Fetch all issues
  const fetchIssues = useCallback(async () => {
    setLoadingIssues(true);
    setIssueError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/issues`);
      if (!res.ok) throw new Error(`Failed to load issues (${res.status})`);
      const json = await res.json();
      setIssues(json.data ?? []);
    } catch (err: unknown) {
      setIssueError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoadingIssues(false);
    }
  }, []);

  useEffect(() => {
    fetchIssues();
    // Request geolocation on page load
    requestLocation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const issuesWithCoords = issues.filter((i) => i.coordinates);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Community Map</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {issuesWithCoords.length} issue{issuesWithCoords.length !== 1 ? "s" : ""} on the map
          </p>
        </div>
        <button
          onClick={() => { fetchIssues(); requestLocation(); }}
          disabled={loadingIssues}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loadingIssues && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Geolocation status bar */}
      {geoStatus !== "idle" && geoStatus !== "success" && (
        <div className={cn(
          "flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs",
          geoStatus === "loading"
            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
            : "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400"
        )}>
          {geoStatus === "loading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          {geoStatus === "loading" ? "Detecting your location…" : geoError}
          {(geoStatus === "denied" || geoStatus === "timeout" || geoStatus === "error") && (
            <button
              onClick={requestLocation}
              className="ml-auto underline underline-offset-2"
            >
              Retry
            </button>
          )}
        </div>
      )}
      {geoStatus === "success" && coords && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 px-4 py-2 text-xs text-green-700 dark:text-green-400">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          Location detected — map centered on your position
        </div>
      )}

      {/* Issue error */}
      {issueError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {issueError}
          <button onClick={fetchIssues} className="ml-auto text-xs underline">
            Retry
          </button>
        </div>
      )}

      {/* No-coordinates notice */}
      {!loadingIssues && !issueError && issues.length > 0 && issuesWithCoords.length === 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          No issues have GPS coordinates yet. Newly submitted issues with location permission will appear here.
        </div>
      )}

      {/* Map */}
      <div className="relative h-[65vh] min-h-[400px] w-full rounded-xl border border-border overflow-hidden shadow-sm">
        {loadingIssues && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <IssueMap
          issues={issues}
          userLocation={geoStatus === "success" ? coords : null}
          height="100%"
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-background px-5 py-3">
        <span className="text-xs font-medium text-muted-foreground mr-1">Legend:</span>
        {STATUS_LEGEND.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-full border border-white shadow-sm"
              style={{ background: color }}
            />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

