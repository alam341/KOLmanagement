// ===== AUTH MODULE (Supabase) =====
const AUTH = {
  _profile: null,

  async getProfile(force = false) {
    if (this._profile && !force) return this._profile;
    const { data: { user } } = await _sb.auth.getUser();
    if (!user) return null;
    const { data } = await _sb.from('profiles').select('*').eq('id', user.id).single();
    this._profile = data;
    return data;
  },

  async requireAuth() {
    const { data: { session } } = await _sb.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return false; }
    const profile = await this.getProfile();
    if (!profile || profile.status === 'pending') {
      await _sb.auth.signOut();
      window.location.href = 'login.html?pending=1';
      return false;
    }
    return true;
  },

  async isAdmin() {
    const p = await this.getProfile();
    return p?.role === 'admin';
  },

  async logout() {
    await _sb.auth.signOut();
    this._profile = null;
    window.location.href = 'login.html';
  },

  // ===== Admin: kelola profiles =====
  async getProfiles() {
    const { data } = await _sb.from('profiles').select('*').order('created_at');
    return data || [];
  },

  async approveUser(id) {
    const { error } = await _sb.from('profiles').update({ status: 'active' }).eq('id', id);
    if (error) throw error;
  },

  async changeRole(id, role) {
    const { error } = await _sb.from('profiles').update({ role }).eq('id', id);
    if (error) throw error;
  },

  async deleteUser(id) {
    const profile = await this.getProfile();
    if (id === profile?.id) return { ok: false, msg: 'Tidak bisa menghapus akun sendiri.' };
    // Hapus profile → user tidak bisa login lagi (requireAuth cek profile)
    const { error } = await _sb.from('profiles').delete().eq('id', id);
    if (error) return { ok: false, msg: error.message };
    return { ok: true };
  },

  // Admin tambah user pakai temp client agar tidak logout admin
  async addUser(name, email, password, role) {
    const tempClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false, autoRefreshToken: false,
        storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      }
    });
    const { error } = await tempClient.auth.signUp({
      email, password,
      options: { data: { name, role, status: 'active' } } // langsung aktif
    });
    if (error) return { ok: false, msg: error.message };
    return { ok: true };
  },
};
