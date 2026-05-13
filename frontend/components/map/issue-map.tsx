"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useCallback } from "react";
import type { Issue } from "@/components/issue-card";
import type { AdminIssue } from "@/components/admin/issue-edit-modal";
import { getSeverityMarkerColor, resolveSeverity } from "@/lib/severity";

// Marker colors per status
const STATUS_COLORS: Record<string, string> = {
  reported: "#ef4444",    // red
  approved: "#f97316",    // orange
  in_progress: "#f97316", // orange
  resolved: "#22c55e",    // green
};

const STATUS_LABELS: Record<string, string> = {
  reported: "Reported",
  approved: "Approved",
  in_progress: "In Progress",
  resolved: "Resolved",
};

type AnyIssue = Issue | AdminIssue;

interface IssueMapProps {
  issues: AnyIssue[];
  userLocation?: { lat: number; lng: number } | null;
  defaultCenter?: { lat: number; lng: number };
  defaultZoom?: number;
  height?: string;
}

// Build a colored SVG div icon
function makeMarkerIcon(L: typeof import("leaflet"), color: string, isUser = false) {
  if (isUser) {
    return L.divIcon({
      className: "",
      html: `<div style="
        width:18px;height:18px;
        background:${color};
        border:3px solid white;
        border-radius:50%;
        box-shadow:0 2px 8px rgba(0,0,0,0.4);
      "></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  }
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:24px;height:30px;">
      <svg viewBox="0 0 24 30" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35))">
        <path d="M12 0C7.589 0 4 3.589 4 8c0 5.25 8 22 8 22s8-16.75 8-22c0-4.411-3.589-8-8-8z" fill="${color}"/>
        <circle cx="12" cy="8" r="4" fill="white" opacity="0.9"/>
      </svg>
    </div>`,
    iconSize: [24, 30],
    iconAnchor: [12, 30],
    popupAnchor: [0, -32],
  });
}

// Build popup HTML for an issue
function buildPopup(issue: AnyIssue): string {
  const admin = issue as AdminIssue;
  const statusColor = STATUS_COLORS[issue.status] ?? "#6b7280";
  const severityLevel = resolveSeverity((issue as { severity?: string }).severity, admin.severityScore);
  const statusLabel = STATUS_LABELS[issue.status] ?? issue.status;

  const severityBadge = `<span style="font-size:11px;color:#6b7280;">Severity: <strong>${severityLevel}</strong></span>`;

  const deptBadge =
    admin.suggestedDepartment
      ? `<span style="font-size:11px;color:#6b7280;">Dept: <strong>${admin.suggestedDepartment}</strong></span>`
      : "";

  const imageHtml = issue.imageUrl
    ? `<img src="${issue.imageUrl}" alt="issue" style="width:100%;height:100px;object-fit:cover;border-radius:6px;margin-bottom:8px;" />`
    : "";

  const locationRaw =
    typeof issue.location === "string"
      ? issue.location
      : (issue as { locationText?: string }).locationText ||
        (issue.coordinates ? `${issue.coordinates.lat.toFixed(4)}, ${issue.coordinates.lng.toFixed(4)}` : "");
  const locationHtml = locationRaw
    ? `<div style="font-size:11px;color:#6b7280;margin-top:4px;">📍 ${locationRaw}</div>`
    : "";

  return `
    <div style="min-width:220px;max-width:260px;font-family:system-ui,sans-serif;">
      ${imageHtml}
      <div style="font-size:14px;font-weight:600;line-height:1.3;margin-bottom:6px;color:#111;">${issue.title}</div>
      <p style="font-size:12px;color:#555;margin:0 0 8px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">
        ${issue.description}
      </p>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;">
        <span style="display:inline-flex;align-items:center;gap:4px;background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}44;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:600;">
          <span style="width:6px;height:6px;background:${statusColor};border-radius:50%;display:inline-block;"></span>
          ${statusLabel}
        </span>
        ${severityBadge}
        ${deptBadge}
      </div>
      ${locationHtml}
    </div>
  `;
}

export function IssueMap({
  issues,
  userLocation,
  defaultCenter = { lat: 20.5937, lng: 78.9629 }, // India center as fallback
  defaultZoom = 13,
  height = "100%",
}: IssueMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<import("leaflet").Marker[]>([]);
  const userMarkerRef = useRef<import("leaflet").Marker | null>(null);
  // Track whether we've already auto-zoomed to the user's location
  const hasAutoZoomedRef = useRef(false);

  const destroyMap = useCallback(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    userMarkerRef.current?.remove();
    userMarkerRef.current = null;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;

      if (cancelled || !containerRef.current || mapRef.current) return;

      // Determine center
      const center = userLocation ?? defaultCenter;

      const map = L.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom: defaultZoom,
        zoomControl: true,
      });
      mapRef.current = map;

      // OpenStreetMap tiles (free, no API key)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // User location marker
      if (userLocation) {
        const userIcon = makeMarkerIcon(L, "#3b82f6", true);
        const um = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
          .addTo(map)
          .bindPopup('<div style="font-size:12px;font-weight:600;">📍 Your Location</div>');
        userMarkerRef.current = um;
      }

      // Issue markers
      const issuesWithCoords = issues.filter((i) => i.coordinates);
      for (const issue of issuesWithCoords) {
        const { lat, lng } = issue.coordinates!;
        const color = getSeverityMarkerColor((issue as { severity?: string }).severity, (issue as AdminIssue).severityScore);
        const icon = makeMarkerIcon(L, color);
        const marker = L.marker([lat, lng], { icon })
          .addTo(map)
          .bindPopup(buildPopup(issue), { maxWidth: 280, className: "issue-popup" });
        markersRef.current.push(marker);
      }

      // Fit bounds to all markers if there are issues with coords
      if (issuesWithCoords.length > 0) {
        const points: [number, number][] = issuesWithCoords.map((i) => [
          i.coordinates!.lat,
          i.coordinates!.lng,
        ]);
        if (userLocation) points.push([userLocation.lat, userLocation.lng]);
        try {
          map.fitBounds(points, { padding: [40, 40], maxZoom: 16 });
        } catch {
          // fallback to default center
        }
      }
    })();

    return () => {
      cancelled = true;
      destroyMap();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Mount only

  // Sync markers when issues change (after initial mount)
  useEffect(() => {
    if (!mapRef.current) return;

    (async () => {
      const L = (await import("leaflet")).default;

      // Remove old issue markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const issuesWithCoords = issues.filter((i) => i.coordinates);
      for (const issue of issuesWithCoords) {
        const { lat, lng } = issue.coordinates!;
        const color = getSeverityMarkerColor((issue as { severity?: string }).severity, (issue as AdminIssue).severityScore);
        const icon = makeMarkerIcon(L, color);
        const marker = L.marker([lat, lng], { icon })
          .addTo(mapRef.current!)
          .bindPopup(buildPopup(issue), { maxWidth: 280 });
        markersRef.current.push(marker);
      }
    })();
  }, [issues]);

  // Update user location marker and auto-zoom on first location detection
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;

    (async () => {
      const L = (await import("leaflet")).default;
      userMarkerRef.current?.remove();
      const userIcon = makeMarkerIcon(L, "#3b82f6", true);
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: userIcon,
      })
        .addTo(mapRef.current!)
        .bindPopup('<div style="font-size:12px;font-weight:600;">📍 Your Location</div>');

      // On first location fix: smoothly fly to user position at a comfortable zoom level
      if (!hasAutoZoomedRef.current) {
        hasAutoZoomedRef.current = true;
        mapRef.current!.flyTo(
          [userLocation.lat, userLocation.lng],
          15, // street-level zoom showing surroundings
          { animate: true, duration: 1.2 }
        );
      }
    })();
  }, [userLocation]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%" }}
      className="rounded-xl overflow-hidden"
    />
  );
}
