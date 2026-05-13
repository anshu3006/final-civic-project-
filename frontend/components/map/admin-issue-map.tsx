"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { AdminIssue } from "@/components/admin/issue-edit-modal";
import { getSeverityMarkerColor, resolveSeverity } from "@/lib/severity";

// ── Marker colour per status ──────────────────────────────────────────────
export const MARKER_COLORS: Record<string, string> = {
  reported: "#ef4444",   // Red  — open / unrepaired
  approved: "#ef4444",   // Red  — still open (awaiting fix)
  in_progress: "#f97316", // Orange — being worked on
  resolved: "#22c55e",   // Green — resolved (hidden from map by default)
};

const STATUS_LABELS: Record<string, string> = {
  reported: "Reported",
  approved: "Approved",
  in_progress: "In Progress",
  resolved: "Resolved",
};

// ── SVG pin icon ──────────────────────────────────────────────────────────
function makePinIcon(L: typeof import("leaflet"), color: string) {
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:28px;height:36px;">
        <svg viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg"
          style="width:100%;height:100%;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.32))">
          <path d="M14 0C8.477 0 4 4.477 4 10c0 6.627 10 26 10 26S24 16.627 24 10C24 4.477 19.523 0 14 0z"
            fill="${color}" stroke="white" stroke-width="1.5"/>
          <circle cx="14" cy="10" r="4.5" fill="white" opacity="0.9"/>
        </svg>
      </div>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -40],
  });
}

function makeUserIcon(L: typeof import("leaflet")) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:16px;height:16px;
      background:#3b82f6;
      border:3px solid white;
      border-radius:50%;
      box-shadow:0 0 0 4px rgba(59,130,246,0.25);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

// ── Popup HTML builder ────────────────────────────────────────────────────
function buildPopupHtml(issue: AdminIssue, isUpdating = false): string {
  const statusColor = MARKER_COLORS[issue.status] ?? "#6b7280";
  const statusLabel = STATUS_LABELS[issue.status] ?? issue.status;
  const severityLevel = resolveSeverity(issue.severity, issue.severityScore);

  const imgHtml = issue.imageUrl
    ? `<img src="${issue.imageUrl}" alt=""
         style="width:100%;height:88px;object-fit:cover;border-radius:8px;margin-bottom:10px;" />`
    : "";

  const coordsHtml = issue.coordinates
    ? `<div style="margin-top:6px;font-size:10px;color:#9ca3af;letter-spacing:0.02em;">
         📍 ${issue.coordinates.lat.toFixed(5)}, ${issue.coordinates.lng.toFixed(5)}
       </div>`
    : "";

  const metaItems = [
    `⚡ ${severityLevel}`,
    issue.suggestedDepartment ? `🏢 ${issue.suggestedDepartment}` : null,
    `▲ ${issue.upvotes?.length ?? 0}`,
  ]
    .filter(Boolean)
    .map(
      (t) =>
        `<span style="font-size:10px;color:#6b7280;background:#f3f4f6;
          border-radius:4px;padding:2px 6px;">${t}</span>`
    )
    .join("");

  const actionBtns = isUpdating
    ? `<p style="font-size:11px;color:#6b7280;text-align:center;padding:6px 0;">
         Updating…
       </p>`
    : `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">
        ${
          issue.status !== "resolved"
            ? `<button data-map-action="resolved" data-map-id="${issue._id}"
                 style="${popBtnStyle("#22c55e")}">✅ Resolve</button>`
            : ""
        }
        ${
          issue.status !== "in_progress"
            ? `<button data-map-action="in_progress" data-map-id="${issue._id}"
                 style="${popBtnStyle("#f97316")}">🔧 In Progress</button>`
            : ""
        }
        ${
          issue.status !== "approved"
            ? `<button data-map-action="approved" data-map-id="${issue._id}"
                 style="${popBtnStyle("#3b82f6")}">✔ Approve</button>`
            : ""
        }
       </div>`;

  return `
    <div style="width:268px;font-family:system-ui,-apple-system,sans-serif;padding:2px 0;">
      ${imgHtml}
      <div style="font-size:13px;font-weight:700;color:#111;margin-bottom:5px;line-height:1.3;">
        ${escHtml(issue.title)}
      </div>
      <p style="font-size:11px;color:#6b7280;margin:0 0 8px;line-height:1.5;
                display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
        ${escHtml(issue.description)}
      </p>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;">
        <span style="background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}55;
                     border-radius:999px;padding:2px 8px;font-size:10px;font-weight:700;">
          ${statusLabel}
        </span>
        ${metaItems}
      </div>
      ${coordsHtml}
      ${actionBtns}
    </div>`;
}

function popBtnStyle(bg: string) {
  return `
    display:inline-flex;align-items:center;gap:4px;
    padding:5px 10px;border-radius:6px;font-size:11px;font-weight:600;
    border:none;cursor:pointer;background:${bg};color:white;
    transition:opacity 0.15s;
  `;
}

function escHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Component ─────────────────────────────────────────────────────────────
export interface AdminIssueMapProps {
  /** Full issue list — used to create / update markers */
  issues: AdminIssue[];
  /** IDs of issues that should be visible (after client-side filtering) */
  visibleIds: Set<string>;
  userLocation?: { lat: number; lng: number } | null;
  /** Called when admin clicks a status-change button in a popup */
  onStatusChange: (id: string, newStatus: AdminIssue["status"]) => Promise<void>;
  height?: string;
}

export function AdminIssueMap({
  issues,
  visibleIds,
  userLocation,
  onStatusChange,
  height = "100%",
}: AdminIssueMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  // Stable marker registry: id → L.Marker
  const markerMapRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const userMarkerRef = useRef<import("leaflet").Marker | null>(null);
  // Always-fresh refs so closures inside Leaflet event handlers see latest state
  const onStatusChangeRef = useRef(onStatusChange);
  const issuesRef = useRef(issues);
  const updatingIdsRef = useRef<Set<string>>(new Set());
  // Track whether we've already auto-zoomed to the user's location
  const hasAutoZoomedRef = useRef(false);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    issuesRef.current = issues;
  }, [issues]);

  // ── Initialize map (once) ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const center = userLocation ?? { lat: 20.5937, lng: 78.9629 };
      const map = L.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom: 13,
        zoomControl: true,
      });
      mapRef.current = map;

      // OpenStreetMap tiles — free, no API key
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // ── Event delegation for popup action buttons ──
      map.on("popupopen", (e) => {
        const container = e.popup.getElement();
        if (!container) return;

        container
          .querySelectorAll<HTMLButtonElement>("[data-map-action]")
          .forEach((btn) => {
            btn.addEventListener("click", async () => {
              const newStatus = btn.dataset
                .mapAction as AdminIssue["status"];
              const id = btn.dataset.mapId;
              if (!id || !newStatus || updatingIdsRef.current.has(id)) return;

              updatingIdsRef.current.add(id);

              // Show "Updating…" inside popup immediately
              const marker = markerMapRef.current.get(id);
              if (marker) {
                const current = issuesRef.current.find((i) => i._id === id);
                if (current) marker.setPopupContent(buildPopupHtml(current, true));
              }

              try {
                await onStatusChangeRef.current(id, newStatus);
                map.closePopup();
              } catch {
                // Revert popup on failure
                const current = issuesRef.current.find((i) => i._id === id);
                if (marker && current)
                  marker.setPopupContent(buildPopupHtml(current, false));
              } finally {
                updatingIdsRef.current.delete(id);
              }
            });
          });
      });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync markers when issues list changes (create new / update existing) ──
  useEffect(() => {
    if (!mapRef.current) return;

    (async () => {
      const L = (await import("leaflet")).default;
      const map = mapRef.current!;

      for (const issue of issues) {
        if (!issue.coordinates) continue;
        const { lat, lng } = issue.coordinates;
        const color = getSeverityMarkerColor(issue.severity, issue.severityScore);
        const icon = makePinIcon(L, color);
        const popupHtml = buildPopupHtml(
          issue,
          updatingIdsRef.current.has(issue._id)
        );

        const existing = markerMapRef.current.get(issue._id);
        if (existing) {
          // Smooth in-place update — no flicker
          existing.setIcon(icon);
          existing.setPopupContent(popupHtml);
        } else {
          const marker = L.marker([lat, lng], { icon }).bindPopup(popupHtml, {
            maxWidth: 300,
            minWidth: 280,
          });
          // Only add if visible
          if (visibleIds.has(issue._id)) marker.addTo(map);
          markerMapRef.current.set(issue._id, marker);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues]);

  // ── Apply filter: show / hide markers without recreating them ──
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    markerMapRef.current.forEach((marker, id) => {
      const shouldShow = visibleIds.has(id);
      const isOnMap = map.hasLayer(marker);
      if (shouldShow && !isOnMap) marker.addTo(map);
      if (!shouldShow && isOnMap) marker.remove();
    });
  }, [visibleIds]);

  // ── Fit bounds on first meaningful load ──
  const hasFittedRef = useRef(false);
  useEffect(() => {
    if (!mapRef.current || hasFittedRef.current) return;
    const withCoords = issues.filter((i) => i.coordinates);
    if (withCoords.length === 0) return;

    hasFittedRef.current = true;

    (async () => {
      await import("leaflet");
      const points: [number, number][] = withCoords.map((i) => [
        i.coordinates!.lat,
        i.coordinates!.lng,
      ]);
      if (userLocation) points.push([userLocation.lat, userLocation.lng]);
      try {
        mapRef.current!.fitBounds(points, { padding: [48, 48], maxZoom: 16 });
      } catch {
        /* ignore */
      }
    })();
  }, [issues, userLocation]);

  // ── User location marker and auto-zoom on first fix ──
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;
    (async () => {
      const L = (await import("leaflet")).default;
      userMarkerRef.current?.remove();
      userMarkerRef.current = L.marker(
        [userLocation.lat, userLocation.lng],
        { icon: makeUserIcon(L) }
      )
        .addTo(mapRef.current!)
        .bindPopup(
          '<div style="font-size:12px;font-weight:600;">📍 Your Location</div>'
        );

      // Smoothly fly to user position at street-level zoom on first detection
      if (!hasAutoZoomedRef.current) {
        hasAutoZoomedRef.current = true;
        mapRef.current!.flyTo(
          [userLocation.lat, userLocation.lng],
          15,
          { animate: true, duration: 1.2 }
        );
      }
    })();
  }, [userLocation]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    const markerMap = markerMapRef.current;
    const map = mapRef.current;

    return () => {
      markerMap.forEach((m) => m.remove());
      markerMap.clear();
      map?.remove();
      if (mapRef.current === map) {
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%" }}
      className="z-0"
    />
  );
}
