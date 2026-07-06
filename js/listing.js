// ===== LISTING KOL (Post-Deal Tracking) =====

let listingCache = {}; // { kolId: listingRecord }

async function initListing() {
  await loadListingData();
  populateMonthFilter();
  renderListingPage();
}

function populateMonthFilter() {
  const sel = document.getElementById('listingFilterBulan');
  if (!sel) return;

  const dealKols = DB.kols.filter(k => k.status === 'deal' && k.kolType !== 'affiliator');
  const monthSet = new Set();

  dealKols.forEach(k => {
    const date = k.updatedAt || k.createdAt;
    if (!date) return;
    const d = new Date(date);
    monthSet.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  });

  // Sort desc (terbaru dulu)
  const months = [...monthSet].sort((a,b) => b.localeCompare(a));

  const names = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const current = sel.value;

  sel.innerHTML = `<option value="">📅 Semua Bulan</option>` +
    months.map(m => {
      const [y, mo] = m.split('-');
      const label = `${names[parseInt(mo)-1]} ${y}`;
      return `<option value="${m}" ${current===m?'selected':''}>${label}</option>`;
    }).join('');
}

async function loadListingData() {
  try {
    const { data: { user } } = await _sb.auth.getUser();
    const { data, error } = await _sb
      .from('kol_listing')
      .select('*')
      .eq('user_id', user.id);
    if (error) throw error;
    listingCache = {};
    (data || []).forEach(row => { listingCache[row.kol_id] = row; });
  } catch(e) {
    if (e.message?.includes('does not exist')) {
      toast('Tabel kol_listing belum dibuat. Hubungi admin untuk setup SQL.', 'error', 6000);
    } else {
      console.error('Listing load error:', e);
    }
  }
}

function renderListingPage() {
  const filterBulan = document.getElementById('listingFilterBulan')?.value || '';
  const q           = (document.getElementById('listingSearch')?.value || '').toLowerCase();

  let dealKols = DB.kols.filter(k => k.status === 'deal' && k.kolType !== 'affiliator');

  // Filter bulan berdasarkan updatedAt KOL
  if (filterBulan) {
    dealKols = dealKols.filter(k => {
      const date = k.updatedAt || k.createdAt;
      if (!date) return false;
      const d = new Date(date);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      return key === filterBulan;
    });
  }

  // Filter search
  if (q) {
    dealKols = dealKols.filter(k =>
      k.name.toLowerCase().includes(q) || (k.tiktok||'').toLowerCase().includes(q)
    );
  }

  // Update subtitle info
  const names = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const subtitle = document.getElementById('listingSubtitle');
  if (subtitle) {
    if (filterBulan) {
      const [y, mo] = filterBulan.split('-');
      subtitle.textContent = `${names[parseInt(mo)-1]} ${y} — ${dealKols.length} KOL deal`;
    } else {
      subtitle.textContent = 'Tracking payment, pengiriman barang & konten';
    }
  }

  // Hitung total endors dari ratecard listing / QC / kol
  let totalEndors = 0;
  dealKols.forEach(k => {
    const rec = listingCache[k.id] || {};
    const qcRec = (typeof qcCache !== 'undefined') ? qcCache[k.id] : null;
    const rc = rec.ratecard > 0 ? rec.ratecard
             : (qcRec?.rekomendasiRatecard > 0 ? qcRec.rekomendasiRatecard : (k.ratecard || 0));
    totalEndors += rc;
  });

  const sudahBayar   = dealKols.filter(k => listingCache[k.id]?.payment).length;
  const sudahUploadTT = dealKols.filter(k => listingCache[k.id]?.upload_tt).length;
  const selesai      = dealKols.filter(k => {
    const r = listingCache[k.id];
    return r && r.payment && r.upload_tt && r.upload_drive;
  }).length;

  const statsEl = document.getElementById('listingStats');
  if (statsEl) statsEl.innerHTML = `
    <div class="stat-card s-deal">
      <div class="stat-icon">${icon('check-circle',22)}</div>
      <div class="stat-label">Total KOL Deal</div>
      <div class="stat-num">${dealKols.length}</div>
      <div class="stat-sub">Status deal aktif</div>
    </div>
    <div class="stat-card s-total">
      <div class="stat-icon">${icon('trending-up',22)}</div>
      <div class="stat-label">Total Endors</div>
      <div class="stat-num" style="font-size:18px;">Rp${totalEndors.toLocaleString('id-ID')}</div>
      <div class="stat-sub">Total budget endorsement</div>
    </div>
    <div class="stat-card s-replied">
      <div class="stat-icon">${icon('credit-card',22)}</div>
      <div class="stat-label">Sudah Bayar</div>
      <div class="stat-num">${sudahBayar}</div>
      <div class="stat-sub">dari ${dealKols.length} KOL</div>
    </div>
    <div class="stat-card s-contacted">
      <div class="stat-icon">${icon('video',22)}</div>
      <div class="stat-label">Sudah Upload TT</div>
      <div class="stat-num">${sudahUploadTT}</div>
      <div class="stat-sub">konten live di TikTok</div>
    </div>
  `;

  renderListingTable(dealKols);
}

function renderListingTable(dealKols) {
  if (!dealKols) dealKols = DB.kols.filter(k => k.status === 'deal' && k.kolType !== 'affiliator');

  const wrap = document.getElementById('listingTableWrap');
  if (!wrap) return;

  if (!dealKols.length) {
    wrap.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--muted);">
        <div style="font-size:48px;margin-bottom:12px;">🤝</div>
        <div style="font-size:15px;font-weight:600;margin-bottom:6px;">Belum ada KOL berstatus Deal</div>
        <div style="font-size:13px;">Ubah status KOL ke "Deal ✓" di Outreach Pipeline</div>
      </div>`;
    return;
  }

  const rows = dealKols.map((k, i) => {
    const rec  = listingCache[k.id] || {};
    const qcRec = (typeof qcCache !== 'undefined') ? qcCache[k.id] : null;
    const ratecard = rec.ratecard > 0 ? rec.ratecard
                   : (qcRec?.rekomendasiRatecard > 0 ? qcRec.rekomendasiRatecard : (k.ratecard || 0));

    const chkCell = (field, label) => `
      <td style="text-align:center;padding:8px 6px;">
        <label class="listing-chk" title="${label}">
          <input type="checkbox" ${rec[field] ? 'checked' : ''}
            onchange="toggleListing('${k.id}','${field}',this.checked)">
          <span class="listing-chk-box"></span>
        </label>
      </td>`;

    const waLink = k.wa
      ? `<a href="https://wa.me/${k.wa.replace(/\D/g,'')}" target="_blank" style="color:var(--green);font-size:12px;text-decoration:none;">📱 ${esc(k.wa)}</a>`
      : `<span style="color:var(--muted);font-size:12px;">-</span>`;

    const ttLink = k.tiktok
      ? `<a href="https://tiktok.com/@${k.tiktok.replace('@','')}" target="_blank" style="color:var(--accent2);font-size:12px;text-decoration:none;">🎵 ${esc(k.tiktok)}</a>`
      : `<span style="color:var(--muted);font-size:12px;">-</span>`;

    // Progress bar mini (berapa checklist yang sudah done)
    const fields = ['payment','kirim_barang','barang_sampai','draft_video','upload_tt','upload_drive'];
    const doneCnt = fields.filter(f => rec[f]).length;
    const pct = Math.round(doneCnt / fields.length * 100);
    const barColor = pct === 100 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--accent)';

    const tokoVal   = esc(rec.toko   || '');
    const produkVal = esc(rec.produk || '');

    return `
    <tr id="listing-row-${k.id}">
      <td style="text-align:center;color:var(--muted);font-size:13px;padding:8px;">${i+1}</td>
      <td style="padding:8px;">
        <input class="listing-input" type="number" value="${ratecard||''}" placeholder="0"
          onchange="updateListingRatecard('${k.id}',this.value)" style="width:90px;">
      </td>
      <td style="padding:8px;min-width:120px;">
        ${tokoVal
          ? `<div style="font-weight:600;font-size:12px;color:var(--accent2);">${tokoVal}</div>`
          : `<span style="color:var(--muted);font-size:11px;">—</span>`}
        ${produkVal
          ? `<div style="font-size:11px;color:var(--text2);margin-top:2px;">${produkVal}</div>`
          : ''}
      </td>
      <td style="padding:8px;">
        <div style="font-weight:600;font-size:13px;">${esc(k.name)}</div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">${esc(k.niche||'')}</div>
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="flex:1;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:${barColor};border-radius:2px;transition:width .3s;"></div>
          </div>
          <span style="font-size:10px;color:var(--muted);flex-shrink:0;">${doneCnt}/6</span>
        </div>
      </td>
      <td style="padding:8px;">${waLink}</td>
      <td style="padding:8px;">${ttLink}</td>
      ${chkCell('payment','Payment')}
      ${chkCell('kirim_barang','Kirim Barang')}
      ${chkCell('barang_sampai','Barang Sampai')}
      ${chkCell('draft_video','Kirim Draft Video')}
      ${chkCell('upload_tt','Upload TikTok')}
      ${chkCell('upload_drive','Upload Drive')}
      <td style="padding:8px;">
        <input class="listing-input" type="text" value="${esc(rec.catatan||'')}" placeholder="Catatan..."
          onchange="updateListingField('${k.id}','catatan',this.value)" style="width:130px;">
      </td>
      <td style="padding:8px;">
        <input class="listing-input" type="text" value="${esc(rec.link_video||'')}" placeholder="Link TikTok..."
          onchange="saveLinkVideo('${k.id}',this.value)" style="width:150px;"
          title="${esc(rec.link_video||'')}">
      </td>
      <td style="padding:8px;">
        <input class="listing-input" type="text" value="${esc(rec.kode_boost||'')}" placeholder="Kode boost..."
          onchange="updateListingField('${k.id}','kode_boost',this.value)" style="width:130px;">
      </td>
      <td style="padding:8px;text-align:center;">
        ${evalBadge(rec, k.id)}
      </td>
      <td style="padding:8px;text-align:center;">
        <button class="btn btn-danger btn-sm" onclick="removeFromListing('${k.id}','${esc(k.name)}')" title="Hapus dari listing">${icon('trash-2',13)}</button>
      </td>
    </tr>`;
  }).join('');

  // Hitung total endors untuk footer
  let totalEndors = 0;
  dealKols.forEach(k => {
    const rec = listingCache[k.id] || {};
    const qcRec = (typeof qcCache !== 'undefined') ? qcCache[k.id] : null;
    const rc = rec.ratecard > 0 ? rec.ratecard
             : (qcRec?.rekomendasiRatecard > 0 ? qcRec.rekomendasiRatecard : (k.ratecard || 0));
    totalEndors += rc;
  });

  wrap.innerHTML = `
    <div class="table-wrap" style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:var(--bg3);">
            <th style="padding:10px 8px;text-align:center;white-space:nowrap;font-size:12px;color:var(--muted);font-weight:600;">No</th>
            <th style="padding:10px 8px;text-align:left;white-space:nowrap;font-size:12px;color:var(--muted);font-weight:600;">Ratecard</th>
            <th style="padding:10px 8px;text-align:left;white-space:nowrap;font-size:12px;color:var(--muted);font-weight:600;">Toko / Produk</th>
            <th style="padding:10px 8px;text-align:left;white-space:nowrap;font-size:12px;color:var(--muted);font-weight:600;">Nama</th>
            <th style="padding:10px 8px;text-align:left;white-space:nowrap;font-size:12px;color:var(--muted);font-weight:600;">Nomer WA</th>
            <th style="padding:10px 8px;text-align:left;white-space:nowrap;font-size:12px;color:var(--muted);font-weight:600;">Username TikTok</th>
            <th style="padding:10px 8px;text-align:center;white-space:nowrap;font-size:12px;color:var(--muted);font-weight:600;">💳<br>Payment</th>
            <th style="padding:10px 8px;text-align:center;white-space:nowrap;font-size:12px;color:var(--muted);font-weight:600;">📦<br>Kirim Brg</th>
            <th style="padding:10px 8px;text-align:center;white-space:nowrap;font-size:12px;color:var(--muted);font-weight:600;">🏠<br>Brg Sampai</th>
            <th style="padding:10px 8px;text-align:center;white-space:nowrap;font-size:12px;color:var(--muted);font-weight:600;">🎬<br>Draft Video</th>
            <th style="padding:10px 8px;text-align:center;white-space:nowrap;font-size:12px;color:var(--muted);font-weight:600;">🎵<br>Upload TT</th>
            <th style="padding:10px 8px;text-align:center;white-space:nowrap;font-size:12px;color:var(--muted);font-weight:600;">☁️<br>Upload Drive</th>
            <th style="padding:10px 8px;text-align:left;white-space:nowrap;font-size:12px;color:var(--muted);font-weight:600;">Catatan</th>
            <th style="padding:10px 8px;text-align:left;white-space:nowrap;font-size:12px;color:var(--muted);font-weight:600;">🎵 Link Video</th>
            <th style="padding:10px 8px;text-align:left;white-space:nowrap;font-size:12px;color:var(--muted);font-weight:600;">Kode Boost Ads</th>
            <th style="padding:10px 8px;text-align:center;white-space:nowrap;font-size:12px;color:var(--muted);font-weight:600;">${icon('star',12)} Evaluasi</th>
            <th style="padding:10px 8px;text-align:center;white-space:nowrap;font-size:12px;color:var(--muted);font-weight:600;">Hapus</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="background:var(--bg3);border-top:2px solid var(--border);">
            <td colspan="1" style="padding:10px 8px;font-size:12px;color:var(--muted);font-weight:600;">TOTAL</td>
            <td style="padding:10px 8px;font-weight:700;color:var(--accent);">Rp${totalEndors.toLocaleString('id-ID')}</td>
            <td colspan="13"></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

// ===== EVAL BADGE HELPER =====
function evalBadge(rec, kolId) {
  const map = { bagus: ['✅','var(--green)','rgba(16,185,129,.12)'], cukup: ['⚡','var(--yellow)','rgba(245,158,11,.12)'], kurang: ['❌','var(--red)','rgba(239,68,68,.12)'] };
  if (rec?.eval_result && map[rec.eval_result]) {
    const [emoji, color, bg] = map[rec.eval_result];
    return `<button onclick="openEvalModal('${kolId}')" style="border:none;background:${bg};color:${color};border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;">${emoji} ${rec.eval_result.charAt(0).toUpperCase()+rec.eval_result.slice(1)}</button>`;
  }
  return `<button class="btn btn-outline btn-sm" onclick="openEvalModal('${kolId}')" style="font-size:11px;">${icon('star',12)} Evaluasi</button>`;
}

// ===== AKSI =====

async function toggleListing(kolId, field, value) {
  await upsertListing(kolId, { [field]: value });
  renderListingPage();
}

async function saveLinkVideo(kolId, value) {
  const url = value.trim();
  const existing = listingCache[kolId] || {};
  // Set upload_date hanya kalau baru pertama kali diisi
  const updates = { link_video: url };
  if (url && !existing.upload_date) {
    updates.upload_date = new Date().toISOString();
  }
  if (!url) updates.upload_date = null;
  await upsertListing(kolId, updates);
}

async function updateListingRatecard(kolId, value) {
  await upsertListing(kolId, { ratecard: parseFloat(value) || 0 });
  renderListingPage();
}

async function updateListingField(kolId, field, value) {
  await upsertListing(kolId, { [field]: value });
}

async function removeFromListing(kolId, kolName) {
  if (!confirm(`Hapus "${kolName}" dari Listing?\n\nStatus KOL akan dikembalikan ke "Replied" dan bisa di-QC ulang.`)) return;
  try {
    const { data: { user } } = await _sb.auth.getUser();

    // Hapus record dari kol_listing
    const { error } = await _sb.from('kol_listing').delete()
      .eq('kol_id', kolId).eq('user_id', user.id);
    if (error) throw error;

    // Hapus dari cache
    delete listingCache[kolId];

    // Kembalikan status KOL ke "replied"
    DB.updateStatus(kolId, 'replied', 'Dikembalikan dari Listing — perlu QC ulang');

    toast(`${kolName} dihapus dari Listing. Status kembali ke "Replied".`, 'success', 5000);
    populateMonthFilter();
    renderListingPage();
  } catch(e) {
    toast('Gagal hapus: ' + e.message, 'error');
  }
}

async function upsertListing(kolId, updates) {
  try {
    const { data: { user } } = await _sb.auth.getUser();
    const existing = listingCache[kolId] || {};

    // Auto-fill ratecard dari QC / kol jika record baru
    if (!existing.id && updates.ratecard === undefined) {
      const qcRec = (typeof qcCache !== 'undefined') ? qcCache[kolId] : null;
      const kol   = DB.kols.find(k => k.id === kolId);
      updates.ratecard = (qcRec?.rekomendasiRatecard > 0 ? qcRec.rekomendasiRatecard : (kol?.ratecard || 0));
    }

    const record = {
      ...existing,
      ...updates,
      id:         existing.id || uid(),
      kol_id:     kolId,
      user_id:    user.id,
      updated_at: new Date().toISOString(),
    };
    if (!existing.id) record.created_at = new Date().toISOString();

    // Optimistic update
    listingCache[kolId] = record;

    const { error } = await _sb.from('kol_listing').upsert(record);
    if (error) throw error;
  } catch(e) {
    toast('Gagal simpan: ' + e.message, 'error');
  }
}

async function exportListingCSV() {
  const filterBulan = document.getElementById('listingFilterBulan')?.value || '';
  let dealKols = DB.kols.filter(k => k.status === 'deal' && k.kolType !== 'affiliator');
  if (filterBulan) {
    dealKols = dealKols.filter(k => {
      const date = k.updatedAt || k.createdAt;
      if (!date) return false;
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === filterBulan;
    });
  }
  if (!dealKols.length) { toast('Belum ada KOL deal!', 'error'); return; }

  const header = ['No','Ratecard','Toko','Produk','Nama','WA','TikTok','Payment','Kirim Barang','Barang Sampai','Draft Video','Upload TT','Upload Drive','Catatan','Kode Boost'];
  const rows = dealKols.map((k, i) => {
    const rec   = listingCache[k.id] || {};
    const qcRec = (typeof qcCache !== 'undefined') ? qcCache[k.id] : null;
    const rc    = rec.ratecard > 0 ? rec.ratecard
                : (qcRec?.rekomendasiRatecard > 0 ? qcRec.rekomendasiRatecard : (k.ratecard || 0));
    return [
      i+1, rc, rec.toko||'', rec.produk||'', k.name, k.wa||'', k.tiktok||'',
      rec.payment     ? '✅' : '❌',
      rec.kirim_barang? '✅' : '❌',
      rec.barang_sampai?'✅' : '❌',
      rec.draft_video ? '✅' : '❌',
      rec.upload_tt   ? '✅' : '❌',
      rec.upload_drive? '✅' : '❌',
      rec.catatan||'', rec.kode_boost||''
    ];
  });

  const csv = [header, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(','))
    .join('\n');

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `listing-kol-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast('Export CSV berhasil!', 'success');
}
