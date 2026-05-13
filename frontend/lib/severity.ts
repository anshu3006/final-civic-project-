export type SeverityLevel = "Low" | "Medium" | "High" | "Critical" | "None";

export function normalizeSeverity(value: unknown): SeverityLevel {
  if (value == null) return "None";
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "critical") return "Critical";
  if (normalized === "high") return "High";
  if (normalized === "medium") return "Medium";
  if (normalized === "low") return "Low";
  return "None";
}

export function severityFromScore(score: unknown): SeverityLevel {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return "None";
  if (numeric >= 8) return "Critical";
  if (numeric >= 5) return "High";
  if (numeric >= 3) return "Medium";
  if (numeric >= 1) return "Low";
  return "None";
}

export function resolveSeverity(value: unknown, score?: unknown): SeverityLevel {
  const direct = normalizeSeverity(value);
  if (direct !== "None") return direct;
  return severityFromScore(score);
}

export function getSeverityMarkerColor(value: unknown, score?: unknown): string {
  const severity = resolveSeverity(value, score);
  if (severity === "Critical") return "#dc2626";
  if (severity === "High") return "#f87171";
  return "#3b82f6";
}

export function isHighSeverity(value: unknown, score?: unknown): boolean {
  const severity = resolveSeverity(value, score);
  return severity === "High" || severity === "Critical";
}

export function getSeverityGradient(value: unknown, score?: unknown): string {
  const severity = resolveSeverity(value, score);
  if (severity === "Critical") {
    return "bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.20)_0%,rgba(220,38,38,0.08)_28%,transparent_62%)]";
  }
  if (severity === "High") {
    return "bg-[radial-gradient(circle_at_top_right,rgba(248,113,113,0.18)_0%,rgba(248,113,113,0.07)_28%,transparent_62%)]";
  }
  if (severity === "Medium") {
    return "bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.14)_0%,rgba(251,146,60,0.05)_28%,transparent_62%)]";
  }
  return "";
}
