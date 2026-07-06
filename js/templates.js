// ===== TEMPLATE PESAN =====
function initTemplates() {
  renderTemplates();
}

function renderTemplates() {
  const tmpls = DB.templates;
  const el = document.getElementById('tmplList');
  if (!el) return;
  if (!tmpls.length) { el.innerHTML = '<div style="color:var(--muted);text-align:center;padding:48px;">Belum ada template.</div>'; return; }

  const platIcon = p => p==='wa'?'💬 WA':p==='tiktok'?'🎵 TikTok':'💬🎵 Keduanya';
  const catLabel = c => c==='reengagement' ? '⭐ Re-Engagement' : '📤 Outreach';
  const catStyle = c => c==='reengagement'
    ? 'background:rgba(245,158,11,.12);color:var(--yellow);'
    : 'background:rgba(124,58,237,.12);color:var(--accent);';

  // Grup: outreach dulu, reengagement di bawah
  const groups = [
    { key: 'outreach',      label: '📤 Outreach' },
    { key: 'reengagement',  label: '⭐ Re-Engagement (Talent Prioritas)' },
  ];

  el.innerHTML = groups.map(g => {
    const list = tmpls.filter(t => (t.category||'outreach') === g.key);
    if (!list.length) return '';
    return `
      <div style="margin-bottom:8px;padding:6px 0 4px;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border);">${g.label}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-bottom:24px;">
        ${list.map(t => `
          <div class="tmpl-card">
            <div class="tmpl-card-header">
              <span class="tmpl-card-title">${esc(t.name)}</span>
              <div style="display:flex;gap:5px;">
                <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;${catStyle(t.category||'outreach')}">${catLabel(t.category||'outreach')}</span>
                <span class="badge badge-new">${platIcon(t.platform)}</span>
              </div>
            </div>
            <div class="tmpl-card-body">${esc(t.body)}</div>
            <div class="tmpl-card-footer">
              <button class="btn btn-outline btn-sm" onclick="copyTmpl('${t.id}')">${icon('copy',13)} Copy</button>
              <button class="btn btn-outline btn-sm" onclick="openTmplModal('${t.id}')">${icon('pencil',13)} Edit</button>
              <button class="btn btn-danger btn-sm" onclick="deleteTmpl('${t.id}')">${icon('trash-2',13)} Hapus</button>
            </div>
          </div>`).join('')}
      </div>`;
  }).join('');
}

function copyTmpl(id) {
  const t = DB.templates.find(x => x.id === id);
  if (t) navigator.clipboard.writeText(t.body).then(() => toast('Template di-copy!', 'success'));
}

function openTmplModal(id) {
  const t = id ? DB.templates.find(x => x.id === id) : null;
  document.getElementById('tmplEditId').value = id || '';
  document.getElementById('tmplModalTitle').textContent = t ? 'Edit Template' : 'Buat Template';
  document.getElementById('tmplName').value = t?.name || '';
  document.getElementById('tmplPlatform').value = t?.platform || 'wa';
  document.getElementById('tmplCategory').value = t?.category || 'outreach';
  document.getElementById('tmplBody').value = t?.body || '';
  openModal('modalTmpl');
}

function saveTmpl() {
  const name = document.getElementById('tmplName').value.trim();
  const body = document.getElementById('tmplBody').value.trim();
  if (!name || !body) { toast('Nama dan isi template wajib diisi!', 'error'); return; }
  const tmpls = DB.templates;
  const id = document.getElementById('tmplEditId').value;
  const data = { id: id||uid(), name, platform: document.getElementById('tmplPlatform').value, category: document.getElementById('tmplCategory').value||'outreach', body };
  if (id) { const i = tmpls.findIndex(t=>t.id===id); tmpls[i]=data; }
  else { tmpls.push(data); }
  DB.templates = tmpls;
  closeModal('modalTmpl');
  renderTemplates();
  toast('Template disimpan!', 'success');
}

function deleteTmpl(id) {
  if (!confirm('Hapus template ini?')) return;
  DB.templates = DB.templates.filter(t => t.id !== id);
  renderTemplates();
  toast('Template dihapus.', 'success');
}
