// ===== ROUTER & INIT =====
const PAGES = {
  dashboard: { title:'Dashboard', subtitle:'Ringkasan aktivitas outreach', init: initDashboard },
  database:  { title:'Database KOL', subtitle:'Kelola daftar kreator & affiliator', init: initDatabase },
  analysis:  { title:'Analisis KOL', subtitle:'Scoring, tier, & performa kreator', init: initAnalysis },
  outreach:  { title:'Outreach Pipeline', subtitle:'Kelola status pendekatan ke kreator', init: initOutreach },
  templates: { title:'Template Pesan', subtitle:'Kelola template WA & TikTok DM', init: initTemplates },
  settings:  { title:'Pengaturan', subtitle:'Konfigurasi brand & data', init: initSettings },
};

let currentPage = 'dashboard';

function navigate(page) {
  if (!PAGES[page]) return;
  currentPage = page;

  // Update nav
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Update topbar
  document.getElementById('topbarTitle').textContent = PAGES[page].title;
  document.getElementById('topbarSubtitle').textContent = PAGES[page].subtitle;
  document.getElementById('topbarActions').innerHTML = topbarActions(page);

  // Update pages
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.getElementById('page-'+page)?.classList.add('active');

  // Init page
  PAGES[page].init();

  // Close sidebar on mobile
  document.getElementById('sidebar')?.classList.remove('open');
}

function topbarActions(page) {
  if (page === 'database') return `
    <button class="btn btn-outline btn-sm" onclick="exportCSV()">⬇ Export CSV</button>
    <button class="btn btn-outline btn-sm" style="color:var(--accent2);border-color:var(--accent2);" onclick="openImport()">⬆ Import</button>
    <button class="btn btn-primary btn-sm" onclick="openKOLModal()">+ Tambah KOL</button>
  `;
  if (page === 'analysis') return `
    <button class="btn btn-outline btn-sm" onclick="refreshAnalysis()">↻ Perbarui Skor</button>
  `;
  if (page === 'templates') return `
    <button class="btn btn-primary btn-sm" onclick="openTmplModal()">+ Buat Template</button>
  `;
  if (page === 'settings') return `
    <button class="btn btn-outline btn-sm" onclick="exportAllData()">⬇ Backup</button>
    <button class="btn btn-outline btn-sm" onclick="importAllData()">⬆ Restore</button>
  `;
  return '';
}

function openModal(id) { document.getElementById(id)?.classList.add('active'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('active'); }

// Close on backdrop click
document.addEventListener('click', e => {
  if (e.target.classList.contains('overlay')) e.target.classList.remove('active');
});

// Mobile sidebar toggle
function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  navigate('dashboard');
});
