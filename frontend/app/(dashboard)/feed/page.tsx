"use client";

import { useEffect, useState, useCallback } from "react";
import { PostIssue } from "@/components/post-issue";
import { IssueCard, type Issue } from "@/components/issue-card";
import { Loader2, Inbox, AlertCircle, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5500").replace(/\/$/, "");

type FeedTab = "all" | "pending_verifications";

export default function FeedPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [pendingIssues, setPendingIssues] = useState<Issue[]>([]);
  const [activeTab, setActiveTab] = useState<FeedTab>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allRes, pendingRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/issues`),
        fetch(`${BACKEND_URL}/api/issues/pending-verifications`),
      ]);
      if (!allRes.ok) throw new Error(`Failed to load issues (${allRes.status})`);
      const allJson = await allRes.json();
      setIssues(allJson.data ?? []);
      if (pendingRes.ok) {
        const pendingJson = await pendingRes.json();
        setPendingIssues(pendingJson.data ?? []);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const displayedIssues = activeTab === "all" ? issues : pendingIssues;

  return (
    <div className="space-y-4">
      {/* Post issue form */}
      <PostIssue onSuccess={fetchIssues} />

      {/* Feed header */}
      <div className="flex items-center justify-between px-1">
        <h1 className="text-lg font-semibold">Community Issues</h1>
        <button
          onClick={fetchIssues}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("all")}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
            activeTab === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
          )}
        >
          All Issues
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
              activeTab === "all" ? "bg-white/20 text-white" : "bg-muted text-foreground"
            )}
          >
            {issues.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("pending_verifications")}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
            activeTab === "pending_verifications"
              ? "border-amber-500 bg-amber-500 text-white"
              : "border-border text-muted-foreground hover:border-amber-400 hover:text-foreground"
          )}
        >
          <ShieldAlert className="h-3 w-3" />
          Pending Verifications
          {pendingIssues.length > 0 && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                activeTab === "pending_verifications"
                  ? "bg-white/20 text-white"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
              )}
            >
              {pendingIssues.length}
            </span>
          )}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 py-12 text-center dark:border-red-900/40 dark:bg-red-900/10">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchIssues}>
            Try again
          </Button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && displayedIssues.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-background py-16 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground/50" />
          {activeTab === "all" ? (
            <>
              <p className="text-sm font-medium text-muted-foreground">No issues reported yet.</p>
              <p className="text-xs text-muted-foreground/70">Be the first to report a civic issue!</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-muted-foreground">No pending verifications.</p>
              <p className="text-xs text-muted-foreground/70">All resolved issues have been verified by residents.</p>
            </>
          )}
        </div>
      )}

      {/* Issues list */}
      {!loading && !error && displayedIssues.length > 0 && (
        <div className="space-y-3">
          {displayedIssues.map((issue) => (
            <IssueCard key={issue._id} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
}
