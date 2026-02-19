const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = process.env.DB_PATH || './db/cana-leads.db';

let db;

function getDb() {
  if (!db) {
    db = new Database(path.resolve(DB_PATH));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables();
  }
  return db;
}

function initTables() {
  db.exec(`
    -- Categories table (admin-managed)
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      description TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Vendors table
    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      phone TEXT,
      token TEXT UNIQUE NOT NULL,
      n8n_trade_ids TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Vendor-Category junction (which categories a vendor serves)
    CREATE TABLE IF NOT EXISTS vendor_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (vendor_id) REFERENCES vendors(id),
      FOREIGN KEY (category_id) REFERENCES categories(id),
      UNIQUE(vendor_id, category_id)
    );

    -- Leads table
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      client_email TEXT,
      client_phone TEXT,
      wedding_date TEXT,
      venue TEXT,
      budget TEXT,
      guest_count INTEGER,
      categories_needed TEXT,
      details TEXT,
      notes TEXT,
      source TEXT DEFAULT 'website',
      status TEXT DEFAULT 'new',
      stage TEXT DEFAULT 'LEAD',
      value TEXT,
      contacted INTEGER DEFAULT 0,
      n8n_lead_id INTEGER,
      business TEXT DEFAULT 'Cana Collective',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Lead-Vendor assignments
    CREATE TABLE IF NOT EXISTS lead_vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      vendor_id INTEGER NOT NULL,
      vendor_token TEXT NOT NULL,
      page_token TEXT UNIQUE NOT NULL,
      category_id INTEGER,
      notified_at TEXT,
      first_opened_at TEXT,
      open_count INTEGER DEFAULT 0,
      contacted INTEGER DEFAULT 0,
      contacted_at TEXT,
      responded INTEGER DEFAULT 0,
      responded_at TEXT,
      booked INTEGER DEFAULT 0,
      booked_at TEXT,
      paid INTEGER DEFAULT 0,
      paid_at TEXT,
      didnt_respond INTEGER DEFAULT 0,
      didnt_respond_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES leads(id),
      FOREIGN KEY (vendor_id) REFERENCES vendors(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    -- Lead open tracking
    CREATE TABLE IF NOT EXISTS lead_opens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_vendor_id INTEGER NOT NULL,
      opened_at TEXT DEFAULT (datetime('now')),
      ip_address TEXT,
      user_agent TEXT,
      FOREIGN KEY (lead_vendor_id) REFERENCES lead_vendors(id)
    );

    -- Ratings
    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      vendor_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      rating INTEGER,
      comment TEXT,
      submitted INTEGER DEFAULT 0,
      submitted_at TEXT,
      sent_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES leads(id),
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    );

    -- Review redirect tracking (Vows & Vinyl)
    CREATE TABLE IF NOT EXISTS review_clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      client_name TEXT,
      bride_phone TEXT,
      groom_phone TEXT,
      email TEXT,
      event_date TEXT,
      clicked INTEGER DEFAULT 0,
      clicked_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_lead_vendors_lead ON lead_vendors(lead_id);
    CREATE INDEX IF NOT EXISTS idx_lead_vendors_vendor ON lead_vendors(vendor_id);
    CREATE INDEX IF NOT EXISTS idx_lead_vendors_page_token ON lead_vendors(page_token);
    CREATE INDEX IF NOT EXISTS idx_vendors_token ON vendors(token);
    CREATE INDEX IF NOT EXISTS idx_ratings_token ON ratings(token);
    CREATE INDEX IF NOT EXISTS idx_vendor_categories ON vendor_categories(vendor_id, category_id);
    CREATE INDEX IF NOT EXISTS idx_review_clicks_token ON review_clicks(token);
  `);

  // Seed default categories from known Trade_Types
  seedCategories();
}

function seedCategories() {
  const count = db.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (count.count === 0) {
    const categories = [
      { name: 'dj', display: 'DJ' },
      { name: 'videography', display: 'Videography' },
      { name: 'photography', display: 'Photography' },
      { name: 'catering', display: 'Catering' },
      { name: 'bartender', display: 'Bartender' },
      { name: 'florist', display: 'Florist' },
      { name: 'cake', display: 'Cake' },
      { name: 'stationery', display: 'Stationery' },
      { name: 'rentals', display: 'Rentals' },
      { name: 'photobooth', display: 'Photobooth' },
      { name: 'jazz', display: 'Jazz' },
      { name: 'mass_cantor', display: 'Mass Cantor' },
      { name: 'live_art_painting', display: 'Live Art Painting' },
      { name: 'prayer_cards', display: 'Prayer Cards' },
      { name: 'marquee_letters', display: 'Marquee Letters' },
      { name: 'backdrops', display: 'Backdrops' },
      { name: 'travel', display: 'Travel' },
      { name: 'planner', display: 'Wedding Planner' },
      { name: 'coordinator', display: 'Day-of Coordinator' },
      { name: 'lighting', display: 'Event Lighting' },
    ];

    const insert = db.prepare('INSERT OR IGNORE INTO categories (name, display_name) VALUES (?, ?)');
    for (const c of categories) {
      insert.run(c.name, c.display);
    }
    console.log(`Seeded ${categories.length} categories`);
  }
}

module.exports = { getDb };
