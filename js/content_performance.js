// ===== CONTENT PERFORMANCE PAGE =====

let cpViewsLog  = {}; // { kolId: [{ day_number, views, fetched_at }] }
let cpChart     = null;
let cpModalKolId = null;

const CP_FETCH_DAYS = [1,2,3,4,5,6,7,14,21,28];
const CP_DAY_LABELS = {
  1:'D1', 2:'D2', 3:'D3', 4:'D4', 5:'D5', 6:'D6', 7:'D7',
  14:'W2', 21:'W3', 28:'W4'
};

async function initContentPerformance() {
  await loadViewsLog();
  renderCPFilters();
  renderCPPage();
}

async function loadViewsLog() {
  try {
    const { data: { user } } = await _sb.auth.getUser();
    const { data, error } = await _sb
      .from('kol_views_log')
      .select('*')
      .eq('user_id', user.id)
      .order('day_number', { ascending: true });
    if (error) throw error;
    cpViewsLog = {};
    (data || []).forEach(row => {
      if (!cpViewsLog[row.kol_id]) cpViewsLog[row.kol_id] = [];
      cpViewsLog[row.kol_id].push(row);
    });
  } catch(e) {
    console.error('CP load error:', e);
  }
}

function renderCPFilters() {
  // Populate filter toko
  const tokoSel = document.getElementById('cpFilterToko');
  if (tokoSel) {
    tokoSel.innerHTML = '<option value="">🏪 Semua Toko</option>' +
      DB.tokoList.map(t => `<option value="${esc(t.name)}">${esc(t.name)}</option>`).join('');
  }
}

function renderCPPage() {
  const filterToko   = document.getElementById('cpFilterToko')?.value   || '';
  const filterProduk = document.getElementById('cpFilterProduk')?.value || '';
  const q            = (document.getElementById('cpSearch')?.value || '').toLowerCase();

  // Update filter produk berdasarkan toko yang dipilih
  const produkSel = document.getElementById('cpFilterProduk');
  if (produkSel) {
    const produkList = filterToko
      ? DB.produkList.filter(p => {
          const toko = DB.tokoList.find(t => t.name === filterToko);
          return toko && p.toko_id === toko.id;
        })
      : DB.produkList;
    const currentProduk = produkSel.value;
    produkSel.innerHTML = '<option value="">📦 Semua Produk</option>' +
      produkList.map(p => `<option value="${esc(p.name)}" ${currentProduk===p.name?'selected':''}>${esc(p.name)}</option>`).join('');
  }

  // Ambil KOL yang punya link_video
  let kols = DB.kols.filter(k => {
    const rec = (typeof listingCache !== 'undefined') ? listingCache[k.id] : null;
    if (!rec?.link_video || !rec?.upload_date) return false;
    if (filterToko   && rec.toko   !== filterToko)   return false;
    if (filterProduk && rec.produk !== filterProduk) return false;
    if (q && !k.name.toLowerCase().includes(q) && !(k.tiktok||'').toLowerCase().includes(q)) return false;
    return true;
  });

  // Stats
  const total     = kols.length;
  const aktif     = kols.filter(k => {
    const rec = listingCache[k.id];
    const dayNum = rec?.upload_date ? calcDayNumber(rec.upload_date) : 99;
    return dayNum <= 28;
  }).length;
  const selesai   = total - aktif;
  const totalFetch = Object.values(cpViewsLog).reduce((s, arr) => s + arr.length, 0);

  const statsEl = document.getElementById('cpStats');
  if (statsEl) statsEl.innerHTML = `
    <div class="stat-card s-total">
      <div class="stat-icon">🎬</div>
      <div class="stat-label">Total Konten</div>
      <div class="stat-num">${total}</div>
      <div class="stat-sub">punya link video</div>
    </div>
    <div class="stat-card s-deal">
      <div class="stat-icon">📡</div>
      <div class="stat-label">Sedang Dipantau</div>
      <div class="stat-num">${aktif}</div>
      <div class="stat-sub">dalam 28 hari</div>
    </div>
    <div class="stat-card s-replied">
      <div class="stat-icon">✅</div>
      <div class="stat-label">Selesai Tracking</div>
      <div class="stat-num">${selesai}</div>
      <div class="stat-sub">sudah hari ke-28</div>
    </div>
    <div class="stat-card s-contacted">
      <div class="stat-icon">📊</div>
      <div class="stat-label">Total Data Views</div>
      <div class="stat-num">${totalFetch}</div>
      <div class="stat-sub">titik data terkumpul</div>
    </div>
  `;

  const wrap = document.getElementById('cpGrid');
  if (!wrap) return;

  if (!kols.length) {
    wrap.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--muted);grid-column:1/-1;">
        <div style="font-size:48px;margin-bottom:12px;">📊</div>
        <div style="font-size:15px;font-weight:600;margin-bottom:6px;">Belum ada konten yang dilacak</div>
        <div style="font-size:13px;">Isi Link Video di Listing KOL untuk mulai tracking</div>
      </div>`;
    return;
  }

  wrap.innerHTML = kols.map(k => cpCard(k)).join('');

  // Render mini charts setelah DOM update
  requestAnimationFrame(() => {
    kols.forEach(k => renderMiniChart(k.id));
  });
}

function cpCard(k) {
  const rec      = listingCache[k.id] || {};
  const logs     = cpViewsLog[k.id]   || [];
  const dayNum   = rec.upload_date ? calcDayNumber(rec.upload_date) : null;
  const isActive = dayNum !== null && dayNum <= 28;

  // Views terakhir
  const lastLog  = logs[logs.length - 1];
  const latestViews = lastLog?.views || 0;

  // Next fetch day
  const nextDay  = CP_FETCH_DAYS.find(d => d > (lastLog?.day_number || 0));
  const nextLabel = nextDay ? CP_DAY_LABELS[nextDay] : 'Selesai';

  // Status badge
  const statusBg    = isActive ? 'rgba(6,182,212,.12)' : 'rgba(71,85,105,.15)';
  const statusColor = isActive ? 'var(--accent2)' : 'var(--muted)';
  const statusText  = isActive ? `Hari ke-${dayNum}` : 'Tracking selesai';

  return `
    <div class="cp-card" onclick="openCPModal('${k.id}')">
      <div style="display:flex;align-items:start;justify-content:space-between;margin-bottom:10px;">
        <div>
          <div style="font-weight:700;font-size:14px;">${esc(k.name)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">🎵 ${esc(k.tiktok||'-')}</div>
        </div>
        <span style="background:${statusBg};color:${statusColor};font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;white-space:nowrap;">${statusText}</span>
      </div>

      ${rec.toko ? `<div style="font-size:11px;color:var(--muted);margin-bottom:8px;">🏪 ${esc(rec.toko)} · 📦 ${esc(rec.produk||'-')}</div>` : ''}

      <canvas id="miniChart_${k.id}" height="60" style="width:100%;margin-bottom:10px;"></canvas>

      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:11px;color:var(--muted);">Views terakhir</div>
          <div style="font-size:16px;font-weight:800;color:var(--accent2);">${latestViews ? latestViews.toLocaleString('id-ID') : '—'}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:var(--muted);">Data terkumpul</div>
          <div style="font-size:14px;font-weight:700;">${logs.length} / ${CP_FETCH_DAYS.length}</div>
        </div>
        ${isActive && nextDay ? `
          <div style="text-align:right;">
            <div style="font-size:11px;color:var(--muted);">Fetch berikutnya</div>
            <div style="font-size:13px;font-weight:700;color:var(--yellow);">${nextLabel}</div>
          </div>` : ''}
      </div>
    </div>`;
}

function renderMiniChart(kolId) {
  const canvas = document.getElementById(`miniChart_${kolId}`);
  if (!canvas) return;

  const logs = cpViewsLog[kolId] || [];
  if (!logs.length) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'var(--muted)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Belum ada data views', canvas.width / 2, 30);
    return;
  }

  const labels = logs.map(l => CP_DAY_LABELS[l.day_number] || `D${l.day_number}`);
  const data   = logs.map(l => l.views);

  if (window.Chart) {
    new window.Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6,182,212,0.08)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#06b6d4',
          tension: 0.3,
          fill: true,
        }]
      },
      options: {
        responsive: false,
        plugins: { legend: { display: false }, tooltip: {
          callbacks: { label: ctx => ctx.parsed.y.toLocaleString('id-ID') + ' views' }
        }},
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#94a3b8' } },
          y: { display: false, beginAtZero: true }
        }
      }
    });
  }
}

// ===== MODAL DETAIL =====
async function openCPModal(kolId) {
  cpModalKolId = kolId;
  const k   = DB.kols.find(x => x.id === kolId);
  const rec = (typeof listingCache !== 'undefined') ? listingCache[kolId] : {};
  if (!k) return;

  document.getElementById('cpModalName').textContent    = k.name;
  document.getElementById('cpModalTiktok').textContent  = k.tiktok || '-';
  document.getElementById('cpModalToko').textContent    = rec?.toko   || '-';
  document.getElementById('cpModalProduk').textContent  = rec?.produk || '-';
  document.getElementById('cpModalUpload').textContent  = rec?.upload_date
    ? new Date(rec.upload_date).toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' })
    : '-';

  renderCPModalChart(kolId);
  renderCPModalTable(kolId);
  openModal('modalCP');
}

function renderCPModalChart(kolId) {
  const canvas = document.getElementById('cpModalChart');
  if (!canvas || !window.Chart) return;

  if (cpChart) { cpChart.destroy(); cpChart = null; }

  const logs   = cpViewsLog[kolId] || [];
  const labels = CP_FETCH_DAYS.map(d => CP_DAY_LABELS[d]);
  const data   = CP_FETCH_DAYS.map(d => {
    const log = logs.find(l => l.day_number === d);
    return log ? log.views : null;
  });

  // Garis putus setelah D7
  const borderDash = CP_FETCH_DAYS.map((d, i, arr) => d <= 7 ? [] : [5, 3]);

  cpChart = new window.Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Views',
        data,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6,182,212,0.08)',
        borderWidth: 2.5,
        pointRadius: d => d === null ? 0 : 5,
        pointBackgroundColor: CP_FETCH_DAYS.map(d => d <= 7 ? '#06b6d4' : '#a855f7'),
        tension: 0.3,
        fill: true,
        spanGaps: false,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ctx.parsed.y !== null
              ? ctx.parsed.y.toLocaleString('id-ID') + ' views'
              : 'Belum difetch'
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8', font: { size: 11 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            color: '#94a3b8', font: { size: 11 },
            callback: v => v >= 1000 ? (v/1000).toFixed(1)+'K' : v
          },
          beginAtZero: true
        }
      }
    }
  });
}

function renderCPModalTable(kolId) {
  const logs  = cpViewsLog[kolId] || [];
  const tbody = document.getElementById('cpModalTableBody');
  if (!tbody) return;

  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:24px;">Belum ada data views terkumpul</td></tr>';
    return;
  }

  tbody.innerHTML = CP_FETCH_DAYS.map(day => {
    const log = logs.find(l => l.day_number === day);
    const label = CP_DAY_LABELS[day];
    const isWeekly = day > 7;
    if (!log) {
      return `<tr style="opacity:.4;">
        <td style="padding:8px 12px;font-weight:600;">${label}</td>
        <td style="padding:8px 12px;color:var(--muted);">—</td>
        <td style="padding:8px 12px;color:var(--muted);">—</td>
        <td style="padding:8px 12px;">
          <span style="font-size:11px;color:var(--muted);background:var(--bg3);padding:2px 8px;border-radius:6px;">
            ${isWeekly ? 'Mingguan' : 'Harian'}
          </span>
        </td>
      </tr>`;
    }
    // Hitung delta dari sebelumnya
    const prevDay = CP_FETCH_DAYS[CP_FETCH_DAYS.indexOf(day) - 1];
    const prevLog = prevDay ? logs.find(l => l.day_number === prevDay) : null;
    const delta   = prevLog ? log.views - prevLog.views : null;
    const deltaHtml = delta !== null
      ? `<span style="color:${delta >= 0 ? 'var(--green)' : 'var(--red)'};">
           ${delta >= 0 ? '+' : ''}${delta.toLocaleString('id-ID')}
         </span>`
      : '—';
    const fetchDate = new Date(log.fetched_at).toLocaleDateString('id-ID', { day:'2-digit', month:'short' });
    return `<tr>
      <td style="padding:8px 12px;font-weight:700;">${label}</td>
      <td style="padding:8px 12px;font-weight:700;color:var(--accent2);">${Number(log.views).toLocaleString('id-ID')}</td>
      <td style="padding:8px 12px;">${deltaHtml}</td>
      <td style="padding:8px 12px;font-size:11px;color:var(--muted);">${fetchDate}</td>
    </tr>`;
  }).join('');
}

// ===== FETCH MANUAL =====
async function fetchViewsNow() {
  if (!cpModalKolId) return;

  const rec = (typeof listingCache !== 'undefined') ? listingCache[cpModalKolId] : null;
  if (!rec?.link_video)  { toast('Link video belum diisi di Listing KOL', 'error'); return; }
  if (!rec?.upload_date) { toast('Upload date tidak ada', 'error'); return; }

  const apiKey  = localStorage.getItem('kol_rapidapi_key');
  const apiHost = localStorage.getItem('kol_rapidapi_host') || 'tiktok-scraper7.p.rapidapi.com';
  if (!apiKey) { toast('RapidAPI Key belum diisi di Pengaturan', 'error'); return; }

  const btn = document.getElementById('btnFetchNow');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Mengambil views...'; }

  try {
    // Cek sudah difetch hari ini
    const dayNum  = calcDayNumber(rec.upload_date);
    const already = (cpViewsLog[cpModalKolId] || []).find(l => l.day_number === dayNum);
    if (already) {
      toast(`Hari ke-${dayNum} sudah difetch (${Number(already.views).toLocaleString('id-ID')} views)`, 'success', 4000);
      return;
    }

    if (dayNum > 28) { toast('Sudah melewati 28 hari tracking', 'error'); return; }

    // Panggil API untuk resolve URL + fetch views
    const params = new URLSearchParams({ videoUrl: rec.link_video, uploadDate: rec.upload_date });
    const res = await fetch(`${window.location.origin}/api/fetch-single?${params}`, {
      headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': apiHost }
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal fetch views');

    // Save ke Supabase langsung dari client (pakai auth sendiri)
    const { data: { user } } = await _sb.auth.getUser();
    const { error } = await _sb.from('kol_views_log').insert({
      kol_id:     cpModalKolId,
      user_id:    user.id,
      views:      json.views,
      day_number: json.dayNumber,
      fetched_at: new Date().toISOString(),
    });
    if (error) throw new Error('Gagal simpan ke database: ' + error.message);

    toast(`✓ Views hari ke-${json.dayNumber}: ${Number(json.views).toLocaleString('id-ID')}`, 'success', 4000);

    // Reload data & refresh
    await loadViewsLog();
    renderCPModalChart(cpModalKolId);
    renderCPModalTable(cpModalKolId);
    renderCPPage();

  } catch(e) {
    toast('Gagal: ' + e.message, 'error', 6000);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📡 Fetch Views Sekarang'; }
  }
}

// ===== HELPER =====
function calcDayNumber(uploadDate) {
  const upload = new Date(uploadDate);
  const now    = new Date();
  const diff   = Math.floor((now - upload) / (1000 * 60 * 60 * 24));
  return diff + 1;
}

function cpFilterToko() {
  renderCPPage();
}
