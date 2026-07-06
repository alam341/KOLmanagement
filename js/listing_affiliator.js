// ===== LISTING AFFILIATOR =====

let affiliatorListingCache = {}; // { kolId: listingRecord }

async function initListingAffiliate() {
  await loadAffiliatorListingData();
  populateAffiliatorMonthFilter();
  renderAffiliatorListingPage();
}

async function loadAffiliatorListingData() {
  try {
    const { data: { user } } = await _sb.auth.getUser();
    const { data, error } = await _sb
      .from('kol_listing')
      .select('*')
      .eq('user_id', user.id);
    if (error) throw error;
    affiliatorListingCache = {};
    (data || []).forEach(row => { affiliatorListingCache[row.kol_id] = row; });
  } catch(e) {
    if (e.message?.includes('does not exist')) {
      toast('Tabel kol_listing belum dibuat. Hubungi admin untuk setup SQL.', 'error', 6000);
    } else {
      console.error('Affiliator listing load error:', e);
    }
  }
}

function populateAffiliatorMonthFilter() {
  const sel = document.getElementById('affiliatorFilterBulan');
  if (!sel) return;

  const kols = DB.kols.filter(k => k.status === 'deal' && k.kolType === 'affiliator');
  const monthSet = new Set();
  kols.forEach(k => {
    const date = k.updatedAt || k.createdAt;
    if (!date) return;
    const d = new Date(date);
    monthSet.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  });

  const months = [...monthSet].sort((a,b) => b.localeCompare(a));
  const names  = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const current = sel.value;

  sel.innerHTML = `<option value="">📅 Semua Bulan</option>` +
    months.map(m => {
      const [y, mo] = m.split('-');
      return `<option value="${m}" ${current===m?'selected':''}>${names[parseInt(mo)-1]} ${y}</option>`;
    }).join('');
}

function renderAffiliatorListingPage() {
  const filterBulan = document.getElementById('affiliatorFilterBulan')?.value || '';
  const q           = (document.getElementById('affiliatorSearch')?.value || '').toLowerCase();

  let kols = DB.kols.filter(k => k.status === 'deal' && k.kolType === 'affiliator');

  if (filterBulan) {
    kols = kols.filter(k => {
      const date = k.updatedAt || k.createdAt;
      if (!date) return false;
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === filterBulan;
    });
  }

  if (q) {
    kols = kols.filter(k => k.name.toLowerCase().includes(q) || (k.tiktok||'').toLowerCase().includes(q));
  }

  // Subtitle
  const names    = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const subtitle = document.getElementById('affiliatorSubtitle');
  if (subtitle) {
    if (filterBulan) {
      const [y, mo] = filterBulan.split('-');
      subtitle.textContent = `${names[parseInt(mo)-1]} ${y} — ${kols.length} affiliator deal`;
    } else {
      subtitle.textContent = 'Tracking pengiriman barang & konten affiliator';
    }
  }

  // Stats
  const sudahUpload = kols.filter(k => affiliatorListingCache[k.id]?.upload_tt).length;
  const selesai     = kols.filter(k => {
    const r = affiliatorListingCache[k.id];
    return r && r.kirim_barang && r.barang_sampai && r.upload_tt;
  }).length;

  const statsEl = document.getElementById('affiliatorStats');
  if (statsEl) statsEl.innerHTML = `
    <div class="stat-card s-deal">
      <div class="stat-icon">${icon('users',22)}</div>
      <div class="stat-label">Total Affiliator Deal</div>
      <div class="stat-num">${kols.length}</div>
      <div class="stat-sub">Status deal aktif</div>
    </div>
    <div class="stat-card s-contacted">
      <div class="stat-icon">${icon('package',22)}</div>
      <div class="stat-label">Barang Dikirim</div>
      <div class="stat-num">${kols.filter(k => affiliatorListingCache[k.id]?.kirim_barang).length}</div>
      <div class="stat-sub">dari ${kols.length} affiliator</div>
    </div>
    <div class="stat-card s-contacted">
      <div class="stat-icon">${icon('video',22)}</div>
      <div class="stat-label">Sudah Upload TT</div>
      <div class="stat-num">${sudahUpload}</div>
      <div class="stat-sub">konten live di TikTok</div>
    </div>
    <div class="stat-card s-replied">
      <div class="stat-icon">${icon('check-circle',22)}</div>
      <div class="stat-label">Selesai</div>
      <div class="stat-num">${selesai}</div>
      <div class="stat-sub">semua checklist done</div>
    </div>
  `;

  renderAffiliatorTable(kols);
}

function renderAffiliatorTable(kols) {
  const wrap = document.getElementById('affiliatorTableWrap');
  if (!wrap) return;

  if (!kols.length) {
    wrap.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--muted);">
        <div style="margin-bottom:12px;opacity:.4;">${icon('users',48)}</div>
        <div style="font-size:15px;font-weight:600;margin-bottom:6px;">Belum ada Affiliator Deal</div>
        <div style="font-size:13px;">Klik tombol <strong>Affiliator</strong> di Database KOL untuk menandai affiliator</div>
      </div>`;
    return;
  }

  const rows = kols.map((k, i) => {
    const rec = affiliatorListingCache[k.id] || {};

    const chkCell = (field, label) => `
      <td style="text-align:center;padding:8px 6px;">
        <label class="listing-chk" title="${label}">
          <input type="checkbox" ${rec[field] ? 'checked' : ''}
            onchange="toggleAffiliatorListing('${k.id}','${field}',this.checked)">
          <span class="listing-chk-box"></span>
        </label>
      </td>`;

    const waLink = k.wa
      ? `<a href="https://wa.me/${k.wa.replace(/\D/g,'')}" target="_blank" style="color:var(--green);font-size:12px;text-decoration:none;display:flex;align-items:center;gap:4px;">${icon('phone',12)} ${esc(k.wa)}</a>`
      : `<span style="color:var(--muted);font-size:12px;">-</span>`;

    const ttLink = k.tiktok
      ? `<a href="https://tiktok.com/@${k.tiktok.replace('@','')}" target="_blank" style="color:var(--accent2);font-size:12px;text-decoration:none;display:flex;align-items:center;gap:4px;">${icon('music',12)} ${esc(k.tiktok)}</a>`
      : `<span style="color:var(--muted);font-size:12px;">-</span>`;

    // Progress (5 checklist: kirim_barang, barang_sampai, draft_video, upload_tt, upload_drive)
    const fields  = ['kirim_barang','barang_sampai','draft_video','upload_tt','upload_drive'];
    const doneCnt = fields.filter(f => rec[f]).length;
    const pct     = Math.round(doneCnt / fields.length * 100);
    const barColor = pct === 100 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--accent)';

    return `
    <tr id="affiliator-row-${k.id}">
      <td style="text-align:center;color:var(--muted);font-size:13px;padding:8px;">${i+1}</td>
      <td style="padding:8px;">
        <div style="font-weight:600;font-size:13px;">${esc(k.name)}</div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">${esc(k.niche||'')}</div>
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="flex:1;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:${barColor};border-radius:2px;transition:width .3s;"></div>
          </div>
          <span style="font-size:10px;color:var(--muted);flex-shrink:0;">${doneCnt}/5</span>
        </div>
      </td>
      <td style="padding:8px;">${waLink}</td>
      <td style="padding:8px;">${ttLink}</td>
      ${chkCell('kirim_barang','Kirim Barang')}
      ${chkCell('barang_sampai','Barang Sampai')}
      ${chkCell('draft_video','Kirim Draft Video')}
      ${chkCell('upload_tt','Upload TikTok')}
      ${chkCell('upload_drive','Upload Drive')}
      <td style="padding:8px;">
        <input class="listing-input" type="text" value="${esc(rec.catatan||'')}" placeholder="Link konten..."
          onchange="updateAffiliatorField('${k.id}','catatan',this.value)" style="width:170px;">
      </td>
      <td style="padding:8px;">
        <input class="listing-input" type="text" value="${esc(rec.kode_boost||'')}" placeholder="Kode boost..."
          onchange="updateAffiliatorField('${k.id}','kode_boost',this.value)" style="width:130px;">
      </td>
      <td style="padding:8px;text-align:center;">
        ${evalBadge(rec, k.id)}
      </td>
      <td style="padding:8px;text-align:center;">
        <button class="btn btn-danger btn-sm" onclick="removeAffiliatorFromListing('${k.id}','${esc(k.name)}')" title="Hapus dari listing">${icon('trash-2',13)}</button>
      </td>
    </tr>`;
  }).join('');

  wrap.innerHTML = `
    <div class="table-wrap" style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:var(--bg3);">
            <th style="padding:10px 8px;text-align:center;font-size:12px;color:var(--muted);font-weight:600;white-space:nowrap;">No</th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:var(--muted);font-weight:600;white-space:nowrap;">Nama</th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:var(--muted);font-weight:600;white-space:nowrap;">Nomer WA</th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:var(--muted);font-weight:600;white-space:nowrap;">Username TikTok</th>
            <th style="padding:10px 8px;text-align:center;font-size:12px;color:var(--muted);font-weight:600;white-space:nowrap;">${icon('package',13)}<br>Kirim Brg</th>
            <th style="padding:10px 8px;text-align:center;font-size:12px;color:var(--muted);font-weight:600;white-space:nowrap;">${icon('truck',13)}<br>Brg Sampai</th>
            <th style="padding:10px 8px;text-align:center;font-size:12px;color:var(--muted);font-weight:600;white-space:nowrap;">${icon('video',13)}<br>Draft Video</th>
            <th style="padding:10px 8px;text-align:center;font-size:12px;color:var(--muted);font-weight:600;white-space:nowrap;">${icon('music',13)}<br>Upload TT</th>
            <th style="padding:10px 8px;text-align:center;font-size:12px;color:var(--muted);font-weight:600;white-space:nowrap;">${icon('cloud-upload',13)}<br>Upload Drive</th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:var(--muted);font-weight:600;white-space:nowrap;">Catatan / Link Konten</th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:var(--muted);font-weight:600;white-space:nowrap;">Kode Boost Ads</th>
            <th style="padding:10px 8px;text-align:center;font-size:12px;color:var(--muted);font-weight:600;white-space:nowrap;">${icon('star',12)} Evaluasi</th>
            <th style="padding:10px 8px;text-align:center;font-size:12px;color:var(--muted);font-weight:600;white-space:nowrap;">Hapus</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="background:var(--bg3);border-top:2px solid var(--border);">
            <td style="padding:10px 8px;font-size:12px;color:var(--muted);font-weight:600;">TOTAL</td>
            <td style="padding:10px 8px;font-weight:700;color:var(--accent);">${kols.length} Affiliator</td>
            <td colspan="11"></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

// ===== AKSI =====

async function toggleAffiliatorListing(kolId, field, value) {
  await upsertAffiliatorListing(kolId, { [field]: value });
  renderAffiliatorListingPage();
}

async function updateAffiliatorField(kolId, field, value) {
  await upsertAffiliatorListing(kolId, { [field]: value });
}

async function upsertAffiliatorListing(kolId, updates) {
  try {
    const { data: { user } } = await _sb.auth.getUser();
    const existing = affiliatorListingCache[kolId] || {};

    const record = {
      ...existing,
      ...updates,
      id:         existing.id || uid(),
      kol_id:     kolId,
      user_id:    user.id,
      updated_at: new Date().toISOString(),
    };
    if (!existing.id) record.created_at = new Date().toISOString();

    affiliatorListingCache[kolId] = record;

    const { error } = await _sb.from('kol_listing').upsert(record);
    if (error) throw error;
  } catch(e) {
    toast('Gagal simpan: ' + e.message, 'error');
  }
}

async function removeAffiliatorFromListing(kolId, kolName) {
  if (!confirm(`Hapus "${kolName}" dari Listing Affiliator?\n\nStatus KOL akan dikembalikan ke "Replied".`)) return;
  try {
    const { data: { user } } = await _sb.auth.getUser();

    const { error } = await _sb.from('kol_listing').delete()
      .eq('kol_id', kolId).eq('user_id', user.id);
    if (error) throw error;

    delete affiliatorListingCache[kolId];

    // Reset status ke replied, tapi tetap affiliator type
    DB.updateStatus(kolId, 'replied', 'Dikembalikan dari Listing Affiliator');

    toast(`${kolName} dihapus dari Listing Affiliator.`, 'success', 5000);
    populateAffiliatorMonthFilter();
    renderAffiliatorListingPage();
  } catch(e) {
    toast('Gagal hapus: ' + e.message, 'error');
  }
}

async function exportAffiliatorCSV() {
  const filterBulan = document.getElementById('affiliatorFilterBulan')?.value || '';
  let kols = DB.kols.filter(k => k.status === 'deal' && k.kolType === 'affiliator');
  if (filterBulan) {
    kols = kols.filter(k => {
      const date = k.updatedAt || k.createdAt;
      if (!date) return false;
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === filterBulan;
    });
  }
  if (!kols.length) { toast('Belum ada affiliator deal!', 'error'); return; }

  const header = ['No','Nama','WA','TikTok','Kirim Barang','Barang Sampai','Draft Video','Upload TT','Upload Drive','Catatan','Kode Boost'];
  const rows = kols.map((k, i) => {
    const rec = affiliatorListingCache[k.id] || {};
    return [
      i+1, k.name, k.wa||'', k.tiktok||'',
      rec.kirim_barang  ? '✅' : '❌',
      rec.barang_sampai ? '✅' : '❌',
      rec.draft_video   ? '✅' : '❌',
      rec.upload_tt     ? '✅' : '❌',
      rec.upload_drive  ? '✅' : '❌',
      rec.catatan||'', rec.kode_boost||''
    ];
  });

  const csv = [header, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(','))
    .join('\n');

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `listing-affiliator-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast('Export CSV berhasil!', 'success');
}
