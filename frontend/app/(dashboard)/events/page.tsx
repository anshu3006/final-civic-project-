"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  CalendarDays, MapPin, Clock, Users, Star, CheckCircle2,
  Plus, Loader2, X, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfileBadge } from "@/components/profile-badge";
import { useProfile } from "@/lib/hooks/use-profile";

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5500").replace(/\/$/, "");

const TAG_COLORS: Record<string, string> = {
  Environment:    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Safety:         "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  Infrastructure: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  General:        "bg-muted text-muted-foreground",
  Health:         "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Education:      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

const TAGS = ["General", "Environment", "Safety", "Infrastructure", "Health", "Education"];

interface CivixEvent {
  _id: string;
  title: string;
  description: string;
  location: string;
  date: string;
  time: string;
  tag: string;
  organiser: string;
  organiserName: string;
  organiserImage?: string;
  interestedUsers: string[];
  participatingUsers: string[];
  createdAt: string;
}

// ── Point toast ──────────────────────────────────────────────────────────
function PointToast({ delta, onDone }: { delta: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
      <div className="flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 shadow-lg text-sm font-medium">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className={delta > 0 ? "text-green-600" : "text-red-500"}>
          {delta > 0 ? `+${delta}` : delta} points
        </span>
      </div>
    </div>
  );
}

// ── Create Event Modal ───────────────────────────────────────────────────
function CreateEventModal({ onClose, onCreated }: { onClose: () => void; onCreated: (e: CivixEvent) => void }) {
  const { getToken } = useAuth();
  const [form, setForm] = useState({ title: "", description: "", location: "", date: "", time: "", tag: "General" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.date) { setError("Title and date are required."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/api/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to create event");
      onCreated(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handler); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md bg-background rounded-t-2xl sm:rounded-xl border border-border shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b border-border flex items-center justify-between px-4 py-3.5">
          <h2 className="text-sm font-semibold">Create Event</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Title <span className="text-red-500">*</span></label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Event title"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} placeholder="What's this event about?"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Date <span className="text-red-500">*</span></label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Time</label>
              <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Location</label>
            <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="Venue or area"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Tag</label>
            <select value={form.tag} onChange={e => setForm(f => ({ ...f, tag: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30">
              {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/20">{error}</p>}
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
            <p className="text-xs text-primary font-medium">You&apos;ll earn +80 points for organising!</p>
          </div>
          <button type="submit" disabled={submitting}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Creating…" : "Create Event"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Event Card ───────────────────────────────────────────────────────────
function EventCard({ event, userId, onUpdate, onToast }: {
  event: CivixEvent;
  userId: string | null | undefined;
  onUpdate: (updated: CivixEvent) => void;
  onToast: (delta: number) => void;
}) {
  const { getToken } = useAuth();
  const [pending, setPending] = useState<"interested" | "participating" | null>(null);

  const isInterested    = !!userId && event.interestedUsers.includes(userId);
  const isParticipating = !!userId && event.participatingUsers.includes(userId);
  const totalCount      = new Set([...event.interestedUsers, ...event.participatingUsers]).size;

  async function toggle(action: "interested" | "participating") {
    if (!userId || pending) return;
    setPending(action);
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/api/events/${event._id}/${action}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      onUpdate({ ...event, interestedUsers: json.data.interestedUsers, participatingUsers: json.data.participatingUsers });
      onToast(json.data.pointsDelta);
    } catch { /* silent */ }
    finally { setPending(null); }
  }

  return (
    <article className="rounded-xl border border-border/60 bg-background p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug">{event.title}</h3>
        <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", TAG_COLORS[event.tag] ?? "bg-muted text-muted-foreground")}>
          {event.tag}
        </span>
      </div>

      {event.description && (
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{event.description}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{event.date}</span>
        {event.time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{event.time}</span>}
        {event.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.location}</span>}
        <span className="ml-auto flex items-center gap-1"><Users className="h-3 w-3" />{totalCount} engaged</span>
      </div>

      {/* Organiser */}
      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        {event.organiserImage
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={event.organiserImage} alt={event.organiserName} className="h-4 w-4 rounded-full object-cover" />
          : <div className="h-4 w-4 rounded-full bg-muted" />
        }
        <span>Organised by <span className="font-medium text-foreground">{event.organiserName}</span></span>
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => toggle("interested")}
          disabled={!userId || pending !== null}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all border",
            isInterested
              ? "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300"
              : "border-border text-muted-foreground hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50",
            (!userId || pending !== null) && "opacity-60 cursor-not-allowed"
          )}
        >
          {pending === "interested" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className="h-3 w-3" />}
          {isInterested ? "Interested ✓" : "Interested"}
          <span className="text-[10px] text-muted-foreground">(+10 pts)</span>
        </button>

        <button
          type="button"
          onClick={() => toggle("participating")}
          disabled={!userId || pending !== null}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all border",
            isParticipating
              ? "bg-primary/10 border-primary/30 text-primary"
              : "border-border text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-primary/5",
            (!userId || pending !== null) && "opacity-60 cursor-not-allowed"
          )}
        >
          {pending === "participating" ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
          {isParticipating ? "Participating ✓" : "Participate"}
          <span className="text-[10px] text-muted-foreground">(+20 pts)</span>
        </button>
      </div>
    </article>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────
export default function EventsPage() {
  const { userId, isSignedIn } = useAuth();
  const { profile, refresh: refreshProfile } = useProfile();
  const [events, setEvents] = useState<CivixEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<number | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/events`);
      const json = await res.json();
      if (json.success) setEvents(json.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  function handleUpdate(updated: CivixEvent) {
    setEvents((ev) => ev.map((e) => (e._id === updated._id ? updated : e)));
    refreshProfile();
  }

  function handleToast(delta: number) {
    setToast(delta);
    refreshProfile();
  }

  function handleCreated(event: CivixEvent) {
    setEvents((ev) => [event, ...ev]);
    setShowCreate(false);
    setToast(80);
    refreshProfile();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-border/60 bg-background p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h1 className="font-semibold">Civic Events</h1>
              <p className="text-sm text-muted-foreground">Participate and earn community points.</p>
            </div>
          </div>
          {isSignedIn && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Event
            </button>
          )}
        </div>
      </div>

      {/* Profile badge (full) */}
      {profile && <ProfileBadge variant="full" />}

      {/* Events list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-background p-10 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">No events yet</p>
          <p className="text-xs text-muted-foreground mt-1">Be the first to create a community event!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <EventCard
              key={event._id}
              event={event}
              userId={userId}
              onUpdate={handleUpdate}
              onToast={handleToast}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateEventModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Points toast */}
      {toast !== null && (
        <PointToast delta={toast} onDone={() => setToast(null)} />
      )}
    </div>
  );
}
