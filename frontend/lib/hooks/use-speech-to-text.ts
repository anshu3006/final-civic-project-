"use client";

import { useState, useRef, useCallback } from "react";

export type STTState = "idle" | "listening" | "processing" | "error";

export interface UseSpeechToTextOptions {
  /** BCP-47 language code, e.g. "en-IN", "hi-IN", "te-IN" */
  languageCode?: string;
  /** "append" adds transcript after existing text; "replace" overwrites it */
  mode?: "append" | "replace";
  /** Max recording duration in ms (default 30 s) */
  maxDurationMs?: number;
}

export interface UseSpeechToTextReturn {
  state: STTState;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

export function useSpeechToText(
  onTranscript: (text: string) => void,
  options: UseSpeechToTextOptions = {}
): UseSpeechToTextReturn {
  const {
    languageCode = "en-IN",
    maxDurationMs = 30_000,
  } = options;

  const [state, setState] = useState<STTState>("idle");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const sendToAPI = useCallback(
    async (audioBlob: Blob) => {
      setState("processing");
      try {
        const form = new FormData();
        form.append("file", audioBlob, "audio.wav");
        form.append("language_code", languageCode);

        const res = await fetch("/api/speech-to-text", {
          method: "POST",
          body: form,
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || "Transcription failed.");
        }

        onTranscript(json.transcript as string);
        setState("idle");
        setError(null);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Transcription failed.";
        setError(msg);
        setState("error");
      }
    },
    [languageCode, onTranscript]
  );

  const startRecording = useCallback(async () => {
    if (state !== "idle" && state !== "error") return;

    setError(null);
    setState("idle");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access denied. Please allow permission and retry.");
      setState("error");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    // Use webm;codecs=opus for recording (best browser support),
    // but Sarvam only accepts plain "audio/webm" — strip codec suffix for upload.
    const recordMime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "";
    // MIME type sent to Sarvam — must not contain codec params
    const uploadMime = recordMime.split(";")[0] || "audio/webm";

    const recorder = new MediaRecorder(stream, recordMime ? { mimeType: recordMime } : {});
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      // Capture chunks BEFORE cleanup() clears chunksRef
      const chunks = chunksRef.current.slice();
      cleanup();
      const blob = new Blob(chunks, {
        type: uploadMime,
      });
      if (blob.size === 0) {
        setError("No audio captured. Please try again.");
        setState("error");
        return;
      }
      await sendToAPI(blob);
    };

    recorder.start();
    setState("listening");

    // Auto-stop after maxDurationMs
    timeoutRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        recorder.stop();
      }
    }, maxDurationMs);
  }, [state, cleanup, sendToAPI, maxDurationMs]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return { state, error, startRecording, stopRecording };
}
