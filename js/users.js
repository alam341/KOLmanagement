// ===== MANAJEMEN USER (Admin Only) =====
async function initUsers() {
  if (!await AUTH.isAdminOrSPV()) return;
  await renderUsersTable();
}

async function renderUsersTable() {
  const users   = await AUTH.getProfiles();
  const profile = await AUTH.getProfile();
  const isAdmin = profile?.role === 'admin';
  const body    = document.getElementById('usersTableBody');
  if (!body) return;

  if (!users.length) {
    body.innerHTML = '<tr class="empty-row"><td colspan="5">Belum ada user terdaftar.</td></tr>';
    updatePendingBadge(); return;
  }

  body.innerHTML = users.map(u => {
    const isSelf    = u.id === profile?.id;
    const isPending = u.status === 'pending';
    const roleLabel = u.role === 'admin'
      ? '<span class="badge tier-macro">👑 Admin</span>'
      : u.role === 'spv'
      ? '<span class="badge tier-mid" style="background:rgba(249,115,22,.15);color:var(--orange);border:1px solid rgba(249,115,22,.3);">👁 SPV</span>'
      : '<span class="badge tier-micro">🎯 KOL Spesialis</span>';
    const statusLabel = isPending
      ? '<span class="badge badge-followup">⏳ Menunggu</span>'
      : '<span class="badge badge-deal">✓ Aktif</span>';
    const date = u.created_at
      ? new Date(u.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})
      : '-';

    // Toko assignment section
    const tokoList    = DB.tokoList || [];
    const assignedIds = u.assigned_toko_ids || [];
    const assignedChips = assignedIds.map(tid => {
      const t = tokoList.find(x => x.id === tid);
      return t
        ? `<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(124,58,237,.12);color:var(--accent);border:1px solid rgba(124,58,237,.3);border-radius:6px;padding:2px 8px;font-size:10px;font-weight:600;">
            🏪 ${esc(t.name)}
            ${isAdmin && !isSelf ? `<button onclick="removeToko('${u.id}','${tid}')" style="background:none;border:none;cursor:pointer;color:var(--muted);line-height:1;padding:0 0 0 2px;font-size:11px;" title="Hapus">✕</button>` : ''}
           </span>`
        : '';
    }).filter(Boolean).join('');

    const availableTokos = tokoList.filter(t => !assignedIds.includes(t.id));
    const addTokoHtml = isAdmin && !isSelf && availableTokos.length
      ? `<select onchange="addTokoToUser('${u.id}',this)" style="font-size:11px;padding:3px 6px;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text);margin-top:6px;width:100%;">
           <option value="">+ Assign Toko...</option>
           ${availableTokos.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
         </select>` : '';

    const tokoSection = !isPending ? `
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border);">
        <div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;margin-bottom:5px;">Toko Assigned</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">
          ${assignedChips || `<span style="font-size:11px;color:var(--muted);">Belum ada</span>`}
        </div>
        ${addTokoHtml}
      </div>` : '';

    return `
      <tr ${isPending ? 'style="opacity:.75;"' : ''}>
        <td>
          <div style="font-weight:600;font-size:13px;">${esc(u.name)}</div>
          ${isSelf ? '<div style="font-size:10px;color:var(--accent2);margin-top:2px;">● Akun aktif kamu</div>' : ''}
        </td>
        <td style="color:var(--muted);font-size:12px;">${esc(u.email||'')}</td>
        <td>${roleLabel} <span style="margin-left:4px;">${statusLabel}</span></td>
        <td style="color:var(--muted);font-size:12px;">${date}</td>
        <td>
          ${isPending ? (isAdmin ? `
            <div style="display:flex;gap:6px;align-items:center;">
              <button class="btn btn-green btn-xs" onclick="approveUser('${u.id}')">✓ Setujui</button>
              <button class="btn btn-danger btn-xs" onclick="deleteUser('${u.id}')">Tolak</button>
            </div>
          ` : `<span style="font-size:11px;color:var(--muted);">—</span>`) : !isSelf ? `
            <div>
              ${isAdmin ? `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                <select class="filter-select" style="padding:5px 8px;font-size:11px;"
                        onchange="changeUserRole('${u.id}',this.value)">
                  <option value="admin"      ${u.role==='admin'      ?'selected':''}>👑 Admin</option>
                  <option value="spv"        ${u.role==='spv'        ?'selected':''}>👁 SPV</option>
                  <option value="specialist" ${u.role==='specialist' ?'selected':''}>🎯 KOL Spesialis</option>
                </select>
                <button class="btn btn-danger btn-xs" onclick="deleteUser('${u.id}')">Hapus</button>
              </div>` : ''}
              ${tokoSection}
            </div>
          ` : `<div>${tokoSection}</div>`}
        </td>
      </tr>`;
  }).join('');

  updatePendingBadge();
}

async function approveUser(id) {
  try {
    await AUTH.approveUser(id);
    toast('Akun berhasil diaktifkan.', 'success');
    await renderUsersTable();
  } catch(e) { toast('Gagal: '+e.message,'error'); }
}

async function changeUserRole(id, role) {
  try {
    await AUTH.changeRole(id, role);
    toast('Role diperbarui.', 'success');
    await renderUsersTable();
  } catch(e) { toast('Gagal: '+e.message,'error'); }
}

async function deleteUser(id) {
  const users = await AUTH.getProfiles();
  const user  = users.find(u => u.id === id);
  if (!user) return;
  const label = user.status==='pending' ? `Tolak pendaftaran "${user.name}"?` : `Hapus akun "${user.name}"?`;
  if (!confirm(label+'\nTindakan ini tidak bisa dibatalkan.')) return;
  const result = await AUTH.deleteUser(id);
  if (!result.ok) { toast(result.msg,'error'); return; }
  toast('User dihapus.','success');
  await renderUsersTable();
}

function openAddUserModal() {
  document.getElementById('addUserName').value  = '';
  document.getElementById('addUserEmail').value = '';
  document.getElementById('addUserPass').value  = '';
  document.getElementById('addUserRole').value  = 'specialist';
  const errEl = document.getElementById('addUserError');
  if (errEl) { errEl.textContent=''; errEl.style.display='none'; }
  openModal('modalAddUser');
}

async function doAddUser() {
  const name  = document.getElementById('addUserName').value.trim();
  const email = document.getElementById('addUserEmail').value.trim();
  const pass  = document.getElementById('addUserPass').value;
  const role  = document.getElementById('addUserRole').value;
  const errEl = document.getElementById('addUserError');
  const showErr = msg => { errEl.textContent=msg; errEl.style.display='block'; };
  errEl.style.display='none';

  if (!name||!email||!pass) { showErr('Semua kolom wajib diisi.'); return; }
  if (pass.length<6) { showErr('Password minimal 6 karakter.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showErr('Format email tidak valid.'); return; }

  const btn = document.querySelector('#modalAddUser .btn-primary');
  if (btn) btn.disabled = true;
  try {
    const result = await AUTH.addUser(name, email, pass, role);
    if (!result.ok) { showErr(result.msg); return; }
    closeModal('modalAddUser');
    toast(`Akun "${name}" berhasil dibuat!`,'success');
    await renderUsersTable();
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function addTokoToUser(userId, selectEl) {
  const tokoId = selectEl.value;
  if (!tokoId) return;
  try {
    const users   = await AUTH.getProfiles();
    const user    = users.find(u => u.id === userId);
    const current = user?.assigned_toko_ids || [];
    if (current.includes(tokoId)) { selectEl.value = ''; return; }
    const updated = [...current, tokoId];
    const { error } = await _sb.from('profiles').update({ assigned_toko_ids: updated }).eq('id', userId);
    if (error) throw error;
    selectEl.value = '';
    await renderUsersTable();
    toast('Toko berhasil di-assign', 'success');
  } catch(e) { toast('Gagal assign toko: '+e.message, 'error'); }
}

async function removeToko(userId, tokoId) {
  try {
    const users   = await AUTH.getProfiles();
    const user    = users.find(u => u.id === userId);
    const updated = (user?.assigned_toko_ids || []).filter(id => id !== tokoId);
    const { error } = await _sb.from('profiles').update({ assigned_toko_ids: updated }).eq('id', userId);
    if (error) throw error;
    await renderUsersTable();
    toast('Toko dihapus dari assignment', 'success');
  } catch(e) { toast('Gagal: '+e.message, 'error'); }
}

async function updatePendingBadge() {
  const badge = document.getElementById('pendingBadge');
  if (!badge) return;
  try {
    const profiles = await AUTH.getProfiles();
    const count = profiles.filter(u => u.status==='pending').length;
    badge.textContent = count;
    badge.style.display = count > 0 ? '' : 'none';
  } catch { badge.style.display='none'; }
}
