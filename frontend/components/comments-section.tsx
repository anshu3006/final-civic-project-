"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { formatDistanceToNow } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Loader2, Send, User, MessageSquare } from "lucide-react";

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5500").replace(/\/$/, "");

interface Comment {
  _id: string;
  issueId: string;
  clerkUserId: string;
  text: string;
  createdAt: string;
  userName: string;
  userImage?: string;
}

interface CommentsSectionProps {
  issueId: string;
}

export function CommentsSection({ issueId }: CommentsSectionProps) {
  const { userId, getToken } = useAuth();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch comments on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${BACKEND_URL}/api/issues/${issueId}/comments`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setComments(json.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load comments.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [issueId]);

  // Scroll to bottom when new comment added
  useEffect(() => {
    if (comments.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments.length]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/api/issues/${issueId}/comments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || "Failed to post comment");
      }

      const json = await res.json();
      setComments((prev) => [...prev, json.data as Comment]);
      setText("");
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Comments {comments.length > 0 && `· ${comments.length}`}
        </span>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <p className="text-xs text-red-500 text-center py-2">{error}</p>
      )}

      {/* Empty state */}
      {!loading && !error && comments.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-3">
          No comments yet. Be the first to comment.
        </p>
      )}

      {/* Comments list */}
      {!loading && !error && comments.length > 0 && (
        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
          {comments.map((comment) => (
            <div key={comment._id} className="flex gap-2.5">
              {/* Avatar */}
              {comment.userImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={comment.userImage}
                  alt={comment.userName}
                  className="h-7 w-7 shrink-0 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted border border-border">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}

              {/* Bubble */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    {comment.userName}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(comment.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-foreground leading-snug break-words">
                  {comment.text}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input form */}
      {userId ? (
        <form onSubmit={handleSubmit} className="flex items-end gap-2 pt-1">
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setSubmitError(null); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            placeholder="Write a comment… (Enter to submit)"
            rows={1}
            className={cn(
              "flex-1 resize-none rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm",
              "placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30",
              "min-h-[38px] max-h-24 overflow-y-auto"
            )}
          />
          <button
            type="submit"
            disabled={!text.trim() || submitting}
            className={cn(
              "flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg",
              "bg-primary text-primary-foreground transition-opacity",
              (!text.trim() || submitting) && "opacity-50 cursor-not-allowed"
            )}
            title="Post comment"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">
          Sign in to leave a comment.
        </p>
      )}

      {submitError && (
        <p className="text-xs text-red-500">{submitError}</p>
      )}
    </div>
  );
}
