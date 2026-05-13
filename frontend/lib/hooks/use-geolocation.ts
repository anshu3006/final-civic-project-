"use client";

import { useState, useCallback } from "react";

export type GeolocationStatus =
  | "idle"
  | "loading"
  | "success"
  | "denied"
  | "unavailable"
  | "timeout"
  | "error";

export interface Coordinates {
  lat: number;
  lng: number;
}

export function useGeolocation() {
  const [status, setStatus] = useState<GeolocationStatus>("idle");
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback((): Promise<Coordinates | null> => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      setError("Geolocation is not supported by your browser.");
      return Promise.resolve(null);
    }

    setStatus("loading");
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const result: Coordinates = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          setCoords(result);
          setStatus("success");
          resolve(result);
        },
        (err) => {
          switch (err.code) {
            case err.PERMISSION_DENIED:
              setStatus("denied");
              setError("Location access denied — issue will submit without GPS coordinates.");
              break;
            case err.POSITION_UNAVAILABLE:
              setStatus("unavailable");
              setError("Location signal unavailable. Please try again.");
              break;
            case err.TIMEOUT:
              setStatus("timeout");
              setError("Location request timed out.");
              break;
            default:
              setStatus("error");
              setError("An unknown location error occurred.");
          }
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        }
      );
    });
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setCoords(null);
    setError(null);
  }, []);

  return { status, coords, error, requestLocation, reset };
}
