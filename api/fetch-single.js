// ===== Fetch views untuk 1 KOL secara manual =====
// Called from browser dengan JWT token

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function sbHeaders(key) {
  return {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

async function resolveShortUrl(shortUrl) {
  const res = await fetch(shortUrl, {
    method: 'HEAD', redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  return res.url || shortUrl;
}

function extractVideoId(url) {
  const m = url.match(/\/video\/(\d+)/);
  return m?.[1] || null;
}

async function fetchViews(videoUrl, apiKey, apiHost) {
  let fullUrl = videoUrl;
  if (videoUrl.includes('vt.tiktok.com') || videoUrl.includes('/t/')) {
    fullUrl = await resolveShortUrl(videoUrl);
  }
  const videoId = extractVideoId(fullUrl);
  if (!videoId) throw new Error('Tidak bisa extract video ID dari URL: ' + fullUrl);

  const headers = { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost };
  const endpoints = [
    `https://${apiHost}/video/info?url=${encodeURIComponent(fullUrl)}`,
    `https://${apiHost}/api/video/detail?url=${encodeURIComponent(fullUrl)}`,
    `https://${apiHost}/video/detail?id=${videoId}`,
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, { headers });
      if (!res.ok) continue;
      const json = await res.json();
      const views =
        json?.data?.statistics?.playCount   ??
        json?.data?.stats?.playCount        ??
        json?.data?.video?.stats?.playCount ??
        json?.itemInfo?.itemStruct?.stats?.playCount ??
        json?.data?.play_count              ??
        json?.statistics?.playCount         ??
        json?.stats?.playCount              ??
        null;
      if (views !== null) return Number(views);
    } catch { continue; }
  }
  throw new Error('Semua endpoint gagal untuk: ' + fullUrl);
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Ambil JWT dari header Authorization
  const jwt = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!jwt) return res.status(401).json({ error: 'Missing token' });

  const { kolId } = req.query;
  if (!kolId) return res.status(400).json({ error: 'kolId required' });

  // Verifikasi JWT & ambil user
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${jwt}` }
  });
  if (!userRes.ok) return res.status(401).json({ error: 'Invalid token' });
  const { id: userId } = await userRes.json();

  // Ambil listing record
  const listRes = await fetch(
    `${SUPABASE_URL}/rest/v1/kol_listing?kol_id=eq.${kolId}&user_id=eq.${userId}&select=link_video,upload_date`,
    { headers: sbHeaders(SUPABASE_SERVICE_KEY) }
  );
  const listings = await listRes.json();
  const listing  = listings?.[0];
  if (!listing?.link_video)  return res.status(400).json({ error: 'Link video tidak ada' });
  if (!listing?.upload_date) return res.status(400).json({ error: 'Upload date tidak ada' });

  // Hitung day number
  const upload   = new Date(listing.upload_date);
  const dayNum   = Math.floor((Date.now() - upload) / 86400000) + 1;
  if (dayNum > 28) return res.status(400).json({ error: 'Sudah lewat 28 hari' });

  // Ambil RapidAPI key dari settings user
  const setRes = await fetch(
    `${SUPABASE_URL}/rest/v1/app_settings?key=eq.brand_settings_${userId}&select=value`,
    { headers: sbHeaders(SUPABASE_SERVICE_KEY) }
  );
  const settings = await setRes.json();
  const apiKey   = settings?.[0]?.value?.rapidApiKey;
  const apiHost  = settings?.[0]?.value?.rapidApiHost || 'tiktok-scraper7.p.rapidapi.com';
  if (!apiKey) return res.status(400).json({ error: 'RapidAPI Key belum disimpan ke Supabase. Simpan ulang di Pengaturan.' });

  // Cek apakah hari ini sudah difetch
  const existRes = await fetch(
    `${SUPABASE_URL}/rest/v1/kol_views_log?kol_id=eq.${kolId}&user_id=eq.${userId}&day_number=eq.${dayNum}`,
    { headers: sbHeaders(SUPABASE_SERVICE_KEY) }
  );
  const existing = await existRes.json();
  if (existing?.length > 0) {
    return res.status(200).json({ ok: true, views: existing[0].views, dayNumber: dayNum, alreadyFetched: true });
  }

  // Fetch views
  try {
    const views = await fetchViews(listing.link_video, apiKey, apiHost);

    // Simpan ke kol_views_log
    await fetch(`${SUPABASE_URL}/rest/v1/kol_views_log`, {
      method: 'POST',
      headers: sbHeaders(SUPABASE_SERVICE_KEY),
      body: JSON.stringify({
        id: crypto.randomUUID(),
        kol_id: kolId, user_id: userId,
        views, day_number: dayNum,
        fetched_at: new Date().toISOString(),
      }),
    });

    return res.status(200).json({ ok: true, views, dayNumber: dayNum });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
