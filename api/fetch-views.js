// ===== VERCEL SERVERLESS FUNCTION: Auto-fetch TikTok views =====
// Dipanggil oleh cron-job.org setiap hari
// Header wajib: x-cron-secret: <CRON_SECRET>

const { randomUUID } = require('crypto');
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

function extractViews(vid) {
  return (
    vid?.stats?.playCount      ??
    vid?.statistics?.playCount ??
    vid?.statsV2?.playCount    ??
    vid?.play_count            ??
    vid?.playCount             ??
    vid?.video?.play_count     ??
    null
  );
}

// ===== Cari video dari user posts (tiktok-scraper7) =====
async function fetchViewsFromUserPosts(videoId, username, headers, apiHost) {
  let cursor = 0;
  for (let page = 0; page < 5; page++) {
    let url;
    if (apiHost.includes('tiktok-scraper7')) {
      url = `https://${apiHost}/user/posts?unique_id=${encodeURIComponent(username)}&count=35&cursor=${cursor}`;
    } else if (apiHost.includes('tiktok-api23')) {
      url = `https://${apiHost}/api/user/posts?uniqueId=${encodeURIComponent(username)}&count=35&cursor=${cursor}`;
    } else {
      url = `https://${apiHost}/user/posts?username=${encodeURIComponent(username)}&count=35&cursor=${cursor}`;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) break;
    const json = await res.json();
    if (json?.code !== undefined && json.code !== 0) break;
    const data = json?.data || json;
    const videos = data?.videos || data?.itemList || data?.items || data?.aweme_list || data?.awemeList || data?.list || [];
    if (!videos.length) break;

    const found = videos.find(v => {
      const ids = [v?.video_id, v?.id, v?.aweme_id, v?.videoId, v?.video?.id].filter(Boolean).map(String);
      return ids.includes(String(videoId));
    });
    if (found) {
      const views = extractViews(found);
      if (views !== null) return Number(views);
    }
    const hasMore = data?.hasMore ?? data?.has_more ?? false;
    if (!hasMore) break;
    cursor = data?.cursor || (cursor + 35);
  }
  return null;
}

// ===== Fetch views dari RapidAPI =====
async function fetchVideoViews(videoUrl, tiktokUsername, apiKey, apiHost) {
  let fullUrl = videoUrl;
  if (videoUrl.includes('vt.tiktok.com') || videoUrl.includes('/t/')) {
    fullUrl = await resolveShortUrl(videoUrl);
  }

  const videoId = extractVideoId(fullUrl);
  if (!videoId) throw new Error(`Tidak bisa extract video ID dari: ${fullUrl}`);

  const headers = { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost };

  // Coba endpoint direct dulu
  const directEndpoints = [
    `https://${apiHost}/api/video/detail?url=${encodeURIComponent(fullUrl)}`,
    `https://${apiHost}/video/info?url=${encodeURIComponent(fullUrl)}`,
    `https://${apiHost}/video/detail?id=${videoId}`,
  ];
  for (const ep of directEndpoints) {
    try {
      const res = await fetch(ep, { headers });
      if (!res.ok) continue;
      const json = await res.json();
      const views =
        json?.data?.play_count             ??
        json?.data?.video?.play_count      ??
        json?.data?.statistics?.play_count ??
        json?.data?.statistics?.playCount  ??
        json?.data?.stats?.playCount       ??
        json?.itemInfo?.itemStruct?.stats?.playCount ??
        json?.statistics?.playCount        ??
        json?.stats?.playCount             ??
        null;
      if (views !== null) return Number(views);
    } catch { continue; }
  }

  // Fallback: cari dari user posts (tiktok-scraper7)
  if (tiktokUsername) {
    const views = await fetchViewsFromUserPosts(videoId, tiktokUsername, headers, apiHost);
    if (views !== null) return views;
  }

  throw new Error(`Gagal fetch views untuk video: ${videoId}`);
}

// ===== Hitung day number dari upload_date =====
function calcDayNumber(uploadDate) {
  const upload = new Date(uploadDate);
  const now    = new Date();
  const diff   = Math.floor((now - upload) / (1000 * 60 * 60 * 24));
  return diff + 1; // hari ke-1 = hari pertama
}

// ===== Main handler =====
module.exports = async function handler(req, res) {
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

      // 2. Ambil listing + username TikTok dari kols
      const listings = await sbGet(
        `kol_listing?user_id=eq.${userId}&link_video=not.is.null&upload_date=not.is.null&select=id,kol_id,link_video,upload_date`
      );
      const kolIds = listings.map(l => l.kol_id).filter(Boolean);
      let kolUsernameMap = {};
      if (kolIds.length) {
        const kolsData = await sbGet(`kols?id=in.(${kolIds.join(',')})&select=id,tiktok`);
        kolsData.forEach(k => { kolUsernameMap[k.id] = (k.tiktok || '').replace('@','').trim(); });
      }

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
          const tiktokUsername = kolUsernameMap[listing.kol_id] || '';
          const views = await fetchVideoViews(listing.link_video, tiktokUsername, apiKey, apiHost);

          await sbInsert('kol_views_log', {
            id:         randomUUID(),
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
