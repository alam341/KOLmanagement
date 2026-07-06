// ===== SETTINGS =====
async function initSettings() {
  const s = DB.settings;
  document.getElementById('setBrandName').value        = s.brandName        || '';
  document.getElementById('setDefaultProduct').value   = s.defaultProduct   || '';
  document.getElementById('setDefaultCommission').value= s.defaultCommission|| '10';
  document.getElementById('setRapidApiKey').value      = localStorage.getItem('kol_rapidapi_key') || '';
  document.getElementById('setRapidApiHost').value     = localStorage.getItem('kol_rapidapi_host') || 'tiktok-scraper2.p.rapidapi.com';
  document.getElementById('setCpmSangatBagus').value   = s.cpmSangatBagus   ?? 20000;
  document.getElementById('setCpmBagus').value         = s.cpmBagus         ?? 30000;
  document.getElementById('setCpmPerlu').value         = s.cpmPerlu         ?? 40000;
  document.getElementById('setCpmBuruk').value         = s.cpmBuruk         ?? 60000;
  const el = document.getElementById('setDataInfo');
  if (el) el.textContent = `${DB.kols.length} KOL tersimpan di database.`;

  // Render master data section (toko & produk)
  await renderMasterSection();
}

async function renderMasterSection() {
  const isAdmin = await AUTH.isAdmin();
  const section = document.getElementById('masterDataSection');
  if (!section) return;

  const tokoList   = DB.tokoList;
  const produkList = DB.produkList;

  const renderList = (items, type) => {
    if (!items.length) {
      return `<div style="color:var(--muted);font-size:12px;padding:8px 0;">Belum ada ${type === 'toko' ? 'toko' : 'produk'} yang ditambahkan.</div>`;
    }
    return items.map(item => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;margin-bottom:6px;">
        <span style="font-size:13px;font-weight:500;">${esc(item.name)}</span>
        ${isAdmin ? `<button onclick="deleteMasterItem('${item.id}','${esc(item.name)}')" style="background:none;border:none;cursor:pointer;color:var(--muted);padding:2px 4px;line-height:1;" title="Hapus">${icon('trash-2',13)}</button>` : ''}
      </div>
    `).join('');
  };

  const addRowHtml = (type, placeholder) => isAdmin ? `
    <div style="display:flex;gap:8px;margin-top:8px;">
      <input class="form-control" id="inputNew_${type}" placeholder="${placeholder}" style="flex:1;" onkeydown="if(event.key==='Enter')addMasterItem('${type}')">
      <button class="btn btn-primary btn-sm" onclick="addMasterItem('${type}')">+ Tambah</button>
    </div>
  ` : '';

  section.innerHTML = `
    <div style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.7;">
      ${isAdmin
        ? 'Daftar ini digunakan oleh semua user saat menandai Deal di QC KOL.'
        : '<span style="background:rgba(6,182,212,.1);color:var(--accent2);border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700;">View Only</span> Hanya Admin yang bisa mengelola daftar ini.'}
    </div>
    <div class="form-row" style="grid-template-columns:1fr 1fr;align-items:start;gap:24px;">
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">🏪 Toko (${tokoList.length})</div>
        <div id="tokoListWrap">${renderList(tokoList, 'toko')}</div>
        ${addRowHtml('toko', 'Nama toko baru...')}
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">📦 Produk (${produkList.length})</div>
        <div id="produkListWrap">${renderList(produkList, 'produk')}</div>
        ${addRowHtml('produk', 'Nama produk baru...')}
      </div>
    </div>
  `;
}

async function addMasterItem(type) {
  const input = document.getElementById(`inputNew_${type}`);
  const name  = input?.value.trim();
  if (!name) { toast('Nama tidak boleh kosong!', 'error'); return; }

  // Cek duplikat
  const existing = type === 'toko' ? DB.tokoList : DB.produkList;
  if (existing.some(x => x.name.toLowerCase() === name.toLowerCase())) {
    toast(`"${name}" sudah ada di daftar!`, 'error'); return;
  }

  try {
    await DB.addMaster(type, name);
    if (input) input.value = '';
    await renderMasterSection();
    toast(`${type === 'toko' ? 'Toko' : 'Produk'} "${name}" berhasil ditambahkan!`, 'success');
  } catch(e) {
    toast('Gagal: ' + e.message, 'error');
  }
}

async function deleteMasterItem(id, name) {
  if (!confirm(`Hapus "${name}" dari daftar?`)) return;
  try {
    await DB.deleteMaster(id);
    await renderMasterSection();
    toast(`"${name}" dihapus.`, 'success');
  } catch(e) {
    toast('Gagal: ' + e.message, 'error');
  }
}

function saveSettings() {
  DB.settings = {
    brandName:         document.getElementById('setBrandName').value.trim(),
    defaultProduct:    document.getElementById('setDefaultProduct').value.trim(),
    defaultCommission: document.getElementById('setDefaultCommission').value.trim(),
    cpmSangatBagus:    parseFloat(document.getElementById('setCpmSangatBagus').value) || 20000,
    cpmBagus:          parseFloat(document.getElementById('setCpmBagus').value)        || 30000,
    cpmPerlu:          parseFloat(document.getElementById('setCpmPerlu').value)        || 40000,
    cpmBuruk:          parseFloat(document.getElementById('setCpmBuruk').value)        || 60000,
  };
  const apiKey  = document.getElementById('setRapidApiKey').value.trim();
  const apiHost = document.getElementById('setRapidApiHost').value.trim();
  if (apiKey)  localStorage.setItem('kol_rapidapi_key', apiKey);
  else         localStorage.removeItem('kol_rapidapi_key');
  if (apiHost) localStorage.setItem('kol_rapidapi_host', apiHost);
  else         localStorage.removeItem('kol_rapidapi_host');
  toast('Pengaturan disimpan!', 'success');
  initSettings();
}

function clearAllData() {
  if (!confirm('HAPUS SEMUA DATA KOL? Tindakan ini tidak dapat dibatalkan!')) return;
  if (!confirm('Yakin ingin menghapus semua data?')) return;
  DB.clearKols();
  DB.clearHistory();
  toast('Semua data KOL dihapus.', 'success');
  initSettings();
}

function clearHistory() {
  if (!confirm('Hapus semua riwayat aktivitas?')) return;
  DB.clearHistory();
  toast('Riwayat dihapus.', 'success');
}

function exportAllData() {
  const data = {
    kols: DB.kols, templates: DB.templates,
    settings: DB.settings, exportedAt: new Date().toISOString(),
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  a.download = `kol-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  toast('Backup didownload!', 'success');
}

function importAllData() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.kols) { toast('File backup tidak valid!','error'); return; }
        if (!confirm(`Restore ${data.kols.length} KOL dari backup? Data saat ini akan digabung.`)) return;
        const existing  = DB.kols;
        const existIds  = new Set(existing.map(k=>k.id));
        const toInsert  = data.kols.filter(k => !existIds.has(k.id));
        if (toInsert.length) DB.insertKols(toInsert);
        if (data.templates) DB.templates = data.templates;
        if (data.settings)  DB.settings  = data.settings;
        toast(`Restore berhasil! ${toInsert.length} KOL ditambahkan.`,'success');
        initSettings();
      } catch { toast('Gagal membaca file backup!','error'); }
    };
    reader.readAsText(file);
  };
  input.click();
}
