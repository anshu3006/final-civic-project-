"use client";

import { useState } from "react";
import { Mic, MicOff, Square, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeechToText } from "@/lib/hooks/use-speech-to-text";

// ── Language options ──────────────────────────────────────────────────────
export const LANGUAGES = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिन्दी (Hindi)" },
  { code: "te-IN", label: "తెలుగు (Telugu)" },
  { code: "ta-IN", label: "தமிழ் (Tamil)" },
  { code: "kn-IN", label: "ಕನ್ನಡ (Kannada)" },
  { code: "ml-IN", label: "മലയാളം (Malayalam)" },
  { code: "mr-IN", label: "मराठी (Marathi)" },
  { code: "bn-IN", label: "বাংলা (Bengali)" },
  { code: "gu-IN", label: "ગુજરાતી (Gujarati)" },
  { code: "pa-IN", label: "ਪੰਜਾਬੀ (Punjabi)" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

// ── Props ─────────────────────────────────────────────────────────────────
interface SpeechToTextButtonProps {
  /** Called with the final transcript string */
  onTranscript: (text: string) => void;
  /** BCP-47 language code (controlled externally or managed internally) */
  languageCode?: LanguageCode;
  /** Show the language dropdown inline */
  showLanguageSelector?: boolean;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────
export function SpeechToTextButton({
  onTranscript,
  languageCode: externalLang,
  showLanguageSelector = true,
  className,
}: SpeechToTextButtonProps) {
  const [internalLang, setInternalLang] = useState<LanguageCode>("en-IN");
  const lang = externalLang ?? internalLang;

  const { state, error, startRecording, stopRecording } = useSpeechToText(
    onTranscript,
    { languageCode: lang }
  );

  const isListening = state === "listening";
  const isProcessing = state === "processing";
  const isDisabled = isProcessing;

  return (
    <div className={cn("flex flex-col gap-1.5 w-full min-w-0", className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {/* Language selector */}
        {showLanguageSelector && !externalLang && (
          <div className="relative flex items-center min-w-0">
            <select
              value={internalLang}
              onChange={(e) => setInternalLang(e.target.value as LanguageCode)}
              disabled={isListening || isProcessing}
              className={cn(
                "appearance-none rounded-lg border border-border bg-background",
                "w-full max-w-[9rem] pl-2.5 pr-6 py-1.5 text-xs text-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary/30",
                "disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              )}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 h-3 w-3 text-muted-foreground" />
          </div>
        )}

        {/* Mic button */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={isListening ? stopRecording : startRecording}
            disabled={isDisabled}
            title={
              isListening
                ? "Stop recording"
                : isProcessing
                ? "Transcribing…"
                : "Click to speak"
            }
            className={cn(
              "relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              isListening
                ? "bg-red-500 text-white shadow-md shadow-red-300/40 dark:shadow-red-900/40"
                : isProcessing
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "border border-border text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5"
            )}
          >
            {/* Pulse rings while listening */}
            {isListening && (
              <>
                <span className="absolute inset-0 rounded-lg animate-ping bg-red-400 opacity-30" />
                <span className="absolute inset-0 rounded-lg animate-pulse bg-red-400 opacity-10" />
              </>
            )}

            {isProcessing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isListening ? (
              <Square className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Mic className="h-3.5 w-3.5" />
            )}

            <span>
              {isProcessing
                ? "Transcribing…"
                : isListening
                ? "Stop"
                : "Speak"}
            </span>
          </button>
        </div>

        {/* Listening badge */}
        {isListening && (
          <span className="flex shrink-0 items-center gap-1 text-xs text-red-500 font-medium animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            Listening…
          </span>
        )}
      </div>

      {/* Error message */}
      {state === "error" && error && (
        <p className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
          <MicOff className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
