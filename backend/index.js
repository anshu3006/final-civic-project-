require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { clerkMiddleware } = require('@clerk/express');
const { connectDB, getDB } = require('./config/db');
const issueRoutes = require('./routes/issue.routes');
const userRoutes = require('./routes/user.routes');
const eventRoutes = require('./routes/event.routes');

const app = express();

// Middleware
app.use(cors({
  origin: [
    'https://micro-task-three.vercel.app',
    'http://localhost:3000',
  ],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ──────────────────────────────────────────────────────────────────────────────
// Rate Limiting - General API protection
// ──────────────────────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: Number(process.env.GENERAL_RATE_WINDOW_MS || 60_000),
  max:
    process.env.NODE_ENV === 'production'
      ? Number(process.env.GENERAL_RATE_MAX || 10)
      : Number(process.env.GENERAL_RATE_MAX_DEV || 100000),
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production',
});

// Apply general rate limiter to all API routes
app.use('/api/', generalLimiter);

// Clerk middleware — makes req.auth available on every request
// (does NOT enforce auth — individual routes use requireAuth())
app.use(clerkMiddleware());

// Lazy, cached DB connection — safe for serverless cold starts
let dbConnectionPromise = null;
app.use(async (req, res, next) => {
  if (!dbConnectionPromise) {
    dbConnectionPromise = connectDB().catch((err) => {
      dbConnectionPromise = null; // allow retry on next request
      throw err;
    });
  }
  try {
    await dbConnectionPromise;
    next();
  } catch (err) {
    console.error('MongoDB connection error:', err);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Server is running' });
});

app.use('/api/issues', issueRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);

app.get('/api/test-db', async (req, res) => {
  try {
    const db = getDB();
    await db.command({ ping: 1 });
    res.json({ success: true, message: 'MongoDB connection is healthy' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'MongoDB connection failed', error: err.message });
  }
});

// Local development: start a real HTTP server
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  connectDB()
    .then(() => {
      const server = app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
      // Extend timeouts so long-running webhook calls don't get dropped
      server.keepAliveTimeout = 120_000;
      server.headersTimeout  = 125_000;
    })
    .catch((err) => {
      console.error('Failed to connect to MongoDB:', err);
      process.exit(1);
    });
}

// Vercel serverless export
module.exports = app;
