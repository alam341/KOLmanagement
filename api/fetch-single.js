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

  const triedErrors = [];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, { headers });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch {
        triedErrors.push(`${ep} → HTTP ${res.status}: non-JSON response`);
        continue;
      }

      if (!res.ok) {
        triedErrors.push(`${ep} → HTTP ${res.status}: ${json?.message || json?.error || text.slice(0,100)}`);
        continue;
      }

      const views =
        json?.data?.statistics?.playCount   ??
        json?.data?.stats?.playCount        ??
        json?.data?.video?.stats?.playCount ??
        json?.itemInfo?.itemStruct?.stats?.playCount ??
        json?.data?.play_count              ??
        json?.statistics?.playCount         ??
        json?.stats?.playCount              ??
        null;

      if (views !== null) return { views: Number(views), videoId };

      triedErrors.push(`${ep} → HTTP ${res.status}: views field tidak ditemukan. Keys: ${JSON.stringify(Object.keys(json?.data || json || {}))}`);
    } catch(e) {
      triedErrors.push(`${ep} → Error: ${e.message}`);
    }
  }

  throw new Error('Semua endpoint gagal:\n' + triedErrors.join('\n'));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-rapidapi-key, x-rapidapi-host');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { videoUrl, uploadDate } = req.query;
  if (!videoUrl) return res.status(400).json({ error: 'videoUrl required' });

  const apiKey  = req.headers['x-rapidapi-key'];
  const apiHost = req.headers['x-rapidapi-host'] || 'tiktok-scraper7.p.rapidapi.com';
  if (!apiKey) return res.status(400).json({ error: 'RapidAPI Key tidak ada. Simpan di Pengaturan.' });

  // Hitung day number
  const upload = new Date(uploadDate || Date.now());
  const dayNum = Math.floor((Date.now() - upload) / 86400000) + 1;
  if (dayNum > 28) return res.status(400).json({ error: 'Sudah melewati 28 hari tracking.' });

  try {
    const { views, videoId } = await fetchViews(videoUrl, apiKey, apiHost);
    return res.status(200).json({ ok: true, views, dayNumber: dayNum, videoId });
  } catch(e) {
    return res.status(500).json({ error: e.message, apiHost, tip: 'Cek RapidAPI key & host di Pengaturan' });
  }
};
