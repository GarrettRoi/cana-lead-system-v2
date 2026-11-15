const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');
const { v4: uuidv4 } = require('uuid');
const { matchServicesToTradeTypes } = require('../db/sync');
const fetch = require('node-fetch');

const BASE_URL = process.env.BASE_URL || 'https://cana-lead-system-production.up.railway.app';
const QUO_API_KEY = process.env.QUO_API_KEY || process.env.QUO1 || '';
const QUO_FROM = process.env.QUO_FROM_NUMBER || '+14056731410';

// ============ AUTH ============
function requireAdmin(req, res, next) {
  const token = req.cookies?.admin_token;
  if (token === (process.env.ADMIN_PASSWORD)) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

router.post('/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === (process.env.ADMIN_PASSWORD)) {
    res.cookie('admin_token', password, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
    return res.json({ success: true });
  }
  return res.status(401).json({ error: 'Invalid password' });
});

router.post('/admin/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true });
});

// ============ LEADS ============
router.get('/leads', requireAdmin, (req, res) => {
  const db = getDb();
  const leads = db.prepare(`
    SELECT l.*,
      (SELECT COUNT(*) FROM lead_vendors lv WHERE lv.lead_id = l.id) as vendor_count,
      (SELECT COUNT(*) FROM lead_vendors lv WHERE lv.lead_id = l.id AND lv.contacted = 1) as contacted_count,
      (SELECT COUNT(*) FROM lead_vendors lv WHERE lv.lead_id = l.id AND lv.booked = 1) as booked_count
    FROM leads l ORDER BY l.created_at DESC
  `).all();
  res.json(leads);
});

router.get('/leads/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const vendors = db.prepare(`
    SELECT lv.*, v.first_name, v.last_name, v.email, v.phone,
      c.display_name as category_name
    FROM lead_vendors lv
    JOIN vendors v ON lv.vendor_id = v.id
    LEFT JOIN categories c ON lv.category_id = c.id
    WHERE lv.lead_id = ?
    ORDER BY lv.created_at
  `).all(req.params.id);

  res.json({ lead, vendors });
});

router.put('/leads/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const { status, stage, value, contacted, notes } = req.body;
  db.prepare(`
    UPDATE leads SET status = COALESCE(?, status), stage = COALESCE(?, stage),
    value = COALESCE(?, value), contacted = COALESCE(?, contacted),
    notes = COALESCE(?, notes), updated_at = datetime('now')
    WHERE id = ?
  `).run(status, stage, value, contacted, notes, req.params.id);
  res.json({ success: true });
});

// Create lead from n8n webhook
router.post('/leads', (req, res) => {
  const db = getDb();
  const { firstName, lastName, email, phone, weddingDate, services, venue, budget, guestCount, notes, value } = req.body;

  const clientName = `${firstName || ''} ${lastName || ''}`.trim();
  const categoriesNeeded = services || notes || '';

  const result = db.prepare(`
    INSERT INTO leads (client_name, first_name, last_name, client_email, client_phone,
      wedding_date, categories_needed, notes, venue, budget, guest_count, source, value)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'website', ?)
  `).run(clientName, firstName, lastName, email, phone, weddingDate, categoriesNeeded, notes || categoriesNeeded, venue, budget, guestCount, value || '750');

  const leadId = result.lastInsertRowid;

  // Auto-assign vendors
  const neededTradeTypes = matchServicesToTradeTypes(categoriesNeeded);
  const vendors = db.prepare(`
    SELECT v.id, v.token, v.first_name, v.last_name, v.email, v.phone, c.display_name as trade_type, c.id as category_id
    FROM vendors v
    JOIN vendor_categories vc ON v.id = vc.vendor_id
    JOIN categories c ON vc.category_id = c.id
    WHERE v.active = 1
  `).all();

  const assignedVendors = [];
  for (const tradeType of neededTradeTypes) {
    const matchedVendors = vendors.filter(v => v.trade_type === tradeType);
    for (const v of matchedVendors) {
      const pageToken = uuidv4();
      db.prepare(`
        INSERT OR IGNORE INTO lead_vendors (lead_id, vendor_id, vendor_token, page_token, category_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(leadId, v.id, v.token, pageToken, v.category_id);
      assignedVendors.push({
        ...v,
        page_token: pageToken,
        lead_url: `${BASE_URL}/lead/${pageToken}`,
      });
    }
  }

  res.json({
    success: true,
    leadId,
    assignedVendors,
    matchedTradeTypes: neededTradeTypes,
  });
});

// ============ VENDORS ============
router.get('/vendors', requireAdmin, (req, res) => {
  const db = getDb();
  const vendors = db.prepare(`
    SELECT v.*,
      GROUP_CONCAT(DISTINCT c.display_name) as trade_types,
      (SELECT COUNT(DISTINCT lv.lead_id) FROM lead_vendors lv WHERE lv.vendor_id = v.id) as lead_count,
      (SELECT COUNT(*) FROM lead_vendors lv WHERE lv.vendor_id = v.id AND lv.booked = 1) as booked_count,
      (SELECT AVG(r.rating) FROM ratings r WHERE r.vendor_id = v.id AND r.submitted = 1) as avg_rating
    FROM vendors v
    LEFT JOIN vendor_categories vc ON v.id = vc.vendor_id
    LEFT JOIN categories c ON vc.category_id = c.id
    GROUP BY v.id
    ORDER BY v.first_name
  `).all();
  res.json(vendors);
});

router.get('/vendors/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const vendor = db.prepare(`
    SELECT v.*,
      GROUP_CONCAT(DISTINCT c.display_name) as trade_types,
      (SELECT AVG(r.rating) FROM ratings r WHERE r.vendor_id = v.id AND r.submitted = 1) as avg_rating
    FROM vendors v
    LEFT JOIN vendor_categories vc ON v.id = vc.vendor_id
    LEFT JOIN categories c ON vc.category_id = c.id
    WHERE v.id = ?
    GROUP BY v.id
  `).get(req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

  const leads = db.prepare(`
    SELECT lv.*, l.client_name, l.wedding_date, l.categories_needed, l.status as lead_status,
      c.display_name as category_name
    FROM lead_vendors lv
    JOIN leads l ON lv.lead_id = l.id
    LEFT JOIN categories c ON lv.category_id = c.id
    WHERE lv.vendor_id = ?
    ORDER BY lv.created_at DESC
  `).all(req.params.id);

  const ratings = db.prepare(`
    SELECT r.*, l.client_name
    FROM ratings r
    JOIN leads l ON r.lead_id = l.id
    WHERE r.vendor_id = ? AND r.submitted = 1
    ORDER BY r.submitted_at DESC
  `).all(req.params.id);

  res.json({ vendor, leads, ratings });
});

// ============ CATEGORIES ============
router.get('/categories', requireAdmin, (req, res) => {
  const db = getDb();
  const categories = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM vendor_categories vc WHERE vc.category_id = c.id) as vendor_count,
      (SELECT COUNT(DISTINCT lv.lead_id) FROM lead_vendors lv WHERE lv.category_id = c.id) as lead_count
    FROM categories c ORDER BY c.display_name
  `).all();
  res.json(categories);
});

router.post('/categories', requireAdmin, (req, res) => {
  const db = getDb();
  const { name, display_name, description } = req.body;
  const catName = name || display_name.toLowerCase().replace(/\s+/g, '_');
  try {
    db.prepare('INSERT INTO categories (name, display_name, description) VALUES (?, ?, ?)').run(catName, display_name, description || '');
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/categories/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const { display_name, description, active } = req.body;
  db.prepare('UPDATE categories SET display_name = COALESCE(?, display_name), description = COALESCE(?, description), active = COALESCE(?, active) WHERE id = ?')
    .run(display_name, description, active, req.params.id);
  res.json({ success: true });
});

router.delete('/categories/:id', requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ============ LEAD PAGE (vendor view) ============
router.get('/lead-page/:pageToken', (req, res) => {
  const db = getDb();
  const lv = db.prepare(`
    SELECT lv.*, l.client_name, l.first_name, l.last_name, l.client_email, l.client_phone,
      l.wedding_date, l.venue, l.budget, l.guest_count, l.categories_needed, l.details,
      v.first_name as vendor_first, v.last_name as vendor_last,
      c.display_name as category_name
    FROM lead_vendors lv
    JOIN leads l ON lv.lead_id = l.id
    JOIN vendors v ON lv.vendor_id = v.id
    LEFT JOIN categories c ON lv.category_id = c.id
    WHERE lv.page_token = ?
  `).get(req.params.pageToken);

  if (!lv) return res.status(404).json({ error: 'Lead page not found' });

  // Track open
  db.prepare('UPDATE lead_vendors SET open_count = open_count + 1, first_opened_at = COALESCE(first_opened_at, datetime("now")) WHERE id = ?').run(lv.id);
  db.prepare('INSERT INTO lead_opens (lead_vendor_id, ip_address, user_agent) VALUES (?, ?, ?)').run(lv.id, req.ip, req.get('user-agent'));

  res.json(lv);
});

router.put('/lead-page/:pageToken/status', (req, res) => {
  const db = getDb();
  const { contacted, responded, booked, paid, didnt_respond } = req.body;
  const lv = db.prepare('SELECT * FROM lead_vendors WHERE page_token = ?').get(req.params.pageToken);
  if (!lv) return res.status(404).json({ error: 'Not found' });

  if (contacted !== undefined) {
    db.prepare('UPDATE lead_vendors SET contacted = ?, contacted_at = CASE WHEN ? = 1 THEN datetime("now") ELSE contacted_at END WHERE page_token = ?')
      .run(contacted, contacted, req.params.pageToken);
  }
  if (responded !== undefined) {
    db.prepare('UPDATE lead_vendors SET responded = ?, responded_at = CASE WHEN ? = 1 THEN datetime("now") ELSE responded_at END WHERE page_token = ?')
      .run(responded, responded, req.params.pageToken);
  }
  if (booked !== undefined) {
    db.prepare('UPDATE lead_vendors SET booked = ?, booked_at = CASE WHEN ? = 1 THEN datetime("now") ELSE booked_at END WHERE page_token = ?')
      .run(booked, booked, req.params.pageToken);
  }
  if (paid !== undefined) {
    db.prepare('UPDATE lead_vendors SET paid = ?, paid_at = CASE WHEN ? = 1 THEN datetime("now") ELSE paid_at END WHERE page_token = ?')
      .run(paid, paid, req.params.pageToken);
  }
  if (didnt_respond !== undefined) {
    db.prepare('UPDATE lead_vendors SET didnt_respond = ?, didnt_respond_at = CASE WHEN ? = 1 THEN datetime("now") ELSE didnt_respond_at END WHERE page_token = ?')
      .run(didnt_respond, didnt_respond, req.params.pageToken);
  }
  res.json({ success: true });
});

// ============ VENDOR DASHBOARD (via token) ============
router.get('/vendor-dashboard/:token', (req, res) => {
  const db = getDb();
  const vendor = db.prepare(`
    SELECT v.*, GROUP_CONCAT(DISTINCT c.display_name) as trade_types
    FROM vendors v
    LEFT JOIN vendor_categories vc ON v.id = vc.vendor_id
    LEFT JOIN categories c ON vc.category_id = c.id
    WHERE v.token = ?
    GROUP BY v.id
  `).get(req.params.token);

  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

  const leads = db.prepare(`
    SELECT lv.*, l.client_name, l.wedding_date, l.categories_needed, l.client_phone, l.client_email,
      c.display_name as category_name
    FROM lead_vendors lv
    JOIN leads l ON lv.lead_id = l.id
    LEFT JOIN categories c ON lv.category_id = c.id
    WHERE lv.vendor_id = ?
    ORDER BY l.wedding_date ASC
  `).all(vendor.id);

  const ratings = db.prepare(`
    SELECT r.*, l.client_name
    FROM ratings r
    JOIN leads l ON r.lead_id = l.id
    WHERE r.vendor_id = ? AND r.submitted = 1
  `).all(vendor.id);

  res.json({ vendor, leads, ratings });
});

// ============ CODE KEYWORD HANDLER ============
router.post('/code-keyword', (req, res) => {
  const db = getDb();
  const { from, text } = req.body;

  if (!from || !text) return res.status(400).json({ error: 'Missing from or text' });

  const normalizedText = text.trim().toUpperCase();
  if (normalizedText !== 'CODE') {
    return res.json({ matched: false, message: 'Not a CODE keyword' });
  }

  // Find vendor by phone
  const phone = from.replace(/\D/g, '');
  const vendor = db.prepare('SELECT * FROM vendors WHERE phone LIKE ?').get(`%${phone.slice(-10)}`);

  if (!vendor) {
    return res.json({ matched: true, vendorFound: false, message: 'No vendor found for this number' });
  }

  const dashboardUrl = `${BASE_URL}/vendor/${vendor.token}`;

  // Send SMS via Quo API
  sendSms(from, `Hey ${vendor.first_name}! Here's your Cana Collective vendor dashboard:\n${dashboardUrl}`)
    .then(() => {
      res.json({ matched: true, vendorFound: true, dashboardUrl, vendorName: `${vendor.first_name} ${vendor.last_name}` });
    })
    .catch(err => {
      console.error('SMS send error:', err.message);
      res.json({ matched: true, vendorFound: true, dashboardUrl, smsError: err.message });
    });
});

// ============ RATINGS ============
router.get('/ratings', requireAdmin, (req, res) => {
  const db = getDb();
  const ratings = db.prepare(`
    SELECT r.*, l.client_name, v.first_name as vendor_first, v.last_name as vendor_last,
      v.email as vendor_email
    FROM ratings r
    JOIN leads l ON r.lead_id = l.id
    JOIN vendors v ON r.vendor_id = v.id
    ORDER BY r.created_at DESC
  `).all();
  res.json(ratings);
});

router.get('/rate/:token', (req, res) => {
  const db = getDb();
  const rating = db.prepare(`
    SELECT r.*, l.client_name, v.first_name as vendor_first, v.last_name as vendor_last
    FROM ratings r
    JOIN leads l ON r.lead_id = l.id
    JOIN vendors v ON r.vendor_id = v.id
    WHERE r.token = ?
  `).get(req.params.token);
  if (!rating) return res.status(404).json({ error: 'Rating not found' });
  res.json(rating);
});

router.post('/rate/:token', (req, res) => {
  const db = getDb();
  const { rating, comment } = req.body;
  db.prepare('UPDATE ratings SET rating = ?, comment = ?, submitted = 1, submitted_at = datetime("now") WHERE token = ?')
    .run(rating, comment || '', req.params.token);
  res.json({ success: true });
});

// ============ STATS ============
router.get('/stats', requireAdmin, (req, res) => {
  const db = getDb();
  const totalLeads = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
  const newLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'new'").get().count;
  const totalVendors = db.prepare('SELECT COUNT(*) as count FROM vendors WHERE active = 1').get().count;
  const totalAssignments = db.prepare('SELECT COUNT(*) as count FROM lead_vendors').get().count;
  const bookedCount = db.prepare('SELECT COUNT(*) as count FROM lead_vendors WHERE booked = 1').get().count;
  const paidCount = db.prepare('SELECT COUNT(*) as count FROM lead_vendors WHERE paid = 1').get().count;
  const avgRating = db.prepare('SELECT AVG(rating) as avg FROM ratings WHERE submitted = 1').get().avg;
  const upcomingWeddings = db.prepare("SELECT COUNT(*) as count FROM leads WHERE wedding_date >= date('now')").get().count;

  res.json({
    totalLeads, newLeads, totalVendors, totalAssignments,
    bookedCount, paidCount,
    avgRating: avgRating ? parseFloat(avgRating.toFixed(1)) : null,
    upcomingWeddings,
  });
});

// ============ SMS HELPER ============
async function sendSms(to, content) {
  if (!QUO_API_KEY) {
    console.log(`[SMS MOCK] To: ${to}, Content: ${content}`);
    return { mock: true };
  }
  const resp = await fetch('https://api.openphone.com/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': QUO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content,
      from: QUO_FROM,
      to: [to],
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Quo API error: ${resp.status} ${err}`);
  }
  return resp.json();
}

module.exports = router;
