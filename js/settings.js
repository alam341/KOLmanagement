// ===== SETTINGS =====
function initSettings() {
  const s = DB.settings;
  document.getElementById('setBrandName').value        = s.brandName        || '';
  document.getElementById('setDefaultProduct').value   = s.defaultProduct   || '';
  document.getElementById('setDefaultCommission').value= s.defaultCommission|| '10';
  const el = document.getElementById('setDataInfo');
  if (el) el.textContent = `${DB.kols.length} KOL tersimpan di database.`;
}

function saveSettings() {
  DB.settings = {
    brandName:         document.getElementById('setBrandName').value.trim(),
    defaultProduct:    document.getElementById('setDefaultProduct').value.trim(),
    defaultCommission: document.getElementById('setDefaultCommission').value.trim(),
  };
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
