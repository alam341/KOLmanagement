// ===== AUTH MODULE =====
const AUTH = {
  get users()   { return JSON.parse(localStorage.getItem('kol_users') || '[]'); },
  set users(v)  { localStorage.setItem('kol_users', JSON.stringify(v)); },
  get session() { return JSON.parse(sessionStorage.getItem('kol_session') || 'null'); },
  set session(v){ v ? sessionStorage.setItem('kol_session', JSON.stringify(v)) : sessionStorage.removeItem('kol_session'); },

  requireAuth() {
    if (!this.session) { window.location.href = 'login.html'; return false; }
    return true;
  },

  isAdmin() { return this.session?.role === 'admin'; },

  logout() {
    this.session = null;
    window.location.href = 'login.html';
  },

  addUser(name, email, password, role) {
    const users = this.users;
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase()))
      return { ok: false, msg: 'Email sudah terdaftar.' };
    const user = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      name, email: email.toLowerCase(), password, role,
      status: 'active', // admin yang tambah manual = langsung aktif
      createdAt: new Date().toISOString()
    };
    users.push(user);
    this.users = users;
    return { ok: true };
  },

  approveUser(id) {
    const users = this.users;
    const u = users.find(x => x.id === id);
    if (!u) return;
    u.status = 'active';
    this.users = users;
  },

  changeRole(id, role) {
    const users = this.users;
    const u = users.find(x => x.id === id);
    if (!u) return;
    u.role = role;
    this.users = users;
  },

  deleteUser(id) {
    if (id === this.session?.id) return { ok: false, msg: 'Tidak bisa menghapus akun sendiri.' };
    this.users = this.users.filter(u => u.id !== id);
    return { ok: true };
  },
};
