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
            <button class="btn btn-primary btn-sm" onclick="openQCModal('${k.id}')">🔍 Mulai QC</button>
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
              <button class="btn btn-outline btn-sm" onclick="openQCModal('${k.id}')">✏️ Edit</button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }
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
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Mengambil data...'; }

  const headers = { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost };

  try {
    let videos = [];

    if (apiHost.includes('tiktok-scraper7')) {
      if (btn) btn.textContent = '⏳ Mengambil video...';
      const postsRes = await fetch(
        `https://${apiHost}/user/posts?unique_id=${encodeURIComponent(username)}&count=20&cursor=0`,
        { headers }
      );
      if (!postsRes.ok) throw new Error(`HTTP ${postsRes.status}`);
      const postsJson = await postsRes.json();
      if (postsJson?.code !== 0) throw new Error(`API: ${postsJson?.msg || 'error'}`);
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
      toast(`Tidak ada video ditemukan untuk @${username}`, 'error');
      return;
    }

    // Filter: exclude pinned/sematkan + repost + ads, sort terbaru dulu
    const ownVideos = videos
      .filter(vid => {
        // Skip video yang disematkan (pinned)
        if (vid?.is_top === 1 || vid?.isTop === 1 || vid?.isPinnedItem) return false;
        // Skip repost (author beda)
        const authorId = vid?.author?.uniqueId || vid?.authorMeta?.name || '';
        if (authorId && authorId.toLowerCase() !== username.toLowerCase()) return false;
        // Skip ads
        if (vid?.is_ads || vid?.isAds) return false;
        return true;
      })
      .sort((a, b) => (b?.createTime || b?.create_time || 0) - (a?.createTime || a?.create_time || 0));

    const top7 = (ownVideos.length >= 4 ? ownVideos : videos).slice(0, 7);

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
    toast('Gagal fetch TikTok: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔄 Auto-Fetch Views'; }
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

  // CPM Indicator
  let indicator = '';
  if (cpm > 0) {
    if      (cpm < 10000) indicator = 'Sangat Bagus';
    else if (cpm < 20000) indicator = 'Bagus';
    else if (cpm < 30000) indicator = 'Perlu Dipertimbangkan';
    else if (cpm < 50000) indicator = 'Buruk';
    else                  indicator = 'Sangat Buruk';
  }

  // Rekomendasi & harga ideal (target CPM 20.000)
  const rekomendasiRatecard = avgViews > 0 ? Math.round(avgViews * 20000 / 1000) : 0;
  let rekomendasi = '';
  if (cpm > 0) {
    if      (cpm < 20000) rekomendasi = '✅ YES – Lanjut Kontrak';
    else if (cpm < 30000) rekomendasi = `⚠️ Bisa Nego – Coba tawar ke Rp ${rekomendasiRatecard.toLocaleString('id-ID')}`;
    else if (cpm < 50000) rekomendasi = `❌ NO – Kemahalan. Rekomendasi Nego ke Rp ${rekomendasiRatecard.toLocaleString('id-ID')}`;
    else                  rekomendasi = `❌ NO – Sangat Kemahalan. Ratecard ideal: Rp ${rekomendasiRatecard.toLocaleString('id-ID')}`;
  }

  // Update UI hasil
  const tvEl  = document.getElementById('qcTotalViews');
  const avgEl = document.getElementById('qcAvgViews');
  const cpmEl = document.getElementById('qcCPM');
  if (tvEl)  tvEl.textContent  = totalViews ? totalViews.toLocaleString('id-ID') : '-';
  if (avgEl) avgEl.textContent = avgViews   ? Math.round(avgViews).toLocaleString('id-ID') : '-';
  if (cpmEl) {
    cpmEl.textContent = cpm ? `Rp ${Math.round(cpm).toLocaleString('id-ID')}` : '-';
    cpmEl.style.color = cpm < 20000 && cpm > 0 ? 'var(--green)' : cpm < 30000 && cpm > 0 ? 'var(--yellow)' : cpm > 0 ? 'var(--red)' : 'var(--text)';
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
          <div style="font-size:15px;font-weight:700;color:${color};margin-bottom:${rekomendasiRatecard && !isYes ? '8px' : '0'};">${rekomendasi}</div>
          ${rekomendasiRatecard && !isYes ? `
            <div style="font-size:12px;color:var(--muted);">
              Ratecard ideal <span style="color:var(--muted);">(target CPM Rp 20.000)</span>:
              <strong style="color:${color};font-size:13px;"> Rp ${rekomendasiRatecard.toLocaleString('id-ID')}/video</strong>
            </div>
          ` : ''}
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
