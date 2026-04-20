// ===== DATABASE LAYER =====
const DB = {
  get kols()      { return JSON.parse(localStorage.getItem('kol_list') || '[]'); },
  set kols(v)     { localStorage.setItem('kol_list', JSON.stringify(v)); },
  get templates() { return JSON.parse(localStorage.getItem('kol_templates') || JSON.stringify(DB._defaultTemplates())); },
  set templates(v){ localStorage.setItem('kol_templates', JSON.stringify(v)); },
  get history()   { return JSON.parse(localStorage.getItem('kol_history') || '[]'); },
  set history(v)  { localStorage.setItem('kol_history', JSON.stringify(v)); },
  get settings()  { return JSON.parse(localStorage.getItem('kol_settings') || JSON.stringify({ brandName: '', defaultProduct: '', defaultCommission: '10' })); },
  set settings(v) { localStorage.setItem('kol_settings', JSON.stringify(v)); },

  addHistory(kol, action) {
    const h = this.history;
    h.unshift({ id: uid(), kolName: kol.name, kolId: kol.id, action, status: kol.status, ts: new Date().toISOString() });
    if (h.length > 500) h.splice(500);
    this.history = h;
  },

  upsertKOL(data) {
    const kols = this.kols;
    const idx = kols.findIndex(k => k.id === data.id);
    if (idx >= 0) {
      kols[idx] = { ...kols[idx], ...data, updatedAt: new Date().toISOString() };
      this.kols = kols;
      this.addHistory(kols[idx], 'Data diperbarui');
    } else {
      const now = new Date().toISOString();
      const entry = { ...data, id: data.id || uid(), createdAt: now, updatedAt: now };
      entry.tier = computeTier(entry.followersRaw || 0);
      entry.score = computeScore(entry);
      kols.push(entry);
      this.kols = kols;
      this.addHistory(entry, 'KOL ditambahkan');
    }
  },

  deleteKOL(id) {
    const kols = this.kols;
    const k = kols.find(x => x.id === id);
    this.kols = kols.filter(x => x.id !== id);
    if (k) this.addHistory(k, 'KOL dihapus');
  },

  updateStatus(id, status) {
    const kols = this.kols;
    const k = kols.find(x => x.id === id);
    if (!k) return;
    const old = k.status;
    k.status = status;
    k.updatedAt = new Date().toISOString();
    this.kols = kols;
    this.addHistory(k, `Status: ${old} → ${status}`);
  },

  _defaultTemplates() {
    return [
      {
        id: 't1', name: 'Pesan Pertama WA', platform: 'wa',
        body: `Halo Kak {nama}! 👋\n\nSaya dari tim {brand}. Saya melihat konten Kak {nama} di TikTok dan sangat tertarik dengan kontennya di niche {niche}! 🔥\n\nKami sedang mencari KOL/Affiliate untuk berkolaborasi mempromosikan *{produk}* kami.\n\nBenefit:\n✅ Komisi {komisi}% per penjualan\n✅ Free produk untuk review\n✅ Support konten & brief\n\nApakah Kakak tertarik? 🙏`
      },
      {
        id: 't2', name: 'DM TikTok Pertama', platform: 'tiktok',
        body: `Hiii Kak {nama}! 😊\n\nSuka banget sama kontennya!\n\nKami dari {brand} pengen ajak kolaborasi untuk promosi {produk}. Ada komisi {komisi}% & free produk buat Kak {nama}.\n\nBoleh DM balik atau WA kami? 🙏✨`
      },
      {
        id: 't3', name: 'Follow Up (3 Hari)', platform: 'both',
        body: `Halo Kak {nama}! 😊\n\nMau follow up terkait kolaborasi {produk} dari {brand}.\n\nApakah sudah sempat membaca pesan kami? Kami sangat ingin berkolaborasi dengan Kak {nama}! 🙏`
      },
      {
        id: 't4', name: 'Pesan Deal / Closing', platform: 'both',
        body: `Halo Kak {nama}! 🎉\n\nSenang sekali Kakak tertarik berkolaborasi!\n\nDetail kerjasama:\n📦 Produk: {produk}\n💰 Komisi: {komisi}% per penjualan\n🎁 Free produk + materi konten\n\nLangkah selanjutnya:\n1. Kakak setuju → kami kirim brief & produk\n2. Buat konten (deadline: [tanggal])\n3. Upload & tag akun kami\n\nApakah Kakak setuju? 🙏`
      },
    ];
  }
};

// ===== UTILITIES =====
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatFollowers(n) {
  if (!n || isNaN(n)) return '';
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1).replace(/\.0$/,'') + 'M';
  if (n >= 1_000) return (n/1_000).toFixed(1).replace(/\.0$/,'') + 'K';
  return String(Math.round(n));
}

function formatNumber(n) {
  if (!n || isNaN(n)) return '';
  if (n >= 1_000_000_000) return (n/1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n/1_000).toFixed(1) + 'K';
  return String(Math.round(n));
}

function formatRupiah(n) {
  if (!n || isNaN(n)) return '';
  if (n >= 1_000_000_000) return 'Rp' + (n/1_000_000_000).toFixed(1) + 'M';
  if (n >= 1_000_000) return 'Rp' + (n/1_000_000).toFixed(0) + 'jt';
  return 'Rp' + Math.round(n).toLocaleString('id-ID');
}

function parseFollowersRaw(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  const s = String(str).toUpperCase().replace(/,/g,'.');
  if (s.includes('M')) return parseFloat(s) * 1_000_000;
  if (s.includes('K')) return parseFloat(s) * 1_000;
  return parseFloat(s) || 0;
}

function computeTier(followersRaw) {
  const f = Number(followersRaw) || 0;
  if (f >= 1_000_000) return 'mega';
  if (f >= 100_000)   return 'macro';
  if (f >= 10_000)    return 'micro';
  return 'nano';
}

function computeScore(kol) {
  let score = 0;
  const f = Number(kol.followersRaw) || 0;
  const e = parseFloat(String(kol.engagementRaw || kol.engagement || '0').replace('%','')) || 0;
  const v = Number(kol.viewsRaw) || 0;
  const p = Number(kol.pendapatanRaw) || 0;
  const s = Number(kol.penjualan) || 0;

  // followers score (0-30): log scale
  if (f > 0) score += Math.min(30, (Math.log10(f) / Math.log10(5_000_000)) * 30);
  // engagement score (0-30)
  if (e > 0) score += Math.min(30, (e / 10) * 30);
  // views score (0-20)
  if (v > 0) score += Math.min(20, (Math.log10(v+1) / Math.log10(50_000_000)) * 20);
  // revenue score (0-20)
  if (p > 0) score += Math.min(20, (Math.log10(p+1) / Math.log10(5_000_000_000)) * 20);

  return Math.round(Math.min(100, score));
}

function fillTemplate(body, kol) {
  const s = DB.settings;
  return body
    .replace(/{nama}/g, kol.name || '')
    .replace(/{username}/g, kol.tiktok || '')
    .replace(/{produk}/g, kol.product || s.defaultProduct || '[Produk]')
    .replace(/{brand}/g, s.brandName || '[Brand]')
    .replace(/{komisi}/g, s.defaultCommission || '10')
    .replace(/{followers}/g, kol.followers || '')
    .replace(/{niche}/g, kol.niche || '');
}

function toast(msg, type = 'success') {
  const wrap = document.getElementById('toastWrap');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  t.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function tierBadge(tier) {
  const map = { nano: 'Nano', micro: 'Micro', macro: 'Macro', mega: 'Mega' };
  return `<span class="badge tier-${tier||'nano'}">${map[tier]||'Nano'}</span>`;
}

function statusBadge(status) {
  const map = { new:'Belum Hubungi', contacted:'Dihubungi', replied:'Reply', deal:'Deal ✓', followup:'Follow Up', rejected:'Rejected' };
  return `<span class="badge badge-${status||'new'}">${map[status]||'Belum'}</span>`;
}

function platformLabel(p) {
  if (p === 'wa') return '<span style="color:#25d366;font-size:12px;font-weight:700;">💬 WA</span>';
  if (p === 'tiktok') return '<span style="font-size:12px;">🎵 TikTok</span>';
  return '<span style="font-size:11px;">💬 WA + 🎵 TikTok</span>';
}

function relativeTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  return `${d} hari lalu`;
}
