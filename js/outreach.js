// ===== OUTREACH KANBAN =====
const KANBAN_COLS = [
  { status: 'new',       label: 'Belum Dihubungi', color: 'var(--muted)' },
  { status: 'contacted', label: 'Dihubungi',        color: 'var(--yellow)' },
  { status: 'replied',   label: 'Reply',             color: 'var(--accent)' },
  { status: 'followup',  label: 'Follow Up',         color: 'var(--orange)' },
  { status: 'deal',      label: 'Deal ✓',            color: 'var(--green)' },
  { status: 'rejected',  label: 'Rejected',          color: 'var(--red)' },
];

function initOutreach() {
  renderKanban();
}

function renderKanban() {
  const q = (document.getElementById('outreachSearch')?.value || '').toLowerCase();
  const kols = DB.kols.filter(k => !q || k.name.toLowerCase().includes(q) || (k.tiktok||'').toLowerCase().includes(q));
  const board = document.getElementById('kanbanBoard');
  if (!board) return;

  board.innerHTML = KANBAN_COLS.map(col => {
    const cards = kols.filter(k => k.status === col.status);
    return `
    <div class="kanban-col">
      <div class="kanban-col-header">
        <span class="kanban-col-title" style="color:${col.color};">● ${col.label}</span>
        <span class="kanban-col-count">${cards.length}</span>
      </div>
      <div class="kanban-cards">
        ${cards.length ? cards.map(k => kanbanCard(k, col.status)).join('') :
          '<div style="color:var(--muted);font-size:12px;text-align:center;padding:20px 0;">Kosong</div>'}
      </div>
    </div>`;
  }).join('');
}

function kanbanCard(k, currentStatus) {
  const moveOpts = KANBAN_COLS.filter(c => c.status !== currentStatus)
    .map(c => `<option value="${c.status}">${c.label}</option>`).join('');
  return `
  <div class="kanban-card" onclick="openSend('${k.id}')">
    <div class="kanban-card-name">${esc(k.name)}</div>
    <div class="kanban-card-meta">
      ${k.tiktok ? `<span>🎵 <a href="https://www.tiktok.com/@${esc(k.tiktok.replace('@',''))}" target="_blank" onclick="event.stopPropagation()" style="color:var(--accent);text-decoration:none;">${esc(k.tiktok)}</a></span>` : ''}
      ${k.followers ? `<span>👥 ${esc(k.followers)}</span>` : ''}
      ${tierBadge(k.tier)}
    </div>
    ${k.note ? `<div style="font-size:11px;color:var(--muted);margin-bottom:8px;line-height:1.4;">${esc(k.note.slice(0,60))}${k.note.length>60?'…':''}</div>` : ''}
    <div class="kanban-card-actions" onclick="event.stopPropagation()">
      <select style="flex:1;background:var(--bg4);border:1px solid var(--border);color:var(--text);border-radius:5px;padding:4px 6px;font-size:11px;cursor:pointer;"
        onchange="moveCard('${k.id}',this.value)">
        <option value="">Pindahkan ke...</option>
        ${moveOpts}
      </select>
      <button class="btn btn-primary btn-xs" onclick="openSend('${k.id}')">📤</button>
    </div>
  </div>`;
}

function moveCard(id, status) {
  if (!status) return;
  DB.updateStatus(id, status);
  renderKanban();
  toast('Status diperbarui!', 'success');
}
