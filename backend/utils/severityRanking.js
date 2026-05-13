const SEVERITY_RANK = Object.freeze({
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
  None: 0,
});

const SEVERITY_TO_SCORE = Object.freeze({
  Critical: 9,
  High: 7,
  Medium: 4,
  Low: 2,
  None: 0,
});

function normalizeSeverity(value) {
  if (!value) return 'None';
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'critical') return 'Critical';
  if (normalized === 'high') return 'High';
  if (normalized === 'medium') return 'Medium';
  if (normalized === 'low') return 'Low';
  if (normalized === 'none' || normalized === 'no issue') return 'None';
  return 'None';
}

function severityFromScore(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return 'None';
  if (numeric >= 8) return 'Critical';
  if (numeric >= 5) return 'High';
  if (numeric >= 3) return 'Medium';
  if (numeric >= 1) return 'Low';
  return 'None';
}

function scoreFromSeverity(severity) {
  return SEVERITY_TO_SCORE[normalizeSeverity(severity)];
}

function getSeverityRank(severity) {
  return SEVERITY_RANK[normalizeSeverity(severity)];
}

function sortIssuesBySeverity(issues) {
  return [...issues].sort((a, b) => {
    const rankDiff = getSeverityRank(b.severity) - getSeverityRank(a.severity);
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
}

module.exports = {
  SEVERITY_RANK,
  normalizeSeverity,
  severityFromScore,
  scoreFromSeverity,
  getSeverityRank,
  sortIssuesBySeverity,
};
