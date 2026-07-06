// ===== CONTENT PERFORMANCE PAGE =====

let cpViewsLog    = {}; // { videoId: [{ day_number, views, fetched_at }] }
let cpChart       = null;
let cpModalVideoId = null;

const CP_FETCH_DAYS = [1,2,3,4,5,6,7,14,21,28];
const CP_DAY_LABELS = {
  1:'D1', 2:'D2', 3:'D3', 4:'D4', 5:'D5', 6:'D6', 7:'D7',
  14:'W2', 21:'W3', 28:'W4'
};

async function initContentPerformance() {
  if (typeof listingCache !== 'undefined' && Object.keys(listingCache).length === 0) {
    await loadListingData();
  }
  if (typeof kolVideosCache !== 'undefined' && Object.keys(kolVideosCache).length === 0) {
    await loadKolVideos();
  }
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
      const key = row.video_id || ('kol:' + row.kol_id);
      if (!cpViewsLog[key]) cpViewsLog[key] = [];
      cpViewsLog[key].push(row);
    });
  } catch(e) {
    console.error('CP load error:', e);
  }
}

function renderCPFilters() {
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

  const produkSel = document.getElementById('cpFilterProduk');
  if (produkSel) {
    const produkList = filterToko
      ? DB.produkList.filter(p => { const t = DB.tokoList.find(t => t.name === filterToko); return t && p.toko_id === t.id; })
      : DB.produkList;
    const currentProduk = produkSel.value;
    produkSel.innerHTML = '<option value="">📦 Semua Produk</option>' +
      produkList.map(p => `<option value="${esc(p.name)}" ${currentProduk===p.name?'selected':''}>${esc(p.name)}</option>`).join('');
  }

  // Kumpulkan semua video dari kolVideosCache
  const allVideos = [];
  if (typeof kolVideosCache !== 'undefined') {
    Object.values(kolVideosCache).forEach(vids => vids.forEach(v => allVideos.push(v)));
  }

  let videos = allVideos.filter(v => {
    const k   = DB.kols.find(x => x.id === v.kol_id);
    const rec = (typeof listingCache !== 'undefined') ? listingCache[v.kol_id] : null;
    if (filterToko   && rec?.toko   !== filterToko)   return false;
    if (filterProduk && rec?.produk !== filterProduk) return false;
    if (q && !( (k?.name||'').toLowerCase().includes(q) ||
                (k?.tiktok||'').toLowerCase().includes(q) ||
                (v.judul||'').toLowerCase().includes(q) )) return false;
    return true;
  });

  const total      = videos.length;
  const aktif      = videos.filter(v => v.upload_date && calcDayNumber(v.upload_date) <= 28).length;
  const selesai    = total - aktif;
  const totalFetch = Object.values(cpViewsLog).reduce((s, arr) => s + arr.length, 0);

  const statsEl = document.getElementById('cpStats');
  if (statsEl) statsEl.innerHTML = `
    <div class="stat-card s-total">
      <div class="stat-icon">🎬</div>
      <div class="stat-label">Total Konten</div>
      <div class="stat-num">${total}</div>
      <div class="stat-sub">video terdaftar</div>
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

  if (!videos.length) {
    wrap.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--muted);grid-column:1/-1;">
        <div style="font-size:48px;margin-bottom:12px;">📊</div>
        <div style="font-size:15px;font-weight:600;margin-bottom:6px;">Belum ada konten yang dilacak</div>
        <div style="font-size:13px;">Tambah video di Listing KOL → tombol 📹 Video</div>
      </div>`;
    return;
  }

  wrap.innerHTML = videos.map(v => cpCard(v)).join('');
  requestAnimationFrame(() => videos.forEach(v => renderMiniChart(v.id)));
}

function cpCard(v) {
  const k        = DB.kols.find(x => x.id === v.kol_id) || {};
  const rec      = (typeof listingCache !== 'undefined') ? listingCache[v.kol_id] : {};
  const logs     = cpViewsLog[v.id] || [];
  const dayNum   = v.upload_date ? calcDayNumber(v.upload_date) : null;
  const isActive = dayNum !== null && dayNum <= 28;

  const lastLog     = logs[logs.length - 1];
  const latestViews = lastLog?.views || 0;
  const nextDay     = CP_FETCH_DAYS.find(d => d > (lastLog?.day_number || 0));
  const nextLabel   = nextDay ? CP_DAY_LABELS[nextDay] : 'Selesai';

  const statusBg    = isActive ? 'rgba(6,182,212,.12)' : 'rgba(71,85,105,.15)';
  const statusColor = isActive ? 'var(--accent2)' : 'var(--muted)';
  const statusText  = isActive ? `Hari ke-${dayNum}` : (dayNum ? 'Tracking selesai' : 'Belum ada tgl upload');

  return `
    <div class="cp-card" onclick="openCPModal('${v.id}')">
      <div style="display:flex;align-items:start;justify-content:space-between;margin-bottom:10px;">
        <div>
          <div style="font-weight:700;font-size:14px;">${esc(k.name||'?')}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">🎵 ${esc(k.tiktok||'-')}</div>
          ${v.judul ? `<div style="font-size:11px;color:var(--accent2);margin-top:2px;font-style:italic;">${esc(v.judul)}</div>` : ''}
        </div>
        <span style="background:${statusBg};color:${statusColor};font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;white-space:nowrap;">${statusText}</span>
      </div>

      ${rec?.toko ? `<div style="font-size:11px;color:var(--muted);margin-bottom:8px;">🏪 ${esc(rec.toko)} · 📦 ${esc(rec.produk||'-')}</div>` : ''}

      <canvas id="miniChart_${v.id}" height="60" style="width:100%;margin-bottom:10px;"></canvas>

      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
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

function renderMiniChart(videoId) {
  const canvas = document.getElementById(`miniChart_${videoId}`);
  if (!canvas) return;

  const logs = cpViewsLog[videoId] || [];
  if (!logs.length) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--muted') || '#64748b';
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
async function openCPModal(videoId) {
  cpModalVideoId = videoId;

  let video = null;
  for (const vids of Object.values(kolVideosCache || {})) {
    video = vids.find(v => v.id === videoId);
    if (video) break;
  }
  if (!video) return;

  const k   = DB.kols.find(x => x.id === video.kol_id) || {};
  const rec = (typeof listingCache !== 'undefined') ? listingCache[video.kol_id] : {};

  document.getElementById('cpModalName').textContent    = k.name || '?';
  document.getElementById('cpModalTiktok').textContent  = k.tiktok || '-';
  document.getElementById('cpModalToko').textContent    = rec?.toko   || '-';
  document.getElementById('cpModalProduk').textContent  = rec?.produk || '-';
  document.getElementById('cpModalUpload').textContent  = video.upload_date
    ? new Date(video.upload_date).toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' })
    : '-';
  const judulEl = document.getElementById('cpModalJudul');
  if (judulEl) judulEl.textContent = video.judul || '-';

  renderCPModalChart(videoId);
  renderCPModalTable(videoId);
  openModal('modalCP');
}

function renderCPModalChart(videoId) {
  const canvas = document.getElementById('cpModalChart');
  if (!canvas || !window.Chart) return;

  if (cpChart) { cpChart.destroy(); cpChart = null; }

  const logs   = cpViewsLog[videoId] || [];
  const labels = CP_FETCH_DAYS.map(d => CP_DAY_LABELS[d]);
  const data   = CP_FETCH_DAYS.map(d => {
    const log = logs.find(l => l.day_number === d);
    return log ? log.views : null;
  });

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

function renderCPModalTable(videoId) {
  const logs  = cpViewsLog[videoId] || [];
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
  if (!cpModalVideoId) return;

  let video = null;
  for (const vids of Object.values(kolVideosCache || {})) {
    video = vids.find(v => v.id === cpModalVideoId);
    if (video) break;
  }
  if (!video?.link_video) { toast('Data video tidak ditemukan', 'error'); return; }

  const apiKey  = localStorage.getItem('kol_rapidapi_key');
  const apiHost = localStorage.getItem('kol_rapidapi_host') || 'tiktok-scraper7.p.rapidapi.com';
  if (!apiKey) { toast('RapidAPI Key belum diisi di Pengaturan', 'error'); return; }

  const uploadDate = video.upload_date || new Date().toISOString().split('T')[0];

  const btn = document.getElementById('btnFetchNow');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Mengambil views...'; }

  try {
    const dayNum  = calcDayNumber(uploadDate);
    const already = (cpViewsLog[cpModalVideoId] || []).find(l => l.day_number === dayNum);
    if (already) {
      toast(`Hari ke-${dayNum} sudah difetch (${Number(already.views).toLocaleString('id-ID')} views)`, 'success', 4000);
      return;
    }
    if (dayNum > 28) { toast('Sudah melewati 28 hari tracking', 'error'); return; }

    const k = DB.kols.find(x => x.id === video.kol_id);
    const tiktokUsername = (k?.tiktok || '').replace('@', '').trim();

    const params = new URLSearchParams({ videoUrl: video.link_video, uploadDate, videoId: cpModalVideoId });
    if (tiktokUsername) params.set('username', tiktokUsername);

    const res = await fetch(`${window.location.origin}/api/fetch-single?${params}`, {
      headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': apiHost }
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal fetch views');

    const { data: { user } } = await _sb.auth.getUser();
    const { error } = await _sb.from('kol_views_log').insert({
      kol_id:     video.kol_id,
      video_id:   cpModalVideoId,
      user_id:    user.id,
      views:      json.views,
      day_number: json.dayNumber,
      fetched_at: new Date().toISOString(),
    });
    if (error) throw new Error('Gagal simpan ke database: ' + error.message);

    toast(`✓ Views hari ke-${json.dayNumber}: ${Number(json.views).toLocaleString('id-ID')}`, 'success', 4000);

    await loadViewsLog();
    renderCPModalChart(cpModalVideoId);
    renderCPModalTable(cpModalVideoId);
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
