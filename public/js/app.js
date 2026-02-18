// ============ UTILITY FUNCTIONS ============
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function formatDate(d) {
  if (!d) return '\u2014';
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatPhone(p) {
  if (!p) return '\u2014';
  const s = String(p).replace(/\D/g, '');
  if (s.length === 10) return `(${s.slice(0,3)}) ${s.slice(3,6)}-${s.slice(6)}`;
  if (s.length === 11) return `(${s.slice(1,4)}) ${s.slice(4,7)}-${s.slice(7)}`;
  return p;
}

function timeAgo(d) {
  if (!d) return '\u2014';
  const now = new Date();
  const date = new Date(d);
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

function statusBadge(status) {
  const colors = {
    new: 'bg-blue-50 text-blue-700 border-blue-200',
    contacted: 'bg-pink-50 text-pink-700 border-pink-200',
    responded: 'bg-green-50 text-green-700 border-green-200',
    booked: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    paid: 'bg-black text-white border-black',
    didnt_respond: 'bg-red-50 text-red-600 border-red-200',
    LEAD: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  const labels = { new:'New', contacted:'Contacted', responded:'Responded', booked:'Booked', paid:'Paid', didnt_respond:"Didn't Respond", LEAD:'Lead' };
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[status]||colors.new}">${labels[status]||status}</span>`;
}

function catBadge(name) {
  return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-pink-50 text-black border border-pink-200">${name}</span>`;
}

async function api(url, opts = {}) {
  const resp = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  return resp.json();
}

// ============ LOGIN ============
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = document.getElementById('password').value;
    const resp = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: pw }) });
    if (resp.success) {
      window.location.href = '/admin/dashboard';
    } else {
      document.getElementById('loginError').classList.remove('hidden');
    }
  });
}

// ============ DASHBOARD TABS ============
async function loadDashboardTab(tab) {
  const container = document.getElementById('dashboard-content');
  if (!container) return;

  switch (tab) {
    case 'overview': return loadOverview(container);
    case 'vendors': return loadVendorsTab(container);
    case 'leads': return loadLeadsTab(container);
    case 'categories': return loadCategoriesTab(container);
    case 'ratings': return loadRatingsTab(container);
    default: return loadOverview(container);
  }
}

async function loadOverview(el) {
  const stats = await api('/api/stats');
  const leads = await api('/api/leads');
  const recentLeads = leads.slice(0, 5);

  el.innerHTML = `
    <h2 class="text-xl font-bold mb-6">Dashboard Overview</h2>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      ${statCard('Total Leads', stats.totalLeads, 'bg-white')}
      ${statCard('New Leads', stats.newLeads, 'bg-blue-50')}
      ${statCard('Active Vendors', stats.totalVendors, 'bg-white')}
      ${statCard('Upcoming Weddings', stats.upcomingWeddings, 'bg-pink-50')}
      ${statCard('Assignments', stats.totalAssignments, 'bg-white')}
      ${statCard('Booked', stats.bookedCount, 'bg-green-50')}
      ${statCard('Paid', stats.paidCount, 'bg-emerald-50')}
      ${statCard('Avg Rating', stats.avgRating ? stats.avgRating + '/5' : 'N/A', 'bg-white')}
    </div>

    <h3 class="text-lg font-bold mb-4">Recent Leads</h3>
    <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Client</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Wedding Date</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Services</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Status</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Vendors</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          ${recentLeads.map(l => `
            <tr class="hover:bg-gray-50 cursor-pointer" onclick="window.location='/admin/lead/${l.id}'">
              <td class="px-4 py-3 font-medium">${l.client_name}</td>
              <td class="px-4 py-3 text-gray-500">${formatDate(l.wedding_date)}</td>
              <td class="px-4 py-3">${(l.categories_needed||'').split(',').slice(0,2).map(s=>catBadge(s.trim())).join(' ')}</td>
              <td class="px-4 py-3">${statusBadge(l.status)}</td>
              <td class="px-4 py-3 text-gray-500">${l.vendor_count || 0} assigned</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function statCard(label, value, bg) {
  return `
    <div class="${bg} rounded-xl border border-gray-100 p-4">
      <div class="text-2xl font-bold text-black">${value}</div>
      <div class="text-xs text-gray-500 mt-1">${label}</div>
    </div>
  `;
}

async function loadLeadsTab(el) {
  const leads = await api('/api/leads');
  el.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-bold">All Leads</h2>
      <div class="text-sm text-gray-500">${leads.length} total</div>
    </div>
    <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Client</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Phone</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Wedding</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Services</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Status</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Vendors</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Added</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          ${leads.map(l => `
            <tr class="hover:bg-gray-50 cursor-pointer" onclick="window.location='/admin/lead/${l.id}'">
              <td class="px-4 py-3">
                <div class="font-medium">${l.client_name}</div>
                <div class="text-xs text-gray-400">${l.client_email || ''}</div>
              </td>
              <td class="px-4 py-3 text-gray-500">${formatPhone(l.client_phone)}</td>
              <td class="px-4 py-3 text-gray-500">${formatDate(l.wedding_date)}</td>
              <td class="px-4 py-3 max-w-xs">
                <div class="flex flex-wrap gap-1">
                  ${(l.categories_needed||'').split(',').filter(Boolean).slice(0,3).map(s=>catBadge(s.trim())).join('')}
                  ${(l.categories_needed||'').split(',').length > 3 ? '<span class="text-xs text-gray-400">+more</span>' : ''}
                </div>
              </td>
              <td class="px-4 py-3">${statusBadge(l.status)}</td>
              <td class="px-4 py-3 text-gray-500">${l.vendor_count || 0}</td>
              <td class="px-4 py-3 text-gray-400 text-xs">${timeAgo(l.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function loadVendorsTab(el) {
  const vendors = await api('/api/vendors');
  el.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-bold">Vendors</h2>
      <div class="text-sm text-gray-500">${vendors.length} total</div>
    </div>
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      ${vendors.map(v => `
        <div class="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer" onclick="window.location='/admin/vendor/${v.id}'">
          <div class="flex items-start justify-between mb-3">
            <div>
              <div class="font-bold text-base">${v.first_name || ''} ${v.last_name || ''}</div>
              <div class="text-xs text-gray-400">${v.email || ''}</div>
            </div>
            ${v.avg_rating ? `<div class="text-sm font-medium text-pink-400">${parseFloat(v.avg_rating).toFixed(1)} \u2605</div>` : ''}
          </div>
          <div class="flex flex-wrap gap-1 mb-3">
            ${(v.trade_types||'').split(',').map(t=>catBadge(t.trim())).join('')}
          </div>
          <div class="flex items-center gap-4 text-xs text-gray-400">
            <span>${v.lead_count || 0} leads</span>
            <span>${v.booked_count || 0} booked</span>
            <span>${formatPhone(v.phone)}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function loadCategoriesTab(el) {
  const categories = await api('/api/categories');
  el.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-bold">Service Categories</h2>
      <button onclick="showAddCategoryModal()" class="btn-primary text-sm">Add Category</button>
    </div>
    <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Category</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">System Name</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Vendors</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Leads</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Status</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          ${categories.map(c => `
            <tr>
              <td class="px-4 py-3 font-medium">${c.display_name}</td>
              <td class="px-4 py-3 text-gray-400 text-xs font-mono">${c.name}</td>
              <td class="px-4 py-3 text-gray-500">${c.vendor_count}</td>
              <td class="px-4 py-3 text-gray-500">${c.lead_count}</td>
              <td class="px-4 py-3">${c.active ? '<span class="text-green-600 text-xs">Active</span>' : '<span class="text-red-400 text-xs">Inactive</span>'}</td>
              <td class="px-4 py-3">
                <button onclick="toggleCategory(${c.id}, ${c.active ? 0 : 1})" class="text-xs text-gray-400 hover:text-black mr-2">${c.active ? 'Disable' : 'Enable'}</button>
                ${c.vendor_count === 0 && c.lead_count === 0 ? `<button onclick="deleteCategory(${c.id})" class="text-xs text-red-400 hover:text-red-600">Delete</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div id="addCategoryModal" class="hidden fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
        <h3 class="text-lg font-bold mb-4">Add Category</h3>
        <form id="addCategoryForm" class="space-y-3">
          <input type="text" id="catDisplayName" placeholder="Display name (e.g. Wedding Planner)" class="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-pink-300" required />
          <input type="text" id="catDescription" placeholder="Description (optional)" class="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-pink-300" />
          <div class="flex gap-2">
            <button type="submit" class="btn-primary text-sm flex-1">Add</button>
            <button type="button" onclick="hideAddCategoryModal()" class="btn-outline text-sm flex-1">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('addCategoryForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const display_name = document.getElementById('catDisplayName').value;
    const description = document.getElementById('catDescription').value;
    await api('/api/categories', { method: 'POST', body: JSON.stringify({ display_name, description }) });
    showToast('Category added');
    hideAddCategoryModal();
    loadCategoriesTab(el);
  });
}

function showAddCategoryModal() { document.getElementById('addCategoryModal').classList.remove('hidden'); }
function hideAddCategoryModal() { document.getElementById('addCategoryModal').classList.add('hidden'); }

async function toggleCategory(id, active) {
  await api(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify({ active }) });
  showToast(active ? 'Category enabled' : 'Category disabled');
  loadDashboardTab('categories');
}

async function deleteCategory(id) {
  if (!confirm('Delete this category?')) return;
  await api(`/api/categories/${id}`, { method: 'DELETE' });
  showToast('Category deleted');
  loadDashboardTab('categories');
}

async function loadRatingsTab(el) {
  const ratings = await api('/api/ratings');
  el.innerHTML = `
    <h2 class="text-xl font-bold mb-6">Vendor Ratings</h2>
    ${ratings.length === 0 ? '<p class="text-gray-400 text-center py-8">No ratings yet</p>' : `
    <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Vendor</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Client</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Rating</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Comment</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          ${ratings.map(r => `
            <tr>
              <td class="px-4 py-3 font-medium">${r.vendor_first} ${r.vendor_last}</td>
              <td class="px-4 py-3 text-gray-500">${r.client_name}</td>
              <td class="px-4 py-3">${r.rating ? starHtml(r.rating) : '\u2014'}</td>
              <td class="px-4 py-3 text-gray-500 max-w-xs truncate">${r.comment || '\u2014'}</td>
              <td class="px-4 py-3">${r.submitted ? '<span class="text-green-600 text-xs">Submitted</span>' : '<span class="text-gray-400 text-xs">Pending</span>'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`}
  `;
}

function starHtml(rating) {
  let s = '';
  for (let i = 1; i <= 5; i++) {
    s += `<span class="${i <= rating ? 'text-pink-300' : 'text-gray-200'}">\u2605</span>`;
  }
  return s;
}

// ============ LEAD DETAIL ============
async function loadLeadDetail(id) {
  const el = document.getElementById('lead-detail');
  const data = await api(`/api/leads/${id}`);
  const { lead, vendors } = data;

  el.innerHTML = `
    <div class="bg-white rounded-xl border border-gray-100 p-6 mb-6">
      <div class="flex items-start justify-between mb-4">
        <div>
          <h2 class="text-2xl font-bold">${lead.client_name}</h2>
          <div class="text-sm text-gray-400 mt-1">${lead.source === 'n8n_import' ? 'Imported from n8n' : 'Website submission'}</div>
        </div>
        ${statusBadge(lead.status)}
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div><span class="text-gray-400">Email</span><div class="font-medium">${lead.client_email || '\u2014'}</div></div>
        <div><span class="text-gray-400">Phone</span><div class="font-medium">${formatPhone(lead.client_phone)}</div></div>
        <div><span class="text-gray-400">Wedding Date</span><div class="font-medium">${formatDate(lead.wedding_date)}</div></div>
        <div><span class="text-gray-400">Value</span><div class="font-medium">${lead.value ? '$' + lead.value : '\u2014'}</div></div>
        <div><span class="text-gray-400">Stage</span><div class="font-medium">${lead.stage || '\u2014'}</div></div>
        <div><span class="text-gray-400">Contacted</span><div class="font-medium">${lead.contacted ? 'Yes' : 'No'}</div></div>
      </div>
      <div class="mt-4">
        <span class="text-gray-400 text-sm">Services Requested</span>
        <div class="flex flex-wrap gap-1 mt-1">
          ${(lead.categories_needed||'').split(',').filter(Boolean).map(s=>catBadge(s.trim())).join('')}
        </div>
      </div>
      ${lead.notes ? `<div class="mt-4"><span class="text-gray-400 text-sm">Notes</span><div class="text-sm mt-1">${lead.notes}</div></div>` : ''}
    </div>

    <h3 class="text-lg font-bold mb-4">Assigned Vendors (${vendors.length})</h3>
    ${vendors.length === 0 ? '<p class="text-gray-400 text-center py-4">No vendors assigned</p>' : `
    <div class="space-y-3">
      ${vendors.map(v => `
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <div class="flex items-start justify-between mb-2">
            <div>
              <div class="font-medium">${v.first_name} ${v.last_name}</div>
              <div class="text-xs text-gray-400">${v.email || ''} &middot; ${formatPhone(v.phone)}</div>
            </div>
            ${v.category_name ? catBadge(v.category_name) : ''}
          </div>
          <div class="flex flex-wrap gap-3 text-xs text-gray-400 mt-2">
            <span>Opens: ${v.open_count}</span>
            <span>First opened: ${v.first_opened_at ? timeAgo(v.first_opened_at) : 'Never'}</span>
            <span class="${v.contacted ? 'text-green-600' : ''}">Contacted: ${v.contacted ? 'Yes' : 'No'}</span>
            <span class="${v.booked ? 'text-emerald-600' : ''}">Booked: ${v.booked ? 'Yes' : 'No'}</span>
            <span class="${v.paid ? 'text-black font-medium' : ''}">Paid: ${v.paid ? 'Yes' : 'No'}</span>
          </div>
          <div class="mt-2 text-xs">
            <a href="/lead/${v.page_token}" target="_blank" class="text-pink-400 hover:text-pink-600">View lead page &rarr;</a>
          </div>
        </div>
      `).join('')}
    </div>`}
  `;
}

// ============ VENDOR DETAIL (admin) ============
async function loadVendorDetail(id) {
  const el = document.getElementById('vendor-detail');
  const data = await api(`/api/vendors/${id}`);
  const { vendor, leads, ratings } = data;

  el.innerHTML = `
    <div class="bg-white rounded-xl border border-gray-100 p-6 mb-6">
      <div class="flex items-start justify-between mb-4">
        <div>
          <h2 class="text-2xl font-bold">${vendor.first_name || ''} ${vendor.last_name || ''}</h2>
          <div class="text-sm text-gray-400 mt-1">${vendor.email || ''} &middot; ${formatPhone(vendor.phone)}</div>
        </div>
        ${vendor.avg_rating ? `<div class="text-lg font-medium text-pink-400">${parseFloat(vendor.avg_rating).toFixed(1)} \u2605</div>` : ''}
      </div>
      <div class="flex flex-wrap gap-1 mb-4">
        ${(vendor.trade_types||'').split(',').map(t=>catBadge(t.trim())).join('')}
      </div>
      <div class="text-xs text-gray-400">
        Vendor dashboard link: <a href="/vendor/${vendor.token}" target="_blank" class="text-pink-400 hover:text-pink-600">/vendor/${vendor.token}</a>
      </div>
    </div>

    <h3 class="text-lg font-bold mb-4">Assigned Leads (${leads.length})</h3>
    <div class="bg-white rounded-xl border border-gray-100 overflow-hidden mb-6">
      <table class="w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Client</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Wedding</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Category</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Opens</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          ${leads.map(l => `
            <tr>
              <td class="px-4 py-3 font-medium">${l.client_name}</td>
              <td class="px-4 py-3 text-gray-500">${formatDate(l.wedding_date)}</td>
              <td class="px-4 py-3">${l.category_name ? catBadge(l.category_name) : '\u2014'}</td>
              <td class="px-4 py-3 text-gray-500">${l.open_count}</td>
              <td class="px-4 py-3">
                ${l.booked ? statusBadge('booked') : l.contacted ? statusBadge('contacted') : l.didnt_respond ? statusBadge('didnt_respond') : statusBadge('new')}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    ${ratings.length > 0 ? `
    <h3 class="text-lg font-bold mb-4">Ratings (${ratings.length})</h3>
    <div class="space-y-3">
      ${ratings.map(r => `
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <div class="flex items-center justify-between mb-1">
            <span class="font-medium">${r.client_name}</span>
            <span>${starHtml(r.rating)}</span>
          </div>
          ${r.comment ? `<p class="text-sm text-gray-500">${r.comment}</p>` : ''}
        </div>
      `).join('')}
    </div>` : ''}
  `;
}

// ============ LEAD PAGE (vendor-facing) ============
async function loadLeadPage(token) {
  const el = document.getElementById('lead-page');
  try {
    const data = await api(`/api/lead-page/${token}`);
    if (data.error) {
      el.innerHTML = `<div class="text-center py-12"><p class="text-gray-400">${data.error}</p></div>`;
      return;
    }

    el.innerHTML = `
      <div class="bg-white rounded-xl border border-gray-100 p-6 mb-6">
        <div class="text-xs text-gray-400 mb-2">Lead for ${data.category_name || 'your service'}</div>
        <h2 class="text-2xl font-bold mb-1">${data.client_name}</h2>
        <div class="text-sm text-gray-500 mb-4">Wedding: ${formatDate(data.wedding_date)}</div>

        <div class="grid grid-cols-2 gap-4 text-sm mb-4">
          <div><span class="text-gray-400">Email</span><div class="font-medium">${data.client_email || '\u2014'}</div></div>
          <div><span class="text-gray-400">Phone</span><div class="font-medium"><a href="tel:${data.client_phone}" class="text-pink-400 hover:text-pink-600">${formatPhone(data.client_phone)}</a></div></div>
          ${data.venue ? `<div><span class="text-gray-400">Venue</span><div class="font-medium">${data.venue}</div></div>` : ''}
          ${data.guest_count ? `<div><span class="text-gray-400">Guest Count</span><div class="font-medium">${data.guest_count}</div></div>` : ''}
        </div>

        <div class="mb-4">
          <span class="text-gray-400 text-sm">Services Requested</span>
          <div class="flex flex-wrap gap-1 mt-1">
            ${(data.categories_needed||'').split(',').filter(Boolean).map(s=>catBadge(s.trim())).join('')}
          </div>
        </div>

        ${data.details ? `<div class="mb-4"><span class="text-gray-400 text-sm">Additional Details</span><div class="text-sm mt-1">${data.details}</div></div>` : ''}
      </div>

      <div class="bg-white rounded-xl border border-gray-100 p-6">
        <h3 class="font-bold mb-4">Update Status</h3>
        <div class="space-y-3">
          ${toggleRow('contacted', 'I contacted this client', data.contacted)}
          ${toggleRow('responded', 'Client responded', data.responded)}
          ${toggleRow('booked', 'Client booked with me', data.booked)}
          ${toggleRow('paid', 'Payment received', data.paid)}
          <div class="border-t border-gray-100 pt-3">
            ${toggleRow('didnt_respond', "Client didn't respond", data.didnt_respond)}
          </div>
        </div>
      </div>
    `;

    // Attach toggle handlers
    el.querySelectorAll('.status-toggle').forEach(toggle => {
      toggle.addEventListener('change', async (e) => {
        const field = e.target.dataset.field;
        const value = e.target.checked ? 1 : 0;
        await api(`/api/lead-page/${token}/status`, {
          method: 'PUT',
          body: JSON.stringify({ [field]: value })
        });
        showToast('Status updated');
      });
    });
  } catch (err) {
    el.innerHTML = `<div class="text-center py-12"><p class="text-red-400">Error loading lead</p></div>`;
  }
}

function toggleRow(field, label, value) {
  return `
    <label class="flex items-center justify-between cursor-pointer">
      <span class="text-sm">${label}</span>
      <div class="toggle-switch">
        <input type="checkbox" class="status-toggle" data-field="${field}" ${value ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </div>
    </label>
  `;
}

// ============ VENDOR DASHBOARD (magic link) ============
async function loadVendorDashboard(token) {
  const el = document.getElementById('vendor-dashboard');
  const nameEl = document.getElementById('vendor-name');
  try {
    const data = await api(`/api/vendor-dashboard/${token}`);
    if (data.error) {
      el.innerHTML = `<div class="text-center py-12"><p class="text-gray-400">${data.error}</p></div>`;
      return;
    }

    const { vendor, leads, ratings } = data;
    if (nameEl) nameEl.textContent = `${vendor.first_name} ${vendor.last_name}`;

    const activeLeads = leads.filter(l => !l.didnt_respond);
    const bookedLeads = leads.filter(l => l.booked);

    el.innerHTML = `
      <div class="grid grid-cols-3 gap-4 mb-6">
        ${statCard('Active Leads', activeLeads.length, 'bg-white')}
        ${statCard('Booked', bookedLeads.length, 'bg-green-50')}
        ${statCard('Avg Rating', ratings.length > 0 ? (ratings.reduce((a,r)=>a+r.rating,0)/ratings.length).toFixed(1) : 'N/A', 'bg-white')}
      </div>

      <div class="flex flex-wrap gap-1 mb-6">
        ${(vendor.trade_types||'').split(',').map(t=>catBadge(t.trim())).join('')}
      </div>

      <h3 class="text-lg font-bold mb-4">Your Leads</h3>
      ${leads.length === 0 ? '<p class="text-gray-400 text-center py-4">No leads yet</p>' : `
      <div class="space-y-3 mb-6">
        ${leads.map(l => `
          <div class="bg-white rounded-xl border border-gray-100 p-4">
            <div class="flex items-start justify-between mb-2">
              <div>
                <div class="font-medium">${l.client_name}</div>
                <div class="text-xs text-gray-400">Wedding: ${formatDate(l.wedding_date)}</div>
              </div>
              ${l.category_name ? catBadge(l.category_name) : ''}
            </div>
            <div class="flex flex-wrap gap-2 text-xs text-gray-400 mb-2">
              ${l.client_phone ? `<a href="tel:${l.client_phone}" class="text-pink-400">${formatPhone(l.client_phone)}</a>` : ''}
              ${l.client_email ? `<a href="mailto:${l.client_email}" class="text-pink-400">${l.client_email}</a>` : ''}
            </div>
            <div class="flex gap-2 text-xs">
              ${l.booked ? '<span class="text-emerald-600 font-medium">Booked</span>' :
                l.contacted ? '<span class="text-pink-400">Contacted</span>' :
                l.didnt_respond ? '<span class="text-red-400">No Response</span>' :
                '<span class="text-blue-500">New</span>'}
            </div>
            <div class="mt-2">
              <a href="/lead/${l.page_token}" class="text-xs text-pink-400 hover:text-pink-600">View full details &rarr;</a>
            </div>
          </div>
        `).join('')}
      </div>`}

      ${ratings.length > 0 ? `
      <h3 class="text-lg font-bold mb-4">Your Ratings</h3>
      <div class="space-y-3">
        ${ratings.map(r => `
          <div class="bg-white rounded-xl border border-gray-100 p-4">
            <div class="flex items-center justify-between">
              <span class="text-sm">${r.client_name}</span>
              <span>${starHtml(r.rating)}</span>
            </div>
            ${r.comment ? `<p class="text-xs text-gray-500 mt-1">${r.comment}</p>` : ''}
          </div>
        `).join('')}
      </div>` : ''}
    `;
  } catch (err) {
    el.innerHTML = `<div class="text-center py-12"><p class="text-red-400">Error loading dashboard</p></div>`;
  }
}

// ============ RATING PAGE ============
async function loadRatingPage(token) {
  const el = document.getElementById('rating-page');
  try {
    const data = await api(`/api/rate/${token}`);
    if (data.error) {
      el.innerHTML = `<div class="text-center py-12"><p class="text-gray-400">${data.error}</p></div>`;
      return;
    }

    if (data.submitted) {
      el.innerHTML = `
        <div class="text-center py-12">
          <div class="text-4xl mb-4">\u2665</div>
          <h2 class="text-xl font-bold mb-2">Thank you!</h2>
          <p class="text-gray-500">Your rating has been submitted.</p>
        </div>
      `;
      return;
    }

    el.innerHTML = `
      <div class="bg-white rounded-xl border border-gray-100 p-6">
        <div class="text-center mb-6">
          <h2 class="text-xl font-bold mb-1">How was ${data.vendor_first} ${data.vendor_last}?</h2>
          <p class="text-sm text-gray-400">Your feedback helps us improve our vendor network</p>
        </div>
        <form id="ratingForm" class="space-y-4">
          <div class="flex justify-center">
            <div class="star-rating">
              ${[5,4,3,2,1].map(i => `
                <input type="radio" name="rating" id="star${i}" value="${i}">
                <label for="star${i}">\u2605</label>
              `).join('')}
            </div>
          </div>
          <textarea id="ratingComment" placeholder="Share your experience (optional)"
            class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-pink-300 text-sm" rows="3"></textarea>
          <button type="submit" class="w-full btn-primary text-center">Submit Rating</button>
        </form>
      </div>
    `;

    document.getElementById('ratingForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const rating = document.querySelector('input[name="rating"]:checked')?.value;
      if (!rating) { showToast('Please select a rating', 'error'); return; }
      const comment = document.getElementById('ratingComment').value;
      await api(`/api/rate/${token}`, { method: 'POST', body: JSON.stringify({ rating: parseInt(rating), comment }) });
      el.innerHTML = `
        <div class="text-center py-12">
          <div class="text-4xl mb-4">\u2665</div>
          <h2 class="text-xl font-bold mb-2">Thank you!</h2>
          <p class="text-gray-500">Your rating has been submitted.</p>
        </div>
      `;
    });
  } catch (err) {
    el.innerHTML = `<div class="text-center py-12"><p class="text-red-400">Error loading rating form</p></div>`;
  }
}
