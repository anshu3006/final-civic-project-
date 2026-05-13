"use client";

import { cn } from "@/lib/utils";
import {
  useProfile,
  getDesignationInfo,
  getProgressToNext,
  type Designation,
} from "@/lib/hooks/use-profile";

interface ProfileBadgeProps {
  /** "compact" — just emoji + name (for navbar) | "full" — card with progress bar */
  variant?: "compact" | "full";
  className?: string;
}

export function ProfileBadge({ variant = "compact", className }: ProfileBadgeProps) {
  const { profile, loading } = useProfile();

  if (loading || !profile) return null;

  const designation = (profile.designation ?? "Newcomer") as Designation;
  const points = profile.points ?? 0;
  const info = getDesignationInfo(designation);
  const { progressPct, nextName, nextMin } = getProgressToNext(points, designation);

  if (variant === "compact") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium",
          info.color,
          className
        )}
        title={`${points} pts — ${designation}`}
      >
        <span>{info.emoji}</span>
        <span>{designation}</span>
      </span>
    );
  }

  // Full card variant
  return (
    <div className={cn("rounded-xl border border-border bg-background p-4 space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        {profile.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.imageUrl}
            alt={profile.fullName}
            className="h-10 w-10 rounded-full object-cover border border-border"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg">
            {info.emoji}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{profile.fullName}</p>
          <p className={cn("text-xs font-medium", info.color)}>
            {info.emoji} {designation}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold tabular-nums">{points}</p>
          <p className="text-[11px] text-muted-foreground">points</p>
        </div>
      </div>

      {/* Progress bar */}
      {nextName && (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Progress to {nextName}</span>
            <span>{points} / {nextMin}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}
      {!nextName && (
        <p className="text-[11px] text-amber-500 font-medium text-center">
          🏆 Top designation achieved!
        </p>
      )}
    </div>
  );
}
