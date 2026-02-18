const { getDb } = require('../db/init');
const { matchServicesToTradeTypes } = require('../db/sync');
const { v4: uuidv4 } = require('uuid');

const db = getDb();

const leads = db.prepare("SELECT * FROM leads WHERE categories_needed IS NOT NULL AND categories_needed != ''").all();
const vendors = db.prepare(`
  SELECT v.id, v.token, v.first_name, v.last_name, v.email, v.phone, c.display_name as trade_type, c.id as category_id
  FROM vendors v
  JOIN vendor_categories vc ON v.id = vc.vendor_id
  JOIN categories c ON vc.category_id = c.id
  WHERE v.active = 1
`).all();

const insertLV = db.prepare('INSERT OR IGNORE INTO lead_vendors (lead_id, vendor_id, vendor_token, page_token, category_id) VALUES (?, ?, ?, ?, ?)');

let count = 0;
for (const lead of leads) {
  const neededTradeTypes = matchServicesToTradeTypes(lead.categories_needed);
  console.log(lead.client_name, '->', neededTradeTypes);
  for (const tradeType of neededTradeTypes) {
    const matchedVendors = vendors.filter(v => v.trade_type === tradeType);
    for (const v of matchedVendors) {
      const check = db.prepare('SELECT id FROM lead_vendors WHERE lead_id = ? AND vendor_id = ? AND category_id = ?').get(lead.id, v.id, v.category_id);
      if (!check) {
        insertLV.run(lead.id, v.id, v.token, uuidv4(), v.category_id);
        console.log('  Assigned', v.first_name, 'for', tradeType);
        count++;
      }
    }
  }
}
console.log('Total new assignments:', count);
