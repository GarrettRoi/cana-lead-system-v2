const express = require('express');
const { getDb } = require('../db/init');
const { v4: uuidv4 } = require('uuid');

// Google review URL for Vows & Vinyl
const GOOGLE_REVIEW_URL = 'https://www.google.com/search?safe=active&sca_esv=5dca0e6f8aa8611e&sxsrf=ANbL-n6my7YtPCZdE32qsB_P-SV8DNtLVg:1771524851533&q=vowsok+reviews&uds=ALYpb_nyMl5r6GKVFvWMby4eauK54ae3eYCbBxRKHcoevffzgWas53yAcdJraS66wJMZT6phcR4O8DSr4_oNJ_YmUCM2JWh57RZwWKlpeCqJPOsZ2sjH3mbc37GfDdqN16AcScOELQo_76HKUrzUc3YM7vuuIz2nC2w4F3ODtCdqGwTCqUFKl2kj-WEmC0DC1FFMwGzx0N__2gtqOi7c0uSf9h4ql5Q1C8wZtQ1tpdDcYIMZyjojC-v_JBOqRCxrV6nIe4D760L8ZOoaTBkThGJkJ8DuAM3QQMgE8X9VbPD66GET15z02_vbF3_vufzqWG4Uyyobv5aReb4rTvGXSQHa-KQSEKVDHXlOeTJTJxeGvHNySkZrcaEeDdESRkoI5md3OzbE_3ieVG-VbQzQRldE4_GoVMtoEA&si=AL3DRZEsmMGCryMMFSHJ3StBhOdZ2-6yYkXd_doETEE1OR-qObg2b288hnFiMgHXQC2ATxXHW9Atb6YnyG1F_IW2qEzONsFtv97sN-Jy9Bj8dOScNh8xyjszUK4__E0e_kktY_xVOf9V&sa=X&ictx=1&biw=390&bih=797&dpr=3&safe=active&sei=Vl6XaYXEG4y4mtkP9I7r0Qo&dlnr=1';

// ============================================================
// REDIRECT ROUTER - mounted at /review
// ============================================================
const redirectRouter = express.Router();

// GET /review/:token - Log click and redirect to Google review page
redirectRouter.get('/:token', (req, res) => {
  const db = getDb();
  const { token } = req.params;

  try {
    const record = db.prepare('SELECT * FROM review_clicks WHERE token = ?').get(token);

    if (!record) {
      console.log(`[Review Redirect] Unknown token: ${token} - redirecting anyway`);
      return res.redirect(302, GOOGLE_REVIEW_URL);
    }

    // Log the click
    if (!record.clicked) {
      db.prepare(`UPDATE review_clicks SET clicked = 1, clicked_at = datetime('now') WHERE token = ?`).run(token);
      console.log(`[Review Redirect] First click logged for ${record.client_name} (token: ${token})`);
    } else {
      console.log(`[Review Redirect] Repeat click for ${record.client_name} (token: ${token})`);
    }

    // Immediately redirect to Google review page
    res.redirect(302, GOOGLE_REVIEW_URL);
  } catch (err) {
    console.error(`[Review Redirect] Error for token ${token}:`, err.message);
    // On error, still redirect - never break the client experience
    res.redirect(302, GOOGLE_REVIEW_URL);
  }
});

// ============================================================
// API ROUTER - mounted at /api/review
// ============================================================
const apiRouter = express.Router();

// POST /api/review/create - Create a new review tracking token
apiRouter.post('/create', (req, res) => {
  const db = getDb();
  const { clientName, bridePhone, groomPhone, email, eventDate } = req.body;

  try {
    const token = uuidv4();
    db.prepare(`
      INSERT INTO review_clicks (token, client_name, bride_phone, groom_phone, email, event_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(token, clientName || '', bridePhone || '', groomPhone || '', email || '', eventDate || '');

    const BASE_URL = process.env.BASE_URL || 'https://cana-lead-system-production.up.railway.app';
    const reviewUrl = `${BASE_URL}/review/${token}`;

    res.json({
      success: true,
      token,
      reviewUrl,
    });
  } catch (err) {
    console.error('[Review Create] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/review/all - List all review tracking records
apiRouter.get('/all', (req, res) => {
  const db = getDb();

  try {
    const records = db.prepare(`
      SELECT token, client_name, bride_phone, groom_phone, email, event_date, clicked, clicked_at, created_at
      FROM review_clicks
      ORDER BY created_at DESC
    `).all();

    res.json({
      total: records.length,
      clicked: records.filter(r => r.clicked === 1).length,
      records,
    });
  } catch (err) {
    console.error('[Review List] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/review/:token/status - Check if a review link was clicked
apiRouter.get('/:token/status', (req, res) => {
  const db = getDb();
  const { token } = req.params;

  try {
    const record = db.prepare('SELECT token, client_name, clicked, clicked_at, created_at FROM review_clicks WHERE token = ?').get(token);

    if (!record) {
      return res.status(404).json({ error: 'Token not found', clicked: false });
    }

    res.json({
      token: record.token,
      clientName: record.client_name,
      clicked: record.clicked === 1,
      clickedAt: record.clicked_at,
      createdAt: record.created_at,
    });
  } catch (err) {
    console.error('[Review Status] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = { redirectRouter, apiRouter };
