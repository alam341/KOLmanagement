// ===== ROUTER & INIT =====
const PAGES = {
  dashboard: { title:'Dashboard', subtitle:'Ringkasan aktivitas outreach', init: initDashboard },
  database:  { title:'Database KOL', subtitle:'Kelola daftar kreator & affiliator', init: initDatabase },
  analysis:  { title:'Analisis KOL', subtitle:'Scoring, tier, & performa kreator', init: initAnalysis },
  outreach:  { title:'Outreach Pipeline', subtitle:'Kelola status pendekatan ke kreator', init: initOutreach },
  autodm:    { title:'Auto DM TikTok', subtitle:'Otomasi kirim DM ke kreator via bot', init: initAutodm },
  templates: { title:'Template Pesan', subtitle:'Kelola template WA & TikTok DM', init: initTemplates },
  settings:  { title:'Pengaturan', subtitle:'Konfigurasi brand & data', init: initSettings },
  users:     { title:'Manajemen User', subtitle:'Kelola akun & hak akses pengguna', init: initUsers },
};

let currentPage = 'dashboard';

async function navigate(page) {
  if (!PAGES[page]) return;
  if (page === 'users' && !await AUTH.isAdmin()) {
    toast('Akses ditolak. Halaman ini hanya untuk Admin.', 'error');
    return;
  }
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
  if (page === 'users') return `
    <button class="btn btn-primary btn-sm" onclick="openAddUserModal()">+ Tambah User</button>
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

// ===== THEME =====
function applyTheme(light) {
  document.body.classList.toggle('light', light);
  const track = document.getElementById('themeTrack');
  const icon  = document.getElementById('themeToggleIcon');
  const label = document.getElementById('themeToggleLabel');
  if (track)  track.classList.toggle('on', light);
  if (icon)   icon.textContent  = light ? '🌙' : '☀️';
  if (label)  label.textContent = light ? 'Tema Gelap' : 'Tema Terang';
}

function toggleTheme() {
  const isLight = !document.body.classList.contains('light');
  localStorage.setItem('kol_theme', isLight ? 'light' : 'dark');
  applyTheme(isLight);
}

// ===== USER INFO =====
async function renderUserInfo() {
  const profile = await AUTH.getProfile();
  if (!profile) return;
  const user = { name: profile.name, role: profile.role };
  const isAdmin   = user.role === 'admin';
  const roleLabel = isAdmin ? 'Admin' : 'KOL Spesialis';
  const roleStyle = isAdmin
    ? 'background:var(--accent);color:#fff;'
    : 'background:rgba(6,182,212,.15);color:var(--accent2);';

  // Topbar
  const tbUser = document.getElementById('topbarUser');
  if (tbUser) tbUser.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="text-align:right;line-height:1.3;">
        <div style="font-size:12px;font-weight:700;">${esc(user.name)}</div>
        <div style="font-size:10px;${isAdmin ? 'color:var(--accent);' : 'color:var(--accent2);'}">${roleLabel}</div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="AUTH.logout()"
              title="Keluar" style="color:var(--red);border-color:rgba(239,68,68,.3);padding:6px 9px;">⏻</button>
    </div>`;

  // Sidebar
  const sbUser = document.getElementById('sidebarUser');
  if (sbUser) sbUser.innerHTML = `
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:8px;">
      <div style="font-size:12px;font-weight:700;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(user.name)}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
        <span style="${roleStyle}font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap;">${roleLabel}</span>
        <button onclick="AUTH.logout()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px;padding:0;white-space:nowrap;" title="Keluar">Keluar ⏻</button>
      </div>
    </div>`;
}

// Boot
document.addEventListener('DOMContentLoaded', async () => {
  if (!await AUTH.requireAuth()) return;

  const saved = localStorage.getItem('kol_theme');
  applyTheme(saved === 'light');

  // Load semua data dari Supabase ke memory
  try {
    await DB.loadAll();
  } catch (e) {
    toast('Gagal memuat data: ' + e.message, 'error');
  }

  await renderUserInfo();

  if (await AUTH.isAdmin()) {
    const navAdmin = document.getElementById('navAdminSection');
    if (navAdmin) navAdmin.style.display = '';
    updatePendingBadge();
  }

  navigate('dashboard');
});
