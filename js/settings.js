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

  // Render setiap toko + produk-produknya di bawah
  const tokoBlocks = tokoList.length
    ? tokoList.map(toko => {
        const produkToko = produkList.filter(p => p.toko_id === toko.id);
        const produkItems = produkToko.length
          ? produkToko.map(p => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 10px 5px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;margin-bottom:4px;">
                <span style="font-size:12px;">📦 ${esc(p.name)}</span>
                ${isAdmin ? `<button onclick="deleteMasterItem('${p.id}','${esc(p.name)}')" style="background:none;border:none;cursor:pointer;color:var(--muted);padding:2px 4px;line-height:1;" title="Hapus produk">${icon('x',12)}</button>` : ''}
              </div>`).join('')
          : `<div style="font-size:11px;color:var(--muted);padding:4px 0 4px 14px;">Belum ada produk</div>`;

        const addProdukHtml = isAdmin ? `
          <div style="display:flex;gap:6px;margin-top:6px;padding-left:14px;">
            <input class="form-control" id="inputProduk_${toko.id}" placeholder="Nama produk..." style="flex:1;font-size:12px;padding:5px 8px;"
              onkeydown="if(event.key==='Enter')addProdukToToko('${toko.id}')">
            <button class="btn btn-outline btn-sm" onclick="addProdukToToko('${toko.id}')" style="font-size:11px;white-space:nowrap;">+ Produk</button>
          </div>` : '';

        return `
          <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <span style="font-size:13px;font-weight:700;">🏪 ${esc(toko.name)}</span>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:11px;color:var(--muted);">${produkToko.length} produk</span>
                ${isAdmin ? `<button onclick="deleteMasterItem('${toko.id}','${esc(toko.name)}','toko')" style="background:none;border:none;cursor:pointer;color:var(--muted);padding:2px 4px;line-height:1;" title="Hapus toko">${icon('trash-2',13)}</button>` : ''}
              </div>
            </div>
            ${produkItems}
            ${addProdukHtml}
          </div>`;
      }).join('')
    : `<div style="color:var(--muted);font-size:12px;padding:8px 0;">Belum ada toko yang ditambahkan.</div>`;

  const addTokoHtml = isAdmin ? `
    <div style="display:flex;gap:8px;margin-top:4px;">
      <input class="form-control" id="inputNew_toko" placeholder="Nama toko baru..." style="flex:1;"
        onkeydown="if(event.key==='Enter')addMasterToko()">
      <button class="btn btn-primary btn-sm" onclick="addMasterToko()">+ Tambah Toko</button>
    </div>` : '';

  section.innerHTML = `
    <div style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.7;">
      ${isAdmin
        ? 'Tambah toko dulu, lalu tambahkan produk di bawah masing-masing toko.'
        : '<span style="background:rgba(6,182,212,.1);color:var(--accent2);border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700;">View Only</span> Hanya Admin yang bisa mengelola daftar ini.'}
    </div>
    ${tokoBlocks}
    ${addTokoHtml}
  `;
}

async function addMasterToko() {
  const input = document.getElementById('inputNew_toko');
  const name  = input?.value.trim();
  if (!name) { toast('Nama toko tidak boleh kosong!', 'error'); return; }
  if (DB.tokoList.some(x => x.name.toLowerCase() === name.toLowerCase())) {
    toast(`Toko "${name}" sudah ada!`, 'error'); return;
  }
  try {
    await DB.addMaster('toko', name, null);
    if (input) input.value = '';
    await renderMasterSection();
    toast(`Toko "${name}" berhasil ditambahkan!`, 'success');
  } catch(e) { toast('Gagal: ' + e.message, 'error'); }
}

async function addProdukToToko(tokoId) {
  const input = document.getElementById(`inputProduk_${tokoId}`);
  const name  = input?.value.trim();
  if (!name) { toast('Nama produk tidak boleh kosong!', 'error'); return; }
  const existing = DB.produkList.filter(p => p.toko_id === tokoId);
  if (existing.some(x => x.name.toLowerCase() === name.toLowerCase())) {
    toast(`Produk "${name}" sudah ada di toko ini!`, 'error'); return;
  }
  try {
    await DB.addMaster('produk', name, tokoId);
    if (input) input.value = '';
    await renderMasterSection();
    toast(`Produk "${name}" berhasil ditambahkan!`, 'success');
  } catch(e) { toast('Gagal: ' + e.message, 'error'); }
}

async function deleteMasterItem(id, name, type) {
  const label = type === 'toko'
    ? `Hapus toko "${name}"?\n\nSemua produk di toko ini juga akan dihapus.`
    : `Hapus produk "${name}"?`;
  if (!confirm(label)) return;
  try {
    // Kalau hapus toko, hapus juga semua produknya
    if (type === 'toko') {
      const produkToko = DB.produkList.filter(p => p.toko_id === id);
      for (const p of produkToko) await DB.deleteMaster(p.id);
    }
    await DB.deleteMaster(id);
    await renderMasterSection();
    toast(`"${name}" dihapus.`, 'success');
  } catch(e) { toast('Gagal: ' + e.message, 'error'); }
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
