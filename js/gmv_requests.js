// ===== GMV REQUESTS =====
// Handle: kol_requests (catatan per KOL dari GMV Tracker)
//       + creator_requests (request KOL baru dari advertiser)

const KOL_REQ_SUPABASE_URL = 'https://pdkkcpdjqpyljddeeott.supabase.co';
const KOL_REQ_ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBka2tjcGRqcXB5bGpkZGVlb3R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwOTAyNzQsImV4cCI6MjA5MjY2NjI3NH0.dgMfJdolmHuMyP_Zm9D912I81sSDQXsxhOI21WgFUa8';
// Pakai _sb yang sudah ada (same Supabase project)
// Jadi langsung pakai _sb dari supabase.js

// ── In-memory store ──
let _kolRequestsMap = {}; // { kol_id: [request, ...] }
let _creatorRequests = [];

// ── Load semua kol_requests ──
async function loadKolRequests() {
  try {
    const { data } = await _sb.from('kol_requests').select('*').order('created_at', { ascending: false });
    _kolRequestsMap = {};
    (data || []).forEach(r => {
      if (!_kolRequestsMap[r.kol_id]) _kolRequestsMap[r.kol_id] = [];
      _kolRequestsMap[r.kol_id].push(r);
    });
    updateNotifBell();
  } catch(e) { console.error('loadKolRequests:', e); }
}

// ── Load creator_requests (filtered by assigned toko for non-admin) ──
async function loadCreatorRequests() {
  try {
    const { data: { user } } = await _sb.auth.getUser();
    let assignedIds = [];
    let isAdmin = false;
    if (user) {
      const { data: prof } = await _sb.from('profiles').select('role,assigned_toko_ids').eq('id', user.id).single();
      isAdmin     = prof?.role === 'admin';
      assignedIds = prof?.assigned_toko_ids || [];
    }

    let query = _sb.from('creator_requests').select('*').order('created_at', { ascending: false });
    if (!isAdmin && assignedIds.length > 0) {
      query = query.in('toko_id', assignedIds);
    }

    const { data } = await query;
    _creatorRequests = data || [];
    updateNotifBell();
  } catch(e) { console.error('loadCreatorRequests:', e); }
}

// ── Notif Bell ──
function updateNotifBell() {
  const unreadKolReq = Object.values(_kolRequestsMap).flat().filter(r => !r.is_read).length;
  const unreadCreReq = _creatorRequests.filter(r => !r.is_read).length;
  const total = unreadKolReq + unreadCreReq;

  const badge = document.getElementById('gmv-notif-badge');
  const bell  = document.getElementById('gmv-notif-btn');
  if (!badge || !bell) return;

  if (total > 0) {
    badge.textContent = total > 99 ? '99+' : total;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function toggleGmvNotif() {
  const dd = document.getElementById('gmv-notif-dd');
  if (!dd) return;
  const isOpen = dd.style.display === 'block';
  dd.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) renderNotifDropdown();
}

function renderNotifDropdown() {
  const dd = document.getElementById('gmv-notif-dd');
  if (!dd) return;

  const unreadReq = Object.values(_kolRequestsMap).flat().filter(r => !r.is_read);
  const unreadCre = _creatorRequests.filter(r => !r.is_read);

  const fmtTime = ts => {
    const diff = Date.now() - new Date(ts);
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Baru saja';
    if (m < 60) return `${m} mnt lalu`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} jam lalu`;
    return new Date(ts).toLocaleDateString('id-ID', { day:'2-digit', month:'short' });
  };

  const reqItems = unreadReq.slice(0, 5).map(r => `
    <div class="gmv-notif-item" onclick="openKolRequestModal('${r.kol_id}','${esc(r.kol_name||'')}')">
      <div class="gmv-notif-dot"></div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:600;">💬 ${esc(r.kol_name || 'KOL')}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(r.catatan)}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px;">${esc(r.advertiser_name||'')} · ${fmtTime(r.created_at)}</div>
      </div>
    </div>`).join('');

  const creItems = unreadCre.slice(0, 5).map(r => `
    <div class="gmv-notif-item" onclick="navigate('request_creator')">
      <div class="gmv-notif-dot" style="background:#f59e0b;"></div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:600;">📩 Request: @${esc(r.tiktok_username)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🏪 ${esc(r.toko_name||'—')}${r.produk_name ? ' · 📦 '+esc(r.produk_name) : ''}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px;">${esc(r.advertiser_name||'')} · ${fmtTime(r.created_at)}</div>
      </div>
    </div>`).join('');

  const empty = !reqItems && !creItems
    ? `<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px;">Tidak ada notifikasi baru</div>`
    : '';

  dd.innerHTML = `
    <div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
      <span style="font-weight:700;font-size:13px;">Notifikasi GMV</span>
      <button onclick="markAllGmvRead()" style="background:none;border:none;color:var(--accent);font-size:11px;cursor:pointer;font-weight:600;">Tandai semua dibaca</button>
    </div>
    <div style="max-height:320px;overflow-y:auto;">
      ${reqItems || ''}
      ${creItems || ''}
      ${empty}
    </div>
    ${(unreadReq.length > 5 || unreadCre.length > 5) ? `<div style="padding:10px;text-align:center;border-top:1px solid var(--border);"><button onclick="navigate('request_creator')" style="background:none;border:none;color:var(--accent);font-size:12px;cursor:pointer;font-weight:600;">Lihat semua →</button></div>` : ''}
  `;
}

async function markAllGmvRead() {
  try {
    await Promise.all([
      _sb.from('kol_requests').update({ is_read: true }).eq('is_read', false),
      _sb.from('creator_requests').update({ is_read: true }).eq('is_read', false),
    ]);
    await Promise.all([loadKolRequests(), loadCreatorRequests()]);
    renderNotifDropdown();
  } catch(e) { console.error(e); }
}

// ── Modal Catatan per KOL ──
let _activeReqKolId   = null;
let _activeReqKolName = null;

function openKolRequestModal(kolId, kolName) {
  _activeReqKolId   = kolId;
  _activeReqKolName = kolName;

  // Tutup notif dropdown
  const dd = document.getElementById('gmv-notif-dd');
  if (dd) dd.style.display = 'none';

  // Set nama
  document.getElementById('kreq-modal-name').textContent = kolName || 'KOL';

  // Render list
  renderKolRequestList(kolId);

  // Buka modal
  document.getElementById('modal-kreq').classList.add('active');

  // Mark as read
  markKolRequestsRead(kolId);
}

function closeKolRequestModal() {
  document.getElementById('modal-kreq').classList.remove('active');
}

function renderKolRequestList(kolId) {
  const list = document.getElementById('kreq-list');
  const requests = _kolRequestsMap[kolId] || [];

  if (!requests.length) {
    list.innerHTML = `<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px;">Belum ada catatan dari advertiser</div>`;
    return;
  }

  const fmtDate = ts => new Date(ts).toLocaleDateString('id-ID', {
    day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
  });

  list.innerHTML = requests.map(r => `
    <div style="background:var(--bg3);border-radius:10px;padding:12px 14px;border:1px solid var(--border);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:12px;font-weight:700;color:var(--accent);">${esc(r.advertiser_name || 'Advertiser')}</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:10px;color:var(--muted);">${fmtDate(r.created_at)}</span>
          ${r.status === 'done'
            ? `<span style="background:var(--green);color:#fff;font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;">Deal Kembali ✓</span>`
            : `<button onclick="markKolRequestDone('${r.id}')" style="background:var(--accent);color:#fff;border:none;border-radius:8px;padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer;">Deal Kembali</button>`
          }
        </div>
      </div>
      <div style="font-size:13px;color:var(--text);">${esc(r.catatan)}</div>
    </div>
  `).join('');
}

async function markKolRequestDone(reqId) {
  try {
    await _sb.from('kol_requests').update({ status: 'done' }).eq('id', reqId);
    // Update in-memory
    Object.values(_kolRequestsMap).flat().forEach(r => {
      if (r.id === reqId) r.status = 'done';
    });
    renderKolRequestList(_activeReqKolId);
    toast('Ditandai: Deal Kembali ✓', 'success');
  } catch(e) {
    toast('Gagal update', 'error');
  }
}

async function markKolRequestsRead(kolId) {
  try {
    const unread = (_kolRequestsMap[kolId] || []).filter(r => !r.is_read);
    if (!unread.length) return;
    await _sb.from('kol_requests').update({ is_read: true }).eq('kol_id', kolId).eq('is_read', false);
    unread.forEach(r => r.is_read = true);
    updateNotifBell();
  } catch(e) {}
}

// ── Request Creator Page ──
function initRequestCreator() {
  renderCreatorRequestsTable();
}

function renderCreatorRequestsTable() {
  const wrap = document.getElementById('page-request-creator-body');
  if (!wrap) return;

  const fil = document.getElementById('creq-fil-status')?.value || '';
  const rows = _creatorRequests.filter(r => !fil || (r.status || 'pending') === fil);

  if (!rows.length) {
    wrap.innerHTML = `<div style="text-align:center;padding:60px;color:var(--muted);">
      <div style="font-size:40px;margin-bottom:12px;">📩</div>
      <div style="font-size:15px;font-weight:600;">Belum ada request creator</div>
    </div>`;
    return;
  }

  const fmtDate = ts => new Date(ts).toLocaleDateString('id-ID', {
    day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
  });

  const statusCfg = {
    pending:  { label:'Pending',  style:'background:#fef3c7;color:#b45309;' },
    done:     { label:'Done',     style:'background:#dcfce7;color:#15803d;' },
    rejected: { label:'Rejected', style:'background:#fef2f2;color:#dc2626;' },
  };

  wrap.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:var(--bg3);">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--muted);font-weight:600;">Tanggal</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--muted);font-weight:600;">Username TikTok</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--muted);font-weight:600;">Toko</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--muted);font-weight:600;">Produk</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--muted);font-weight:600;">Catatan</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--muted);font-weight:600;">Advertiser</th>
          <th style="padding:10px 12px;text-align:center;font-size:12px;color:var(--muted);font-weight:600;">Status</th>
          <th style="padding:10px 12px;text-align:center;font-size:12px;color:var(--muted);font-weight:600;">Aksi</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => {
          const cfg = statusCfg[r.status || 'pending'];
          return `<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:10px 12px;color:var(--muted);white-space:nowrap;font-size:12px;">${fmtDate(r.created_at)}</td>
            <td style="padding:10px 12px;">
              <a href="https://tiktok.com/@${esc(r.tiktok_username.replace('@',''))}" target="_blank"
                style="color:var(--accent2);font-weight:700;text-decoration:none;">
                @${esc(r.tiktok_username.replace('@',''))}
              </a>
            </td>
            <td style="padding:10px 12px;font-weight:600;font-size:12px;">${esc(r.toko_name||'—')}</td>
            <td style="padding:10px 12px;font-size:12px;color:var(--text2);">${esc(r.produk_name||'—')}</td>
            <td style="padding:10px 12px;max-width:220px;color:var(--text2);">${esc(r.catatan||'—')}</td>
            <td style="padding:10px 12px;font-weight:600;font-size:12px;">${esc(r.advertiser_name||'—')}</td>
            <td style="padding:10px 12px;text-align:center;">
              <span style="${cfg.style}padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;">${cfg.label}</span>
            </td>
            <td style="padding:10px 12px;text-align:center;">
              ${r.status !== 'done' ? `
                <button onclick="updateCreatorRequestStatus('${r.id}','done')" class="btn btn-primary btn-sm">✓ Proses</button>
              ` : ''}
              ${r.status !== 'rejected' ? `
                <button onclick="updateCreatorRequestStatus('${r.id}','rejected')" class="btn btn-outline btn-sm" style="color:var(--red);border-color:rgba(239,68,68,.3);">✗ Tolak</button>
              ` : ''}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;

  // Mark semua sebagai read
  const unread = _creatorRequests.filter(r => !r.is_read);
  if (unread.length) {
    _sb.from('creator_requests').update({ is_read: true }).eq('is_read', false).then(() => {
      _creatorRequests.forEach(r => r.is_read = true);
      updateNotifBell();
    });
  }
}

async function updateCreatorRequestStatus(id, status) {
  try {
    await _sb.from('creator_requests').update({ status }).eq('id', id);
    const r = _creatorRequests.find(x => x.id === id);
    if (r) r.status = status;
    renderCreatorRequestsTable();
    toast(`Request di${status === 'done' ? 'proses' : 'tolak'}`, 'success');
  } catch(e) {
    toast('Gagal update status', 'error');
  }
}

// ── Close notif dropdown on outside click ──
document.addEventListener('click', e => {
  const dd  = document.getElementById('gmv-notif-dd');
  const btn = document.getElementById('gmv-notif-btn');
  if (dd && dd.style.display === 'block' && !dd.contains(e.target) && !btn?.contains(e.target)) {
    dd.style.display = 'none';
  }
});
