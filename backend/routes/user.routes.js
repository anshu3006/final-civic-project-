const express = require('express');
const { requireAuth, getAuth } = require('../middleware/auth');
const { clerkClient } = require('@clerk/express');
const { getDB } = require('../config/db');

const router = express.Router();

// ---------- POST /api/users/sync ----------
// Called from the frontend after a successful Clerk login.
// Upserts a user document in MongoDB linked to the Clerk user.
router.post('/sync', requireAuth(), async (req, res) => {
  try {
    const { userId: clerkUserId } = getAuth(req);
    if (!clerkUserId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Fetch full user profile from Clerk
    const clerkUser = await clerkClient.users.getUser(clerkUserId);

    const email =
      clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId
      )?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress || null;

    const fullName =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
      email ||
      'Unknown';

    const db = getDB();

    // Upsert: create if not exists, update profile fields if it does
    const result = await db.collection('users').updateOne(
      { clerkUserId },
      {
        $set: {
          email,
          fullName,
          imageUrl: clerkUser.imageUrl || null,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          clerkUserId,
          role: 'resident',
          points: 0,
          designation: 'Newcomer',
          isActive: true,
          phone: null,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    // Backfill points/designation for users created before the rewards system
    await db.collection('users').updateOne(
      { clerkUserId, points: { $exists: false } },
      { $set: { points: 0, designation: 'Newcomer' } }
    );

    // Fetch the upserted / updated document
    const user = await db.collection('users').findOne({ clerkUserId });

    res.json({
      success: true,
      message: result.upsertedCount ? 'User created' : 'User synced',
      data: user,
    });
  } catch (err) {
    console.error('Error syncing user:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- GET /api/users/me ----------
// Returns the current user's MongoDB document
router.get('/me', requireAuth(), async (req, res) => {
  try {
    const { userId: clerkUserId } = getAuth(req);
    if (!clerkUserId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const db = getDB();
    const user = await db.collection('users').findOne({ clerkUserId });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
