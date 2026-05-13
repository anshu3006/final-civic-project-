const rateLimit = require('express-rate-limit');

const isProd = process.env.NODE_ENV === 'production';

function limiterMax(prodEnvKey, prodDefault, devEnvKey, devDefault = 100000) {
  return Number(process.env[isProd ? prodEnvKey : devEnvKey] || (isProd ? prodDefault : devDefault));
}

function limiterWindow(envKey, defaultMs) {
  return Number(process.env[envKey] || defaultMs);
}

// Strict rate limit for AI preview endpoint - 10 requests per 15 minutes
// (This endpoint calls expensive n8n webhook + AI analysis)
const aiPreviewLimiter = rateLimit({
  windowMs: limiterWindow('AI_PREVIEW_RATE_WINDOW_MS', 15 * 60 * 1000),
  max: limiterMax('AI_PREVIEW_RATE_MAX', 10, 'AI_PREVIEW_RATE_MAX_DEV'),
  message: {
    success: false,
    message: 'AI analysis rate limit exceeded. Please wait before analyzing more issues.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production',
});

// Rate limit for creating issues - 20 per 15 minutes
const createIssueLimiter = rateLimit({
  windowMs: limiterWindow('CREATE_ISSUE_RATE_WINDOW_MS', 15 * 60 * 1000),
  max: limiterMax('CREATE_ISSUE_RATE_MAX', 20, 'CREATE_ISSUE_RATE_MAX_DEV'),
  message: {
    success: false,
    message: 'Too many issues created. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production',
});

// Rate limit for comments/upvotes - 100 per 15 minutes
const interactionLimiter = rateLimit({
  windowMs: limiterWindow('INTERACTION_RATE_WINDOW_MS', 15 * 60 * 1000),
  max: limiterMax('INTERACTION_RATE_MAX', 100, 'INTERACTION_RATE_MAX_DEV'),
  message: {
    success: false,
    message: 'Too many interactions. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production',
});

module.exports = {
  aiPreviewLimiter,
  createIssueLimiter,
  interactionLimiter,
};
