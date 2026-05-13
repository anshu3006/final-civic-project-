"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  ImagePlus,
  X,
  ChevronDown,
  Loader2,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LocationPicker, type PickedLocation } from "@/components/location-picker";
import { SpeechToTextButton } from "@/components/speech-to-text-button";
import { useGeolocation } from "@/lib/hooks/use-geolocation";
import { DuplicateWarningModal, type DuplicateMatch } from "@/components/duplicate-warning-modal";
import { ProcessingStatusIndicator } from "@/components/processing-status-indicator";

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5500").replace(/\/$/, "");

const suggestedDepartments = [
  "Electrical",
  "Plumbing",
  "Civil",
  "Housekeeping",
  "Lift",
  "Security",
  "Other",
];

const severityOptions = ["Low", "Medium", "High", "Critical"] as const;

function severityFromScore(score: unknown): string {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return "";
  if (numeric >= 8) return "Critical";
  if (numeric >= 5) return "High";
  if (numeric >= 3) return "Medium";
  if (numeric >= 1) return "Low";
  return "Low";
}

function severityToScore(severity: string): number | null {
  if (severity === "Critical") return 9;
  if (severity === "High") return 7;
  if (severity === "Medium") return 4;
  if (severity === "Low") return 2;
  return null;
}
const impactScopeOptions = ["Individual", "Locality", "Ward", "City-wide"];
const urgencyOptions = ["Immediate", "Within 24hrs", "Within a Week", "Routine"];
const estimatedResolutionOptions = [
  "Same Day",
  "1-3 Days",
  "1 Week",
  "2-4 Weeks",
  "Long-term Project",
];

interface FormState {
  title: string;
  description: string;
  location: string;
}

interface FormErrors {
  title?: string;
  description?: string;
  image?: string;
}

interface AIFields {
  imageUrl: string | null;
  predictedIssueType: string;
  severity: string;
  confidence: number | string;
  severityScore: number | string;
  impactScope: string;
  urgency: string;
  priorityScore: number | string;
  suggestedDepartment: string;
  estimatedResolution: string;
  description: string;
}

function isSentinelInvalidAiResponse(value: unknown): { isInvalid: boolean; type: "BLURRY" | "OUT_OF_CONTEXT" | null } {
  if (!value || typeof value !== "object") {
    return { isInvalid: false, type: null };
  }

  const source = value as Record<string, unknown>;
  const read = (keys: string[]): unknown => {
    for (const key of keys) {
      if (source[key] != null) return source[key];
    }
    return null;
  };

  const issue = read(["predictedIssueType", "issueType", "issue", "category"]);
  const severityScore = read(["severityScore", "severity_score"]);
  const impactScope = read(["impactScope", "impact_scope", "impact"]);
  const urgency = read(["urgency"]);
  const priorityScore = read(["priorityScore", "priority_score", "priority"]);
  const department = read(["suggestedDepartment", "department"]);
  const estimatedResolution = read(["estimatedResolution", "estimated_resolution", "resolutionEta", "resolution_eta"]);

  const matches = (candidate: unknown, sentinel: number) => Number(candidate) === sentinel;
  const allMatch = (sentinel: number) => (
    matches(issue, sentinel) &&
    matches(severityScore, sentinel) &&
    matches(impactScope, sentinel) &&
    matches(urgency, sentinel) &&
    matches(priorityScore, sentinel) &&
    matches(department, sentinel) &&
    matches(estimatedResolution, sentinel)
  );

  if (allMatch(300)) return { isInvalid: true, type: "BLURRY" };
  if (allMatch(400)) return { isInvalid: true, type: "OUT_OF_CONTEXT" };
  return { isInvalid: false, type: null };
}

interface PostIssueProps {
  onSuccess?: () => void;
}

type Stage = "form" | "analyzing" | "review";

// How long (ms) the frontend waits for the /preview response before aborting.
// Must be slightly longer than the backend axios timeout (90 s) so the backend
// error is surfaced rather than a raw network abort.
const PREVIEW_FETCH_TIMEOUT_MS = 100_000; // 100 s
const AI_RUNNING_MESSAGE = "Running AI analysis to classify the issue...";
const ML_HIGH_MESSAGE = "High confidence detected — using ML model to estimate severity...";
const ML_LOW_MESSAGE = "Low confidence detected — delegating analysis to AI agent...";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function PostIssue({ onSuccess }: PostIssueProps) {
  const { getToken } = useAuth();

  const [expanded, setExpanded] = useState(false);
  const [stage, setStage] = useState<Stage>("form");
  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    location: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pickedLocation, setPickedLocation] = useState<PickedLocation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [aiFields, setAiFields] = useState<AIFields | null>(null);
  const [webhookFailed, setWebhookFailed] = useState(false);
  const [webhookErrorCode, setWebhookErrorCode] = useState<string | null>(null);
  const [analysisTimedOut, setAnalysisTimedOut] = useState(false);
  const [processingStatusMessage, setProcessingStatusMessage] = useState(AI_RUNNING_MESSAGE);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [, setInvalidImage] = useState(false);
  const [invalidImageType, setInvalidImageType] = useState<'BLURRY' | 'OUT_OF_CONTEXT' | null>(null);
  const [showInvalidImagePrompt, setShowInvalidImagePrompt] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { status: geoStatus, coords, error: geoError, requestLocation, reset: resetGeo } = useGeolocation();
  // Store GPS coords captured during analyze step
  const gpsCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  // AbortController for the in-flight /preview fetch
  const previewAbortRef = useRef<AbortController | null>(null);

  // Tick an elapsed-seconds counter while in the "analyzing" stage
  useEffect(() => {
    if (stage !== "analyzing") {
      setElapsedSeconds(0);
      return;
    }
    setElapsedSeconds(0);
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [stage]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((e) => ({ ...e, [name]: undefined }));
    }
  }

  function handleAiFieldChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setAiFields((f) => (f ? { ...f, [name]: value } : f));
  }

  function handleTranscript(text: string) {
    setForm((f) => ({
      ...f,
      description: f.description ? `${f.description} ${text}` : text,
    }));
    if (errors.description) {
      setErrors((e) => ({ ...e, description: undefined }));
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSubmitError("Please select a valid image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError("Image must be under 5 MB.");
      return;
    }
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
    setSubmitError(null);
  }

  function removeImage() {
    setImage(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleReuploadImage() {
    // Reset invalid image state
    setInvalidImage(false);
    setInvalidImageType(null);
    setShowInvalidImagePrompt(false);
    // Clear current image
    removeImage();
    // Trigger file input
    fileRef.current?.click();
  }

  function handleCancelPost() {
    // Reset invalid image state
    setInvalidImage(false);
    setInvalidImageType(null);
    setShowInvalidImagePrompt(false);
    // Reset form
    setStage("form");
    setForm({ title: "", description: "", location: "" });
    removeImage();
    setErrors({});
    setSubmitError(null);
    setExpanded(false);
  }

  function validate(): boolean {
    const newErrors: FormErrors = {};
    if (!form.title.trim() || form.title.trim().length < 5) {
      newErrors.title = "Title must be at least 5 characters.";
    }
    if (!form.description.trim() || form.description.trim().length < 10) {
      newErrors.description = "Description must be at least 10 characters.";
    }
    if (!image) {
      newErrors.image = "A photo is required to submit an issue.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // Step 1: Upload image + call webhook, show loading then review panel
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setStage("analyzing");
    setSubmitError(null);
    setWebhookFailed(false);
    setWebhookErrorCode(null);
    setAnalysisTimedOut(false);
    setProcessingStatusMessage(AI_RUNNING_MESSAGE);
    setInvalidImage(false);
    setInvalidImageType(null);
    setShowInvalidImagePrompt(false);

    // Set up an AbortController so we never hang forever
    const controller = new AbortController();
    previewAbortRef.current = controller;
    const abortTimer = setTimeout(() => {
      setAnalysisTimedOut(true);
      controller.abort();
    }, PREVIEW_FETCH_TIMEOUT_MS);

    try {
      // Capture GPS silently
      let gpsCoords = coords;
      if (geoStatus === "idle") {
        gpsCoords = await requestLocation();
      }
      gpsCoordsRef.current = gpsCoords;

      const token = await getToken();
      const body = new FormData();
      body.append("title", form.title.trim());
      body.append("description", form.description.trim());
      if (form.location) body.append("location", form.location.trim());
      if (image) body.append("image", image);

      const res = await fetch(`${BACKEND_URL}/api/issues/preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
        signal: controller.signal,
      });

      clearTimeout(abortTimer);
      previewAbortRef.current = null;

      const data = await res.json().catch(() => ({}));
      /* --------------------------------
        IMAGE DUPLICATE DETECTION
      -------------------------------- */

      if (data?.duplicate && data?.originalIssue) {

        console.log("Duplicate issue detected:", data.originalIssue);

        setStage("form");

        const issue = data.originalIssue;

        const formattedMatch = {
          _id: issue._id || Math.random().toString(),
          title: issue.title || "Existing Issue",
          description: issue.description || "",
          imageUrl: issue.imageUrl || "",
          location: issue.location || "",
          status: issue.status || "reported",
          upvotes: issue.upvotes || [],
          createdAt: issue.createdAt || new Date().toISOString(),
          similarityScore: 100,
          distanceMeters: 0
        };

        setDuplicateMatches([formattedMatch]);

        return;
      }

      /* --------------------------------
        NORMAL PREVIEW FLOW
      -------------------------------- */

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Preview failed");
      }

      // Check for invalid/blurry image response
      const responseData = ((data && typeof data === "object" && "data" in data)
        ? (data as { data?: Record<string, unknown> }).data
        : data) as Record<string, unknown> | null;
      const asString = (value: unknown): string => (typeof value === "string" ? value : "");
      const asNumberOrString = (value: unknown): number | string =>
        typeof value === "number" || typeof value === "string" ? value : "";
      const asNullableString = (value: unknown): string | null =>
        typeof value === "string" ? value : null;
      const sentinelInvalid = isSentinelInvalidAiResponse(responseData);
      if (responseData?.invalidImage === true || sentinelInvalid.isInvalid) {
        setInvalidImage(true);
        setInvalidImageType(
          (responseData?.invalidImageType as "BLURRY" | "OUT_OF_CONTEXT" | undefined) ||
          sentinelInvalid.type ||
          'OUT_OF_CONTEXT'
        );
        setShowInvalidImagePrompt(true);
        setStage("form");
        return;
      }

      // Even if the call failed, fall back gracefully to review with original fields
      const aiDataPresent = Boolean(
        responseData && (
          responseData.predictedIssueType ||
          responseData.severityScore != null ||
          responseData.impactScope ||
          responseData.urgency ||
          responseData.priorityScore != null ||
          responseData.suggestedDepartment ||
          responseData.estimatedResolution ||
          responseData.description
        )
      );
      

      if (!res.ok || !aiDataPresent) {
        setWebhookFailed(true);
        setWebhookErrorCode(asString(responseData?.webhookError) || (res.ok ? "EMPTY_RESPONSE" : "HTTP_ERROR"));
      } else {
        setWebhookErrorCode(asNullableString(responseData?.webhookError));
      }

      const mlConfidence = Number(responseData?.mlConfidence ?? responseData?.confidence);

      if (Number.isFinite(mlConfidence)) {

        const percent = (mlConfidence * 100).toFixed(1);

        setProcessingStatusMessage(
          `ML model confidence: ${percent}%`
        );

        await sleep(900);

        setProcessingStatusMessage(
          mlConfidence >= 0.8
            ? `High confidence (${percent}%) — ML severity estimation used`
            : `Low confidence (${percent}%) — AI agent performing deeper analysis`
        );
      }
      if (Number.isFinite(mlConfidence)) {
        setProcessingStatusMessage(
          mlConfidence >= 0.8 ? ML_HIGH_MESSAGE : ML_LOW_MESSAGE
        );
        await sleep(900);
      }

      setAiFields({
  imageUrl: asNullableString(responseData?.imageUrl),

  // Issue classification
  predictedIssueType:
    asString(responseData?.issueType) ||
    asString(responseData?.predictedIssueType) ||
    "",

  // Severity
  severity:
    asString(responseData?.severity) ||
    severityFromScore(responseData?.severityScore),

  severityScore: asNumberOrString(responseData?.severityScore),

  // Confidence
  confidence: asNumberOrString(responseData?.confidence),

  // Department routing
  suggestedDepartment:
    asString(responseData?.department) ||
    asString(responseData?.suggestedDepartment) ||
    "",

  // Impact metrics
  impactScope: asString(responseData?.impactScope),
  urgency: asString(responseData?.urgency),
  priorityScore: asNumberOrString(responseData?.priorityScore),

  // Resolution estimate
  estimatedResolution: asString(responseData?.estimatedResolution),

  // Description
  description: asString(responseData?.description) || form.description.trim(),
      });
      setStage("review");
    } catch (err: unknown) {
      clearTimeout(abortTimer);
      previewAbortRef.current = null;

      const isAbort = err instanceof Error && err.name === "AbortError";
      // Network-level failure or timeout — still go to review with original fields
      setWebhookFailed(true);
      setWebhookErrorCode(isAbort ? "TIMEOUT" : "NETWORK_ERROR");
      setProcessingStatusMessage(AI_RUNNING_MESSAGE);
      setAiFields({
        imageUrl: null,
        predictedIssueType: "",
        severity: "",
        confidence: "",
        severityScore: "",
        impactScope: "",
        urgency: "",
        priorityScore: "",
        suggestedDepartment: "",
        estimatedResolution: "",
        description: form.description.trim(),
      });
      setStage("review");
    }
  }

  // Step 2: Check for duplicates, then save
  async function handleConfirm(forceSubmit = false) {
    if (!aiFields) return;

    // ── Duplicate check (skip if user already chose "Submit Anyway") ──
    if (!forceSubmit) {
      const gps = gpsCoordsRef.current ?? pickedLocation;
      if (gps?.lat && gps?.lng) {
        setCheckingDuplicate(true);
        try {
          const res = await fetch(`${BACKEND_URL}/api/issues/check-duplicate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: aiFields.description,
              lat: gps.lat,
              lng: gps.lng,
            }),
          });
          const data = await res.json().catch(() => ({ duplicates: [] }));
          if (data.duplicates?.length > 0) {
            setDuplicateMatches(data.duplicates);
            setCheckingDuplicate(false);
            return; // show modal, don't submit yet
          }
        } catch {
          // fail open — proceed with submission
        }
        setCheckingDuplicate(false);
      }
    }

    setDuplicateMatches([]); // clear modal
    await doConfirm();
  }

  async function doConfirm() {
    if (!aiFields) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const token = await getToken();
      const gps = gpsCoordsRef.current;

      const payload: Record<string, unknown> = {
  title: form.title.trim(),
  description: aiFields.description,

  location: form.location.trim() || null,
  imageUrl: aiFields.imageUrl || null,

  // Issue classification
  predictedIssueType: aiFields.predictedIssueType || null,

  // Severity
  severity: aiFields.severity || null,
  severityScore:
    aiFields.severityScore !== ""
      ? Number(aiFields.severityScore)
      : severityToScore(aiFields.severity),

  // Confidence
  confidence:
    aiFields.confidence !== ""
      ? Number(aiFields.confidence)
      : null,

  // Impact metrics
  impactScope: aiFields.impactScope || null,
  urgency: aiFields.urgency || null,
  priorityScore:
    aiFields.priorityScore !== ""
      ? Number(aiFields.priorityScore)
      : null,

  // Department routing
  suggestedDepartment: aiFields.suggestedDepartment || null,

  // Resolution estimate
  estimatedResolution: aiFields.estimatedResolution || null,

  // GPS coordinates
  lat: gps?.lat ?? null,
  lng: gps?.lng ?? null,
      };

      const res = await fetch(`${BACKEND_URL}/api/issues`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Server error (${res.status})`);
      }

      // Reset
      setForm({ title: "", description: "", location: "" });
      removeImage();
      resetGeo();
      setAiFields(null);
      setExpanded(false);
      setStage("form");
      gpsCoordsRef.current = null;
      onSuccess?.();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Failed to submit issue. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    setForm({ title: "", description: "", location: "" });
    removeImage();
    setPickedLocation(null);
    setErrors({});
    setSubmitError(null);
    setAiFields(null);
    setStage("form");
    setExpanded(false);
    setWebhookFailed(false);
    setWebhookErrorCode(null);
    setAnalysisTimedOut(false);
    setProcessingStatusMessage(AI_RUNNING_MESSAGE);
    gpsCoordsRef.current = null;
  }

  return (
    <div className="rounded-xl border border-border/60 bg-background shadow-sm">
      {/* Collapsed trigger */}
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/50 rounded-xl"
        >
          <div className="flex-1 rounded-full border border-border bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
            What issue would you like to report?
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      ) : stage === "analyzing" ? (
        /* ── Loading / Analyzing state ── */
        <div className="flex flex-col items-center justify-center gap-5 px-6 py-10 sm:p-10 text-center">
          <div className="relative">
            {/* Outer ring */}
            <div className="h-16 w-16 rounded-full border-4 border-primary/20" />
            {/* Spinning arc */}
            <Loader2 className="absolute inset-0 m-auto h-9 w-9 animate-spin text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              {analysisTimedOut ? "Still waiting for AI…" : "Analysing your issue…"}
            </p>
            <p className="text-xs text-muted-foreground">
              {analysisTimedOut
                ? "The AI is taking longer than expected. Hang tight or cancel and retry."
                : "Our AI is classifying and enhancing your report. This may take up to 90 seconds."}
            </p>
            <ProcessingStatusIndicator message={processingStatusMessage} />
            {elapsedSeconds > 0 && (
              <p className="text-xs tabular-nums text-muted-foreground/70">
                {elapsedSeconds}s elapsed
              </p>
            )}
          </div>
          {/* Let users escape if the AI truly stalls */}
          <button
            type="button"
            onClick={handleCancel}
            className="mt-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      ) : stage === "review" && aiFields ? (
        /* ── Review / Edit AI fields ── */
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Review AI Analysis</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            The fields below were filled in by AI. Edit them if needed, then confirm to post.
          </p>

          {webhookFailed && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-700 dark:bg-amber-900/20">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {webhookErrorCode === "TIMEOUT"
                  ? "AI analysis timed out. Please review and fill in the fields below before posting."
                  : webhookErrorCode === "EMPTY_RESPONSE"
                    ? "AI returned no data. Please review and fill in the fields below."
                    : "AI analysis was unavailable. Please review and fill in the fields below before posting."}
              </p>
            </div>
          )}

          {/* Title (read-only) */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Title</label>
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {form.title}
            </p>
          </div>

          {/* AI-refined Description (editable) */}
          <div className="space-y-1">
            <label htmlFor="ai-description" className="text-sm font-medium flex items-center gap-1.5">
              Description
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">AI refined</span>
            </label>
            <textarea
              id="ai-description"
              name="description"
              value={aiFields.description}
              onChange={handleAiFieldChange}
              rows={4}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Issue Type */}
          <div className="space-y-1">
            <label htmlFor="ai-predictedIssueType" className="text-sm font-medium flex items-center gap-1.5">
              Issue Type
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">AI</span>
            </label>
            <input
              id="ai-predictedIssueType"
              name="predictedIssueType"
              value={aiFields.predictedIssueType}
              onChange={handleAiFieldChange}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Severity + Priority */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="ai-severity" className="text-sm font-medium flex items-center gap-1.5">
                Severity
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">AI / ML</span>
              </label>
              <select
                id="ai-severity"
                name="severity"
                value={aiFields.severity}
                onChange={handleAiFieldChange}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select severity…</option>
                {severityOptions.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Confidence: {aiFields.confidence !== "" ? Number(aiFields.confidence).toFixed(2) : "N/A"}
              </p>
            </div>

            <div className="space-y-1">
              <label htmlFor="ai-priorityScore" className="text-sm font-medium flex items-center gap-1.5">
                Priority Score <span className="text-muted-foreground font-normal">(1–100)</span>
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">AI</span>
              </label>
              <input
                id="ai-priorityScore"
                name="priorityScore"
                type="number"
                min={1}
                max={100}
                value={aiFields.priorityScore}
                onChange={handleAiFieldChange}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Impact + Urgency */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="ai-impactScope" className="text-sm font-medium flex items-center gap-1.5">
                Impact Scope
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">AI</span>
              </label>
              <select
                id="ai-impactScope"
                name="impactScope"
                value={aiFields.impactScope}
                onChange={handleAiFieldChange}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select impact scope…</option>
                {impactScopeOptions.map((scope) => (
                  <option key={scope} value={scope}>{scope}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="ai-urgency" className="text-sm font-medium flex items-center gap-1.5">
                Urgency
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">AI</span>
              </label>
              <select
                id="ai-urgency"
                name="urgency"
                value={aiFields.urgency}
                onChange={handleAiFieldChange}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select urgency…</option>
                {urgencyOptions.map((urgency) => (
                  <option key={urgency} value={urgency}>{urgency}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Department + Estimated Resolution */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="ai-suggestedDepartment" className="text-sm font-medium flex items-center gap-1.5">
                Department
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">AI</span>
              </label>
              <select
                id="ai-suggestedDepartment"
                name="suggestedDepartment"
                value={aiFields.suggestedDepartment}
                onChange={handleAiFieldChange}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select department…</option>
                {suggestedDepartments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="ai-estimatedResolution" className="text-sm font-medium flex items-center gap-1.5">
                Estimated Resolution
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">AI</span>
              </label>
              <select
                id="ai-estimatedResolution"
                name="estimatedResolution"
                value={aiFields.estimatedResolution}
                onChange={handleAiFieldChange}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select estimated resolution…</option>
                {estimatedResolutionOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Uploaded image preview (if any) */}
          {aiFields.imageUrl && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Uploaded Photo</label>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={aiFields.imageUrl}
                alt="Uploaded"
                className="h-40 w-full rounded-lg border border-border object-cover"
              />
            </div>
          )}

          {submitError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {submitError}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setStage("form"); setSubmitError(null); }}
              disabled={submitting}
              className="flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => handleConfirm()}
                disabled={submitting || checkingDuplicate}
              >
                {(submitting || checkingDuplicate) && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Posting…" : checkingDuplicate ? "Checking…" : "Confirm & Post"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* ── Original form ── */
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <h2 className="text-base font-semibold">Report an Issue</h2>

          {/* Title */}
          <div className="space-y-1">
            <label htmlFor="title" className="text-sm font-medium">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. Broken streetlight on Main St"
              className={cn(
                "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30",
                errors.title
                  ? "border-red-400 focus:ring-red-200"
                  : "border-border"
              )}
            />
            {errors.title && (
              <p className="text-xs text-red-500">{errors.title}</p>
            )}
          </div>

          {/* Description + STT button */}
          <div className="space-y-1.5">
            <label htmlFor="description" className="text-sm font-medium">
              Description <span className="text-red-500">*</span>
            </label>

            {/* STT controls row — language dropdown + mic button */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="text-xs text-muted-foreground shrink-0">🎙️ Voice:</span>
              <SpeechToTextButton
                onTranscript={handleTranscript}
                showLanguageSelector
              />
            </div>

            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              placeholder="Describe the issue in detail… or use voice input above 🎙️"
              className={cn(
                "w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30",
                errors.description
                  ? "border-red-400 focus:ring-red-200"
                  : "border-border"
              )}
            />
            {errors.description && (
              <p className="text-xs text-red-500">{errors.description}</p>
            )}
          </div>

          {/* Location text */}
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1">
              <label htmlFor="location" className="text-sm font-medium">
                Location (text)
              </label>
              <input
                id="location"
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="Street, area, or landmark"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* GPS Location Capture */}
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  {geoStatus === "idle" && (
                    <p className="text-xs text-muted-foreground">
                      GPS captured on submit, or&nbsp;
                      <button
                        type="button"
                        onClick={() => requestLocation()}
                        className="text-primary underline underline-offset-2 hover:no-underline"
                      >
                        capture now
                      </button>
                    </p>
                  )}
                  {geoStatus === "loading" && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Getting your location…
                    </p>
                  )}
                  {geoStatus === "success" && coords && (
                    <p className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">GPS captured — {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>
                    </p>
                  )}
                  {(geoStatus === "denied" || geoStatus === "unavailable" || geoStatus === "timeout" || geoStatus === "error") && (
                    <p className="flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span className="line-clamp-2">{geoError}</span>
                    </p>
                  )}
                </div>
              </div>
              {(geoStatus === "denied" || geoStatus === "timeout" || geoStatus === "error" || geoStatus === "unavailable") && (
                <button
                  type="button"
                  onClick={() => requestLocation()}
                  className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Retry
                </button>
              )}
              {geoStatus === "success" && (
                <button
                  type="button"
                  onClick={resetGeo}
                  className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                  title="Clear location"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="mt-3">
              <LocationPicker
                value={pickedLocation}
                onChange={setPickedLocation}
              />
            </div>
          </div>

          {/* Image upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Photo <span className="text-red-500">*</span>
            </label>
            {imagePreview ? (
              <div className="relative w-full overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-40 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute right-2 top-2 rounded-full bg-background/80 p-1 backdrop-blur-sm hover:bg-background transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-6 text-sm transition-colors hover:bg-muted/50",
                  errors.image
                    ? "border-red-400 text-red-500 hover:border-red-400"
                    : "border-border text-muted-foreground hover:border-primary/40"
                )}
              >
                <ImagePlus className="h-5 w-5" />
                Click to upload photo
              </button>
            )}
            {errors.image && (
              <p className="text-xs text-red-500">{errors.image}</p>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>

          {submitError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {submitError}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Analyse &amp; Submit
            </Button>
          </div>
        </form>
      )}

      {/* Duplicate warning modal */}
      {duplicateMatches.length > 0 && (
        <DuplicateWarningModal
          matches={duplicateMatches}
          onSubmitAnyway={() => handleConfirm(true)}
          onClose={() => setDuplicateMatches([])}
        />
      )}

      {/* Invalid image prompt modal */}
      {showInvalidImagePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="text-lg font-semibold">
                    {invalidImageType === 'BLURRY' ? 'Blurry Image Detected' : 'Invalid Image'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {invalidImageType === 'BLURRY' 
                      ? 'The uploaded image is too blurry, obscured, or of insufficient quality to analyze. Please upload a clearer photo.'
                      : 'The uploaded image does not appear to be related to civic, infrastructure, urban, or public safety issues. Please upload a relevant photo.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={handleReuploadImage}
                  className="w-full"
                  size="sm"
                >
                  <ImagePlus className="h-4 w-4 mr-2" />
                  Re-upload Image
                </Button>
                <Button
                  onClick={handleCancelPost}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  Cancel Post
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
