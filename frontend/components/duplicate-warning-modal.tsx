"use client";

import { useEffect, useCallback, useState } from "react";
import { AlertTriangle, X, ExternalLink, ChevronUp, Loader2, MapPin, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@clerk/nextjs";

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5500").replace(/\/$/, "");

export interface DuplicateMatch {
  _id: string;
  title: string;
  description: string;
  location?: string | { lat: number; lng: number };
  imageUrl?: string;
  status: string;
  category?: string;
  suggestedDepartment?: string;
  similarityScore: number;   // 0–100
  distanceMeters: number;
  upvotes: string[];
  createdAt: string;
}

interface Props {
  matches: DuplicateMatch[];
  onSubmitAnyway: () => void;
  onClose: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  reported:    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved:    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  resolved:    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};
const STATUS_LABELS: Record<string, string> = {
  reported: "Reported", approved: "Approved", in_progress: "In Progress", resolved: "Resolved",
};

function MatchCard({ match }: { match: DuplicateMatch }) {
  const { userId, getToken } = useAuth();
  const [upvoted, setUpvoted] = useState(
    !!userId && Array.isArray(match.upvotes) && match.upvotes.includes(userId)
  );
  const [count, setCount] = useState(match.upvotes?.length ?? 0);
  const [pending, setPending] = useState(false);

  async function handleUpvote(e: React.MouseEvent) {
    e.stopPropagation();
    if (!userId || pending) return;
    const next = !upvoted;
    setUpvoted(next);
    setCount((c) => c + (next ? 1 : -1));
    setPending(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/api/issues/${match._id}/upvote`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setCount(json.data.upvoteCount);
      setUpvoted(json.data.hasUpvoted);
    } catch {
      setUpvoted(!next);
      setCount((c) => c + (next ? -1 : 1));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      {/* Similarity + distance badges */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          {match.similarityScore}% similar
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {match.distanceMeters} m away
        </span>
        <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[match.status] ?? "bg-muted text-muted-foreground")}>
          {STATUS_LABELS[match.status] ?? match.status}
        </span>
      </div>

      {/* Image */}
      {match.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={match.imageUrl} alt={match.title} className="h-28 w-full object-cover" />
      )}

      <div className="px-3 py-2 space-y-1">
        <p className="text-sm font-semibold line-clamp-1">{match.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{match.description}</p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-xs text-muted-foreground">
          {match.category && (
            <span className="flex items-center gap-0.5"><Tag className="h-3 w-3" />{match.category}</span>
          )}
          {match.location && (
  <span className="flex items-center gap-0.5">
    <MapPin className="h-3 w-3" />
    {typeof match.location === "string"
      ? match.location
      : `${match.location.lat}, ${match.location.lng}`}
  </span>
)}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-border px-3 py-2">
        <a
          href={`/issues/${match._id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" />
          View
        </a>
        <button
          type="button"
          onClick={handleUpvote}
          disabled={!userId || pending}
          className={cn(
            "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            upvoted
              ? "bg-primary text-primary-foreground"
              : "border border-border text-muted-foreground hover:bg-primary/10 hover:text-primary",
            (!userId || pending) && "opacity-60 cursor-not-allowed"
          )}
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronUp className="h-3 w-3" />}
          {upvoted ? "Upvoted" : "Upvote"} · {count}
        </button>
      </div>
    </div>
  );
}

export function DuplicateWarningModal({ matches, onSubmitAnyway, onClose }: Props) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [handleKey]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full sm:max-w-md bg-background rounded-t-2xl sm:rounded-xl border border-border shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start gap-3 bg-background border-b border-border px-4 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <AlertTriangle className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold">Similar Issue Already Reported</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {matches.length === 1
                ? "A similar issue was found nearby."
                : `${matches.length} similar issues were found nearby.`}{" "}
              Consider upvoting instead of posting a duplicate.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Matches */}
        <div className="p-4 space-y-3">
          {matches.map((m) => (
            <MatchCard key={m._id} match={m} />
          ))}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-background px-4 py-3">
          <button
            type="button"
            onClick={onSubmitAnyway}
            className="w-full rounded-lg border border-border py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            Submit Anyway — It&apos;s Different
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
