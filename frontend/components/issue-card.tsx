"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { formatDistanceToNow } from "@/lib/time";
import { cn } from "@/lib/utils";
import { MapPin, ChevronUp, Loader2, MessageSquare, User, ShieldCheck, ShieldAlert } from "lucide-react";
import { CommentsSection } from "@/components/comments-section";
import { ImageLightbox, ExpandHint } from "@/components/image-lightbox";
import { isHighSeverity, resolveSeverity } from "@/lib/severity";

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5500").replace(/\/$/, "");

export interface Issue {
  _id: string;
  title: string;
  description: string;
  location?: string | { lat: number; lng: number };
  locationText?: string;
  imageUrl?: string;
  category?: string;
  severity?: string;
  severityScore?: number;
  confidence?: number;
  department?: string;
  status: "reported" | "approved" | "in_progress" | "resolved";
  upvotes: string[];
  reportedBy?: string;
  reporterName?: string;
  reporterImage?: string;
  createdAt: string;
  coordinates?: { lat: number; lng: number };
  verificationImageUrl?: string;
  verificationStatus?: "pending_verification" | "verified";
  verificationUpvotes?: string[];
}

const STATUS_STYLES: Record<Issue["status"], string> = {
  reported: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const STATUS_LABELS: Record<Issue["status"], string> = {
  reported: "Reported",
  approved: "Approved",
  in_progress: "In Progress",
  resolved: "Resolved",
};

export function IssueCard({ issue }: { issue: Issue }) {
  const { userId, getToken } = useAuth();

  const [upvoteCount, setUpvoteCount] = useState(issue.upvotes?.length ?? 0);
  const [hasUpvoted, setHasUpvoted] = useState(
    !!userId && Array.isArray(issue.upvotes) && issue.upvotes.includes(userId)
  );
  const [pending, setPending] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  const [verificationUpvoteCount, setVerificationUpvoteCount] = useState(
    issue.verificationUpvotes?.length ?? 0
  );
  const [hasVerified, setHasVerified] = useState(
    !!userId && Array.isArray(issue.verificationUpvotes) && issue.verificationUpvotes.includes(userId)
  );
  const [verificationStatus, setVerificationStatus] = useState(issue.verificationStatus);
  const [verifyPending, setVerifyPending] = useState(false);
  const [verifyLightboxOpen, setVerifyLightboxOpen] = useState(false);

  async function handleUpvote() {
    if (!userId || pending) return;
    const next = !hasUpvoted;
    setHasUpvoted(next);
    setUpvoteCount((c) => c + (next ? 1 : -1));
    setPending(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/api/issues/${issue._id}/upvote`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setUpvoteCount(json.data.upvoteCount);
      setHasUpvoted(json.data.hasUpvoted);
    } catch {
      setHasUpvoted(!next);
      setUpvoteCount((c) => c + (next ? -1 : 1));
    } finally {
      setPending(false);
    }
  }

  async function handleVerifyUpvote() {
    if (!userId || verifyPending || hasVerified) return;
    setVerifyPending(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/api/issues/${issue._id}/verify-upvote`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setVerificationUpvoteCount(json.data.verificationUpvoteCount);
      setHasVerified(true);
      setVerificationStatus(json.data.verificationStatus);
    } catch {
      // silently fail
    } finally {
      setVerifyPending(false);
    }
  }

  const reporterName = issue.reporterName || "Anonymous";
  const severityLevel = resolveSeverity(issue.severity, issue.severityScore);
  const shouldHighlight = isHighSeverity(issue.severity, issue.severityScore);
  const locationLabel =
    typeof issue.location === "string"
      ? issue.location
      : issue.locationText ||
        (issue.location?.lat != null && issue.location?.lng != null
          ? `${issue.location.lat.toFixed(4)}, ${issue.location.lng.toFixed(4)}`
          : undefined);

  return (
    <article
      className={cn(
        "group rounded-xl border border-border/60 bg-background shadow-sm transition-shadow hover:shadow-md",
        shouldHighlight && "border-red-200 bg-red-50/30 dark:border-red-900/40 dark:bg-red-950/20"
      )}
    >
      <div className="p-5">
        {/* Reporter row */}
        <div className="flex items-center gap-2 mb-3">
          {issue.reporterImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={issue.reporterImage}
              alt={reporterName}
              className="h-7 w-7 rounded-full object-cover border border-border"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted border border-border">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          )}
          <span className="text-xs font-medium text-foreground">{reporterName}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{formatDistanceToNow(issue.createdAt)}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold leading-snug text-foreground line-clamp-2">
            {issue.title}
          </h3>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                STATUS_STYLES[issue.status]
              )}
            >
              {STATUS_LABELS[issue.status]}
            </span>
            {issue.status === "resolved" && verificationStatus === "pending_verification" && (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                <ShieldAlert className="h-3 w-3" />
                Yet to be Verified
              </span>
            )}
            {issue.status === "resolved" && verificationStatus === "verified" && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                <ShieldCheck className="h-3 w-3" />
                Verified Resolution ✅
              </span>
            )}
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                severityLevel === "Critical" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                severityLevel === "High" && "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
                severityLevel !== "Critical" &&
                  severityLevel !== "High" &&
                  "bg-muted text-muted-foreground"
              )}
            >
              Severity: {severityLevel}
            </span>
          </div>
        </div>

        {/* Description with Read More / Read Less */}
        <div className="mt-2">
          <div
            style={{
              maxHeight: descExpanded ? "600px" : "4.5rem",
              overflow: "hidden",
              transition: "max-height 0.3s ease",
            }}
          >
            <p className="text-sm text-muted-foreground leading-6">
              {issue.description}
            </p>
          </div>
          {issue.description.length > 150 && (
            <button
              onClick={() => setDescExpanded((v) => !v)}
              className="mt-1 text-xs font-medium text-primary hover:underline focus:outline-none"
            >
              {descExpanded ? "Read less" : "Read more"}
            </button>
          )}
        </div>

        {/* Optional image — click to open lightbox */}
        {issue.imageUrl && (
          <div className="mt-3 overflow-hidden rounded-lg border border-border/40">
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="group/img relative block w-full cursor-zoom-in"
              aria-label="View fullscreen"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={issue.imageUrl}
                alt={issue.title}
                className="h-48 w-full object-cover transition-transform group-hover:scale-[1.02]"
              />
              <ExpandHint />
            </button>
          </div>
        )}

        {/* Verification proof section (shown when resolved) */}
        {issue.status === "resolved" && issue.verificationImageUrl && (
          <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Admin Verification Proof
            </p>
            <button
              type="button"
              onClick={() => setVerifyLightboxOpen(true)}
              className="group/img relative block w-full cursor-zoom-in overflow-hidden rounded-md border border-border/40"
              aria-label="View verification proof"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={issue.verificationImageUrl}
                alt="Verification proof"
                className="h-40 w-full object-cover transition-transform group-hover/img:scale-[1.02]"
              />
              <ExpandHint />
            </button>
            {verificationStatus === "pending_verification" && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {verificationUpvoteCount} resident{verificationUpvoteCount !== 1 ? "s" : ""} verified
                </p>
                <button
                  onClick={handleVerifyUpvote}
                  disabled={!userId || verifyPending || hasVerified}
                  title={
                    !userId
                      ? "Sign in to verify"
                      : hasVerified
                      ? "Already verified"
                      : "Confirm this resolution"
                  }
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    hasVerified
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 cursor-default"
                      : "bg-primary text-primary-foreground hover:bg-primary/90",
                    (!userId || verifyPending) && "opacity-60 cursor-not-allowed"
                  )}
                >
                  {verifyPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-3 w-3" />
                  )}
                  {hasVerified ? "Verified" : "Verify Resolution"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Meta row */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {locationLabel && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {locationLabel}
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* Comments toggle */}
            <button
              onClick={() => setShowComments((o) => !o)}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 font-medium transition-colors",
                showComments
                  ? "bg-muted text-foreground"
                  : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquare className="h-3 w-3" />
              Comments
            </button>

            {/* Upvote button */}
            <button
              onClick={handleUpvote}
              disabled={!userId || pending}
              title={userId ? (hasUpvoted ? "Remove upvote" : "Upvote") : "Sign in to upvote"}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 font-medium transition-colors",
                hasUpvoted
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-primary/10 hover:text-primary",
                (!userId || pending) && "opacity-60 cursor-not-allowed"
              )}
            >
              {pending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ChevronUp className="h-3 w-3" />
              )}
              {upvoteCount}
            </button>
          </div>
        </div>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="border-t border-border/60 px-5 py-4">
          <CommentsSection issueId={issue._id} />
        </div>
      )}

      {/* Fullscreen image lightbox */}
      {lightboxOpen && issue.imageUrl && (
        <ImageLightbox
          src={issue.imageUrl}
          alt={issue.title}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {/* Verification proof lightbox */}
      {verifyLightboxOpen && issue.verificationImageUrl && (
        <ImageLightbox
          src={issue.verificationImageUrl}
          alt="Verification proof"
          onClose={() => setVerifyLightboxOpen(false)}
        />
      )}
    </article>
  );
}


export interface Issue {
  _id: string;
  title: string;
  description: string;
  location?: string | { lat: number; lng: number };
  locationText?: string;
  imageUrl?: string;
  category?: string;
  severity?: string;
  severityScore?: number;
  confidence?: number;
  department?: string;
  status: "reported" | "approved" | "in_progress" | "resolved";
  upvotes: string[];
  reportedBy?: string;
  createdAt: string;
  coordinates?: { lat: number; lng: number };
}
