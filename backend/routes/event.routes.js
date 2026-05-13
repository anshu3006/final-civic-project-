const express = require('express');
const { ObjectId } = require('mongodb');
const { requireAuth, getAuth } = require('../middleware/auth');
const { getDB } = require('../config/db');
const { awardPoints } = require('../utils/points');

const router = express.Router();

// Point values
const PTS_ORGANISE    = 80;
const PTS_PARTICIPATE = 20;
const PTS_INTERESTED  = 10;

// ---------- GET /api/events ----------
// Public: list all events newest-first, with organiser info joined
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const events = await db
      .collection('events')
      .aggregate([
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: 'users',
            localField: 'organiser',
            foreignField: 'clerkUserId',
            as: '_org',
          },
        },
        {
          $addFields: {
            organiserName:  { $ifNull: [{ $arrayElemAt: ['$_org.fullName',  0] }, 'Anonymous'] },
            organiserImage: { $ifNull: [{ $arrayElemAt: ['$_org.imageUrl', 0] }, null] },
          },
        },
        { $unset: '_org' },
      ])
      .toArray();

    res.json({ success: true, data: events });
  } catch (err) {
    console.error('[EVENTS] GET error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- POST /api/events ----------
// Authenticated: create a new event and award organiser points
router.post('/', requireAuth(), async (req, res) => {
  try {
    const { userId: clerkUserId } = getAuth(req);
    const { title, description, location, date, time, tag } = req.body;

    if (!title || !date) {
      return res.status(400).json({ success: false, message: 'Title and date are required.' });
    }

    const db = getDB();
    const event = {
      title:              title.trim(),
      description:        description?.trim() || '',
      location:           location?.trim() || '',
      date:               date.trim(),
      time:               time?.trim() || '',
      tag:                tag?.trim() || 'General',
      organiser:          clerkUserId,
      interestedUsers:    [],
      participatingUsers: [],
      createdAt:          new Date(),
    };

    const result = await db.collection('events').insertOne(event);

    // Award organiser points
    await awardPoints(db, clerkUserId, PTS_ORGANISE);
    console.log(`[EVENTS] +${PTS_ORGANISE} pts awarded to organiser ${clerkUserId}`);

    res.status(201).json({ success: true, data: { _id: result.insertedId, ...event } });
  } catch (err) {
    console.error('[EVENTS] POST error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- PATCH /api/events/:id/interested ----------
// Toggle "Interested" for the authenticated user
router.patch('/:id/interested', requireAuth(), async (req, res) => {
  try {
    const { userId: clerkUserId } = getAuth(req);
    const db = getDB();
    const eventId = new ObjectId(req.params.id);

    const event = await db.collection('events').findOne({ _id: eventId });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const isInterested = (event.interestedUsers || []).includes(clerkUserId);

    const update = isInterested
      ? { $pull:  { interestedUsers: clerkUserId } }
      : { $addToSet: { interestedUsers: clerkUserId } };

    await db.collection('events').updateOne({ _id: eventId }, update);

    // Award / revoke points
    await awardPoints(db, clerkUserId, isInterested ? -PTS_INTERESTED : PTS_INTERESTED);

    const updated = await db.collection('events').findOne({ _id: eventId });
    res.json({
      success: true,
      data: {
        interestedUsers:    updated.interestedUsers,
        participatingUsers: updated.participatingUsers,
        isInterested:       !isInterested,
        pointsDelta:        isInterested ? -PTS_INTERESTED : PTS_INTERESTED,
      },
    });
  } catch (err) {
    console.error('[EVENTS] PATCH interested error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- PATCH /api/events/:id/participating ----------
// Toggle "Participating" for the authenticated user
router.patch('/:id/participating', requireAuth(), async (req, res) => {
  try {
    const { userId: clerkUserId } = getAuth(req);
    const db = getDB();
    const eventId = new ObjectId(req.params.id);

    const event = await db.collection('events').findOne({ _id: eventId });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const isParticipating = (event.participatingUsers || []).includes(clerkUserId);

    const update = isParticipating
      ? { $pull:  { participatingUsers: clerkUserId } }
      : { $addToSet: { participatingUsers: clerkUserId } };

    await db.collection('events').updateOne({ _id: eventId }, update);

    await awardPoints(db, clerkUserId, isParticipating ? -PTS_PARTICIPATE : PTS_PARTICIPATE);

    const updated = await db.collection('events').findOne({ _id: eventId });
    res.json({
      success: true,
      data: {
        interestedUsers:    updated.interestedUsers,
        participatingUsers: updated.participatingUsers,
        isParticipating:    !isParticipating,
        pointsDelta:        isParticipating ? -PTS_PARTICIPATE : PTS_PARTICIPATE,
      },
    });
  } catch (err) {
    console.error('[EVENTS] PATCH participating error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
