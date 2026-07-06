// ===== SETTINGS =====
function initSettings() {
  const s = DB.settings;
  document.getElementById('setBrandName').value        = s.brandName        || '';
  document.getElementById('setDefaultProduct').value   = s.defaultProduct   || '';
  document.getElementById('setDefaultCommission').value= s.defaultCommission|| '10';
  document.getElementById('setTokoList').value         = (s.tokoList   || []).join(', ');
  document.getElementById('setProdukList').value       = (s.produkList || []).join(', ');
  document.getElementById('setRapidApiKey').value      = localStorage.getItem('kol_rapidapi_key') || '';
  document.getElementById('setRapidApiHost').value     = localStorage.getItem('kol_rapidapi_host') || 'tiktok-scraper2.p.rapidapi.com';
  document.getElementById('setCpmSangatBagus').value   = s.cpmSangatBagus   ?? 20000;
  document.getElementById('setCpmBagus').value         = s.cpmBagus         ?? 30000;
  document.getElementById('setCpmPerlu').value         = s.cpmPerlu         ?? 40000;
  document.getElementById('setCpmBuruk').value         = s.cpmBuruk         ?? 60000;
  const el = document.getElementById('setDataInfo');
  if (el) el.textContent = `${DB.kols.length} KOL tersimpan di database.`;
}

function saveSettings() {
  const parseList = id => document.getElementById(id).value
    .split(',').map(s => s.trim()).filter(Boolean);

  DB.settings = {
    brandName:         document.getElementById('setBrandName').value.trim(),
    defaultProduct:    document.getElementById('setDefaultProduct').value.trim(),
    defaultCommission: document.getElementById('setDefaultCommission').value.trim(),
    tokoList:          parseList('setTokoList'),
    produkList:        parseList('setProdukList'),
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
