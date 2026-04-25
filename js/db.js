// ===== DATABASE LAYER (Supabase + in-memory cache) =====
// Reads: sync dari memory cache (setelah loadAll() dipanggil saat boot)
// Writes: sync update memory + async write ke Supabase (optimistic)

const DB = {
  _data: { kols: null, templates: null, history: null, settings: null },

  // ===== SYNC GETTERS =====
  get kols()      { return this._data.kols      ?? []; },
  get templates() { return this._data.templates ?? []; },
  get history()   { return this._data.history   ?? []; },
  get settings()  { return this._data.settings  ?? { brandName:'', defaultProduct:'', defaultCommission:'10' }; },

  // ===== SYNC SETTERS (+ async flush) =====
  set kols(v)     { this._data.kols      = v; this._flushKols(v); },
  set templates(v){ this._data.templates = v; this._flushTemplates(v); },
  set settings(v) { this._data.settings  = v; this._flushSettings(v); },

  // ===== INIT: load semua data dari Supabase =====
  async loadAll() {
    const [allKols, tmplRes, histRes, setRes] = await Promise.all([
      this._fetchAllKols(),
      _sb.from('templates').select('*').order('created_at'),
      _sb.from('kol_history').select('*').order('created_at', { ascending: false }).limit(500),
      _sb.from('app_settings').select('*').eq('key', 'brand_settings').maybeSingle(),
    ]);
    this._data.kols      = allKols.map(fromDbRow);
    this._data.history   = (histRes.data  || []).map(fromHistoryRow);
    this._data.templates = tmplRes.data?.length ? tmplRes.data : this._defaultTemplates();
    this._data.settings  = setRes.data?.value   ?? { brandName:'', defaultProduct:'', defaultCommission:'10' };

    // Seed templates jika belum ada
    if (!tmplRes.data?.length) this._flushTemplates(this._data.templates);
  },

  async _fetchAllKols() {
    const PAGE = 1000;
    let all = [], from = 0;
    while (true) {
      const { data, error } = await _sb.from('kols').select('*')
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      all = all.concat(data || []);
      if (!data || data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  },

  // ===== KOL CRUD =====
  upsertKOL(data) {
    const kols = this._data.kols;
    const idx  = kols.findIndex(k => k.id === data.id);
    const now  = new Date().toISOString();
    if (idx >= 0) {
      kols[idx] = { ...kols[idx], ...data, updatedAt: now };
      this.addHistory(kols[idx], 'Data diperbarui');
    } else {
      const entry = { ...data, id: data.id || uid(), tier: computeTier(data.followersRaw||0), score: computeScore(data), createdAt: now, updatedAt: now };
      entry.score = computeScore(entry);
      kols.unshift(entry);
      this.addHistory(entry, 'KOL ditambahkan');
    }
    this._writeKol(data).catch(e => toast('Sync error: '+e.message,'error'));
  },

  deleteKOL(id) {
    const k = this._data.kols.find(x => x.id === id);
    this._data.kols = this._data.kols.filter(x => x.id !== id);
    if (k) this.addHistory(k, 'KOL dihapus');
    _sb.from('kols').delete().eq('id', id)
      .then(({ error }) => { if (error) toast('Sync error: '+error.message,'error'); });
  },

  deleteKOLs(ids) {
    const idsSet = new Set(ids);
    const removed = this._data.kols.filter(x => idsSet.has(x.id));
    this._data.kols = this._data.kols.filter(x => !idsSet.has(x.id));
    removed.forEach(k => this.addHistory(k, 'KOL dihapus'));
    _sb.from('kols').delete().in('id', ids)
      .then(({ error }) => { if (error) toast('Sync error: '+error.message,'error'); });
  },

  updateStatus(id, status, customAction) {
    const k = this._data.kols.find(x => x.id === id);
    if (!k) return;
    const old = k.status;
    k.status = status;
    k.updatedAt = new Date().toISOString();
    this.addHistory(k, customAction || `Status: ${old} → ${status}`);
    _sb.from('kols').update({ status, updated_at: k.updatedAt }).eq('id', id)
      .then(({ error }) => { if (error) toast('Sync error: '+error.message,'error'); });
  },

  insertKols(newKols) {
    const now = new Date().toISOString();
    newKols.forEach(r => {
      const entry = { ...r, id: r.id||uid(), createdAt: now, updatedAt: now };
      entry.tier  = computeTier(entry.followersRaw || 0);
      entry.score = computeScore(entry);
      this._data.kols.push(entry);
    });
    _sb.from('kols').insert(newKols.map(r => toDbRow({ ...r, id: r.id||uid(), createdAt: now, updatedAt: now })))
      .then(({ error }) => { if (error) toast('Sync error: '+error.message,'error'); });
  },

  clearKols() {
    this._data.kols = [];
    _sb.from('kols').delete().not('id','is',null)
      .then(({ error }) => { if (error) toast('Sync error: '+error.message,'error'); });
  },

  // ===== HISTORY =====
  addHistory(kol, action) {
    const entry = { id: uid(), kolId: kol.id, kolName: kol.name, action, status: kol.status, ts: new Date().toISOString() };
    const h = this._data.history || [];
    h.unshift(entry);
    if (h.length > 500) h.splice(500);
    this._data.history = h;
    _sb.auth.getUser().then(({ data: { user } }) => {
      _sb.from('kol_history').insert({
        id: entry.id, kol_id: kol.id, kol_name: kol.name,
        action, kol_status: kol.status, user_id: user?.id,
      }).then(({ error }) => { if (error) console.error('History sync:', error.message); });
    });
  },

  clearHistory() {
    this._data.history = [];
    _sb.from('kol_history').delete().not('id','is',null)
      .then(({ error }) => { if (error) toast('Sync error: '+error.message,'error'); });
  },

  // ===== PRIVATE ASYNC WRITERS =====
  async _writeKol(data) {
    const now = new Date().toISOString();
    const { error } = await _sb.from('kols').upsert(toDbRow({ ...data, updatedAt: now }));
    if (error) throw error;
  },

  async _flushKols(kols) {
    if (!kols.length) return;
    const { error } = await _sb.from('kols').upsert(kols.map(toDbRow));
    if (error) toast('Sync error: '+error.message,'error');
  },

  async _flushTemplates(tmpls) {
    if (!tmpls.length) return;
    const rows = tmpls.map(t => ({ id: t.id, name: t.name, platform: t.platform, body: t.body }));
    const { error } = await _sb.from('templates').upsert(rows);
    if (error) toast('Sync error: '+error.message,'error');
  },

  async _flushSettings(s) {
    const { error } = await _sb.from('app_settings').upsert({ key: 'brand_settings', value: s });
    if (error) toast('Sync error: '+error.message,'error');
  },

  // ===== DEFAULT TEMPLATES =====
  _defaultTemplates() {
    return [
      { id: 't1', name: 'Pesan Pertama WA', platform: 'wa',
        body: `Halo Kak {nama}! 👋\n\nSaya dari tim {brand}. Saya melihat konten Kak {nama} di TikTok dan sangat tertarik dengan kontennya di niche {niche}! 🔥\n\nKami sedang mencari KOL/Affiliate untuk berkolaborasi mempromosikan *{produk}* kami.\n\nBenefit:\n✅ Komisi {komisi}% per penjualan\n✅ Free produk untuk review\n✅ Support konten & brief\n\nApakah Kakak tertarik? 🙏` },
      { id: 't2', name: 'DM TikTok Pertama', platform: 'tiktok',
        body: `Hiii Kak {nama}! 😊\n\nSuka banget sama kontennya!\n\nKami dari {brand} pengen ajak kolaborasi untuk promosi {produk}. Ada komisi {komisi}% & free produk buat Kak {nama}.\n\nBoleh DM balik atau WA kami? 🙏✨` },
      { id: 't3', name: 'Follow Up (3 Hari)', platform: 'both',
        body: `Halo Kak {nama}! 😊\n\nMau follow up terkait kolaborasi {produk} dari {brand}.\n\nApakah sudah sempat membaca pesan kami? Kami sangat ingin berkolaborasi dengan Kak {nama}! 🙏` },
      { id: 't4', name: 'Pesan Deal / Closing', platform: 'both',
        body: `Halo Kak {nama}! 🎉\n\nSenang sekali Kakak tertarik berkolaborasi!\n\nDetail kerjasama:\n📦 Produk: {produk}\n💰 Komisi: {komisi}% per penjualan\n🎁 Free produk + materi konten\n\nLangkah selanjutnya:\n1. Kakak setuju → kami kirim brief & produk\n2. Buat konten (deadline: [tanggal])\n3. Upload & tag akun kami\n\nApakah Kakak setuju? 🙏` },
    ];
  },
};

// ===== ROW MAPPERS =====
function toDbRow(k) {
  return {
    id: k.id, name: k.name,
    tiktok: k.tiktok||'', wa: k.wa||'', email: k.email||'',
    instagram: k.instagram||'', platform: k.platform||'wa',
    niche: k.niche||'', followers: k.followers||'',
    followers_raw: k.followersRaw||0,
    product: k.product||'', status: k.status||'new',
    note: k.note||'', tier: k.tier||'nano', score: k.score||0,
    engagement: k.engagement||'', engagement_raw: k.engagementRaw||0,
    views_raw: k.viewsRaw||0, pendapatan_raw: k.pendapatanRaw||0,
    penjualan: k.penjualan||0,
    updated_at: k.updatedAt||new Date().toISOString(),
    created_at: k.createdAt||new Date().toISOString(),
  };
}

function fromDbRow(r) {
  return {
    id: r.id, name: r.name,
    tiktok: r.tiktok, wa: r.wa, email: r.email,
    instagram: r.instagram, platform: r.platform,
    niche: r.niche, followers: r.followers,
    followersRaw: Number(r.followers_raw)||0,
    product: r.product, status: r.status,
    note: r.note, tier: r.tier, score: r.score||0,
    engagement: r.engagement,
    engagementRaw: Number(r.engagement_raw)||0,
    viewsRaw: Number(r.views_raw)||0,
    pendapatanRaw: Number(r.pendapatan_raw)||0,
    penjualan: Number(r.penjualan)||0,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function fromHistoryRow(r) {
  return { id: r.id, kolId: r.kol_id, kolName: r.kol_name, action: r.action, status: r.kol_status, ts: r.created_at };
}

// ===== UTILITIES =====
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatFollowers(n) {
  if (!n||isNaN(n)) return '';
  if (n>=1_000_000) return (n/1_000_000).toFixed(1).replace(/\.0$/,'')+'M';
  if (n>=1_000)     return (n/1_000).toFixed(1).replace(/\.0$/,'')+'K';
  return String(Math.round(n));
}

function formatNumber(n) {
  if (!n||isNaN(n)) return '';
  if (n>=1_000_000_000) return (n/1_000_000_000).toFixed(1)+'B';
  if (n>=1_000_000)     return (n/1_000_000).toFixed(1)+'M';
  if (n>=1_000)         return (n/1_000).toFixed(1)+'K';
  return String(Math.round(n));
}

function formatRupiah(n) {
  if (!n||isNaN(n)) return '';
  if (n>=1_000_000_000) return 'Rp'+(n/1_000_000_000).toFixed(1)+'M';
  if (n>=1_000_000)     return 'Rp'+(n/1_000_000).toFixed(0)+'jt';
  return 'Rp'+Math.round(n).toLocaleString('id-ID');
}

function parseFollowersRaw(str) {
  if (!str) return 0;
  if (typeof str==='number') return str;
  const s = String(str).toUpperCase().replace(/,/g,'.');
  if (s.includes('M')) return parseFloat(s)*1_000_000;
  if (s.includes('K')) return parseFloat(s)*1_000;
  return parseFloat(s)||0;
}

function computeTier(f) {
  f = Number(f)||0;
  if (f>=1_000_000) return 'mega';
  if (f>=100_000)   return 'macro';
  if (f>=10_000)    return 'micro';
  return 'nano';
}

function computeScore(kol) {
  let score = 0;
  const f = Number(kol.followersRaw)||0;
  const e = parseFloat(String(kol.engagementRaw||kol.engagement||'0').replace('%',''))||0;
  const v = Number(kol.viewsRaw)||0;
  const p = Number(kol.pendapatanRaw)||0;
  if (f>0) score += Math.min(30,(Math.log10(f)/Math.log10(5_000_000))*30);
  if (e>0) score += Math.min(30,(e/10)*30);
  if (v>0) score += Math.min(20,(Math.log10(v+1)/Math.log10(50_000_000))*20);
  if (p>0) score += Math.min(20,(Math.log10(p+1)/Math.log10(5_000_000_000))*20);
  return Math.round(Math.min(100,score));
}

function fillTemplate(body, kol) {
  const s = DB.settings;
  return body
    .replace(/{nama}/g,     kol.name||'')
    .replace(/{username}/g, kol.tiktok||'')
    .replace(/{produk}/g,   kol.product||s.defaultProduct||'[Produk]')
    .replace(/{brand}/g,    s.brandName||'[Brand]')
    .replace(/{komisi}/g,   s.defaultCommission||'10')
    .replace(/{followers}/g,kol.followers||'')
    .replace(/{niche}/g,    kol.niche||'');
}

function toast(msg, type='success', duration=3000) {
  const wrap = document.getElementById('toastWrap');
  if (!wrap) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icon = type==='success'?'✓':type==='error'?'✕':'ℹ';
  t.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  wrap.appendChild(t);
  setTimeout(()=>t.remove(), duration);
}

function tierBadge(tier) {
  const map = { nano:'Nano', micro:'Micro', macro:'Macro', mega:'Mega' };
  return `<span class="badge tier-${tier||'nano'}">${map[tier]||'Nano'}</span>`;
}

function statusBadge(status) {
  const map = { new:'Belum Hubungi', contacted:'Dihubungi', replied:'Reply', deal:'Deal ✓', followup:'Follow Up', rejected:'Rejected' };
  return `<span class="badge badge-${status||'new'}">${map[status]||'Belum'}</span>`;
}

function platformLabel(p) {
  if (p==='wa')     return '<span style="color:#25d366;font-size:12px;font-weight:700;">💬 WA</span>';
  if (p==='tiktok') return '<span style="font-size:12px;">🎵 TikTok</span>';
  return '<span style="font-size:11px;">💬 WA + 🎵 TikTok</span>';
}

function relativeTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff/60000);
  if (m<1)  return 'baru saja';
  if (m<60) return `${m} menit lalu`;
  const h = Math.floor(m/60);
  if (h<24) return `${h} jam lalu`;
  return `${Math.floor(h/24)} hari lalu`;
}
