// ===== AUTO DM PAGE =====
let selectedKOLs = new Set();

function initAutodm() {
  renderAutodmStats();
  renderCookiesStatus();
  renderKOLSelector();
}

// ===== STATS =====
function renderAutodmStats() {
  const kols = DB.kols;
  const ready     = kols.filter(k => k.status === 'new' && k.tiktok).length;
  const contacted = kols.filter(k => ['contacted','replied','deal','followup'].includes(k.status)).length;
  const noTiktok  = kols.filter(k => k.status === 'new' && !k.tiktok).length;

  document.getElementById('autodmStats').innerHTML = `
    <div class="stat-card s-total">
      <div class="stat-icon">🎯</div>
      <div class="stat-label">Siap di-DM</div>
      <div class="stat-num">${ready}</div>
      <div class="stat-sub">belum dihubungi + ada TikTok</div>
    </div>
    <div class="stat-card s-contacted">
      <div class="stat-icon">📤</div>
      <div class="stat-label">Sudah Dihubungi</div>
      <div class="stat-num">${contacted}</div>
      <div class="stat-sub">total semua status aktif</div>
    </div>
    <div class="stat-card s-rejected">
      <div class="stat-icon">⚠️</div>
      <div class="stat-label">Tidak Ada TikTok</div>
      <div class="stat-num">${noTiktok}</div>
      <div class="stat-sub">tidak bisa di-DM</div>
    </div>
    <div class="stat-card s-deal">
      <div class="stat-icon">✅</div>
      <div class="stat-label">Dipilih</div>
      <div class="stat-num" id="selectedCount">0</div>
      <div class="stat-sub">siap dijalankan</div>
    </div>
  `;
}

// ===== COOKIES =====
function renderCookiesStatus() {
  const el = document.getElementById('cookiesStatusBadge');
  if (!el) return;
  const raw = localStorage.getItem('kol_cookies');
  if (!raw) {
    el.innerHTML = `<span style="color:var(--red);font-size:13px;font-weight:600;">● Belum ada cookies</span>`;
    return;
  }
  try {
    const cookies = JSON.parse(raw);
    const savedAt = localStorage.getItem('kol_cookies_saved_at') || '';
    const d = savedAt ? new Date(savedAt).toLocaleDateString('id-ID', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '-';
    el.innerHTML = `<span style="color:var(--green);font-size:13px;font-weight:600;">● Cookies aktif</span> <span style="color:var(--muted);font-size:12px;">${cookies.length} cookies · ${d}</span>
      <button class="btn btn-danger btn-xs" style="margin-left:8px;" onclick="deleteCookies()">Hapus</button>`;
  } catch {
    el.innerHTML = `<span style="color:var(--red);font-size:13px;">● Cookies tidak valid</span>`;
  }
}

function handleCookiesUpload(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      const arr = Array.isArray(parsed) ? parsed : Object.values(parsed);
      if (!arr.length || !arr[0].name) throw new Error('Format tidak valid');
      const tiktok = arr.filter(c => (c.domain||'').includes('tiktok'));
      const toSave = tiktok.length > 0 ? tiktok : arr;
      localStorage.setItem('kol_cookies', JSON.stringify(toSave));
      localStorage.setItem('kol_cookies_saved_at', new Date().toISOString());
      renderCookiesStatus();
      toast(`${toSave.length} cookies TikTok tersimpan!`, 'success');
    } catch (err) {
      toast('File cookies tidak valid: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

function deleteCookies() {
  if (!confirm('Hapus cookies?')) return;
  localStorage.removeItem('kol_cookies');
  localStorage.removeItem('kol_cookies_saved_at');
  renderCookiesStatus();
  toast('Cookies dihapus.', 'success');
}

// ===== KOL SELECTOR =====
function renderKOLSelector() {
  const q       = (document.getElementById('dmSearch')?.value || '').toLowerCase();
  const tierF   = document.getElementById('dmFilterTier')?.value || '';
  const kols    = DB.kols.filter(k => k.tiktok && (
    document.getElementById('dmShowAll')?.checked ? true : k.status === 'new'
  )).filter(k =>
    (!q || k.name.toLowerCase().includes(q) || (k.tiktok||'').toLowerCase().includes(q)) &&
    (!tierF || k.tier === tierF)
  );

  const el = document.getElementById('kolSelectorList');
  if (!el) return;

  if (!kols.length) {
    el.innerHTML = `<div style="text-align:center;color:var(--muted);padding:32px;font-size:13px;">
      Tidak ada KOL dengan username TikTok.<br>Import data dari Kalodata atau tambah manual.
    </div>`;
    updateSelectedCount();
    return;
  }

  el.innerHTML = kols.map(k => {
    const checked = selectedKOLs.has(k.id) ? 'checked' : '';
    return `
    <label style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .1s;"
      onmouseover="this.style.background='rgba(124,58,237,.05)'" onmouseout="this.style.background=''">
      <input type="checkbox" ${checked} onchange="toggleKOL('${k.id}',this.checked)"
        style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer;flex-shrink:0;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;">${esc(k.name)}</div>
        <div style="font-size:11px;color:var(--muted);">🎵 ${esc(k.tiktok)} · 👥 ${esc(k.followers||'-')}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
        ${tierBadge(k.tier)}
        ${statusBadge(k.status)}
      </div>
    </label>`;
  }).join('');

  updateSelectedCount();
}

function toggleKOL(id, checked) {
  if (checked) selectedKOLs.add(id);
  else selectedKOLs.delete(id);
  updateSelectedCount();
}

function selectAllKOLs() {
  const kols = DB.kols.filter(k => k.tiktok && k.status === 'new');
  kols.forEach(k => selectedKOLs.add(k.id));
  renderKOLSelector();
}

function clearSelectionKOLs() {
  selectedKOLs.clear();
  renderKOLSelector();
}

function updateSelectedCount() {
  const el = document.getElementById('selectedCount');
  if (el) el.textContent = selectedKOLs.size;
  const btn = document.getElementById('btnRunBot');
  if (btn) {
    btn.disabled = selectedKOLs.size === 0;
    btn.style.opacity = selectedKOLs.size > 0 ? '1' : '.5';
    btn.textContent = selectedKOLs.size > 0
      ? `🚀 Siapkan Bot (${selectedKOLs.size} KOL)`
      : '🚀 Siapkan Bot';
  }
}

// ===== PREPARE BOT =====
function prepareBot() {
  if (!selectedKOLs.size) { toast('Pilih minimal 1 KOL!', 'error'); return; }

  const cookies = localStorage.getItem('kol_cookies');
  if (!cookies) { toast('Upload cookies TikTok dulu!', 'error'); return; }

  const kols = DB.kols.filter(k => selectedKOLs.has(k.id));

  // Download cookies.json
  const ca = document.createElement('a');
  ca.href = URL.createObjectURL(new Blob([cookies], {type:'application/json'}));
  ca.download = 'cookies.json';
  ca.click();

  // Download kol-list.csv
  setTimeout(() => {
    const h = ['Nama','TikTok','WhatsApp','Platform','Niche','Followers','Produk','Status','Catatan'];
    const rows = kols.map(k =>
      [k.name,k.tiktok,k.wa,k.platform,k.niche,k.followers,k.product,k.status,k.note]
      .map(v => `"${(v||'').toString().replace(/"/g,'""')}"`)
    );
    const csv = [h, ...rows].map(r => r.join(',')).join('\n');
    const ka = document.createElement('a');
    ka.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
    ka.download = `bot-kol-${new Date().toISOString().slice(0,10)}.csv`;
    ka.click();
  }, 500);

  // Tampilkan instruksi
  document.getElementById('botReadyPanel').style.display = 'block';
  document.getElementById('botReadyCount').textContent = kols.length;
  toast(`${kols.length} KOL siap! 2 file didownload ke folder Downloads.`, 'success');
}

// ===== IMPORT HASIL BOT =====
function handleBotResultFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) { toast('File kosong!', 'error'); return; }

    const header  = lines[0].split(',').map(h => h.replace(/"/g,'').trim().toLowerCase());
    const iUser   = header.findIndex(h => h.includes('username'));
    const iStatus = header.findIndex(h => h.includes('status'));
    if (iUser < 0 || iStatus < 0) { toast('Format file tidak valid!', 'error'); return; }

    let updated = 0, gagal = 0;
    const kols = DB.kols;

    for (let i = 1; i < lines.length; i++) {
      const cols    = parseCsvLine(lines[i]);
      const username = (cols[iUser]||'').replace('@','').trim().toLowerCase();
      const status   = (cols[iStatus]||'').trim().toUpperCase();
      const kol = kols.find(k => (k.tiktok||'').replace('@','').toLowerCase() === username);
      if (!kol) continue;
      if (status === 'SUKSES') {
        kol.status = 'contacted';
        kol.updatedAt = new Date().toISOString();
        DB.addHistory(kol, 'Auto DM via bot TikTok');
        updated++;
      } else if (status === 'GAGAL') {
        gagal++;
      }
    }

    DB.kols = kols;
    renderAutodmStats();
    renderKOLSelector();
    selectedKOLs.clear();

    const el = document.getElementById('botImportResult');
    el.style.display = 'block';
    el.innerHTML = `✓ <strong>${updated}</strong> KOL diperbarui ke "Dihubungi".${gagal ? ` <span style="color:var(--yellow)">${gagal} gagal dikirim.</span>` : ''}`;
    toast(`${updated} status KOL diperbarui!`, 'success');
  };
  reader.readAsText(file, 'UTF-8');
}

function parseCsvLine(line) {
  const result = []; let cur = '', inQ = false;
  for (const c of line) {
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  result.push(cur.trim());
  return result;
}
