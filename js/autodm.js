// ===== AUTO DM PAGE =====
function initAutodm() {
  renderAutodmStats();
  renderAutodmKOLPreview();
}

function renderAutodmStats() {
  const kols = DB.kols;
  const ready = kols.filter(k => k.status === 'new' && k.tiktok).length;
  const contacted = kols.filter(k => ['contacted','replied','deal','followup'].includes(k.status)).length;
  const noTiktok = kols.filter(k => k.status === 'new' && !k.tiktok).length;

  document.getElementById('autodmStats').innerHTML = `
    <div class="stat-card s-total">
      <div class="stat-icon">🎯</div>
      <div class="stat-label">Siap di-DM</div>
      <div class="stat-num">${ready}</div>
      <div class="stat-sub">punya username TikTok</div>
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
      <div class="stat-icon">📊</div>
      <div class="stat-label">Total KOL</div>
      <div class="stat-num">${kols.length}</div>
      <div class="stat-sub">di database</div>
    </div>
  `;
}

function renderAutodmKOLPreview() {
  const kols = DB.kols.filter(k => k.status === 'new' && k.tiktok).slice(0, 5);
  const el = document.getElementById('autodmKOLPreview');
  if (!el) return;
  if (!kols.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px 0;">Tidak ada KOL dengan status "Belum Dihubungi" yang punya username TikTok.</div>';
    return;
  }
  const total = DB.kols.filter(k => k.status === 'new' && k.tiktok).length;
  el.innerHTML = `
    <div style="font-size:12px;color:var(--muted);margin-bottom:10px;">Preview ${Math.min(5,total)} dari <strong style="color:var(--text)">${total} KOL</strong> yang akan dieksport:</div>
    ${kols.map(k => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;">${esc(k.name)}</div>
          <div style="font-size:11px;color:var(--muted);">🎵 ${esc(k.tiktok)} · 👥 ${esc(k.followers||'-')}</div>
        </div>
        ${tierBadge(k.tier)}
      </div>`).join('')}
    ${total > 5 ? `<div style="font-size:12px;color:var(--muted);padding:8px 0;">... dan ${total-5} KOL lainnya</div>` : ''}
  `;
}

function exportBotCSV() {
  const kols = DB.kols.filter(k => k.status === 'new' && k.tiktok);
  if (!kols.length) { toast('Tidak ada KOL siap di-DM!', 'error'); return; }
  const h = ['Nama','TikTok','WhatsApp','Platform','Niche','Followers','Produk','Status','Catatan'];
  const rows = kols.map(k => [k.name,k.tiktok,k.wa,k.platform,k.niche,k.followers,k.product,k.status,k.note]
    .map(v => `"${(v||'').toString().replace(/"/g,'""')}"`));
  const csv = [h, ...rows].map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
  a.download = `bot-kol-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast(`${kols.length} KOL diexport untuk bot!`, 'success');
}

// ===== IMPORT HASIL BOT =====
function handleBotResultFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) { toast('File kosong!', 'error'); return; }

    // Parse CSV results
    const header = lines[0].split(',').map(h => h.replace(/"/g,'').trim().toLowerCase());
    const iUsername = header.findIndex(h => h.includes('username'));
    const iStatus   = header.findIndex(h => h.includes('status'));
    const iCatatan  = header.findIndex(h => h.includes('catatan'));

    if (iUsername < 0 || iStatus < 0) { toast('Format file hasil bot tidak valid!', 'error'); return; }

    let updated = 0, notFound = 0;
    const kols = DB.kols;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseResultLine(lines[i]);
      const username = (cols[iUsername]||'').replace('@','').trim().toLowerCase();
      const botStatus = (cols[iStatus]||'').trim().toUpperCase();
      const catatan   = iCatatan >= 0 ? (cols[iCatatan]||'').trim() : '';

      const kol = kols.find(k => (k.tiktok||'').replace('@','').toLowerCase() === username);
      if (!kol) { notFound++; continue; }

      if (botStatus === 'SUKSES') {
        kol.status = 'contacted';
        kol.updatedAt = new Date().toISOString();
        if (catatan) kol.note = (kol.note ? kol.note + ' | ' : '') + catatan;
        DB.addHistory(kol, 'Auto DM terkirim via bot');
        updated++;
      }
    }

    DB.kols = kols;
    renderAutodmStats();
    renderAutodmKOLPreview();

    const el = document.getElementById('botImportResult');
    el.style.display = 'block';
    el.innerHTML = `✓ <strong>${updated}</strong> KOL diperbarui ke status "Dihubungi".${notFound ? ` <span style="color:var(--yellow)">${notFound} username tidak ditemukan di database.</span>` : ''}`;
    toast(`${updated} status KOL diperbarui!`, 'success');
  };
  reader.readAsText(file, 'UTF-8');
}

function parseResultLine(line) {
  const result = []; let cur = '', inQ = false;
  for (const c of line) {
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  result.push(cur.trim());
  return result;
}
