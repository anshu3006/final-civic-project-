const express = require('express');
const { ObjectId } = require('mongodb');
const axios = require('axios');
const { isDuplicate } = require('../utils/duplicateDetector');
const FormData = require('form-data');
const upload = require('../middleware/upload');
const { requireAuth, getAuth } = require('../middleware/auth');
const { uploadToCloudinary } = require('../utils/cloudinaryUpload');
const { getDB } = require('../config/db');
const { aiPreviewLimiter, createIssueLimiter, interactionLimiter } = require('../middleware/rateLimiter');
const { awardPoints, resolutionPoints } = require('../utils/points');
const {
  normalizeSeverity,
  severityFromScore,
  scoreFromSeverity,
  sortIssuesBySeverity,
} = require('../utils/severityRanking');

const router = express.Router();

const WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://n8n1.rohithn8n.me/webhook/cad109f9-1c30-404a-be6b-6a6aa8c90b64';
const WEBHOOK_TIMEOUT_MS = 90000; // 90 s — production n8n workflows can take longer than 60 s
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000/analyze-severity';
const ML_CONFIDENCE_THRESHOLD = Number(process.env.ML_CONFIDENCE_THRESHOLD || 0.8);

function parseConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric < 0 || numeric > 1) return null;
  return numeric;
}

function normalizeLocation(lat, lng) {
  const parsedLat = Number.parseFloat(lat);
  const parsedLng = Number.parseFloat(lng);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return null;
  return { lat: parsedLat, lng: parsedLng };
}

function normalizeN8nAnalysis(payload, fallbackDescription) {
  const issue =
    payload?.issue ||
    payload?.issueType ||
    payload?.category ||
    payload?.predictedIssueType ||
    null;
  const severity = normalizeSeverity(payload?.severity || severityFromScore(payload?.severityScore));
  const confidence = parseConfidence(payload?.confidence) ?? parseConfidence(payload?.confidenceScore);
  const department = payload?.department || payload?.suggestedDepartment || null;
  const description = payload?.description || fallbackDescription;
  const severityScoreFromPayload = Number(payload?.severityScore);
  const impactScope =
    payload?.impactScope ||
    payload?.impact_scope ||
    payload?.impact ||
    null;
  const urgency = payload?.urgency || null;
  const priorityScore =
    parseIntegerOrNull(payload?.priorityScore) ??
    parseIntegerOrNull(payload?.priority_score) ??
    parseIntegerOrNull(payload?.priority) ??
    null;
  const estimatedResolution =
    payload?.estimatedResolution ||
    payload?.estimated_resolution ||
    payload?.resolutionEta ||
    payload?.resolution_eta ||
    null;
  return {
    description,
    issue,
    severity,
    confidence,
    department,
    impactScope,
    urgency,
    priorityScore,
    estimatedResolution,
    severityScore: Number.isFinite(severityScoreFromPayload) ? severityScoreFromPayload : scoreFromSeverity(severity),
  };
}

function normalizeMlSeverity(payload) {
  const severity = normalizeSeverity(payload?.severity);
  return {
    description: payload?.description || null,
    severity,
    confidence: parseConfidence(payload?.confidence),
    severityScore: scoreFromSeverity(severity),
  };
}

async function callMlSeverityService(file) {
  const form = new FormData();
  form.append('image', file.buffer, {
    filename: file.originalname || 'issue-image.jpg',
    contentType: file.mimetype || 'image/jpeg',
  });

  const mlResponse = await axios.post(ML_SERVICE_URL, form, {
    headers: form.getHeaders(),
    timeout: 25000,
  });
  return normalizeMlSeverity(mlResponse.data);
}

async function callN8nWebhook(title, description, imageUrl) {
  const webhookRes = await axios.post(
    WEBHOOK_URL,
    { title, description, image_url: imageUrl },
    { headers: { 'Content-Type': 'application/json' }, timeout: WEBHOOK_TIMEOUT_MS }
  );
  const raw = webhookRes.data;
  
  // Check for invalid/blurry image BEFORE normalization
  if (Array.isArray(raw) && raw.length > 0) {
    const firstResult = raw[0] || {};
    const valueOf = (obj, keys) => {
      for (const key of keys) {
        if (obj?.[key] != null) return obj[key];
      }
      return null;
    };
    const matchesSentinel = (value, sentinel) => Number(value) === sentinel;

    const issueValue = valueOf(firstResult, ['predictedIssueType', 'issueType', 'issue', 'category']);
    const severityScoreValue = valueOf(firstResult, ['severityScore', 'severity_score']);
    const impactScopeValue = valueOf(firstResult, ['impactScope', 'impact_scope', 'impact']);
    const urgencyValue = valueOf(firstResult, ['urgency']);
    const priorityScoreValue = valueOf(firstResult, ['priorityScore', 'priority_score', 'priority']);
    const departmentValue = valueOf(firstResult, ['suggestedDepartment', 'department']);
    const estimatedResolutionValue = valueOf(firstResult, ['estimatedResolution', 'estimated_resolution', 'resolutionEta', 'resolution_eta']);

    const allFieldsMatch = (sentinel) => (
      matchesSentinel(issueValue, sentinel) &&
      matchesSentinel(severityScoreValue, sentinel) &&
      matchesSentinel(impactScopeValue, sentinel) &&
      matchesSentinel(urgencyValue, sentinel) &&
      matchesSentinel(priorityScoreValue, sentinel) &&
      matchesSentinel(departmentValue, sentinel) &&
      matchesSentinel(estimatedResolutionValue, sentinel)
    );

    const isBlurryImage = allFieldsMatch(300);
    const isOutOfContext = allFieldsMatch(400);

    if (isBlurryImage || isOutOfContext) {
      // Return raw invalid response without normalization
      return {
        invalidImage: true,
        invalidImageType: isBlurryImage ? 'BLURRY' : 'OUT_OF_CONTEXT',
        description: firstResult.description || (isBlurryImage ? 'Blurry image' : 'Invalid'),
      };
    }
  }
  
  const parsed = Array.isArray(raw) ? (raw[0] || {}) : (raw && typeof raw === 'object' ? raw : {});
  return normalizeN8nAnalysis(parsed, description);
}

function parseIntegerOrNull(value) {
  if (value == null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

// ---------- POST /api/issues/preview  ----------
// Step 1: Upload image to Cloudinary, call n8n webhook, return AI-enriched fields.
// The issue is NOT saved to the DB here.
// RATE LIMITED: 10 requests per 15 minutes (expensive AI operation)
router.post('/preview', aiPreviewLimiter, requireAuth(), upload.single('image'), async (req, res) => {
  try {
    const { title, description } = req.body;
    console.log('\n[PREVIEW] ── New preview request received ──');
    console.log('[PREVIEW] Title:', title);
    console.log('[PREVIEW] Description:', description);
    console.log('[PREVIEW] Image attached:', req.file ? `yes (${req.file.originalname}, ${(req.file.size / 1024).toFixed(1)} KB)` : 'no');

    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    // Upload image to Cloudinary if provided
    let imageUrl = null;
    if (req.file) {
      console.log('[PREVIEW] Uploading image to Cloudinary…');
      const result = await uploadToCloudinary(req.file.buffer);
      imageUrl = result.secure_url;
      console.log('[PREVIEW] ✅ Cloudinary upload successful:', imageUrl);
    } else {
      console.log('[PREVIEW] No image — skipping Cloudinary upload.');
    }

    // -------------------------------------------------
    // IMAGE DUPLICATE DETECTION
    // -------------------------------------------------

    if (req.file) {

      const db = getDB();

      const existingIssues = await db
        .collection('issues')
        .find({ imageUrl: { $ne: null } })
        .project({
          title: 1,
          description: 1,
          imageUrl: 1,
          location: 1,
          severity: 1,
          createdAt: 1
        })
        .toArray();

      if (existingIssues.length > 0) {

        const existingImages = existingIssues
          .map(issue => issue.imageUrl)
          .filter(Boolean);

        const duplicateIndex = await isDuplicate(
          req.file.buffer,
          existingImages
        );

        if (duplicateIndex !== false) {

          const duplicateIssue = existingIssues[duplicateIndex];

          console.log('[PREVIEW] ⚠ Duplicate image detected');

          return res.status(200).json({
            success: true,
            duplicate: true,
            originalIssue: duplicateIssue,
            message: "A similar issue image already exists"
          });

        }

      }

      console.log('[PREVIEW] ✅ Image passed duplicate detection');

    }

    let mlOk = !req.file;
    let mlError = null;
    let mlResult = null;
    if (req.file) {
      try {
        console.log('[PREVIEW] Calling ML severity service...');
        mlResult = await callMlSeverityService(req.file);
        mlOk = true;

        console.log('[ML] Severity:', mlResult.severity);
        console.log('[ML] Confidence:', mlResult.confidence);
        console.log('[ML] Severity Score:', mlResult.severityScore);
      } catch (mlErr) {
        mlError = mlErr.response?.data?.detail || mlErr.message || 'ML_SERVICE_ERROR';
        console.error('[PREVIEW] ❌ ML service failed:', mlError);
      }
    }

    const mlSeverityAccepted =
      mlResult &&
      mlResult.severity &&
      mlResult.confidence != null &&
      mlResult.confidence >= ML_CONFIDENCE_THRESHOLD;

    let webhookOk = true;
    let webhookError = null;
    let n8nResult = null;
    try {
      console.log('[PREVIEW] Calling n8n webhook...');
      n8nResult = await callN8nWebhook(title, description, imageUrl);
      
      // Check if n8n returned an invalid/blurry image response
      if (n8nResult?.invalidImage === true) {
        const invalidType = n8nResult.invalidImageType || 'OUT_OF_CONTEXT';
        console.log(`[PREVIEW] ⚠️ n8n detected ${invalidType} IMAGE`);
        return res.status(200).json({
          success: true,
          data: {
            imageUrl,
            invalidImage: true,
            invalidImageType: invalidType,
            description: n8nResult.description || (invalidType === 'BLURRY' ? 'Blurry image' : 'Invalid'),
          }
        });
      }
    } catch (webhookErr) {
      webhookOk = false;
      const status = webhookErr.response?.status;
      const isTimeout = webhookErr.code === 'ECONNABORTED' || webhookErr.message?.includes('timeout');
      webhookError = isTimeout ? 'TIMEOUT' : (status ? 'HTTP_ERROR' : 'NETWORK_ERROR');
      console.error('[PREVIEW] ❌ Webhook call failed:', webhookError, webhookErr.message);
    }

    const finalAnalysis = n8nResult || {
      description,
      issue: null,
      severity: 'None',
      confidence: null,
      department: null,
      severityScore: scoreFromSeverity('None'),
    };

    if (mlSeverityAccepted) {
      finalAnalysis.severity = mlResult.severity;
      finalAnalysis.severityScore = mlResult.severityScore;
      finalAnalysis.confidence = mlResult.confidence;
    }

    const source = !webhookOk
      ? (mlSeverityAccepted ? 'n8n_error_ml_severity_only' : 'n8n_error_manual_review')
      : (mlSeverityAccepted ? 'n8n_with_ml_severity_override' : 'n8n');

    const responseData = {
      imageUrl,

      // Description priority: n8n/AI -> ML caption -> original
      description: finalAnalysis?.description || mlResult?.description || description,

      // Issue classification
      issueType: finalAnalysis?.issue || null,
      category: finalAnalysis?.issue || null,
      predictedIssueType: finalAnalysis?.issue || null,

      // Severity
      severity: finalAnalysis?.severity || 'None',
      severityScore: finalAnalysis?.severityScore ?? null,

      // Impact metrics
      impactScope: finalAnalysis?.impactScope || null,
      urgency: finalAnalysis?.urgency || null,
      priorityScore: finalAnalysis?.priorityScore ?? null,

      // Department routing
      department: finalAnalysis?.department || null,
      suggestedDepartment: finalAnalysis?.department || null,

      // ML outputs
      mlOk,
      mlError,
      mlSeverityAccepted: Boolean(mlSeverityAccepted),
      mlSeverity: mlResult?.severity || null,
      mlConfidence: mlResult?.confidence ?? null,
      mlDescription: mlResult?.description || null,

      // AI metadata
      confidence: finalAnalysis?.confidence,

      // Resolution estimate
      estimatedResolution: finalAnalysis?.estimatedResolution || null,

      // Source tracking
      source,

      // Webhook status
      webhookOk,
      webhookError,

      // Invalid image flags
      invalidImage: false,
      invalidImageType: null,
    };
    console.log('[PREVIEW] Sending enriched fields to client:', JSON.stringify(responseData));
    console.log('[PREVIEW] ── Done. Awaiting user confirmation. ──\n');

    // Return Cloudinary URL + AI fields to the client for review
    return res.status(200).json({ success: true, data: responseData });
  } catch (err) {
    console.error('[PREVIEW] ❌ Unexpected error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- POST /api/issues  ----------
// Step 2: Save the confirmed (and optionally user-edited) issue to the DB.
// Accepts imageUrl as a plain string (already uploaded in /preview).
// RATE LIMITED: 20 requests per 15 minutes
router.post('/', createIssueLimiter, requireAuth(), async (req, res) => {
  try {
    const { userId: clerkUserId } = getAuth(req);
    const {
      title,
      description,
      location,
      category,
      issueType,
      severity,
      confidence,
      confidenceScore,
      department,
      lat,
      lng,
      imageUrl,
      predictedIssueType,
      severityScore,
      impactScope,
      urgency,
      priorityScore,
      suggestedDepartment,
      estimatedResolution,
    } = req.body;

    console.log('\n[CREATE] ── User confirmed issue, saving to DB ──');
    console.log('[CREATE] Reported by:', clerkUserId);
    console.log('[CREATE] Title:', title);
    console.log('[CREATE] Description:', description);
    console.log('[CREATE] Category:', category || issueType, '| Dept:', department || suggestedDepartment, '| Severity:', severity || severityFromScore(severityScore));
    console.log('[CREATE] Predicted type:', predictedIssueType);
    console.log('[CREATE] Impact:', impactScope, '| Urgency:', urgency, '| Priority:', priorityScore, '| ETA:', estimatedResolution);
    console.log('[CREATE] Image URL:', imageUrl || 'none');
    console.log('[CREATE] GPS:', lat && lng ? `${lat}, ${lng}` : 'not provided');

    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    const db = getDB();

    let normalizedLocation = null;
    if (typeof location === 'string' && location.startsWith('{')) {
      try {
        const parsedLocation = JSON.parse(location);
        if (parsedLocation.lat != null && parsedLocation.lng != null) {
          normalizedLocation = normalizeLocation(parsedLocation.lat, parsedLocation.lng);
        }
      } catch (locationError) {
        console.warn('[CREATE] Unable to parse location JSON:', locationError.message);
      }
    } else if (location && typeof location === 'object' && location.lat != null && location.lng != null) {
      normalizedLocation = normalizeLocation(location.lat, location.lng);
    } else if (lat != null && lng != null) {
      normalizedLocation = normalizeLocation(lat, lng);
    }

    const normalizedSeverity = normalizeSeverity(severity || severityFromScore(severityScore));
    const normalizedConfidence =
      parseConfidence(confidence) ??
      parseConfidence(confidenceScore) ??
      parseConfidence(Number(severityScore) / 10);
    const normalizedCategory = category || issueType || predictedIssueType || null;
    const normalizedDepartment = department || suggestedDepartment || null;

const issue = {
  title,
  description,

  // Location
  location: normalizedLocation,
  locationText: typeof location === 'string' && !location.startsWith('{') ? location : null,
  coordinates: normalizedLocation,

  // Classification
  category: normalizedCategory,
  predictedIssueType: predictedIssueType || normalizedCategory,

  // Severity
  severity: normalizedSeverity,
  severityScore: parseIntegerOrNull(severityScore) ?? scoreFromSeverity(normalizedSeverity),

  // AI metrics
  impactScope: impactScope || null,
  urgency: urgency || null,
  priorityScore: parseIntegerOrNull(priorityScore),

  // Department routing
  department: normalizedDepartment,
  suggestedDepartment: suggestedDepartment || normalizedDepartment,

  // Confidence
  confidence: normalizedConfidence,

  // Resolution estimate
  estimatedResolution: estimatedResolution || null,

  // Media
  imageUrl: imageUrl || null,

  // Metadata
  reportedBy: clerkUserId,
  status: 'reported',
  upvotes: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

    console.log('[CREATE] Inserting into MongoDB…');
    const inserted = await db.collection('issues').insertOne(issue);
    console.log('[CREATE] ✅ Issue saved! ID:', inserted.insertedId.toString());
    console.log('[CREATE] ── Done ──\n');

    res.status(201).json({
      success: true,
      message: 'Issue created successfully',
      data: { _id: inserted.insertedId, ...issue },
    });
  } catch (err) {
    console.error('[CREATE] ❌ Error saving issue:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- POST /api/issues/check-duplicate  ----------
// Returns nearby issues with similar descriptions (potential duplicates).
// Uses Haversine distance + Jaccard text similarity — no external dependencies.
router.post('/check-duplicate', async (req, res) => {
  try {
    const { description, lat, lng } = req.body;

    if (!description || lat == null || lng == null) {
      return res.json({ success: true, duplicates: [] });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const db = getDB();

    // Fetch issues that have coordinates (only non-resolved/nearby candidates)
    const candidates = await db
      .collection('issues')
      .find(
        { coordinates: { $ne: null }, status: { $ne: 'resolved' } },
        { projection: { _id: 1, title: 1, description: 1, location: 1, imageUrl: 1, status: 1, category: 1, department: 1, suggestedDepartment: 1, severity: 1, coordinates: 1, createdAt: 1, upvotes: 1 } }
      )
      .toArray();

    // ── Haversine distance in metres ──────────────────────────────────────
    function haversine(lat1, lng1, lat2, lng2) {
      const R = 6371000;
      const toRad = (d) => (d * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // ── Jaccard similarity on normalized word tokens ──────────────────────
    function normalize(text) {
      return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2); // drop very short words
    }

    function jaccard(a, b) {
      const setA = new Set(normalize(a));
      const setB = new Set(normalize(b));
      if (setA.size === 0 && setB.size === 0) return 0;
      const intersection = [...setA].filter((w) => setB.has(w)).length;
      const union = new Set([...setA, ...setB]).size;
      return union === 0 ? 0 : intersection / union;
    }

    const DISTANCE_THRESHOLD_M = 200; // 200 m radius
    const SIMILARITY_THRESHOLD = 0.25; // Jaccard ≥ 0.25

    const matches = [];
    for (const issue of candidates) {
      const { lat: iLat, lng: iLng } = issue.coordinates || {};
      if (iLat == null || iLng == null) continue;

      const distanceMeters = haversine(userLat, userLng, iLat, iLng);
      if (distanceMeters > DISTANCE_THRESHOLD_M) continue;

      const sim = jaccard(description, issue.description || '');
      if (sim < SIMILARITY_THRESHOLD) continue;

      matches.push({ ...issue, similarityScore: Math.round(sim * 100), distanceMeters: Math.round(distanceMeters) });
    }

    // Sort by similarity descending, return top 3
    matches.sort((a, b) => b.similarityScore - a.similarityScore);

    res.json({ success: true, duplicates: matches.slice(0, 3) });
  } catch (err) {
    console.error('[CHECK-DUPLICATE] ❌', err.message);
    res.json({ success: true, duplicates: [] }); // fail open — never block submission
  }
});


// ---------- GET /api/issues/pending-verifications  ----------
// Returns resolved issues awaiting resident verification (must be before /:id)
router.get('/pending-verifications', async (req, res) => {
  try {
    const db = getDB();
    const issues = await db
      .collection('issues')
      .aggregate([
        { $match: { status: 'resolved', verificationStatus: 'pending_verification' } },
        { $sort: { updatedAt: -1 } },
        {
          $lookup: {
            from: 'users',
            localField: 'reportedBy',
            foreignField: 'clerkUserId',
            as: '_reporter',
          },
        },
        {
          $addFields: {
            reporterName: {
              $ifNull: [{ $arrayElemAt: ['$_reporter.fullName', 0] }, 'Anonymous'],
            },
            reporterImage: { $arrayElemAt: ['$_reporter.imageUrl', 0] },
          },
        },
        { $project: { _reporter: 0 } },
      ])
      .toArray();

    res.json({ success: true, data: issues });
  } catch (err) {
    console.error('Error fetching pending verifications:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Fetch all issues with reporter info, then sort by severity rank
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const issues = await db
      .collection('issues')
      .aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'reportedBy',
            foreignField: 'clerkUserId',
            as: '_reporter',
          },
        },
        {
          $addFields: {
            reporterName: {
              $ifNull: [{ $arrayElemAt: ['$_reporter.fullName', 0] }, 'Anonymous'],
            },
            reporterImage: { $arrayElemAt: ['$_reporter.imageUrl', 0] },
          },
        },
        { $project: { _reporter: 0 } },
      ])
      .toArray();

    const sortedIssues = sortIssuesBySeverity(issues);
    res.json({ success: true, data: sortedIssues });
  } catch (err) {
    console.error('Error fetching issues:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- GET /api/issues/:id/comments  ----------
router.get('/:id/comments', async (req, res) => {
  try {
    const db = getDB();
    const comments = await db
      .collection('comments')
      .aggregate([
        { $match: { issueId: req.params.id } },
        { $sort: { createdAt: 1 } },
        {
          $lookup: {
            from: 'users',
            localField: 'clerkUserId',
            foreignField: 'clerkUserId',
            as: '_user',
          },
        },
        {
          $addFields: {
            userName: {
              $ifNull: [{ $arrayElemAt: ['$_user.fullName', 0] }, 'Anonymous'],
            },
            userImage: { $arrayElemAt: ['$_user.imageUrl', 0] },
          },
        },
        { $project: { _user: 0 } },
      ])
      .toArray();

    res.json({ success: true, data: comments });
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- POST /api/issues/:id/comments  ----------
// RATE LIMITED: 50 interactions per 15 minutes
router.post('/:id/comments', interactionLimiter, requireAuth(), async (req, res) => {
  try {
    const { userId: clerkUserId } = getAuth(req);
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text is required' });
    }

    const db = getDB();

    // Verify issue exists
    const issue = await db.collection('issues').findOne({ _id: new ObjectId(req.params.id) });
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    const comment = {
      issueId: req.params.id,
      clerkUserId,
      text: text.trim(),
      createdAt: new Date(),
    };

    const result = await db.collection('comments').insertOne(comment);

    // Fetch user info for the response
    const user = await db.collection('users').findOne({ clerkUserId });

    res.status(201).json({
      success: true,
      data: {
        _id: result.insertedId,
        ...comment,
        userName: user?.fullName || 'Anonymous',
        userImage: user?.imageUrl || null,
      },
    });
  } catch (err) {
    console.error('Error posting comment:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- PATCH /api/issues/:id/upvote  ----------
// Toggle upvote for the authenticated user
// RATE LIMITED: 50 interactions per 15 minutes
router.patch('/:id/upvote', interactionLimiter, requireAuth(), async (req, res) => {
  try {
    const { userId: clerkUserId } = getAuth(req);
    const db = getDB();
    const issueId = new ObjectId(req.params.id);

    const issue = await db.collection('issues').findOne({ _id: issueId });
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    const hasUpvoted = Array.isArray(issue.upvotes) && issue.upvotes.includes(clerkUserId);
    const update = hasUpvoted
      ? { $pull: { upvotes: clerkUserId } }
      : { $addToSet: { upvotes: clerkUserId } };

    await db.collection('issues').updateOne({ _id: issueId }, update);

    const updated = await db.collection('issues').findOne({ _id: issueId });

    res.json({
      success: true,
      data: {
        upvotes: updated.upvotes,
        upvoteCount: updated.upvotes.length,
        hasUpvoted: !hasUpvoted,
      },
    });
  } catch (err) {
    console.error('Error toggling upvote:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- GET /api/issues/:id  ----------
router.get('/:id', async (req, res) => {
  try {
    const db = getDB();
    const issue = await db.collection('issues').findOne({ _id: new ObjectId(req.params.id) });

    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    res.json({ success: true, data: issue });
  } catch (err) {
    console.error('Error fetching issue:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

const VERIFICATION_THRESHOLD = 3; // upvotes required to mark resolution verified

// ---------- PATCH /api/issues/:id/resolve  ----------
// Admin: resolve an issue with mandatory proof image upload
router.patch('/:id/resolve', requireAuth(), upload.single('verificationImage'), async (req, res) => {
  try {
    const { userId: clerkUserId } = getAuth(req);
    const db = getDB();

    const caller = await db.collection('users').findOne({ clerkUserId });
    if (!caller || caller.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Admin only' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Verification proof image is required to resolve an issue' });
    }

    const issueId = new ObjectId(req.params.id);
    const issue = await db.collection('issues').findOne({ _id: issueId });
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    const uploadResult = await uploadToCloudinary(req.file.buffer, 'micro-task-verifications');

    const updates = {
      status: 'resolved',
      verificationImageUrl: uploadResult.secure_url,
      verificationStatus: 'pending_verification',
      verificationUpvotes: [],
      updatedAt: new Date(),
    };

    const result = await db.collection('issues').findOneAndUpdate(
      { _id: issueId },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (result && result.reportedBy) {
      const pts = resolutionPoints(result.severityScore);
      await awardPoints(db, result.reportedBy, pts);
      console.log(`[POINTS] +${pts} awarded to ${result.reportedBy} for issue ${issueId}`);
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error resolving issue with proof:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- PATCH /api/issues/:id/verify-upvote  ----------
// Resident: upvote admin's resolution proof (one-way — no un-vote)
router.patch('/:id/verify-upvote', requireAuth(), async (req, res) => {
  try {
    const { userId: clerkUserId } = getAuth(req);
    const db = getDB();
    const issueId = new ObjectId(req.params.id);

    const issue = await db.collection('issues').findOne({ _id: issueId });
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }
    if (issue.status !== 'resolved') {
      return res.status(400).json({ success: false, message: 'Issue is not resolved yet' });
    }

    const existingUpvotes = Array.isArray(issue.verificationUpvotes) ? issue.verificationUpvotes : [];
    if (existingUpvotes.includes(clerkUserId)) {
      return res.status(400).json({ success: false, message: 'You have already verified this resolution' });
    }

    const newUpvotes = [...existingUpvotes, clerkUserId];
    const verificationStatus = newUpvotes.length >= VERIFICATION_THRESHOLD ? 'verified' : 'pending_verification';

    await db.collection('issues').updateOne(
      { _id: issueId },
      { $addToSet: { verificationUpvotes: clerkUserId }, $set: { verificationStatus, updatedAt: new Date() } }
    );

    res.json({
      success: true,
      data: {
        verificationUpvotes: newUpvotes,
        verificationUpvoteCount: newUpvotes.length,
        verificationStatus,
        hasVerified: true,
      },
    });
  } catch (err) {
    console.error('Error verify-upvoting:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- PATCH /api/issues/:id  ----------
// Admin: update issue fields (status, severity, department, etc.)
router.patch('/:id', requireAuth(), async (req, res) => {
  try {
    const { userId: clerkUserId } = getAuth(req);
    const db = getDB();

    // Verify the caller is an admin
    const caller = await db.collection('users').findOne({ clerkUserId });
    if (!caller || caller.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Admin only' });
    }

    const issueId = new ObjectId(req.params.id);
    const allowedFields = [
      'status', 'severityScore', 'impactScope', 'urgency', 'priorityScore', 'suggestedDepartment', 'estimatedResolution',
      'title', 'description', 'location', 'predictedIssueType',
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = ['severityScore', 'priorityScore'].includes(field)
          ? parseIntegerOrNull(req.body[field])
          : req.body[field];
      }
    }

    if (updates.severity !== undefined) {
      updates.severity = normalizeSeverity(updates.severity);
      updates.severityScore = scoreFromSeverity(updates.severity);
    } else if (updates.severityScore !== undefined) {
      updates.severity = severityFromScore(updates.severityScore);
      updates.severityScore = scoreFromSeverity(updates.severity);
    }

    if (updates.confidence !== undefined) {
      updates.confidence = parseConfidence(updates.confidence);
    }

    if (updates.department !== undefined && updates.suggestedDepartment === undefined) {
      updates.suggestedDepartment = updates.department;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    updates.updatedAt = new Date();

    const result = await db.collection('issues').findOneAndUpdate(
      { _id: issueId },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    // ── Award points to reporter when an issue is marked resolved ────────
    if (updates.status === 'resolved') {
      const before = await db.collection('issues').findOne({ _id: issueId });
      const wasAlreadyResolved = before?.status === 'resolved';
      if (!wasAlreadyResolved && result.reportedBy) {
        const pts = resolutionPoints(result.severityScore);
        await awardPoints(db, result.reportedBy, pts);
        console.log(`[POINTS] +${pts} awarded to ${result.reportedBy} for issue ${issueId}`);
      }
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error updating issue:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
