// ===== QC KOL PAGE =====

let activeQCKolId = null;
let qcCache = {}; // { kolId: qcRecord }

async function initQC() {
  await loadQCData();
  renderQCPage();
}

async function loadQCData() {
  try {
    const { data: { user } } = await _sb.auth.getUser();
    const { data, error } = await _sb
      .from('kol_qc')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    qcCache = {};
    (data || []).forEach(row => {
      qcCache[row.kol_id] = {
        id: row.id,
        kolId: row.kol_id,
        ratecard: row.ratecard,
        views: [row.view1||0, row.view2||0, row.view3||0, row.view4||0, row.view5||0, row.view6||0, row.view7||0],
        totalViews: row.total_views,
        avgViews: row.avg_views,
        cpm: row.cpm,
        cpmIndicator: row.cpm_indicator,
        rekomendasi: row.rekomendasi,
        rekomendasiRatecard: row.rekomendasi_ratecard,
        createdAt: row.created_at,
      };
    });
  } catch(e) {
    if (e.message && e.message.includes('does not exist')) {
      toast('Tabel kol_qc belum dibuat. Hubungi admin untuk setup Supabase.', 'error', 5000);
    } else {
      console.error('QC load error:', e);
    }
  }
}

function renderQCPage() {
  const allKols = DB.kols;
  const eligible = allKols.filter(k => k.status === 'contacted' && !qcCache[k.id]);
  const done     = allKols.filter(k => !!qcCache[k.id]);
  const lanjut   = done.filter(k => (qcCache[k.id]?.rekomendasi || '').startsWith('✅'));
  const tolak    = done.filter(k => (qcCache[k.id]?.rekomendasi || '').startsWith('❌'));

  // Stats
  const statsEl = document.getElementById('qcStats');
  if (statsEl) statsEl.innerHTML = `
    <div class="stat-card s-total">
      <div class="stat-icon">⏳</div>
      <div class="stat-label">Siap di-QC</div>
      <div class="stat-num">${eligible.length}</div>
      <div class="stat-sub">Status dihubungi</div>
    </div>
    <div class="stat-card s-replied">
      <div class="stat-icon">📋</div>
      <div class="stat-label">Sudah QC</div>
      <div class="stat-num">${done.length}</div>
    </div>
    <div class="stat-card s-deal">
      <div class="stat-icon">✅</div>
      <div class="stat-label">Lanjut Kontrak</div>
      <div class="stat-num">${lanjut.length}</div>
    </div>
    <div class="stat-card s-rejected">
      <div class="stat-icon">❌</div>
      <div class="stat-label">Tidak Lanjut</div>
      <div class="stat-num">${tolak.length}</div>
    </div>
  `;

  renderQCTable();
}

function renderQCTable() {
  const q          = (document.getElementById('qcSearch')?.value || '').toLowerCase();
  const filterRek  = document.getElementById('qcFilterRek')?.value || '';
  const allKols    = DB.kols;

  // Eligible: contacted, belum QC
  const eligible = allKols.filter(k => {
    const match = !q || [k.name, k.tiktok].join(' ').toLowerCase().includes(q);
    return match && k.status === 'contacted' && !qcCache[k.id];
  });

  // Done: sudah QC
  const done = allKols.filter(k => {
    if (!qcCache[k.id]) return false;
    const match = !q || [k.name, k.tiktok].join(' ').toLowerCase().includes(q);
    if (!match) return false;
    if (filterRek) {
      const rek = qcCache[k.id].rekomendasi || '';
      if (!rek.startsWith(filterRek)) return false;
    }
    return true;
  });

  // Render eligible
  const eligibleEl = document.getElementById('qcEligibleBody');
  if (eligibleEl) {
    if (!eligible.length) {
      eligibleEl.innerHTML = '<tr class="empty-row"><td colspan="5" style="text-align:center;color:var(--muted);padding:32px;">Tidak ada KOL dengan status "Dihubungi" yang belum di-QC.</td></tr>';
    } else {
      eligibleEl.innerHTML = eligible.map(k => `
        <tr>
          <td>
            <div style="font-weight:600;font-size:13px;">${esc(k.name)}</div>
            ${k.tiktok ? `<div style="font-size:11px;color:var(--muted);">🎵 ${esc(k.tiktok)}</div>` : ''}
          </td>
          <td>${tierBadge(k.tier)}<div style="font-size:12px;margin-top:4px;">${esc(k.followers||'-')}</div></td>
          <td>
            ${k.ratecard ? `<strong style="color:var(--accent2);">Rp ${Number(k.ratecard).toLocaleString('id-ID')}</strong>` : `<span style="color:var(--muted);font-size:12px;">Belum diisi</span>`}
          </td>
          <td>${statusBadge(k.status)}</td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="openQCModal('${k.id}')">${icon('microscope',13)} Mulai QC</button>
          </td>
        </tr>
      `).join('');
    }
  }

  // Render done
  const doneEl = document.getElementById('qcDoneBody');
  if (doneEl) {
    if (!done.length) {
      doneEl.innerHTML = '<tr class="empty-row"><td colspan="7" style="text-align:center;color:var(--muted);padding:32px;">Belum ada QC yang selesai.</td></tr>';
    } else {
      doneEl.innerHTML = done.map(k => {
        const qc = qcCache[k.id];
        return `
          <tr>
            <td>
              <div style="font-weight:600;font-size:13px;">${esc(k.name)}</div>
              ${k.tiktok ? `<div style="font-size:11px;color:var(--muted);">🎵 ${esc(k.tiktok)}</div>` : ''}
            </td>
            <td><strong style="color:var(--accent2);">Rp ${Number(qc.ratecard||0).toLocaleString('id-ID')}</strong></td>
            <td style="font-weight:600;">${qc.avgViews ? Math.round(qc.avgViews).toLocaleString('id-ID') : '-'}</td>
            <td><strong>Rp ${Math.round(qc.cpm||0).toLocaleString('id-ID')}</strong></td>
            <td>${cpmBadge(qc.cpmIndicator)}</td>
            <td style="font-size:12px;line-height:1.5;max-width:200px;">${esc(qc.rekomendasi||'-')}</td>
            <td>
              <div style="display:flex;gap:5px;flex-wrap:wrap;">
                <button class="btn btn-outline btn-sm" onclick="openQCModal('${k.id}')">${icon('pencil',13)} Edit</button>
                ${k.status === 'deal'
                  ? `<span class="badge" style="background:rgba(16,185,129,.15);color:var(--green);padding:5px 10px;display:inline-flex;align-items:center;gap:4px;">${icon('check',12)} Deal</span>`
                  : `<button class="btn btn-deal btn-sm" onclick="markDealFromQC('${k.id}')">${icon('check-circle',13)} Tandai Deal</button>`
                }
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }
}

// ===== TANDAI DEAL DARI QC =====
let _dealKolId = null;

function markDealFromQC(kolId) {
  openDealModal(kolId);
}

function openDealModal(kolId) {
  const k = DB.kols.find(x => x.id === kolId);
  if (!k) return;
  _dealKolId = kolId;

  document.getElementById('dealKolName').textContent = k.name;

  // Populate Toko dropdown (value = toko.id)
  const tokoSel  = document.getElementById('dealToko');
  const tokoList = DB.tokoList;
  if (!tokoList.length) {
    tokoSel.innerHTML = '<option value="">— Belum ada toko (isi di Pengaturan) —</option>';
  } else {
    tokoSel.innerHTML = '<option value="">— Pilih Toko —</option>' +
      tokoList.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  }

  // Reset produk (kosong dulu, diisi setelah toko dipilih)
  const produkSel = document.getElementById('dealProduk');
  produkSel.innerHTML = '<option value="">— Pilih toko dulu —</option>';
  produkSel.disabled = true;

  openModal('modalDeal');
}

function filterDealProduk() {
  const tokoId    = document.getElementById('dealToko').value;
  const produkSel = document.getElementById('dealProduk');

  if (!tokoId) {
    produkSel.innerHTML  = '<option value="">— Pilih toko dulu —</option>';
    produkSel.disabled   = true;
    return;
  }

  const produkList = DB.produkByToko(tokoId);
  produkSel.disabled = false;

  if (!produkList.length) {
    produkSel.innerHTML = '<option value="">— Belum ada produk untuk toko ini —</option>';
  } else {
    produkSel.innerHTML = '<option value="">— Pilih Produk —</option>' +
      produkList.map(p => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join('');
  }
}

async function confirmDeal() {
  if (!_dealKolId) return;

  const tokoId = document.getElementById('dealToko').value;
  const toko   = DB.tokoList.find(t => t.id === tokoId)?.name || '';
  const produk = document.getElementById('dealProduk').value.trim();

  if (!toko)   { toast('Pilih toko terlebih dahulu!', 'error'); return; }
  if (!produk) { toast('Pilih produk terlebih dahulu!', 'error'); return; }

  const k = DB.kols.find(x => x.id === _dealKolId);
  if (!k) return;

  // Pastikan tipe = kol (bukan affiliator)
  const idx = DB.kols.findIndex(x => x.id === _dealKolId);
  if (idx >= 0) DB.kols[idx].kolType = 'kol';
  _sb.from('kols').update({ kol_type: 'kol' }).eq('id', _dealKolId).then(() => {});

  // Update status ke deal
  DB.updateStatus(_dealKolId, 'deal', `Deal dikonfirmasi dari QC — Toko: ${toko}, Produk: ${produk}`);

  // Simpan toko & produk ke kol_listing
  try {
    const { data: { user } } = await _sb.auth.getUser();
    const existing = (typeof listingCache !== 'undefined') ? (listingCache[_dealKolId] || {}) : {};
    const qcRec    = qcCache[_dealKolId];
    const kolRec   = DB.kols.find(x => x.id === _dealKolId);

    const ratecard = existing.ratecard > 0 ? existing.ratecard
      : (qcRec?.rekomendasiRatecard > 0 ? qcRec.rekomendasiRatecard : (kolRec?.ratecard || 0));

    const record = {
      ...existing,
      id:         existing.id || uid(),
      kol_id:     _dealKolId,
      user_id:    user.id,
      toko,
      produk,
      ratecard,
      updated_at: new Date().toISOString(),
    };
    if (!existing.id) record.created_at = new Date().toISOString();

    if (typeof listingCache !== 'undefined') listingCache[_dealKolId] = record;
    await _sb.from('kol_listing').upsert(record);
  } catch(e) {
    console.error('Gagal simpan toko/produk ke listing:', e.message);
  }

  closeModal('modalDeal');
  toast(`${k.name} ditandai Deal ✓ — Toko: ${toko} · Produk: ${produk}`, 'success', 5000);
  renderQCTable();
}

// ===== CPM BADGE =====
function cpmBadge(indicator) {
  const map = {
    'Sangat Bagus':          { bg:'rgba(16,185,129,.15)', color:'var(--green)' },
    'Bagus':                 { bg:'rgba(16,185,129,.1)',  color:'var(--green)' },
    'Perlu Dipertimbangkan': { bg:'rgba(245,158,11,.15)', color:'var(--yellow)' },
    'Buruk':                 { bg:'rgba(249,115,22,.15)', color:'var(--orange)' },
    'Sangat Buruk':          { bg:'rgba(239,68,68,.15)',  color:'var(--red)' },
  };
  const s = map[indicator] || { bg:'rgba(71,85,105,.2)', color:'var(--text2)' };
  return `<span class="badge" style="background:${s.bg};color:${s.color};">${esc(indicator||'-')}</span>`;
}

// ===== MODAL QC =====
function openQCModal(kolId) {
  const k = DB.kols.find(x => x.id === kolId);
  if (!k) return;
  activeQCKolId = kolId;
  const existing = qcCache[kolId];

  // Info KOL
  document.getElementById('qcKolName').textContent      = k.name;
  document.getElementById('qcKolTiktok').textContent    = k.tiktok || '-';
  document.getElementById('qcKolFollowers').textContent = k.followers || '-';

  // Ratecard: prioritas QC existing → in-memory KOL
  const ratecardVal = existing?.ratecard > 0 ? existing.ratecard : (k.ratecard > 0 ? k.ratecard : '');
  document.getElementById('qcRatecard').value = ratecardVal;

  // Views dari QC existing
  for (let i = 1; i <= 7; i++) {
    const el = document.getElementById('qcView' + i);
    if (el) el.value = (existing?.views?.[i-1] > 0) ? existing.views[i-1] : '';
  }

  calcQC();
  openModal('modalQC');
}

// ===== AUTO-FETCH VIEWS DARI TIKTOK (RapidAPI) =====
async function autoFetchViews() {
  const k = DB.kols.find(x => x.id === activeQCKolId);
  if (!k?.tiktok) { toast('Username TikTok tidak ada di data KOL!', 'error'); return; }

  const apiKey  = localStorage.getItem('kol_rapidapi_key');
  const apiHost = localStorage.getItem('kol_rapidapi_host') || 'tiktok-scraper2.p.rapidapi.com';
  if (!apiKey) {
    toast('RapidAPI Key belum diisi. Atur di menu Pengaturan.', 'error');
    return;
  }

  const username = k.tiktok.replace('@', '').trim();
  const btn = document.getElementById('btnAutoFetch');
  if (btn) { btn.disabled = true; document.getElementById('btnAutoFetchIcon').innerHTML = icon('refresh-cw',12); btn.childNodes[btn.childNodes.length-1].textContent = ' Mengambil data...'; }

  const headers = { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost };

  try {
    let videos = [];

    if (apiHost.includes('tiktok-scraper7')) {
      if (btn) btn.childNodes[btn.childNodes.length-1].textContent = ' Mengambil video...';
      const postsRes = await fetch(
        `https://${apiHost}/user/posts?unique_id=${encodeURIComponent(username)}&count=20&cursor=0`,
        { headers }
      );
      if (!postsRes.ok) throw new Error(`HTTP ${postsRes.status}`);
      const postsJson = await postsRes.json();
      if (postsJson?.code !== 0) throw new Error(postsJson?.msg || 'user not found');
      videos = postsJson?.data?.videos || postsJson?.data?.itemList || postsJson?.data?.items || postsJson?.data?.aweme_list || [];

    } else if (apiHost.includes('tiktok-api23')) {
      const res = await fetch(`https://${apiHost}/api/user/posts?uniqueId=${encodeURIComponent(username)}&count=7`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      videos = json?.data?.itemList || json?.data?.videos || [];

    } else {
      const res = await fetch(`https://${apiHost}/user/posts?username=${encodeURIComponent(username)}&count=7&cursor=0`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      videos = json?.data?.videos || json?.data?.itemList || json?.collector || [];
    }

    if (!videos.length) {
      toast(`Akun @${username} tidak ditemukan atau belum ada video.`, 'error', 8000);
      return;
    }

    // Sort by tanggal terbaru
    const byDate = (a, b) => (b?.createTime || b?.create_time || 0) - (a?.createTime || a?.create_time || 0);

    // Filter pinned + ads
    const nonPinned = videos
      .filter(vid => {
        if (vid?.is_ads || vid?.isAds) return false;
        if (vid?.is_top === 1 || vid?.isTop === 1 || vid?.isPinnedItem) return false;
        return true;
      })
      .sort(byDate);

    // Kalau non-pinned cukup → pakai, kalau kurang → fallback sort tanggal semua video
    const top7 = (nonPinned.length >= 7 ? nonPinned : videos.filter(v => !(v?.is_ads || v?.isAds)).sort(byDate)).slice(0, 7);

    top7.forEach((vid, i) => {
      const views =
        vid?.stats?.playCount       ??
        vid?.statistics?.playCount  ??
        vid?.statsV2?.playCount     ??
        vid?.play_count             ??
        vid?.playCount              ??
        vid?.video?.play_count      ??
        0;
      const el = document.getElementById(`qcView${i + 1}`);
      if (el) el.value = views;
    });

    // Kosongkan sisa kalau video < 7
    for (let i = top7.length + 1; i <= 7; i++) {
      const el = document.getElementById(`qcView${i}`);
      if (el) el.value = '';
    }

    calcQC();
    toast(`✓ Berhasil ambil ${top7.length} video dari @${username}`, 'success');

  } catch (err) {
    const msg = err.message?.toLowerCase() || '';
    if (msg.includes('unique_id') || msg.includes('invalid') || msg.includes('not found') || msg.includes('user')) {
      toast(`Akun TikTok @${username} tidak ditemukan. Pastikan username sudah benar.`, 'error', 8000);
    } else if (msg.includes('403') || msg.includes('401')) {
      toast('API Key tidak valid atau sudah habis kuota. Cek di menu Pengaturan.', 'error', 8000);
    } else if (msg.includes('429')) {
      toast('Terlalu banyak request. Tunggu beberapa saat lalu coba lagi.', 'error', 8000);
    } else {
      toast(`Gagal mengambil data TikTok. Coba beberapa saat lagi.`, 'error', 8000);
    }
  } finally {
    if (btn) { btn.disabled = false; document.getElementById('btnAutoFetchIcon').innerHTML = icon('refresh-cw',12); btn.childNodes[btn.childNodes.length-1].textContent = ' Auto-Fetch Views'; }
  }
}

// ===== KALKULASI REALTIME =====
function calcQC() {
  const ratecard = parseFloat(document.getElementById('qcRatecard')?.value) || 0;

  const views = [];
  for (let i = 1; i <= 7; i++) {
    const v = parseFloat(document.getElementById('qcView' + i)?.value) || 0;
    if (v > 0) views.push(v);
  }

  const totalViews = views.reduce((a, b) => a + b, 0);
  const avgViews   = views.length ? totalViews / views.length : 0;
  const cpm        = (avgViews > 0 && ratecard > 0) ? (ratecard / avgViews * 1000) : 0;

  // Ambil threshold dari settings
  const s   = DB.settings;
  const t1  = s.cpmSangatBagus ?? 20000;
  const t2  = s.cpmBagus       ?? 30000;
  const t3  = s.cpmPerlu       ?? 40000;
  const t4  = s.cpmBuruk       ?? 60000;

  // CPM Indicator
  let indicator = '';
  if (cpm > 0) {
    if      (cpm < t1) indicator = 'Sangat Bagus';
    else if (cpm < t2) indicator = 'Bagus';
    else if (cpm < t3) indicator = 'Perlu Dipertimbangkan';
    else if (cpm < t4) indicator = 'Buruk';
    else               indicator = 'Sangat Buruk';
  }

  // Ratecard ideal = target CPM "Sangat Bagus" (t1)
  const rekomendasiRatecard = avgViews > 0 ? Math.round(avgViews * t1 / 1000) : 0;
  const rcFmt = rekomendasiRatecard.toLocaleString('id-ID');

  // Rekomendasi berdasarkan indikator
  let rekomendasi = '';
  if (cpm > 0) {
    if (indicator === 'Sangat Bagus') {
      rekomendasi = '✅ Lanjut Kontrak – CPM sangat efisien!';
    } else if (indicator === 'Bagus') {
      rekomendasi = '✅ Lanjut Kontrak – CPM bagus, worth it!';
    } else if (indicator === 'Perlu Dipertimbangkan') {
      rekomendasi = `⚠️ Bisa Nego – CPM masih bisa diterima jika ratecard bisa diturunkan ke Rp ${rcFmt}`;
    } else if (indicator === 'Buruk') {
      rekomendasi = `❌ Tolak – CPM buruk, terlalu mahal untuk performa ini. Idealnya ratecard Rp ${rcFmt}`;
    } else {
      rekomendasi = `❌ Tolak – CPM sangat buruk, tidak worth it sama sekali. Idealnya ratecard Rp ${rcFmt}`;
    }
  }

  // Update UI hasil
  const tvEl  = document.getElementById('qcTotalViews');
  const avgEl = document.getElementById('qcAvgViews');
  const cpmEl = document.getElementById('qcCPM');
  if (tvEl)  tvEl.textContent  = totalViews ? totalViews.toLocaleString('id-ID') : '-';
  if (avgEl) avgEl.textContent = avgViews   ? Math.round(avgViews).toLocaleString('id-ID') : '-';
  if (cpmEl) {
    cpmEl.textContent = cpm ? `Rp ${Math.round(cpm).toLocaleString('id-ID')}` : '-';
    const cpmColor = !cpm ? 'var(--text)'
      : cpm < t2 ? 'var(--green)'
      : cpm < t3 ? 'var(--yellow)'
      : 'var(--red)';
    cpmEl.style.color = cpmColor;
  }

  const indEl = document.getElementById('qcCPMIndicator');
  if (indEl) indEl.innerHTML = indicator ? cpmBadge(indicator) : '<span style="color:var(--muted);">-</span>';

  const rekEl = document.getElementById('qcRekomendasi');
  if (rekEl) {
    if (!rekomendasi) {
      rekEl.innerHTML = '<div class="qc-empty-rek">Isi ratecard dan minimal 1 views untuk melihat rekomendasi.</div>';
    } else {
      const isYes  = rekomendasi.startsWith('✅');
      const isWarn = rekomendasi.startsWith('⚠️');
      const color  = isYes ? 'var(--green)' : isWarn ? 'var(--yellow)' : 'var(--red)';
      const bg     = isYes ? 'rgba(16,185,129,.08)' : isWarn ? 'rgba(245,158,11,.08)' : 'rgba(239,68,68,.08)';
      const border = isYes ? 'rgba(16,185,129,.3)'  : isWarn ? 'rgba(245,158,11,.3)'  : 'rgba(239,68,68,.3)';
      rekEl.innerHTML = `
        <div style="background:${bg};border:1px solid ${border};border-radius:10px;padding:14px 16px;">
          <div style="font-size:15px;font-weight:700;color:${color};">${rekomendasi}</div>
          ${!isYes ? `
            <div style="font-size:11px;color:var(--muted);margin-top:6px;">
              Target CPM ideal: Rp ${t1.toLocaleString('id-ID')} (batas Sangat Bagus di Pengaturan)
            </div>` : ''}
        </div>`;
    }
  }

  // Simpan ke state untuk saveQC()
  window._qcCalc = { totalViews, avgViews, cpm, indicator, rekomendasi, rekomendasiRatecard };
}

// ===== SIMPAN QC =====
async function saveQC() {
  if (!activeQCKolId) return;
  const ratecard = parseFloat(document.getElementById('qcRatecard')?.value) || 0;
  if (!ratecard) { toast('Ratecard wajib diisi!', 'error'); return; }

  const views = [];
  for (let i = 1; i <= 7; i++) {
    views.push(parseFloat(document.getElementById('qcView' + i)?.value) || 0);
  }

  const hasilViews = views.filter(v => v > 0);
  if (!hasilViews.length) { toast('Isi minimal 1 views video!', 'error'); return; }

  const calc = window._qcCalc || {};
  const now  = new Date().toISOString();
  const { data: { user } } = await _sb.auth.getUser();

  const row = {
    id:                  qcCache[activeQCKolId]?.id || uid(),
    kol_id:              activeQCKolId,
    user_id:             user.id,
    ratecard,
    view1: views[0], view2: views[1], view3: views[2],
    view4: views[3], view5: views[4], view6: views[5], view7: views[6],
    total_views:         Math.round(calc.totalViews || 0),
    avg_views:           Math.round(calc.avgViews   || 0),
    cpm:                 Math.round(calc.cpm        || 0),
    cpm_indicator:       calc.indicator   || '',
    rekomendasi:         calc.rekomendasi || '',
    rekomendasi_ratecard: calc.rekomendasiRatecard || 0,
    created_at:          now,
  };

  const { error } = await _sb.from('kol_qc').upsert(row);
  if (error) { toast('Gagal simpan: ' + error.message, 'error'); return; }

  // Update ratecard di KOL jika berubah
  const k = DB.kols.find(x => x.id === activeQCKolId);
  if (k && k.ratecard !== ratecard) {
    k.ratecard = ratecard;
    _sb.from('kols').update({ ratecard }).eq('id', activeQCKolId)
      .then(({ error: e }) => { if (e) console.error('Ratecard sync:', e.message); });
  }

  // Update memory cache
  qcCache[activeQCKolId] = {
    id: row.id, kolId: activeQCKolId,
    ratecard, views,
    totalViews: calc.totalViews, avgViews: calc.avgViews,
    cpm: calc.cpm, cpmIndicator: calc.indicator,
    rekomendasi: calc.rekomendasi,
    rekomendasiRatecard: calc.rekomendasiRatecard,
    createdAt: now,
  };

  closeModal('modalQC');
  renderQCPage();
  toast('QC berhasil disimpan!', 'success');
}
