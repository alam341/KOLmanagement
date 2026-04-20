// ===== TEMPLATE PESAN =====
function initTemplates() {
  renderTemplates();
}

function renderTemplates() {
  const tmpls = DB.templates;
  const platIcon = p => p==='wa'?'💬 WA':p==='tiktok'?'🎵 TikTok':'💬🎵 Keduanya';
  const el = document.getElementById('tmplList');
  if (!el) return;
  el.innerHTML = tmpls.length ? tmpls.map(t => `
    <div class="tmpl-card">
      <div class="tmpl-card-header">
        <span class="tmpl-card-title">${esc(t.name)}</span>
        <span class="badge badge-new">${platIcon(t.platform)}</span>
      </div>
      <div class="tmpl-card-body">${esc(t.body)}</div>
      <div class="tmpl-card-footer">
        <button class="btn btn-outline btn-sm" onclick="copyTmpl('${t.id}')">📋 Copy</button>
        <button class="btn btn-outline btn-sm" onclick="openTmplModal('${t.id}')">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTmpl('${t.id}')">🗑 Hapus</button>
      </div>
    </div>
  `).join('') : '<div style="color:var(--muted);text-align:center;padding:48px;">Belum ada template.</div>';
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
  document.getElementById('tmplBody').value = t?.body || '';
  openModal('modalTmpl');
}

function saveTmpl() {
  const name = document.getElementById('tmplName').value.trim();
  const body = document.getElementById('tmplBody').value.trim();
  if (!name || !body) { toast('Nama dan isi template wajib diisi!', 'error'); return; }
  const tmpls = DB.templates;
  const id = document.getElementById('tmplEditId').value;
  const data = { id: id||uid(), name, platform: document.getElementById('tmplPlatform').value, body };
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
