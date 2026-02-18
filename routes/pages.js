const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');
const { layout, navBar, adminNav, formatDate, formatDateTime, timeAgo, statusBadge, categoryBadge, starDisplay } = require('../views/layout');

const BASE_URL = process.env.BASE_URL || 'https://cana-lead-system-production.up.railway.app';

// ============ HOME / LOGIN ============
router.get('/', (req, res) => {
  const isLoggedIn = req.cookies?.admin_token === (process.env.ADMIN_PASSWORD || 'cana2025admin');
  if (isLoggedIn) return res.redirect('/admin/dashboard');

  const html = layout('Login', `
    ${navBar()}
    <div class="min-h-[calc(100vh-64px)] flex items-center justify-center bg-cana-warm-white">
      <div class="w-full max-w-sm mx-auto p-8">
        <div class="text-center mb-8">
          <img src="/images/cana_logo.webp" alt="Cana Wedding" class="h-16 mx-auto mb-4" onerror="this.style.display='none'">
          <h1 class="text-2xl font-bold text-cana-black">Welcome Back</h1>
          <p class="text-cana-gray text-sm mt-1">Sign in to manage your leads</p>
        </div>
        <form id="loginForm" class="space-y-4">
          <div>
            <input type="password" id="password" placeholder="Enter admin password"
              class="w-full px-4 py-3 rounded-full border border-cana-gray-light focus:outline-none focus:border-cana-blush transition-colors text-center" />
          </div>
          <button type="submit" class="w-full btn-primary text-center">Sign In</button>
          <p id="loginError" class="text-red-500 text-sm text-center hidden">Invalid password</p>
        </form>
      </div>
    </div>
  `);
  res.send(html);
});

// ============ ADMIN DASHBOARD ============
router.get('/admin/dashboard', (req, res) => {
  const isLoggedIn = req.cookies?.admin_token === (process.env.ADMIN_PASSWORD || 'cana2025admin');
  if (!isLoggedIn) return res.redirect('/');

  const tab = req.query.tab || 'overview';

  const html = layout('Dashboard', `
    ${navBar()}
    ${adminNav(tab)}
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div id="dashboard-content" class="fade-in">
        <div class="flex items-center justify-center py-12">
          <div class="text-cana-gray">Loading...</div>
        </div>
      </div>
    </div>
    <script>
      const currentTab = '${tab}';
      document.addEventListener('DOMContentLoaded', () => loadDashboardTab(currentTab));
    </script>
  `);
  res.send(html);
});

// ============ LEAD DETAIL (admin) ============
router.get('/admin/lead/:id', (req, res) => {
  const isLoggedIn = req.cookies?.admin_token === (process.env.ADMIN_PASSWORD || 'cana2025admin');
  if (!isLoggedIn) return res.redirect('/');

  const html = layout('Lead Detail', `
    ${navBar()}
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <a href="/admin/dashboard?tab=leads" class="text-sm text-cana-gray hover:text-cana-black mb-4 inline-block">&larr; Back to Leads</a>
      <div id="lead-detail" class="fade-in">
        <div class="flex items-center justify-center py-12">
          <div class="text-cana-gray">Loading...</div>
        </div>
      </div>
    </div>
    <script>
      const leadId = ${req.params.id};
      document.addEventListener('DOMContentLoaded', () => loadLeadDetail(leadId));
    </script>
  `);
  res.send(html);
});

// ============ VENDOR DETAIL (admin) ============
router.get('/admin/vendor/:id', (req, res) => {
  const isLoggedIn = req.cookies?.admin_token === (process.env.ADMIN_PASSWORD || 'cana2025admin');
  if (!isLoggedIn) return res.redirect('/');

  const html = layout('Vendor Detail', `
    ${navBar()}
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <a href="/admin/dashboard?tab=vendors" class="text-sm text-cana-gray hover:text-cana-black mb-4 inline-block">&larr; Back to Vendors</a>
      <div id="vendor-detail" class="fade-in">
        <div class="flex items-center justify-center py-12">
          <div class="text-cana-gray">Loading...</div>
        </div>
      </div>
    </div>
    <script>
      const vendorId = ${req.params.id};
      document.addEventListener('DOMContentLoaded', () => loadVendorDetail(vendorId));
    </script>
  `);
  res.send(html);
});

// ============ LEAD PAGE (vendor-facing) ============
router.get('/lead/:pageToken', (req, res) => {
  const html = layout('Lead Details', `
    <div class="min-h-screen bg-cana-warm-white">
      <nav class="bg-white border-b border-cana-gray-light">
        <div class="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <img src="/images/cana_logo.webp" alt="Cana Wedding" class="h-8" onerror="this.style.display='none'">
          <span class="text-lg font-bold">Lead Details</span>
        </div>
      </nav>
      <div class="max-w-3xl mx-auto px-4 py-6">
        <div id="lead-page" class="fade-in">
          <div class="flex items-center justify-center py-12">
            <div class="text-cana-gray">Loading lead information...</div>
          </div>
        </div>
      </div>
    </div>
    <script>
      const pageToken = '${req.params.pageToken}';
      document.addEventListener('DOMContentLoaded', () => loadLeadPage(pageToken));
    </script>
  `);
  res.send(html);
});

// ============ VENDOR DASHBOARD (magic link) ============
router.get('/vendor/:token', (req, res) => {
  const html = layout('Vendor Dashboard', `
    <div class="min-h-screen bg-cana-warm-white">
      <nav class="bg-white border-b border-cana-gray-light">
        <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <img src="/images/cana_logo.webp" alt="Cana Wedding" class="h-8" onerror="this.style.display='none'">
            <span class="text-lg font-bold">Vendor Dashboard</span>
          </div>
          <div id="vendor-name" class="text-sm text-cana-gray"></div>
        </div>
      </nav>
      <div class="max-w-4xl mx-auto px-4 py-6">
        <div id="vendor-dashboard" class="fade-in">
          <div class="flex items-center justify-center py-12">
            <div class="text-cana-gray">Loading your dashboard...</div>
          </div>
        </div>
      </div>
    </div>
    <script>
      const vendorToken = '${req.params.token}';
      document.addEventListener('DOMContentLoaded', () => loadVendorDashboard(vendorToken));
    </script>
  `);
  res.send(html);
});

// ============ RATING PAGE ============
router.get('/rate/:token', (req, res) => {
  const html = layout('Rate Vendor', `
    <div class="min-h-screen bg-cana-warm-white">
      <nav class="bg-white border-b border-cana-gray-light">
        <div class="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <img src="/images/cana_logo.webp" alt="Cana Wedding" class="h-8" onerror="this.style.display='none'">
          <span class="text-lg font-bold">Rate Your Vendor</span>
        </div>
      </nav>
      <div class="max-w-lg mx-auto px-4 py-8">
        <div id="rating-page" class="fade-in">
          <div class="flex items-center justify-center py-12">
            <div class="text-cana-gray">Loading...</div>
          </div>
        </div>
      </div>
    </div>
    <script>
      const ratingToken = '${req.params.token}';
      document.addEventListener('DOMContentLoaded', () => loadRatingPage(ratingToken));
    </script>
  `);
  res.send(html);
});

module.exports = router;
