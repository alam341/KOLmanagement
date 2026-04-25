// ===== MANAJEMEN USER (Admin Only) =====
function initUsers() {
  if (!AUTH.isAdmin()) return;
  renderUsersTable();
}

function renderUsersTable() {
  const users = AUTH.users;
  const me    = AUTH.session;
  const body  = document.getElementById('usersTableBody');
  if (!body) return;

  if (!users.length) {
    body.innerHTML = '<tr class="empty-row"><td colspan="5">Belum ada user terdaftar.</td></tr>';
    return;
  }

  body.innerHTML = users.map(u => {
    const isSelf   = u.id === me?.id;
    const isPending = u.status === 'pending';
    const roleLabel = u.role === 'admin'
      ? '<span class="badge tier-macro" style="gap:4px;">👑 Admin</span>'
      : '<span class="badge tier-micro" style="gap:4px;">🎯 KOL Spesialis</span>';
    const statusLabel = isPending
      ? '<span class="badge badge-followup" style="gap:4px;">⏳ Menunggu</span>'
      : '<span class="badge badge-deal" style="gap:4px;">✓ Aktif</span>';
    const date = u.createdAt
      ? new Date(u.createdAt).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })
      : '-';

    return `
      <tr ${isPending ? 'style="opacity:.75;"' : ''}>
        <td>
          <div style="font-weight:600;font-size:13px;">${esc(u.name)}</div>
          ${isSelf ? '<div style="font-size:10px;color:var(--accent2);margin-top:2px;">● Akun aktif kamu</div>' : ''}
        </td>
        <td style="color:var(--muted);font-size:12px;">${esc(u.email)}</td>
        <td>
          ${roleLabel}
          <span style="margin-left:4px;">${statusLabel}</span>
        </td>
        <td style="color:var(--muted);font-size:12px;">${date}</td>
        <td>
          ${isPending ? `
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
              <button class="btn btn-green btn-xs" onclick="approveUser('${u.id}')">✓ Setujui</button>
              <button class="btn btn-danger btn-xs" onclick="deleteUser('${u.id}')">Tolak</button>
            </div>
          ` : !isSelf ? `
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
              <select class="filter-select" style="padding:5px 8px;font-size:11px;"
                      onchange="changeUserRole('${u.id}', this.value)">
                <option value="admin"      ${u.role==='admin'      ? 'selected' : ''}>👑 Admin</option>
                <option value="specialist" ${u.role==='specialist' ? 'selected' : ''}>🎯 KOL Spesialis</option>
              </select>
              <button class="btn btn-danger btn-xs" onclick="deleteUser('${u.id}')">Hapus</button>
            </div>
          ` : '<span style="font-size:11px;color:var(--muted);">—</span>'}
        </td>
      </tr>
    `;
  }).join('');

  updatePendingBadge();
}

function approveUser(id) {
  AUTH.approveUser(id);
  const user = AUTH.users.find(u => u.id === id);
  toast(`Akun "${user?.name}" berhasil diaktifkan.`, 'success');
  renderUsersTable();
}

function changeUserRole(id, role) {
  AUTH.changeRole(id, role);
  toast('Role berhasil diperbarui.', 'success');
  renderUsersTable();
}

function deleteUser(id) {
  const user = AUTH.users.find(u => u.id === id);
  if (!user) return;
  const label = user.status === 'pending' ? `Tolak pendaftaran "${user.name}"?` : `Hapus akun "${user.name}" (${user.email})?`;
  if (!confirm(label + '\nTindakan ini tidak bisa dibatalkan.')) return;
  const result = AUTH.deleteUser(id);
  if (!result.ok) { toast(result.msg, 'error'); return; }
  toast('User berhasil dihapus.', 'success');
  renderUsersTable();
}

function openAddUserModal() {
  document.getElementById('addUserName').value  = '';
  document.getElementById('addUserEmail').value = '';
  document.getElementById('addUserPass').value  = '';
  document.getElementById('addUserRole').value  = 'specialist';
  const errEl = document.getElementById('addUserError');
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  openModal('modalAddUser');
}

function doAddUser() {
  const name  = document.getElementById('addUserName').value.trim();
  const email = document.getElementById('addUserEmail').value.trim();
  const pass  = document.getElementById('addUserPass').value;
  const role  = document.getElementById('addUserRole').value;
  const errEl = document.getElementById('addUserError');

  const showErr = msg => { errEl.textContent = msg; errEl.style.display = 'block'; };
  errEl.style.display = 'none';

  if (!name || !email || !pass) { showErr('Semua kolom wajib diisi.'); return; }
  if (pass.length < 6) { showErr('Password minimal 6 karakter.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showErr('Format email tidak valid.'); return; }

  const result = AUTH.addUser(name, email, pass, role);
  if (!result.ok) { showErr(result.msg); return; }

  closeModal('modalAddUser');
  toast(`Akun "${name}" berhasil dibuat!`, 'success');
  renderUsersTable();
}

function updatePendingBadge() {
  const pendingCount = AUTH.users.filter(u => u.status === 'pending').length;
  const badge = document.getElementById('pendingBadge');
  if (!badge) return;
  if (pendingCount > 0) {
    badge.textContent = pendingCount;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}
