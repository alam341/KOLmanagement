// ===== AUTO DM PAGE =====
const BOT_URL = location.protocol === 'file:' ? "http://127.0.0.1:5678" : "";
let selectedKOLs = new Set();
let progressInterval = null;

function initAutodm() {
  renderAutodmStats();
  renderCookiesStatus();
  renderKOLSelector();
  renderTemplateSelector();
  checkBotServer();
}

// ===== CEK SERVER =====
async function checkBotServer() {
  const el = document.getElementById('serverStatus');
  if (!el) return;
  try {
    const res = await fetch(`${BOT_URL}/status`, { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    el.innerHTML = `<span style="color:var(--green);font-weight:700;">● Server aktif</span>`;
    if (data.running) startProgressPolling();
  } catch {
    el.innerHTML = `<span style="color:var(--red);font-weight:700;">● Tidak terhubung</span>
      <span style="color:var(--muted);font-size:11px;margin-left:6px;">— buka via <code>Mulai.bat</code></span>`;
  }
  setTimeout(checkBotServer, 5000);
}

// ===== STATS =====
function renderAutodmStats() {
  const kols      = DB.kols;
  const ready     = kols.filter(k => k.status === 'new' && k.tiktok).length;
  const contacted = kols.filter(k => ['contacted','replied','deal','followup'].includes(k.status)).length;

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
      <div class="stat-sub">total status aktif</div>
    </div>
    <div class="stat-card s-replied">
      <div class="stat-icon">✅</div>
      <div class="stat-label">Dipilih</div>
      <div class="stat-num" id="selectedCount">0</div>
      <div class="stat-sub">siap dijalankan</div>
    </div>
  `;
}

// ===== COOKIES =====
function renderCookiesStatus() {
  const el  = document.getElementById('cookiesStatusBadge');
  if (!el) return;
  const raw = localStorage.getItem('kol_cookies');
  if (!raw) {
    el.innerHTML = `<span style="color:var(--red);font-size:13px;font-weight:600;">● Belum ada cookies</span>`;
    return;
  }
  try {
    const cookies = JSON.parse(raw);
    const savedAt = localStorage.getItem('kol_cookies_saved_at') || '';
    const d = savedAt ? new Date(savedAt).toLocaleDateString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '-';
    el.innerHTML = `
      <span style="color:var(--green);font-size:13px;font-weight:600;">● Cookies aktif</span>
      <span style="color:var(--muted);font-size:11px;margin-left:6px;">${cookies.length} cookies · ${d}</span>
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
      const arr    = Array.isArray(parsed) ? parsed : Object.values(parsed);
      if (!arr.length || !arr[0].name) throw new Error('Format tidak valid');
      const tiktok = arr.filter(c => (c.domain||'').includes('tiktok'));
      localStorage.setItem('kol_cookies', JSON.stringify(tiktok.length ? tiktok : arr));
      localStorage.setItem('kol_cookies_saved_at', new Date().toISOString());
      renderCookiesStatus();
      toast('Cookies TikTok tersimpan!', 'success');
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
}

// ===== TEMPLATE SELECTOR =====
function renderTemplateSelector() {
  const el = document.getElementById('dmTemplateSelect');
  if (!el) return;
  const tmpls = DB.templates;
  el.innerHTML = tmpls.map(t =>
    `<option value="${t.id}">${esc(t.name)} (${t.platform})</option>`
  ).join('');
}

function getSelectedTemplate() {
  const id   = document.getElementById('dmTemplateSelect')?.value;
  const tmpl = DB.templates.find(t => t.id === id);
  return tmpl ? tmpl.body : '';
}

// ===== KOL SELECTOR =====
function renderKOLSelector() {
  const q      = (document.getElementById('dmSearch')?.value || '').toLowerCase();
  const tierF  = document.getElementById('dmFilterTier')?.value || '';
  const showAll = document.getElementById('dmShowAll')?.checked;

  const kols = DB.kols.filter(k =>
    k.tiktok &&
    (showAll ? true : k.status === 'new') &&
    (!q || k.name.toLowerCase().includes(q) || k.tiktok.toLowerCase().includes(q)) &&
    (!tierF || k.tier === tierF)
  );

  const el = document.getElementById('kolSelectorList');
  if (!el) return;

  if (!kols.length) {
    el.innerHTML = `<div style="text-align:center;color:var(--muted);padding:32px;font-size:13px;">
      Tidak ada KOL dengan username TikTok.</div>`;
    updateSelectedCount(); return;
  }

  el.innerHTML = kols.map(k => {
    const checked = selectedKOLs.has(k.id) ? 'checked' : '';
    return `
    <label style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;"
      onmouseover="this.style.background='rgba(124,58,237,.05)'" onmouseout="this.style.background=''">
      <input type="checkbox" ${checked} onchange="toggleKOL('${k.id}',this.checked)"
        style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer;flex-shrink:0;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;">${esc(k.name)}</div>
        <div style="font-size:11px;color:var(--muted);">🎵 ${esc(k.tiktok)} · 👥 ${esc(k.followers||'-')}</div>
      </div>
      <div style="display:flex;gap:5px;flex-shrink:0;">
        ${tierBadge(k.tier)}
        ${statusBadge(k.status)}
      </div>
    </label>`;
  }).join('');

  updateSelectedCount();
}

function toggleKOL(id, checked) {
  if (checked) selectedKOLs.add(id); else selectedKOLs.delete(id);
  updateSelectedCount();
}

function selectAllKOLs() {
  DB.kols.filter(k => k.tiktok && k.status === 'new').forEach(k => selectedKOLs.add(k.id));
  renderKOLSelector();
}

function clearSelectionKOLs() {
  selectedKOLs.clear();
  renderKOLSelector();
}

function updateSelectedCount() {
  const el  = document.getElementById('selectedCount');
  const btn = document.getElementById('btnRunBot');
  if (el) el.textContent = selectedKOLs.size;
  if (btn) {
    const ok = selectedKOLs.size > 0;
    btn.disabled    = !ok;
    btn.style.opacity = ok ? '1' : '.5';
    btn.textContent = ok ? `🚀 Jalankan Bot (${selectedKOLs.size} KOL)` : '🚀 Jalankan Bot';
  }
}

// ===== JALANKAN BOT =====
async function runBot() {
  if (!selectedKOLs.size) { toast('Pilih minimal 1 KOL!', 'error'); return; }

  const cookiesRaw = localStorage.getItem('kol_cookies');
  if (!cookiesRaw) { toast('Upload cookies TikTok dulu!', 'error'); return; }

  const template = getSelectedTemplate();
  if (!template) { toast('Pilih template pesan!', 'error'); return; }

  const kols = DB.kols
    .filter(k => selectedKOLs.has(k.id))
    .map(k => ({
      name: k.name, tiktok: k.tiktok, followers: k.followers,
      niche: k.niche, product: k.product || DB.settings.defaultProduct || '',
      brand: DB.settings.brandName || '', komisi: DB.settings.defaultCommission || '10',
    }));

  const delayMin = parseInt(document.getElementById('dmDelayMin')?.value || '30');
  const delayMax = parseInt(document.getElementById('dmDelayMax')?.value || '60');

  try {
    const res = await fetch(`${BOT_URL}/run`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        cookies: JSON.parse(cookiesRaw),
        kols, template, delay_min: delayMin, delay_max: delayMax,
      }),
    });
    const data = await res.json();
    if (!data.ok) { toast(data.error, 'error'); return; }
    toast(`Bot dimulai! Mengirim ke ${kols.length} KOL...`, 'success');
    showProgressPanel();
    startProgressPolling();
  } catch {
    toast('Server bot tidak aktif! Jalankan bot/server.bat dulu.', 'error');
  }
}

async function stopBot() {
  try {
    await fetch(`${BOT_URL}/stop`, { method: 'POST' });
    toast('Menghentikan bot...', 'info');
  } catch {
    toast('Gagal menghubungi server.', 'error');
  }
}

// ===== PROGRESS =====
function showProgressPanel() {
  const el = document.getElementById('progressPanel');
  if (el) el.style.display = 'block';
}

function startProgressPolling() {
  if (progressInterval) clearInterval(progressInterval);
  progressInterval = setInterval(fetchProgress, 1500);
}

async function fetchProgress() {
  try {
    const res  = await fetch(`${BOT_URL}/progress`);
    const data = await res.json();
    renderProgress(data);
    if (data.done) {
      clearInterval(progressInterval);
      progressInterval = null;
      updateKOLStatusFromResults();
    }
  } catch {
    clearInterval(progressInterval);
    progressInterval = null;
  }
}

function renderProgress(data) {
  const bar  = document.getElementById('progressBar');
  const info = document.getElementById('progressInfo');
  const logs = document.getElementById('progressLogs');
  const btn  = document.getElementById('btnStopBot');

  const pct  = data.total ? Math.round((data.current / data.total) * 100) : 0;
  if (bar)  bar.style.width = pct + '%';
  if (info) info.innerHTML  = `
    <span style="color:var(--accent2);">${data.current}/${data.total}</span> ·
    <span style="color:var(--green);">✓ ${data.sukses}</span> ·
    <span style="color:var(--red);">✗ ${data.gagal}</span>
    ${data.done ? ' · <strong style="color:var(--green);">Selesai!</strong>' : ''}
    ${data.running ? ' · <span style="color:var(--yellow);">Berjalan...</span>' : ''}
  `;
  if (btn)  btn.style.display = data.running ? 'inline-flex' : 'none';

  if (logs && data.logs?.length) {
    logs.innerHTML = [...data.logs].reverse().map(l => `
      <div style="padding:4px 0;border-bottom:1px solid var(--border);font-size:12px;display:flex;gap:8px;">
        <span style="color:var(--muted);flex-shrink:0;">${l.time}</span>
        <span style="color:${l.status==='success'?'var(--green)':l.status==='error'?'var(--red)':'var(--text2)'};">${esc(l.msg)}</span>
      </div>`).join('');
  }
}

// Update status KOL di database setelah bot selesai
async function updateKOLStatusFromResults() {
  try {
    const res  = await fetch(`${BOT_URL}/read-results`);
    const data = await res.json();
    if (!data.rows?.length) return;

    let updated = 0;
    data.rows.forEach(row => {
      if (row.status !== 'SUKSES') return;
      const username = (row.username||'').toLowerCase();
      const kol = DB.kols.find(k => (k.tiktok||'').replace('@','').toLowerCase() === username);
      if (kol && kol.status === 'new') {
        DB.updateStatus(kol.id, 'contacted', 'Auto DM via bot TikTok');
        updated++;
      }
    });
    if (updated) {
      selectedKOLs.clear();
      renderKOLSelector();
      renderAutodmStats();
      toast(`${updated} status KOL diperbarui ke "Dihubungi"!`, 'success');
    }
  } catch { /* server mungkin sudah tutup */ }
}
