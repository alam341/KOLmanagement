// ===== DATABASE KOL PAGE =====
let importRows = [];
let selectedDBKOLs = new Set();

function initDatabase() {
  renderTable();
}

// ===== TABLE =====
function renderTable() {
  const q = (document.getElementById('dbSearch')?.value || '').toLowerCase();
  const sf = document.getElementById('dbFilterStatus')?.value || '';
  const pf = document.getElementById('dbFilterPlatform')?.value || '';
  const tf = document.getElementById('dbFilterTier')?.value || '';

  let kols = DB.kols.filter(k => {
    const match = !q || [k.name,k.tiktok,k.niche,k.product,k.wa,k.email].join(' ').toLowerCase().includes(q);
    return match && (!sf||k.status===sf) && (!pf||k.platform===pf) && (!tf||k.tier===tf);
  });

  const body = document.getElementById('dbTableBody');
  if (!body) return;

  if (!kols.length) {
    body.innerHTML = '<tr class="empty-row"><td colspan="9">Tidak ada data. Import dari Kalodata atau tambah manual.</td></tr>';
    updateBulkBar(); return;
  }

  body.innerHTML = kols.map(k => `
    <tr>
      <td style="padding:8px 6px;text-align:center;width:36px;">
        <input type="checkbox" data-id="${k.id}" ${selectedDBKOLs.has(k.id)?'checked':''}
          onchange="toggleDBKOL('${k.id}',this.checked)"
          style="width:15px;height:15px;accent-color:var(--accent);cursor:pointer;">
      </td>
      <td>
        <div style="font-weight:600;font-size:13px;">${esc(k.name)}</div>
        <div style="font-size:11px;color:var(--muted);">${k.note ? esc(k.note.slice(0,50))+(k.note.length>50?'…':'') : ''}</div>
      </td>
      <td>
        ${k.tiktok ? `<div style="font-size:12px;">🎵 <a href="https://www.tiktok.com/@${esc(k.tiktok.replace('@',''))}" target="_blank" style="color:var(--accent);text-decoration:none;" title="Lihat profil TikTok">${esc(k.tiktok)}</a></div>` : ''}
        ${k.wa     ? `<div style="font-size:12px;">📱 ${esc(k.wa)}</div>` : ''}
        ${k.email  ? `<div style="font-size:11px;color:var(--muted);">✉️ ${esc(k.email)}</div>` : ''}
      </td>
      <td>
        <div style="font-size:12px;font-weight:600;">${esc(k.followers||'-')}</div>
        ${tierBadge(k.tier)}
      </td>
      <td>
        <div style="font-size:12px;">${esc(k.niche||'-')}</div>
        ${k.engagementRaw ? `<div style="font-size:11px;color:var(--muted);">Eng: ${k.engagementRaw}%</div>` : ''}
      </td>
      <td>${platformLabel(k.platform)}</td>
      <td>
        <select style="background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer;" onchange="quickStatus('${k.id}',this.value)">
          ${['new','contacted','replied','deal','followup','rejected'].map(s=>`<option value="${s}"${k.status===s?' selected':''}>${{new:'Belum Hubungi',contacted:'Dihubungi',replied:'Reply',deal:'Deal ✓',followup:'Follow Up',rejected:'Rejected'}[s]}</option>`).join('')}
        </select>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:4px;">
          <div style="font-size:13px;font-weight:700;color:${(k.score||0)>=70?'var(--green)':(k.score||0)>=40?'var(--yellow)':'var(--red)'};">${k.score||0}</div>
          <div style="font-size:10px;color:var(--muted);">/100</div>
        </div>
      </td>
      <td>
        <div style="display:flex;gap:5px;">
          <button class="btn btn-primary btn-sm" onclick="openSend('${k.id}')">📤</button>
          <button class="btn btn-outline btn-sm" onclick="openKOLModal('${k.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteKOL('${k.id}')">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');

  updateBulkBar();
}

function toggleDBKOL(id, checked) {
  if (checked) selectedDBKOLs.add(id); else selectedDBKOLs.delete(id);
  updateBulkBar();
}

function toggleSelectAllDB(checked) {
  document.querySelectorAll('#dbTableBody input[type=checkbox]').forEach(cb => {
    cb.checked = checked;
    if (checked) selectedDBKOLs.add(cb.dataset.id);
    else selectedDBKOLs.delete(cb.dataset.id);
  });
  updateBulkBar();
}

function clearDBSelection() {
  selectedDBKOLs.clear();
  renderTable();
}

function updateBulkBar() {
  const bar   = document.getElementById('dbBulkBar');
  const count = document.getElementById('dbSelectedCount');
  if (bar)   bar.style.display = selectedDBKOLs.size > 0 ? 'flex' : 'none';
  if (count) count.textContent = selectedDBKOLs.size;
  const cbs  = document.querySelectorAll('#dbTableBody input[type=checkbox]');
  const allCb = document.getElementById('dbCheckAll');
  if (allCb && cbs.length) {
    const checked = [...cbs].filter(c => c.checked).length;
    allCb.checked = checked === cbs.length;
    allCb.indeterminate = checked > 0 && checked < cbs.length;
  }
}

function deleteSelectedKOLs() {
  if (!selectedDBKOLs.size) return;
  if (!confirm(`Hapus ${selectedDBKOLs.size} KOL yang dipilih?\nTindakan ini tidak bisa dibatalkan.`)) return;
  const ids = [...selectedDBKOLs];
  DB.deleteKOLs(ids);
  selectedDBKOLs.clear();
  renderTable();
  toast(`${ids.length} KOL berhasil dihapus.`, 'success');
}

function quickStatus(id, status) {
  DB.updateStatus(id, status);
  toast('Status diperbarui!', 'success');
  renderTable();
  renderDashStats && renderDashStats();
}

function deleteKOL(id) {
  if (!confirm('Hapus KOL ini?')) return;
  DB.deleteKOL(id);
  renderTable();
  toast('KOL dihapus.', 'success');
}

// ===== KOL MODAL =====
function openKOLModal(id) {
  const k = id ? DB.kols.find(x => x.id === id) : null;
  document.getElementById('kolModalTitle').textContent = k ? 'Edit KOL' : 'Tambah KOL';
  document.getElementById('kolEditId').value = id || '';

  const fields = ['kolName','kolTiktok','kolWA','kolEmail','kolIG','kolNiche','kolFollowers','kolProduct','kolNote'];
  const keys   = ['name','tiktok','wa','email','instagram','niche','followers','product','note'];
  fields.forEach((f,i) => document.getElementById(f).value = k ? (k[keys[i]]||'') : '');
  document.getElementById('kolPlatform').value = k?.platform || 'wa';
  document.getElementById('kolStatus').value   = k?.status   || 'new';
  openModal('modalKOL');
}

function saveKOL() {
  const name = document.getElementById('kolName').value.trim();
  if (!name) { toast('Nama wajib diisi!', 'error'); return; }
  const id = document.getElementById('kolEditId').value;
  const followersStr = document.getElementById('kolFollowers').value.trim();
  const followersRaw = parseFollowersRaw(followersStr);
  const data = {
    id: id || uid(),
    name,
    tiktok:    document.getElementById('kolTiktok').value.trim(),
    wa:        document.getElementById('kolWA').value.trim(),
    email:     document.getElementById('kolEmail').value.trim(),
    instagram: document.getElementById('kolIG').value.trim(),
    platform:  document.getElementById('kolPlatform').value,
    niche:     document.getElementById('kolNiche').value.trim(),
    followers: followersStr,
    followersRaw,
    product:   document.getElementById('kolProduct').value.trim(),
    status:    document.getElementById('kolStatus').value,
    note:      document.getElementById('kolNote').value.trim(),
    tier:      computeTier(followersRaw),
    score:     0,
  };
  data.score = computeScore(data);
  DB.upsertKOL(data);
  closeModal('modalKOL');
  renderTable();
  toast(id ? 'KOL diperbarui!' : 'KOL ditambahkan!', 'success');
}

// ===== SEND MODAL =====
let activeSendKOLId = null;

function openSend(id) {
  const k = DB.kols.find(x => x.id === id);
  if (!k) return;
  activeSendKOLId = id;
  document.getElementById('sendModalName').textContent = k.name;
  const tmpls = DB.templates.filter(t => t.platform === k.platform || t.platform === 'both' || k.platform === 'both');
  const tabsEl = document.getElementById('sendTemplateTabs');
  tabsEl.innerHTML = tmpls.map((t,i) =>
    `<button class="tmpl-pill ${i===0?'active':''}" onclick="selectSendTmpl(this,'${t.id}')">${esc(t.name)}</button>`
  ).join('');
  if (tmpls.length) document.getElementById('sendMsgPreview').value = fillTemplate(tmpls[0].body, k);
  document.getElementById('btnSendWA').style.display = k.platform === 'tiktok' ? 'none' : '';
  document.getElementById('btnSendTT').style.display = k.platform === 'wa' ? 'none' : '';
  openModal('modalSend');
}

function selectSendTmpl(el, tmplId) {
  document.querySelectorAll('#sendTemplateTabs .tmpl-pill').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  const tmpl = DB.templates.find(t => t.id === tmplId);
  const kol = DB.kols.find(k => k.id === activeSendKOLId);
  if (tmpl && kol) document.getElementById('sendMsgPreview').value = fillTemplate(tmpl.body, kol);
}

function copyMsg() {
  navigator.clipboard.writeText(document.getElementById('sendMsgPreview').value).then(() => toast('Pesan di-copy!', 'success'));
}

function doSendWA() {
  const k = DB.kols.find(x => x.id === activeSendKOLId);
  if (!k?.wa) { toast('Nomor WA tidak ada!', 'error'); return; }
  const msg = encodeURIComponent(document.getElementById('sendMsgPreview').value);
  window.open(`https://wa.me/${k.wa.replace(/\D/g,'')}?text=${msg}`, '_blank');
}

function doSendTT() {
  const k = DB.kols.find(x => x.id === activeSendKOLId);
  if (!k?.tiktok) { toast('Username TikTok tidak ada!', 'error'); return; }
  window.open(`https://www.tiktok.com/${k.tiktok.startsWith('@')?k.tiktok:'@'+k.tiktok}`, '_blank');
  copyMsg();
  toast('TikTok dibuka, pesan di-copy — paste di DM!', 'info');
}

function markSendContacted() {
  if (!activeSendKOLId) return;
  DB.updateStatus(activeSendKOLId, 'contacted');
  closeModal('modalSend');
  renderTable();
  toast('Status diperbarui: Dihubungi', 'success');
}

// ===== IMPORT =====
function openImport() {
  resetImport();
  openModal('modalImport');
}

function resetImport() {
  importRows = [];
  ['dbCSVFile','dbKalodataFile'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  const pa = document.getElementById('dbPasteArea'); if(pa) pa.value='';
  ['dbCSVPreview','dbKalodataPreview','dbPastePreview','dbImportSummary'].forEach(id => {
    const el = document.getElementById(id); if(el) el.innerHTML=''; if(el) el.style.display='none';
  });
  setImportBtn(false);
}

function setImportBtn(enabled) {
  const btn = document.getElementById('btnDoImport');
  if (!btn) return;
  btn.disabled = !enabled;
  btn.style.opacity = enabled ? '1' : '.5';
}

function switchImportTab(tab, el) {
  document.querySelectorAll('.import-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.import-panel').forEach(p => p.classList.remove('active'));
  const key = tab.charAt(0).toUpperCase() + tab.slice(1);
  document.getElementById('dbImportPanel'+key)?.classList.add('active');
  el.classList.add('active');
  importRows = [];
  setImportBtn(false);
}

// --- Kalodata XLSX ---
function handleKalodataFile(file) {
  if (!file) return;
  if (!window.XLSX) { toast('Library XLSX belum dimuat!', 'error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (!data.length) { toast('File kosong!', 'error'); return; }

      let headerIdx = 0;
      for (let i = 0; i < Math.min(5, data.length); i++) {
        if (data[i].some(c => String(c).includes('Nama Kreator'))) { headerIdx = i; break; }
      }
      const headers = data[headerIdx].map(h => String(h).trim());
      const col = name => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));

      const iName=col('Nama Kreator'), iHandle=col('Handle Kreator'), iFollowers=col('Pengikut'),
            iEngagement=col('Tingkat Engagement'), iViews=col('Views Konten'),
            iPendapatan=col('Pendapatan(Rp)'), iPenjualan=col('Penjualan'),
            iWA=col('whatsapp'), iEmail=col('Email'), iIG=col('Instagram');

      importRows = [];
      for (let i = headerIdx+1; i < data.length; i++) {
        const row = data[i];
        const name = String(row[iName]||'').trim();
        if (!name) continue;

        const handle       = String(row[iHandle]||'').trim();
        const followersRaw = Number(row[iFollowers]) || 0;
        const followers    = formatFollowers(followersRaw);
        const engRaw       = parseFloat(String(row[iEngagement]||'0').replace('%','')) || 0;
        const viewsRaw     = Number(row[iViews]) || 0;
        const pendapatanRaw= Number(row[iPendapatan]) || 0;
        const penjualan    = Number(row[iPenjualan]) || 0;
        const wa           = String(row[iWA]||'').trim();
        const email        = String(row[iEmail]||'').trim();
        const ig           = String(row[iIG]||'').trim();

        const noteParts = [];
        if (engRaw)         noteParts.push(`Engagement: ${engRaw}%`);
        if (viewsRaw)       noteParts.push(`Views: ${formatNumber(viewsRaw)}`);
        if (pendapatanRaw)  noteParts.push(`Pendapatan: ${formatRupiah(pendapatanRaw)}`);
        if (ig)             noteParts.push(`IG: ${ig}`);

        const kol = {
          name, followers, followersRaw,
          tiktok: handle ? '@'+handle.replace('@','') : '',
          wa: wa.replace(/\D/g,'') ? wa : '',
          email, instagram: ig,
          platform: wa.trim() ? 'both' : 'tiktok',
          niche: '', product: '',
          engagementRaw: engRaw,
          engagement: engRaw ? engRaw+'%' : '',
          viewsRaw, pendapatanRaw, penjualan,
          note: noteParts.join(' | '),
          status: 'new',
          tier: computeTier(followersRaw),
        };
        kol.score = computeScore(kol);
        importRows.push(kol);
      }
      showImportPreview('dbKalodataPreview', importRows);
    } catch(err) { toast('Gagal baca file: '+err.message, 'error'); }
  };
  reader.readAsArrayBuffer(file);
}

// --- CSV ---
function handleCSVFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    importRows = parseCSVText(e.target.result);
    showImportPreview('dbCSVPreview', importRows);
  };
  reader.readAsText(file, 'UTF-8');
}

function parseCSVText(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (i === 0 && cols[0].toLowerCase().replace(/"/g,'').trim() === 'nama') continue;
    if (!cols[0]?.trim()) continue;
    rows.push(mapCSVCols(cols));
  }
  return rows;
}

function parseCSVLine(line) {
  const result = []; let cur = '', inQ = false;
  for (const c of line) {
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  result.push(cur.trim());
  return result;
}

function mapCSVCols(cols) {
  const platRaw = (cols[3]||'').toLowerCase().trim();
  const platMap = { wa:'wa', whatsapp:'wa', tiktok:'tiktok', both:'both', keduanya:'both' };
  const followersRaw = parseFollowersRaw(cols[5]);
  const kol = {
    name: (cols[0]||'').trim(), tiktok: (cols[1]||'').trim(), wa: (cols[2]||'').trim(),
    platform: platMap[platRaw]||'wa', niche: (cols[4]||'').trim(),
    followers: (cols[5]||'').trim(), followersRaw, product: (cols[6]||'').trim(),
    note: (cols[7]||'').trim(), status: 'new', email: '', instagram: '',
    tier: computeTier(followersRaw), engagementRaw: 0, viewsRaw: 0, pendapatanRaw: 0,
  };
  kol.score = computeScore(kol);
  return kol;
}

// --- Paste ---
function parsePaste() {
  const text = document.getElementById('dbPasteArea')?.value || '';
  if (!text.trim()) { importRows = []; showImportPreview('dbPastePreview', []); return; }
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  importRows = [];
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    if (i === 0 && cols[0].toLowerCase().trim() === 'nama') continue;
    if (!cols[0]?.trim()) continue;
    importRows.push(mapCSVCols(cols));
  }
  showImportPreview('dbPastePreview', importRows);
}

function showImportPreview(containerId, rows) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = '<div style="color:var(--red);font-size:12px;margin-top:8px;">Tidak ada data valid.</div>';
    setImportBtn(false); return;
  }
  el.innerHTML = `
    <div style="font-size:12px;color:var(--muted);margin:10px 0 6px;"><strong style="color:var(--green);">${rows.length} KOL</strong> siap diimport (preview 10 pertama):</div>
    <div class="preview-wrap">
      <table><thead><tr><th>Nama</th><th>TikTok</th><th>WA</th><th>Followers</th><th>Tier</th><th>Skor</th></tr></thead>
      <tbody>${rows.slice(0,10).map(r=>`<tr>
        <td>${esc(r.name||'-')}</td><td>${esc(r.tiktok||'-')}</td><td>${esc(r.wa||'-')}</td>
        <td>${esc(r.followers||'-')}</td><td>${r.tier||'nano'}</td><td>${r.score||0}</td>
      </tr>`).join('')}
      ${rows.length>10?`<tr><td colspan="6" style="text-align:center;color:var(--muted);">... dan ${rows.length-10} lainnya</td></tr>`:''}
      </tbody></table>
    </div>`;
  setImportBtn(true);
}

function doImport() {
  if (!importRows.length) return;
  const existingNames = new Set(DB.kols.map(k => k.name.toLowerCase()));
  const toInsert = [];
  let skipped = 0;
  importRows.forEach(r => {
    if (!r.name || existingNames.has(r.name.toLowerCase())) { skipped++; return; }
    toInsert.push({ ...r, id: uid() });
    existingNames.add(r.name.toLowerCase());
  });
  if (toInsert.length) DB.insertKols(toInsert); // sync memory + async Supabase
  const sumEl = document.getElementById('dbImportSummary');
  if (sumEl) {
    sumEl.style.display = 'block';
    sumEl.innerHTML = `✓ Berhasil import <strong>${toInsert.length}</strong> KOL.${skipped?` <span style="color:var(--yellow)">${skipped} dilewati (duplikat).</span>`:''}`;
  }
  renderTable();
  toast(`${toInsert.length} KOL berhasil diimport!`, 'success');
  importRows = [];
  setImportBtn(false);
}

function downloadCSVTemplate() {
  const h = 'Nama,TikTok,WhatsApp,Platform,Niche,Followers,Produk,Catatan';
  const ex = [
    '"Siti Beauty","@sitibeauty","628123456789","wa","Beauty","150K","Serum XYZ","Konten bagus"',
    '"Andi Foodie","@andifoodie","","tiktok","Food","300K","Snack ABC",""',
  ].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([h+'\n'+ex], {type:'text/csv'}));
  a.download = 'template-import-kol.csv'; a.click();
  toast('Template CSV didownload!', 'success');
}

function exportCSV() {
  const kols = DB.kols;
  if (!kols.length) { toast('Tidak ada data!', 'error'); return; }
  const h = ['Nama','TikTok','WhatsApp','Email','Platform','Niche','Followers','Tier','Skor','Produk','Status','Catatan','Dibuat'];
  const rows = kols.map(k => [k.name,k.tiktok,k.wa,k.email,k.platform,k.niche,k.followers,k.tier,k.score,k.product,k.status,k.note,k.createdAt].map(v=>`"${(v||'').toString().replace(/"/g,'""')}"`));
  const csv = [h,...rows].map(r=>r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = `kol-export-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  toast('Export berhasil!', 'success');
}

// drag/drop helpers
function onDragOver(e, id) { e.preventDefault(); document.getElementById(id)?.classList.add('drag-over'); }
function onDragLeave(id) { document.getElementById(id)?.classList.remove('drag-over'); }
function onDrop(e, id, handler) {
  e.preventDefault(); document.getElementById(id)?.classList.remove('drag-over');
  const file = e.dataTransfer.files[0]; if(file) handler(file);
}
