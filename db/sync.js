const { getDb } = require('./init');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

const N8N_URL = process.env.N8N_URL || 'https://primary-production-38b8.up.railway.app';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

// Service mapping: website form text -> Trade_Type values
const SERVICE_TO_TRADE_MAP = {
  'wedding dj and event lighting': ['DJ'],
  'wedding dj': ['DJ'],
  'dj': ['DJ'],
  'event lighting': ['DJ'],
  'bartender': ['Bartender'],
  'photographer': ['Photography'],
  'photography': ['Photography'],
  'videographer': ['Videography'],
  'videography': ['Videography'],
  'stationery and invitations': ['Stationery'],
  'stationery': ['Stationery'],
  'invitations': ['Stationery'],
  'florist and table decorations': ['Florist'],
  'florist': ['Florist'],
  'table decorations': ['Florist'],
  'wedding planner/day of coordination': ['Travel'],
  'wedding planner': ['Travel'],
  'day of coordination': ['Travel'],
  'catering and charcuterie': ['Catering'],
  'catering and and charcuterie': ['Catering'],
  'catering': ['Catering'],
  'charcuterie': ['Catering'],
  'wedding cakes and baked goods': ['Cake'],
  'cake': ['Cake'],
  'baked goods': ['Cake'],
  'live art painting': ['Live Art Painting'],
  'live art': ['Live Art Painting'],
  'photobooth': ['Photobooth'],
  'photo booth': ['Photobooth'],
  'jazz': ['Jazz'],
  'jazz band': ['Jazz'],
  'mass cantor': ['Mass Cantor'],
  'wedding mass cantor': ['Mass Cantor'],
  'prayer cards': ['Prayer Cards'],
  'marquee letters': ['Marquee Letters'],
  'backdrops': ['Backdrops'],
  'chair and table rentals': ['Rentals'],
  'rentals': ['Rentals'],
  'travel': ['Travel'],
};

function matchServicesToTradeTypes(servicesText) {
  if (!servicesText) return [];
  const services = servicesText.split(',').map(s => s.trim().toLowerCase());
  const matched = new Set();
  for (const svc of services) {
    if (SERVICE_TO_TRADE_MAP[svc]) {
      SERVICE_TO_TRADE_MAP[svc].forEach(t => matched.add(t));
    } else {
      // Fuzzy match
      for (const [key, types] of Object.entries(SERVICE_TO_TRADE_MAP)) {
        if (svc.includes(key) || key.includes(svc)) {
          types.forEach(t => matched.add(t));
        }
      }
    }
  }
  return Array.from(matched);
}

async function fetchN8nTableData(tableId) {
  try {
    // Create a temp workflow to read data, or use existing webhook
    // For now, we'll use the n8n webhook approach
    const webhookPath = tableId === (process.env.TRADES_TABLE_ID || '9e2xKbaOVQiRVao1')
      ? 'cana-read-trades'
      : 'cana-read-leads';

    const resp = await fetch(`${N8N_URL}/webhook/${webhookPath}`, {
      method: 'GET',
      timeout: 15000,
    });

    if (!resp.ok) {
      console.log(`n8n webhook ${webhookPath} returned ${resp.status}, skipping`);
      return null;
    }

    const data = await resp.json();
    // Response could be array with {data: [...]} or direct array
    if (Array.isArray(data) && data.length > 0 && data[0].data) {
      return data[0].data;
    }
    if (Array.isArray(data)) return data;
    if (data && data.data) return data.data;
    return [data];
  } catch (err) {
    console.log(`n8n fetch error for ${tableId}: ${err.message}`);
    return null;
  }
}

async function syncFromN8n() {
  const db = getDb();
  console.log('Starting n8n sync...');

  // 1. Sync Trades List -> vendors + vendor_categories
  const trades = await fetchN8nTableData(process.env.TRADES_TABLE_ID || '9e2xKbaOVQiRVao1');
  if (trades && trades.length > 0) {
    console.log(`Syncing ${trades.length} trade entries...`);
    syncTrades(db, trades);
  } else {
    console.log('No trades data from n8n, using hardcoded fallback');
    syncTradesFromFallback(db);
  }

  // 2. Sync Leads -> leads table
  const leads = await fetchN8nTableData(process.env.LEADS_TABLE_ID || 'NypivyIriTTZeVAJ');
  if (leads && leads.length > 0) {
    const canaLeads = leads.filter(l => l.Business && l.Business.includes('Cana'));
    console.log(`Syncing ${canaLeads.length} Cana leads...`);
    syncLeads(db, canaLeads);
  } else {
    console.log('No leads data from n8n, using hardcoded fallback');
    syncLeadsFromFallback(db);
  }
}

function syncTrades(db, trades) {
  // Group by vendor (by email or phone)
  const vendorMap = {};
  for (const t of trades) {
    const key = t.Email || t.Phone_Number || `${t.First_Name}_${t.Last_Name}`;
    if (!key || key === 'null_null') continue;
    if (!vendorMap[key]) {
      vendorMap[key] = {
        first_name: t.First_Name,
        last_name: t.Last_Name,
        email: t.Email,
        phone: t.Phone_Number ? String(t.Phone_Number) : null,
        trade_types: [],
        n8n_ids: [],
      };
    }
    vendorMap[key].trade_types.push(t.Trade_Type);
    vendorMap[key].n8n_ids.push(t.id);
  }

  const insertVendor = db.prepare(`
    INSERT OR IGNORE INTO vendors (first_name, last_name, email, phone, token, n8n_trade_ids)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const getVendor = db.prepare('SELECT id FROM vendors WHERE email = ? OR phone = ?');
  const insertVC = db.prepare('INSERT OR IGNORE INTO vendor_categories (vendor_id, category_id) VALUES (?, ?)');
  const getCat = db.prepare('SELECT id FROM categories WHERE LOWER(display_name) = LOWER(?)');
  const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name, display_name) VALUES (?, ?)');

  for (const [key, v] of Object.entries(vendorMap)) {
    const token = uuidv4();
    insertVendor.run(v.first_name, v.last_name, v.email, v.phone, token, JSON.stringify(v.n8n_ids));

    const vendor = getVendor.get(v.email || 'NONE', v.phone || 'NONE');
    if (!vendor) continue;

    for (const tradeType of v.trade_types) {
      let cat = getCat.get(tradeType);
      if (!cat) {
        const catName = tradeType.toLowerCase().replace(/\s+/g, '_');
        insertCat.run(catName, tradeType);
        cat = getCat.get(tradeType);
      }
      if (cat) {
        insertVC.run(vendor.id, cat.id);
      }
    }
  }
  console.log(`Synced ${Object.keys(vendorMap).length} vendors from trades`);
}

function syncLeads(db, leads) {
  const insertLead = db.prepare(`
    INSERT OR IGNORE INTO leads (
      client_name, first_name, last_name, client_email, client_phone,
      wedding_date, categories_needed, notes, source, status, stage,
      value, contacted, n8n_lead_id, business, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Check for existing leads by name+email
  const checkExisting = db.prepare('SELECT id FROM leads WHERE first_name = ? AND last_name = ?');

  for (const l of leads) {
    const existing = checkExisting.get(l.FirstName, l.LastName);
    if (existing) continue;

    const weddingDate = l.WeddingDate ? l.WeddingDate.split('T')[0] : null;
    const phone = l.CellPhone ? String(l.CellPhone) : null;

    insertLead.run(
      `${l.FirstName} ${l.LastName}`,
      l.FirstName,
      l.LastName,
      l.PersonalEmail,
      phone,
      weddingDate,
      l.Notes || '',
      l.Notes || '',
      'n8n_import',
      l.Contacted ? 'contacted' : 'new',
      l.Stage || 'LEAD',
      l.Value || '',
      l.Contacted || 0,
      l.id || null,
      l.Business || 'Cana Collective',
      new Date().toISOString()
    );
  }

  // Auto-assign vendors to imported leads
  autoAssignVendors(db);
}

function autoAssignVendors(db) {
  const leads = db.prepare("SELECT * FROM leads WHERE categories_needed IS NOT NULL AND categories_needed != ''").all();
  const vendors = db.prepare(`
    SELECT v.*, GROUP_CONCAT(c.display_name) as trade_types
    FROM vendors v
    JOIN vendor_categories vc ON v.id = vc.vendor_id
    JOIN categories c ON vc.category_id = c.id
    GROUP BY v.id
  `).all();

  const insertLV = db.prepare(`
    INSERT OR IGNORE INTO lead_vendors (lead_id, vendor_id, vendor_token, page_token, category_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  const getVendorToken = db.prepare('SELECT token FROM vendors WHERE id = ?');
  const getCatByDisplay = db.prepare('SELECT id FROM categories WHERE LOWER(display_name) = LOWER(?)');
  const existingLV = db.prepare('SELECT id FROM lead_vendors WHERE lead_id = ? AND vendor_id = ?');

  for (const lead of leads) {
    const neededTradeTypes = matchServicesToTradeTypes(lead.categories_needed);
    for (const tradeType of neededTradeTypes) {
      for (const vendor of vendors) {
        const vendorTypes = vendor.trade_types ? vendor.trade_types.split(',') : [];
        if (vendorTypes.includes(tradeType)) {
          const existing = existingLV.get(lead.id, vendor.id);
          if (!existing) {
            const vToken = getVendorToken.get(vendor.id);
            const cat = getCatByDisplay.get(tradeType);
            insertLV.run(lead.id, vendor.id, vToken?.token || '', uuidv4(), cat?.id || null);
          }
        }
      }
    }
  }
}

// Hardcoded fallback data
function syncTradesFromFallback(db) {
  const trades = [
    { First_Name: 'Leigha', Last_Name: 'Liuzza', Email: 'sanctusmm@gmail.com', Phone_Number: '15042027886', Trade_Type: 'Stationery', id: 1 },
    { First_Name: 'Leigha', Last_Name: 'Liuzza', Email: 'sanctusmm@gmail.com', Phone_Number: '15042027886', Trade_Type: 'Prayer Cards', id: 4 },
    { First_Name: 'Leigha', Last_Name: 'Liuzza', Email: 'sanctusmm@gmail.com', Phone_Number: '15042027886', Trade_Type: 'Live Art Painting', id: 5 },
    { First_Name: 'Garrett', Last_Name: 'Finnell', Email: 'garrett@vowsok.com', Phone_Number: '14052550459', Trade_Type: 'DJ', id: 2 },
    { First_Name: 'Garrett', Last_Name: 'Finnell', Email: 'garrett@vowsok.com', Phone_Number: '14052550459', Trade_Type: 'Photobooth', id: 7 },
    { First_Name: 'Garrett', Last_Name: 'Finnell', Email: 'garrett@vowsok.com', Phone_Number: '14052550459', Trade_Type: 'Rentals', id: 11 },
    { First_Name: 'Garrett', Last_Name: 'Finnell', Email: 'garrett@vowsok.com', Phone_Number: '14052550459', Trade_Type: 'Marquee Letters', id: 12 },
    { First_Name: 'Garrett', Last_Name: 'Finnell', Email: 'garrett@vowsok.com', Phone_Number: '14052550459', Trade_Type: 'Backdrops', id: 13 },
    { First_Name: 'Chris', Last_Name: 'Livernois', Email: 'Chris@thereforemedia.tv', Phone_Number: '19105124874', Trade_Type: 'Videography', id: 3 },
    { First_Name: 'Caye', Last_Name: 'Finnell', Email: 'garrett@vowsok.com', Phone_Number: '14052550459', Trade_Type: 'Jazz', id: 6 },
    { First_Name: 'Caye', Last_Name: 'Finnell', Email: 'garrett@vowsok.com', Phone_Number: '14052550459', Trade_Type: 'Mass Cantor', id: 10 },
    { First_Name: 'Mike', Last_Name: 'Murphy', Email: 'mikesprivatecatering@gmail.com', Phone_Number: '14056094899', Trade_Type: 'Catering', id: 9 },
    { First_Name: 'Brooke', Last_Name: 'McAfee', Email: 'mrsmcafeesr@gmail.com', Phone_Number: '14058184156', Trade_Type: 'Bartender', id: 14 },
    { First_Name: 'Marry Jesse', Last_Name: 'Livernois', Email: 'littleflowerco.ok@gmail.com', Phone_Number: '14052000009', Trade_Type: 'Florist', id: 15 },
    { First_Name: 'Abby', Last_Name: 'Wiggins', Email: 'simplysweetbyabby@gmail.com', Phone_Number: '14056578735', Trade_Type: 'Cake', id: 16 },
    { First_Name: 'Emily', Last_Name: 'Lassiter', Email: 'tim4myvacationwithemily@gmail.com', Phone_Number: '14056097076', Trade_Type: 'Travel', id: 17 },
  ];
  syncTrades(db, trades);
}

function syncLeadsFromFallback(db) {
  const leads = [
    { FirstName: 'Declan', LastName: 'Ciesinski', CellPhone: 4054064175, PersonalEmail: 'dacieski@gmail.com', Contacted: 0, Stage: 'LEAD', Value: '750', Business: 'Cana Collective', WeddingDate: '2026-06-25T04:00:00.000Z', Notes: 'Wedding DJ and event lighting, Bartender, Stationery and invitations, Florist and table decorations, Wedding planner/day of coordination' },
    { FirstName: 'Emilie', LastName: 'Jackson', CellPhone: 4054714381, PersonalEmail: 'emilie.j0324@gmail.com', Contacted: 0, Stage: 'LEAD', Value: '750', Business: 'Cana Collective', WeddingDate: '2026-07-24T04:00:00.000Z', Notes: 'Wedding DJ and event lighting, Bartender, Photographer, Stationery and invitations' },
    { FirstName: 'Elisabeth', LastName: 'Sorenson', CellPhone: 4052612203, PersonalEmail: 'bethms@icloud.com', Contacted: 0, Stage: 'LEAD', Value: '750', Business: 'Cana Collective', WeddingDate: '2026-06-25T04:00:00.000Z', Notes: 'Stationery and invitations, Florist and table decorations, Wedding planner/day of coordination' },
    { FirstName: 'Kenzee', LastName: 'Miller', CellPhone: 4054064175, PersonalEmail: 'kenzee.miller@gmail.com', Contacted: 1, Stage: 'LEAD', Value: '750', Business: 'Cana Collective', WeddingDate: '2026-05-23T04:00:00.000Z', Notes: 'Wedding Mass Cantor' },
    { FirstName: 'Sarah', LastName: 'Jauregui', CellPhone: 4051234567, PersonalEmail: 'sarah.j@gmail.com', Contacted: 0, Stage: 'LEAD', Value: '750', Business: 'Cana Collective', WeddingDate: '2026-10-10T04:00:00.000Z', Notes: 'Bartender, Florist and table decorations, Catering and charcuterie' },
    { FirstName: 'Sydney', LastName: 'Natale', CellPhone: 4057654321, PersonalEmail: 'sydney.n@gmail.com', Contacted: 0, Stage: 'LEAD', Value: '750', Business: 'Cana Collective', WeddingDate: '2026-06-13T04:00:00.000Z', Notes: 'Live art painting, Wedding cakes and baked goods, Catering and and charcuterie' },
    { FirstName: 'Cindi', LastName: 'Jorgensen', CellPhone: 4059876543, PersonalEmail: 'cindi.j@gmail.com', Contacted: 0, Stage: 'LEAD', Value: '750', Business: 'Cana Collective', WeddingDate: '2026-10-10T04:00:00.000Z', Notes: 'Catering and charcuterie, Chair and table rentals' },
  ];
  syncLeads(db, leads);
}

module.exports = { syncFromN8n, matchServicesToTradeTypes, SERVICE_TO_TRADE_MAP };
