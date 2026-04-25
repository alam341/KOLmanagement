// ===== MANAJEMEN USER (Admin Only) =====
async function initUsers() {
  if (!await AUTH.isAdmin()) return;
  await renderUsersTable();
}

async function renderUsersTable() {
  const users  = await AUTH.getProfiles();
  const profile = await AUTH.getProfile();
  const body   = document.getElementById('usersTableBody');
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
      : '<span class="badge tier-micro">🎯 KOL Spesialis</span>';
    const statusLabel = isPending
      ? '<span class="badge badge-followup">⏳ Menunggu</span>'
      : '<span class="badge badge-deal">✓ Aktif</span>';
    const date = u.created_at
      ? new Date(u.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})
      : '-';

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
          ${isPending ? `
            <div style="display:flex;gap:6px;align-items:center;">
              <button class="btn btn-green btn-xs" onclick="approveUser('${u.id}')">✓ Setujui</button>
              <button class="btn btn-danger btn-xs" onclick="deleteUser('${u.id}')">Tolak</button>
            </div>
          ` : !isSelf ? `
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
              <select class="filter-select" style="padding:5px 8px;font-size:11px;"
                      onchange="changeUserRole('${u.id}',this.value)">
                <option value="admin"      ${u.role==='admin'      ?'selected':''}>👑 Admin</option>
                <option value="specialist" ${u.role==='specialist' ?'selected':''}>🎯 KOL Spesialis</option>
              </select>
              <button class="btn btn-danger btn-xs" onclick="deleteUser('${u.id}')">Hapus</button>
            </div>
          ` : '<span style="font-size:11px;color:var(--muted);">—</span>'}
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
