// ===== Resolve short URL + fetch TikTok views =====
// Client yang handle auth & save ke Supabase

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

function extractUsername(url) {
  const m = url.match(/tiktok\.com\/@([^/?]+)/);
  return m?.[1] || null;
}

function extractViews(vid) {
  return (
    vid?.stats?.playCount       ??
    vid?.statistics?.playCount  ??
    vid?.statsV2?.playCount     ??
    vid?.play_count             ??
    vid?.playCount              ??
    vid?.video?.play_count      ??
    null
  );
}

// Cari video dari user posts (untuk tiktok-scraper7 yang tidak punya endpoint video detail)
async function fetchViewsFromUserPosts(videoId, username, apiKey, apiHost) {
  const headers = { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost };
  let cursor = 0;
  const maxPages = 5; // max 5 halaman (100 video)

  for (let page = 0; page < maxPages; page++) {
    let url;
    if (apiHost.includes('tiktok-scraper7')) {
      url = `https://${apiHost}/user/posts?unique_id=${encodeURIComponent(username)}&count=20&cursor=${cursor}`;
    } else if (apiHost.includes('tiktok-api23')) {
      url = `https://${apiHost}/api/user/posts?uniqueId=${encodeURIComponent(username)}&count=20&cursor=${cursor}`;
    } else {
      url = `https://${apiHost}/user/posts?username=${encodeURIComponent(username)}&count=20&cursor=${cursor}`;
    }

    const res = await fetch(url, { headers });
    const rawText = await res.text();
    let json;
    try { json = JSON.parse(rawText); } catch {
      throw new Error(`Response bukan JSON: ${rawText.slice(0, 200)}`);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${json?.message || json?.msg || rawText.slice(0,100)}`);
    if (json?.code !== undefined && json.code !== 0) throw new Error(`code ${json.code}: ${json?.msg}`);

    const data = json?.data || json;
    const allKeys = Object.keys(data || {});
    const videos = data?.videos || data?.itemList || data?.items || data?.aweme_list || data?.awemeList || data?.post_list || data?.list || [];

    if (!videos.length) {
      return { views: null, foundIds: [], noMore: true, debug: `keys: [${allKeys.join(', ')}] | raw: ${rawText.slice(0, 300)}` };
    }

    // Kumpulkan semua ID yang ada untuk debug
    const foundIds = videos.map(v =>
      v?.video_id || v?.id || v?.aweme_id || v?.videoId || v?.video?.id || '?'
    );

    // Cari video dengan ID yang cocok
    const found = videos.find(v => {
      const ids = [v?.video_id, v?.id, v?.aweme_id, v?.videoId, v?.video?.id]
        .filter(Boolean).map(String);
      return ids.includes(String(videoId));
    });

    if (found) {
      const views = extractViews(found);
      if (views !== null) return { views: Number(views), foundIds };
    }

    // Cek apakah ada halaman berikutnya
    const hasMore = json?.data?.hasMore ?? json?.data?.has_more ?? false;
    if (!hasMore) {
      // Return debug info supaya bisa diagnosa
      return { views: null, foundIds, noMore: true };
    }
    cursor = json?.data?.cursor || (cursor + 20);
  }

  return { views: null, foundIds: [], noMore: false };
}

async function fetchViews(videoUrl, username, apiKey, apiHost) {
  let fullUrl = videoUrl;
  if (videoUrl.includes('vt.tiktok.com') || videoUrl.includes('/t/')) {
    fullUrl = await resolveShortUrl(videoUrl);
  }

  const videoId = extractVideoId(fullUrl);
  if (!videoId) throw new Error('Tidak bisa extract video ID dari URL: ' + fullUrl);

  // Ambil username dari URL kalau tidak di-pass
  const resolvedUsername = username || extractUsername(fullUrl);

  const headers = { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost };

  // Coba endpoint video detail langsung dulu
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
        json?.data?.play_count              ??
        json?.data?.video?.play_count       ??
        json?.data?.statistics?.play_count  ??
        json?.data?.statistics?.playCount   ??
        json?.data?.stats?.playCount        ??
        json?.data?.video?.stats?.playCount ??
        json?.itemInfo?.itemStruct?.stats?.playCount ??
        json?.statistics?.playCount         ??
        json?.stats?.playCount              ??
        null;
      if (views !== null) return { views: Number(views), videoId };
    } catch { continue; }
  }

  // Fallback: cari dari user posts (tiktok-scraper7 style)
  if (resolvedUsername) {
    const result = await fetchViewsFromUserPosts(videoId, resolvedUsername, apiKey, apiHost);
    if (result?.views !== null && result?.views !== undefined) return { views: result.views, videoId };
    // Return debug info
    const sampleIds = (result?.foundIds || []).slice(0, 5).join(', ');
    const debug = result?.debug ? ` | ${result.debug}` : '';
    throw new Error(`Video ID ${videoId} tidak ditemukan. Contoh ID: [${sampleIds || 'kosong'}]. Total: ${result?.foundIds?.length || 0}${debug}`);
  }

  throw new Error('Gagal fetch views: tidak ada username dan endpoint direct gagal semua');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-rapidapi-key, x-rapidapi-host');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { videoUrl, uploadDate, username } = req.query;
  if (!videoUrl) return res.status(400).json({ error: 'videoUrl required' });

  const apiKey  = req.headers['x-rapidapi-key'];
  const apiHost = req.headers['x-rapidapi-host'] || 'tiktok-scraper7.p.rapidapi.com';
  if (!apiKey) return res.status(400).json({ error: 'RapidAPI Key tidak ada. Simpan di Pengaturan.' });

  // Hitung day number
  const upload = new Date(uploadDate || Date.now());
  const dayNum = Math.floor((Date.now() - upload) / 86400000) + 1;
  if (dayNum > 28) return res.status(400).json({ error: 'Sudah melewati 28 hari tracking.' });

  try {
    const { views, videoId } = await fetchViews(videoUrl, username, apiKey, apiHost);
    return res.status(200).json({ ok: true, views, dayNumber: dayNum, videoId });
  } catch(e) {
    return res.status(500).json({ error: e.message, apiHost, tip: 'Cek RapidAPI key & host di Pengaturan' });
  }
};
