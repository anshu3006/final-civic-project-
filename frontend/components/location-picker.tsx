"use client";

import "leaflet/dist/leaflet.css";
import { useState, useEffect, useRef, useCallback } from "react";
import { Navigation, Loader2, CheckCircle2, AlertTriangle, X, Map } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PickedLocation {
  lat: number;
  lng: number;
  address?: string;
}

interface LocationPickerProps {
  value: PickedLocation | null;
  onChange: (loc: PickedLocation | null) => void;
}

type Tab = "gps" | "map";
type GeoState = "idle" | "loading" | "success" | "denied" | "unavailable" | "timeout";

// Reverse-geocode via OpenStreetMap Nominatim (free, no key)
async function reverseGeocode(lat: number, lng: number): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { "Accept-Language": "en" } }
    );
    const json = await res.json();
    return json.display_name as string | undefined;
  } catch {
    return undefined;
  }
}

// ── GPS Tab ───────────────────────────────────────────────────────────────
function GpsTab({ value, onChange }: LocationPickerProps) {
  const [geoState, setGeoState] = useState<GeoState>("idle");
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoState("unavailable");
      setError("Geolocation is not supported by this browser.");
      return;
    }
    setGeoState("loading");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const address = await reverseGeocode(lat, lng);
        setGeoState("success");
        onChange({ lat, lng, address });
      },
      (err) => {
        if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
          setGeoState("denied");
          setError("Location permission denied. Please allow access and retry.");
        } else if (err.code === GeolocationPositionError.TIMEOUT) {
          setGeoState("timeout");
          setError("Location request timed out. Please retry.");
        } else {
          setGeoState("unavailable");
          setError("Unable to determine location.");
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, [onChange]);

  function clear() {
    setGeoState("idle");
    setError(null);
    onChange(null);
  }

  return (
    <div className="space-y-3 p-4">
      {geoState === "idle" && (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Navigation className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Use your current location</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your browser will ask for location permission
            </p>
          </div>
          <button
            type="button"
            onClick={requestLocation}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Get My Location
          </button>
        </div>
      )}

      {geoState === "loading" && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Detecting your location…</p>
        </div>
      )}

      {geoState === "success" && value && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-900/10 p-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                Location captured
              </p>
              <p className="text-xs text-green-700 dark:text-green-400 mt-0.5 font-mono">
                {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
              </p>
              {value.address && (
                <p className="text-xs text-green-700 dark:text-green-400 mt-1 line-clamp-2">
                  {value.address}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={clear}
              className="shrink-0 text-green-600 hover:text-green-800 dark:text-green-400"
              title="Clear location"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {(geoState === "denied" || geoState === "unavailable" || geoState === "timeout") && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-900/10 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-orange-800 dark:text-orange-300">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestLocation}
            className="mt-2 text-xs text-orange-700 dark:text-orange-400 underline underline-offset-2 hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

// ── Map Tab ───────────────────────────────────────────────────────────────
const FALLBACK_CENTER: [number, number] = [20.5937, 78.9629]; // India
const DEFAULT_ZOOM = 15;
const FALLBACK_ZOOM = 5;

type MapGeoState = "locating" | "ready" | "denied" | "unavailable";

function MapTab({ value, onChange }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [mapGeoState, setMapGeoState] = useState<MapGeoState>("locating");
  const [geoError, setGeoError] = useState<string | null>(null);

  // ── helpers (defined before useEffect so they can be referenced) ──────
  const doUpdateLocation = useCallback(
    async (lat: number, lng: number) => {
      setGeocoding(true);
      const address = await reverseGeocode(lat, lng);
      setGeocoding(false);
      onChange({ lat, lng, address });
    },
    [onChange]
  );

  const bindDrag = useCallback(
    (L: typeof import("leaflet"), marker: import("leaflet").Marker) => {
      marker.on("dragend", async () => {
        const pos = marker.getLatLng();
        await doUpdateLocation(pos.lat, pos.lng);
      });
    },
    [doUpdateLocation]
  );

  const doPlaceMarker = useCallback(
    async (
      L: typeof import("leaflet"),
      map: import("leaflet").Map,
      lat: number,
      lng: number
    ) => {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
        bindDrag(L, markerRef.current);
      }
      await doUpdateLocation(lat, lng);
    },
    [bindDrag, doUpdateLocation]
  );

  function clearMarker() {
    markerRef.current?.remove();
    markerRef.current = null;
    onChange(null);
  }

  // Fly map smoothly to a position and optionally place a "you are here" marker style
  const flyToLocation = useCallback(
    (lat: number, lng: number, zoom = DEFAULT_ZOOM) => {
      mapRef.current?.flyTo([lat, lng], zoom, { animate: true, duration: 0.8 });
    },
    []
  );

  // ── "My Location" button handler ──────────────────────────────────────
  const goToMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setMapGeoState("locating");
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        flyToLocation(pos.coords.latitude, pos.coords.longitude, DEFAULT_ZOOM);
        setMapGeoState("ready");
      },
      (err) => {
        setMapGeoState(
          err.code === GeolocationPositionError.PERMISSION_DENIED ? "denied" : "unavailable"
        );
        setGeoError(
          err.code === GeolocationPositionError.PERMISSION_DENIED
            ? "Location access denied."
            : "Could not get your location."
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, [flyToLocation]);

  // ── Initialize map once ───────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      LRef.current = L;

      // Fix Leaflet default marker icons broken by webpack asset hashing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Start at existing value or fallback; we'll flyTo GPS shortly
      const initialCenter: [number, number] = value
        ? [value.lat, value.lng]
        : FALLBACK_CENTER;
      const initialZoom = value ? DEFAULT_ZOOM : FALLBACK_ZOOM;

      const map = L.map(containerRef.current, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: true,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Restore existing pin if reopening the tab
      if (value) {
        markerRef.current = L.marker([value.lat, value.lng], { draggable: true }).addTo(map);
        bindDrag(L, markerRef.current);
        setMapGeoState("ready");
      }

      // Click to place / move marker
      map.on("click", async (e: import("leaflet").LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        await doPlaceMarker(L, map, lat, lng);
      });

      // Auto-center on user GPS if no existing value
      if (!value) {
        if (!navigator.geolocation) {
          setMapGeoState("unavailable");
          setGeoError("Geolocation not supported.");
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            map.flyTo(
              [pos.coords.latitude, pos.coords.longitude],
              DEFAULT_ZOOM,
              { animate: true, duration: 0.8 }
            );
            setMapGeoState("ready");
          },
          (err) => {
            if (cancelled) return;
            setMapGeoState(
              err.code === GeolocationPositionError.PERMISSION_DENIED
                ? "denied"
                : "unavailable"
            );
            setGeoError(
              err.code === GeolocationPositionError.PERMISSION_DENIED
                ? "Location access denied — map shows default area."
                : "Could not get location — map shows default area."
            );
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-0">
      {/* Instruction bar */}
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1.5">
        <p className="text-xs text-muted-foreground">
          {mapGeoState === "locating"
            ? "Finding your location…"
            : mapGeoState === "denied" || mapGeoState === "unavailable"
            ? geoError
            : "Tap to drop a pin · drag to adjust"}
        </p>
        {/* My Location button */}
        <button
          type="button"
          onClick={goToMyLocation}
          title="Center on my location"
          className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          {mapGeoState === "locating" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Navigation className="h-3 w-3" />
          )}
          My Location
        </button>
      </div>

      {/* Map container */}
      <div ref={containerRef} className="h-44 sm:h-56 w-full" />

      {/* Selected coords */}
      {value && (
        <div className="mx-3 my-2 flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-mono text-foreground break-all">
              {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
            </p>
            {geocoding ? (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Loader2 className="h-2.5 w-2.5 animate-spin" /> Looking up address…
              </p>
            ) : value.address ? (
              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                {value.address}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={clearMarker}
            className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
            title="Remove pin"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main LocationPicker ───────────────────────────────────────────────────
export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [tab, setTab] = useState<Tab>("gps");

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: "gps",
      label: "Current Location",
      icon: <Navigation className="h-3.5 w-3.5 shrink-0" />,
    },
    {
      id: "map",
      label: "Pick on Map",
      icon: <Map className="h-3.5 w-3.5 shrink-0" />,
    },
  ];

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); onChange(null); }}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors",
              tab === t.id
                ? "border-b-2 border-primary text-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            {t.icon}
            <span className="truncate">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "gps" ? (
        <GpsTab value={value} onChange={onChange} />
      ) : (
        <MapTab value={value} onChange={onChange} />
      )}

      {/* Status indicator at bottom if picked */}
      {value && (
        <div className="flex items-center gap-1.5 border-t border-border bg-green-50 dark:bg-green-900/10 px-4 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
          <span className="text-xs text-green-700 dark:text-green-400 font-medium">
            {tab === "gps" ? "GPS location captured" : "Map pin placed"} ·{" "}
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </span>
        </div>
      )}
    </div>
  );
}
