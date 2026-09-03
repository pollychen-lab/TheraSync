// TheraSync backend API
//
// Endpoints:
//   POST /api/triage       - crisis screening + therapist matching
//   POST /api/book/lock    - temporary slot lock (held while human approval is pending)
//   POST /api/book/commit  - persist a confirmed booking (requires explicit consent)
//   GET  /api/health       - readiness probe

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { pool } from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Compress every response. Under Docker Compose this was Nginx's job; in the
// deployed single-service image Express serves the React bundle itself, and
// without this the client downloads it uncompressed.
app.use(compression());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Temporary in-memory slot locks. A lock is held for LOCK_TTL_MS while the
// human-in-the-loop approval modal is open, so a slot can't be taken by a
// second request in the meantime.
const activeLocks = new Map();
const LOCK_TTL_MS = 10 * 60 * 1000;

const CRISIS_KEYWORDS = [
  'suicide', 'suicidal', 'kill myself', 'want to die', 'end my life',
  'self-harm', 'hurt myself', 'no reason to live', "can't go on",
];

const CRISIS_HOTLINES = [
  '988 Suicide & Crisis Lifeline (call or text 988)',
  'Emergency services: 911',
  'Crisis Text Line: text HOME to 741741',
];

function detectCrisis(text) {
  const normalized = (text || '').toLowerCase();
  return CRISIS_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

// 1. Triage and therapist matching
app.post('/api/triage', async (req, res) => {
  const { rawNarrative, preferredModality, focusAreas } = req.body || {};

  // Backend crisis screening acts as a second safety net in case the
  // frontend check is bypassed (e.g. a direct API call).
  if (detectCrisis(rawNarrative)) {
    return res.json({
      status: 'CRISIS_INTERCEPTED',
      crisisHotlines: CRISIS_HOTLINES,
    });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM therapists ORDER BY rating DESC');

    let matches = rows;
    if (preferredModality) {
      const needle = preferredModality.toLowerCase();
      matches = rows.filter((t) => t.modalities.some((m) => m.toLowerCase().includes(needle)));
    }
    if (Array.isArray(focusAreas) && focusAreas.length > 0) {
      const needles = focusAreas.map((f) => f.toLowerCase());
      const focused = matches.filter((t) =>
        t.specialties.some((s) => needles.some((n) => s.toLowerCase().includes(n)))
      );
      if (focused.length > 0) matches = focused;
    }

    res.json({
      status: 'SUCCESS',
      matches: matches.length > 0 ? matches : rows,
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// 2. Temporary slot lock
app.post('/api/book/lock', async (req, res) => {
  const { therapistId, slot } = req.body || {};
  if (!therapistId || !slot) {
    return res.status(400).json({ error: 'MISSING_FIELDS' });
  }
  const lockKey = `${therapistId}_${slot}`;

  try {
    const therapistResult = await pool.query('SELECT slots FROM therapists WHERE id = $1', [therapistId]);
    if (therapistResult.rowCount === 0) {
      return res.status(404).json({ error: 'THERAPIST_NOT_FOUND' });
    }
    if (!therapistResult.rows[0].slots.includes(slot)) {
      return res.status(400).json({
        error: 'INVALID_SLOT',
        message: 'This therapist does not offer the requested slot.',
      });
    }

    const existing = await pool.query(
      `SELECT 1 FROM bookings WHERE therapist_id = $1 AND slot = $2 AND status = 'CONFIRMED'`,
      [therapistId, slot]
    );

    if (activeLocks.has(lockKey) || existing.rowCount > 0) {
      return res.status(409).json({
        error: 'SLOT_UNAVAILABLE',
        message: 'This slot is already booked or currently being reserved by someone else.',
      });
    }

    const lockToken = crypto.randomUUID();
    const lockTimeout = setTimeout(() => activeLocks.delete(lockKey), LOCK_TTL_MS);
    activeLocks.set(lockKey, { lockTimeout, lockedAt: Date.now(), token: lockToken });

    res.json({ success: true, lockToken, expiresInSeconds: LOCK_TTL_MS / 1000 });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// 2b. Release a slot lock early (e.g. the human declined the approval modal).
// Requires the token handed back by /api/book/lock, so only the holder of a
// reservation can release it.
app.post('/api/book/release', (req, res) => {
  const { therapistId, slot, lockToken } = req.body || {};
  if (!therapistId || !slot || !lockToken) {
    return res.status(400).json({ error: 'MISSING_FIELDS' });
  }
  const lockKey = `${therapistId}_${slot}`;
  const lock = activeLocks.get(lockKey);
  if (lock && lock.token === lockToken) {
    clearTimeout(lock.lockTimeout);
    activeLocks.delete(lockKey);
  }
  res.json({ success: true });
});

// 3. Commit booking (only called after explicit human approval)
app.post('/api/book/commit', async (req, res) => {
  const { therapistId, slot, intakeSummary, userConsent, lockToken } = req.body || {};

  if (!userConsent) {
    return res.status(400).json({
      error: 'CONSENT_REQUIRED',
      message: 'Informed consent must be acknowledged before a booking can be confirmed.',
    });
  }
  if (!therapistId || !slot || !lockToken) {
    return res.status(400).json({ error: 'MISSING_FIELDS' });
  }

  const lockKey = `${therapistId}_${slot}`;
  const lock = activeLocks.get(lockKey);

  // Committing requires the exact token handed back by /api/book/lock, so a
  // caller who merely knows the therapist/slot can't bypass the two-phase
  // reservation and commit a slot someone else is mid-approval on.
  if (!lock || lock.token !== lockToken) {
    return res.status(409).json({
      error: 'LOCK_REQUIRED',
      message: 'No matching active reservation was found for this slot. Lock the slot again before committing.',
    });
  }

  try {
    const bookingId = `BK_${Date.now()}`;
    await pool.query(
      `INSERT INTO bookings (booking_id, therapist_id, slot, intake_summary, consent_acknowledged, status)
       VALUES ($1, $2, $3, $4, $5, 'CONFIRMED')`,
      [bookingId, therapistId, slot, intakeSummary || null, true]
    );

    clearTimeout(lock.lockTimeout);
    activeLocks.delete(lockKey);

    console.log(`[Notification Engine] Sending confirmation SMS and calendar invite for booking ${bookingId}...`);

    res.json({
      status: 'SUCCESS',
      booking: { bookingId, therapistId, slot, intakeSummary, status: 'CONFIRMED' },
    });
  } catch (err) {
    // The partial unique index on bookings(therapist_id, slot) guards
    // against a race that slips past the in-memory lock (e.g. a second
    // process, or the lock TTL expiring mid-commit).
    if (err.code === '23505') {
      return res.status(409).json({ error: 'SLOT_UNAVAILABLE', message: 'This slot was just booked by someone else.' });
    }
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// Unknown API paths must answer with JSON. Without this the SPA fallback below
// would hand back an HTML document, and a fetch() expecting JSON would fail on
// a confusing parse error rather than a clear 404.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND' });
});

// In the deployed single-service image the built React bundle is served by this
// same process, which keeps the SPA and the API on one origin: the frontend
// calls /api/* on relative paths, so no CORS negotiation and no proxy hop is
// involved. Under local Docker Compose the bundle is served by Nginx instead
// and this directory is absent, so the block is skipped.
const clientBuildPath =
  process.env.CLIENT_BUILD_PATH ||
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');

if (fs.existsSync(clientBuildPath)) {
  app.use(
    express.static(clientBuildPath, {
      setHeaders: (res, filePath) => {
        // Filenames under /static carry a content hash and change whenever the
        // bundle changes, so they can be cached indefinitely. index.html must
        // not be, or a returning client would keep loading a stale bundle.
        if (filePath.includes(`${path.sep}static${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );

  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
  console.log(`Serving client build from ${clientBuildPath}`);
}

app.listen(PORT, () => {
  console.log(`TheraSync backend API is running on http://localhost:${PORT}`);
});
