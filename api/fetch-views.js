// ===== VERCEL SERVERLESS FUNCTION: Auto-fetch TikTok views =====
// Dipanggil oleh cron-job.org setiap hari
// Header wajib: x-cron-secret: <CRON_SECRET>

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CRON_SECRET          = process.env.CRON_SECRET;

// Titik-titik fetch: hari 1-7 harian, lalu minggu 2/3/4
const FETCH_DAYS = [1, 2, 3, 4, 5, 6, 7, 14, 21, 28];

// ===== Supabase REST helpers =====
function sbHeaders() {
  return {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase GET ${path}: ${res.status}`);
  return res.json();
}

async function sbInsert(table, row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase INSERT ${table}: ${err}`);
  }
  return res.json();
}

// ===== Resolve vt.tiktok.com short URL =====
async function resolveShortUrl(shortUrl) {
  try {
    const res = await fetch(shortUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    return res.url;
  } catch {
    // HEAD gagal, coba GET
    const res = await fetch(shortUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    return res.url;
  }
}

// ===== Extract video ID dari full TikTok URL =====
function extractVideoId(url) {
  const match = url.match(/\/video\/(\d+)/);
  return match?.[1] || null;
}

// ===== Fetch views dari RapidAPI =====
async function fetchVideoViews(videoUrl, apiKey, apiHost) {
  // Resolve short URL dulu
  let fullUrl = videoUrl;
  if (videoUrl.includes('vt.tiktok.com') || videoUrl.includes('/t/')) {
    fullUrl = await resolveShortUrl(videoUrl);
  }

  const videoId = extractVideoId(fullUrl);
  if (!videoId) throw new Error(`Tidak bisa extract video ID dari: ${fullUrl}`);

  const headers = {
    'X-RapidAPI-Key': apiKey,
    'X-RapidAPI-Host': apiHost,
  };

  // Coba endpoint by URL (paling umum di berbagai host)
  const endpoints = [
    `https://${apiHost}/video/info?url=${encodeURIComponent(fullUrl)}`,
    `https://${apiHost}/api/video/detail?url=${encodeURIComponent(fullUrl)}`,
    `https://${apiHost}/video/detail?id=${videoId}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, { headers });
      if (!res.ok) continue;
      const json = await res.json();

      // Coba berbagai struktur response yang umum
      const views =
        json?.data?.statistics?.playCount     ??
        json?.data?.stats?.playCount          ??
        json?.data?.video?.stats?.playCount   ??
        json?.itemInfo?.itemStruct?.stats?.playCount ??
        json?.data?.play_count                ??
        json?.statistics?.playCount           ??
        json?.stats?.playCount                ??
        null;

      if (views !== null) return Number(views);
    } catch { continue; }
  }

  throw new Error(`Semua endpoint gagal untuk video: ${fullUrl}`);
}

// ===== Hitung day number dari upload_date =====
function calcDayNumber(uploadDate) {
  const upload = new Date(uploadDate);
  const now    = new Date();
  const diff   = Math.floor((now - upload) / (1000 * 60 * 60 * 24));
  return diff + 1; // hari ke-1 = hari pertama
}

// ===== Main handler =====
export default async function handler(req, res) {
  // Auth check
  const secret = req.headers['x-cron-secret'];
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase env vars missing' });
  }

  const results = { processed: 0, fetched: 0, skipped: 0, errors: [] };

  try {
    // 1. Ambil semua user settings yang punya rapidApiKey
    const allSettings = await sbGet('app_settings?key=like.brand_settings_%&select=key,value');

    for (const setting of allSettings) {
      const userId     = setting.key.replace('brand_settings_', '');
      const apiKey     = setting.value?.rapidApiKey;
      const apiHost    = setting.value?.rapidApiHost || 'tiktok-scraper7.p.rapidapi.com';

      if (!apiKey) continue;

      // 2. Ambil listing KOL user ini yang punya link_video & upload_date dalam 28 hari
      const listings = await sbGet(
        `kol_listing?user_id=eq.${userId}&link_video=not.is.null&upload_date=not.is.null&select=id,kol_id,link_video,upload_date`
      );

      for (const listing of listings) {
        const dayNumber = calcDayNumber(listing.upload_date);

        // Skip kalau di luar window 28 hari
        if (dayNumber > 28) { results.skipped++; continue; }

        // Skip kalau bukan hari fetch
        if (!FETCH_DAYS.includes(dayNumber)) { results.skipped++; continue; }

        // Cek apakah hari ini sudah di-fetch untuk day_number ini
        const existing = await sbGet(
          `kol_views_log?kol_id=eq.${listing.kol_id}&user_id=eq.${userId}&day_number=eq.${dayNumber}`
        );
        if (existing.length > 0) { results.skipped++; continue; }

        results.processed++;

        try {
          const views = await fetchVideoViews(listing.link_video, apiKey, apiHost);

          await sbInsert('kol_views_log', {
            id:         crypto.randomUUID(),
            kol_id:     listing.kol_id,
            user_id:    userId,
            views,
            day_number: dayNumber,
            fetched_at: new Date().toISOString(),
          });

          results.fetched++;
        } catch(e) {
          results.errors.push({ kol_id: listing.kol_id, day: dayNumber, error: e.message });
        }
      }
    }

    return res.status(200).json({ ok: true, ...results });

  } catch(e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
