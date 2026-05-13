// Designation thresholds (highest first for correct lookup)
const DESIGNATIONS = [
  { name: 'Nayak',    min: 700 },
  { name: 'Rakshak', min: 300 },
  { name: 'Mitra',   min: 100 },
];

/**
 * Returns the designation name for a given points total.
 * @param {number} points
 * @returns {'Nayak'|'Rakshak'|'Mitra'|'Newcomer'}
 */
function computeDesignation(points = 0) {
  for (const d of DESIGNATIONS) {
    if (points >= d.min) return d.name;
  }
  return 'Newcomer';
}

/**
 * Atomically adds `delta` points to a user and recomputes designation.
 * Idempotent-safe: if user doesn't exist yet, the $inc is a no-op.
 * @param {import('mongodb').Db} db
 * @param {string} clerkUserId
 * @param {number} delta  positive to add, negative to subtract
 */
async function awardPoints(db, clerkUserId, delta) {
  if (!clerkUserId || delta === 0) return;

  const result = await db.collection('users').findOneAndUpdate(
    { clerkUserId },
    {
      $inc: { points: delta },
      $setOnInsert: { designation: 'Newcomer' },
    },
    { returnDocument: 'after', upsert: false }
  );

  if (!result) return; // user not in DB yet — skip silently

  const newPoints = result.points ?? 0;
  const designation = computeDesignation(newPoints);

  await db.collection('users').updateOne(
    { clerkUserId },
    { $set: { designation } }
  );
}

/**
 * Returns severity-based point value for issue resolution.
 * @param {number|null} severityScore  1–10
 * @returns {number}
 */
function resolutionPoints(severityScore) {
  const s = parseInt(severityScore, 10);
  if (s >= 7) return 50;
  if (s >= 4) return 30;
  if (s >= 1) return 10;
  return 20; // unknown severity — give a fair default
}

module.exports = { computeDesignation, awardPoints, resolutionPoints, DESIGNATIONS };
