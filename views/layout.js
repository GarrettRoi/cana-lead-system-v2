function layout(title, content, options = {}) {
  const { bodyClass = '' } = options;
  return '<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'  <meta charset="UTF-8">\n' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'  <title>' + title + ' — Cana Wedding Collective</title>\n' +
'  <script src="https://cdn.tailwindcss.com"><\/script>\n' +
'  <link rel="preconnect" href="https://fonts.googleapis.com">\n' +
'  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
'  <link href="https://fonts.googleapis.com/css2?family=Varela+Round&display=swap" rel="stylesheet">\n' +
'  <script>\n' +
'    tailwind.config = {\n' +
'      theme: {\n' +
'        extend: {\n' +
'          colors: {\n' +
'            cana: {\n' +
'              black: "#000000",\n' +
'              dark: "#1a1a1a",\n' +
'              blush: "#F4C2C2",\n' +
'              "blush-light": "#FAE0E0",\n' +
'              "blush-pale": "#FDF0F0",\n' +
'              white: "#FFFFFF",\n' +
'              cream: "#FEFEFE",\n' +
'              "warm-white": "#FBF9F9",\n' +
'              navy: "#002147",\n' +
'              gray: "#6B7280",\n' +
'              "gray-light": "#E5E7EB",\n' +
'              "gray-dark": "#374151",\n' +
'            }\n' +
'          },\n' +
'          fontFamily: {\n' +
'            sans: ["Varela Round", "sans-serif"],\n' +
'          }\n' +
'        }\n' +
'      }\n' +
'    }\n' +
'  <\/script>\n' +
'  <style>\n' +
'    body { font-family: "Varela Round", sans-serif; }\n' +
'    .toggle-switch { position: relative; width: 44px; height: 24px; flex-shrink: 0; }\n' +
'    .toggle-switch input { opacity: 0; width: 0; height: 0; }\n' +
'    .toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #E5E7EB; transition: 0.3s; border-radius: 24px; }\n' +
'    .toggle-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: 0.3s; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }\n' +
'    input:checked + .toggle-slider { background-color: #F4C2C2; }\n' +
'    input:checked + .toggle-slider:before { transform: translateX(20px); }\n' +
'    .star-rating input { display: none; }\n' +
'    .star-rating label { font-size: 2rem; color: #E5E7EB; cursor: pointer; transition: color 0.2s; }\n' +
'    .star-rating label:hover, .star-rating label:hover ~ label, .star-rating input:checked ~ label { color: #F4C2C2; }\n' +
'    .star-rating { display: flex; flex-direction: row-reverse; justify-content: flex-end; gap: 4px; }\n' +
'    .fade-in { animation: fadeIn 0.4s ease-in; }\n' +
'    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }\n' +
'    .toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 24px; border-radius: 8px; color: white; font-size: 14px; z-index: 1000; animation: slideUp 0.3s ease-out; }\n' +
'    .toast.success { background-color: #000000; }\n' +
'    .toast.error { background-color: #EF4444; }\n' +
'    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }\n' +
'    ::-webkit-scrollbar { width: 6px; }\n' +
'    ::-webkit-scrollbar-track { background: #FBF9F9; }\n' +
'    ::-webkit-scrollbar-thumb { background: #F4C2C2; border-radius: 3px; }\n' +
'    ::-webkit-scrollbar-thumb:hover { background: #E5A5A5; }\n' +
'    .btn-primary { background-color: #F4C2C2; color: #000; padding: 0.625rem 1.5rem; border-radius: 9999px; font-weight: 500; transition: all 0.2s; }\n' +
'    .btn-primary:hover { background-color: #E5A5A5; }\n' +
'    .btn-outline { border: 2px solid #000; color: #000; padding: 0.625rem 1.5rem; border-radius: 9999px; font-weight: 500; transition: all 0.2s; }\n' +
'    .btn-outline:hover { background-color: #000; color: #fff; }\n' +
'  </style>\n' +
'</head>\n' +
'<body class="bg-white text-cana-black min-h-screen ' + bodyClass + '">\n' +
'  ' + content + '\n' +
'  <script src="/js/app.js"><\/script>\n' +
'</body>\n' +
'</html>';
}

function navBar() {
  return '<nav class="bg-white border-b border-cana-gray-light">' +
    '<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">' +
      '<div class="flex justify-between items-center h-16">' +
        '<a href="/" class="flex items-center gap-2">' +
          '<img src="/images/cana_logo.webp" alt="Cana Wedding" class="h-10">' +
        '</a>' +
        '<div class="text-xs text-cana-gray tracking-wide uppercase">Lead Management</div>' +
      '</div>' +
    '</div>' +
  '</nav>';
}

function adminNav(activeTab) {
  var tabs = [
    { id: 'overview', label: 'Overview', href: '/admin/dashboard' },
    { id: 'vendors', label: 'Vendors', href: '/admin/dashboard?tab=vendors' },
    { id: 'leads', label: 'All Leads', href: '/admin/dashboard?tab=leads' },
    { id: 'categories', label: 'Categories', href: '/admin/dashboard?tab=categories' },
    { id: 'ratings', label: 'Ratings', href: '/admin/dashboard?tab=ratings' },
  ];
  var tabsHtml = tabs.map(function(t) {
    var cls = activeTab === t.id
      ? 'border-cana-blush text-cana-black'
      : 'border-transparent text-cana-gray hover:text-cana-black hover:border-cana-gray-light';
    return '<a href="' + t.href + '" class="py-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ' + cls + '">' + t.label + '</a>';
  }).join('');

  return '<div class="border-b border-cana-gray-light bg-white">' +
    '<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">' +
      '<div class="flex gap-8 overflow-x-auto">' + tabsHtml + '</div>' +
    '</div>' +
  '</div>';
}

function formatDate(dateStr) {
  if (!dateStr) return '\u2014';
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusBadge(status) {
  var colors = {
    new: 'bg-blue-50 text-blue-700 border-blue-200',
    contacted: 'bg-pink-50 text-pink-700 border-pink-200',
    responded: 'bg-green-50 text-green-700 border-green-200',
    booked: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    paid: 'bg-black text-white border-black',
    didnt_respond: 'bg-red-50 text-red-600 border-red-200',
    LEAD: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  var labels = {
    new: 'New', contacted: 'Contacted', responded: 'Responded',
    booked: 'Booked', paid: 'Paid', didnt_respond: "Didn't Respond", LEAD: 'Lead',
  };
  return '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ' + (colors[status] || colors['new']) + '">' + (labels[status] || status) + '</span>';
}

function categoryBadge(cat) {
  return '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-pink-50 text-black border border-pink-200">' + cat + '</span>';
}

module.exports = { layout: layout, navBar: navBar, adminNav: adminNav, formatDate: formatDate, statusBadge: statusBadge, categoryBadge: categoryBadge };
