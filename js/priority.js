// ===== TALENT PRIORITAS =====

function initPriority() {
  renderPriorityPage();
}

function renderPriorityPage() {
  const filter = document.getElementById('priorityFilter')?.value || '';
  const q = (document.getElementById('prioritySearch')?.value || '').toLowerCase();

  let talents = DB.kols.filter(k => k.isPriority);
  if (filter === 'kol')        talents = talents.filter(k => k.kolType !== 'affiliator');
  if (filter === 'affiliator') talents = talents.filter(k => k.kolType === 'affiliator');
  if (q) talents = talents.filter(k =>
    k.name.toLowerCase().includes(q) || (k.tiktok||'').toLowerCase().includes(q)
  );

  const totalKOL = DB.kols.filter(k => k.isPriority && k.kolType !== 'affiliator').length;
  const totalAff = DB.kols.filter(k => k.isPriority && k.kolType === 'affiliator').length;

  const statsEl = document.getElementById('priorityStats');
  if (statsEl) statsEl.innerHTML = `
    <div class="stat-card s-deal">
      <div class="stat-icon">${icon('star',22)}</div>
      <div class="stat-label">Total Prioritas</div>
      <div class="stat-num">${totalKOL + totalAff}</div>
      <div class="stat-sub">Talent terpilih</div>
    </div>
    <div class="stat-card s-replied">
      <div class="stat-icon">${icon('users',22)}</div>
      <div class="stat-label">KOL Prioritas</div>
      <div class="stat-num">${totalKOL}</div>
      <div class="stat-sub">kreator berbayar</div>
    </div>
    <div class="stat-card s-contacted">
      <div class="stat-icon">${icon('trending-up',22)}</div>
      <div class="stat-label">Affiliator Prioritas</div>
      <div class="stat-num">${totalAff}</div>
      <div class="stat-sub">affiliator aktif</div>
    </div>
  `;

  const grid = document.getElementById('priorityGrid');
  if (!grid) return;

  if (!talents.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:80px 20px;color:var(--muted);">
        <div style="margin-bottom:16px;opacity:.3;">${icon('star',52)}</div>
        <div style="font-size:16px;font-weight:700;margin-bottom:8px;color:var(--text);">Belum ada Talent Prioritas</div>
        <div style="font-size:13px;line-height:1.6;">Evaluasi konten KOL di halaman <strong>Listing KOL</strong> atau <strong>Listing Affiliator</strong>,<br>kemudian tandai hasilnya sebagai <strong>✅ Bagus</strong></div>
      </div>`;
    return;
  }

  // Gabung cache dari listing & affiliator
  const cache = { ...(typeof listingCache !== 'undefined' ? listingCache : {}), ...(typeof affiliatorListingCache !== 'undefined' ? affiliatorListingCache : {}) };

  grid.innerHTML = talents.map(k => {
    const rec   = cache[k.id] || {};
    const isAff = k.kolType === 'affiliator';
    const typeLabel = isAff ? 'Affiliator' : 'KOL';
    const typeColor = isAff ? 'var(--yellow)'  : 'var(--accent)';
    const typeBg    = isAff ? 'rgba(245,158,11,.12)' : 'rgba(124,58,237,.12)';

    const stars = rec.eval_rating || 0;
    const starsHtml = [1,2,3,4,5].map(i =>
      `<span style="color:${i<=stars ? 'var(--yellow)' : 'var(--muted)'};font-size:15px;">★</span>`
    ).join('');

    const views = rec.eval_views ? Number(rec.eval_views).toLocaleString('id-ID') + ' views' : '—';
    const resultMap = { bagus:'✅ Bagus', cukup:'⚡ Cukup', kurang:'❌ Kurang' };
    const resultLabel = resultMap[rec.eval_result] || '';

    const collabCount = (DB.history || []).filter(h =>
      h.kolId === k.id && (h.action||'').toLowerCase().includes('deal')
    ).length || 1;

    return `
    <div class="priority-card">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:3px;">
            <span style="font-size:14px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(k.name)}</span>
            <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:${typeBg};color:${typeColor};flex-shrink:0;">${typeLabel}</span>
          </div>
          ${k.tiktok ? `<div style="font-size:12px;color:var(--accent2);">@${esc(k.tiktok.replace('@',''))}</div>` : ''}
        </div>
        <div style="font-size:20px;margin-left:8px;flex-shrink:0;">⭐</div>
      </div>

      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px;">
        ${k.tier  ? `<span style="font-size:11px;padding:2px 8px;border-radius:8px;background:var(--bg4);color:var(--text2);">${k.tier}</span>` : ''}
        ${k.niche ? `<span style="font-size:11px;padding:2px 8px;border-radius:8px;background:var(--bg4);color:var(--text2);">${esc(k.niche)}</span>` : ''}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
        <div style="background:var(--bg3);border-radius:8px;padding:8px 10px;">
          <div style="font-size:10px;color:var(--muted);margin-bottom:3px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;">Rating</div>
          <div>${starsHtml}</div>
        </div>
        <div style="background:var(--bg3);border-radius:8px;padding:8px 10px;">
          <div style="font-size:10px;color:var(--muted);margin-bottom:3px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;">Views Konten</div>
          <div style="font-size:12px;font-weight:700;color:var(--text);">${views}</div>
        </div>
      </div>

      ${rec.eval_notes ? `
        <div style="font-size:12px;color:var(--text2);background:var(--bg3);border-left:3px solid var(--accent);border-radius:0 8px 8px 0;padding:8px 10px;margin-bottom:12px;font-style:italic;line-height:1.5;">"${esc(rec.eval_notes)}"</div>
      ` : ''}

      <div style="display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid var(--border);">
        <div style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:5px;">
          ${icon('refresh-cw',11)} ${collabCount}x collab
          ${resultLabel ? `<span style="margin-left:4px;">${resultLabel}</span>` : ''}
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-primary btn-sm" onclick="openRereachModal('${k.id}')" title="Hubungi Ulang">${icon('send',13)} Hubungi</button>
          <button class="btn btn-outline btn-sm" onclick="openEvalModal('${k.id}')" title="Edit Evaluasi">${icon('pencil',13)}</button>
          <button class="btn btn-danger btn-sm" onclick="demotePriority('${k.id}','${esc(k.name)}')" title="Hapus dari Prioritas">${icon('star',13)}</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ===== MODAL HUBUNGI ULANG =====
let _rereachKolId = null;

function openRereachModal(kolId) {
  const k = DB.kols.find(x => x.id === kolId);
  if (!k) return;
  _rereachKolId = kolId;

  document.getElementById('rereachKolName').textContent = k.name;
  document.getElementById('rereachKolContact').innerHTML = [
    k.wa     ? `<span style="font-size:12px;color:var(--green);">📱 ${esc(k.wa)}</span>` : '',
    k.tiktok ? `<span style="font-size:12px;color:var(--accent2);">🎵 @${esc(k.tiktok.replace('@',''))}</span>` : '',
  ].filter(Boolean).join('<span style="color:var(--muted);margin:0 6px;">·</span>');

  const tmpls = DB.templates.filter(t => (t.category||'outreach') === 'reengagement');
  const tabsEl = document.getElementById('rereachTemplateTabs');
  const preview = document.getElementById('rereachMsgPreview');

  if (!tmpls.length) {
    tabsEl.innerHTML = '<div style="font-size:12px;color:var(--muted);">Belum ada template Re-Engagement. Buat di halaman <strong>Template Pesan</strong> dengan kategori ⭐ Re-Engagement.</div>';
    preview.value = '';
  } else {
    tabsEl.innerHTML = tmpls.map((t,i) =>
      `<button class="tmpl-pill ${i===0?'active':''}" onclick="selectRereachTmpl(this,'${t.id}')">${esc(t.name)}</button>`
    ).join('');
    preview.value = fillTemplate(tmpls[0].body, k);
  }

  document.getElementById('btnRereachWA').style.display = k.platform === 'tiktok' ? 'none' : '';
  document.getElementById('btnRereachTT').style.display = k.platform === 'wa' ? 'none' : '';
  openModal('modal-rereach');
}

function selectRereachTmpl(el, tmplId) {
  document.querySelectorAll('#rereachTemplateTabs .tmpl-pill').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  const tmpl = DB.templates.find(t => t.id === tmplId);
  const kol  = DB.kols.find(k => k.id === _rereachKolId);
  if (tmpl && kol) document.getElementById('rereachMsgPreview').value = fillTemplate(tmpl.body, kol);
}

function doRereachWA() {
  const k = DB.kols.find(x => x.id === _rereachKolId);
  if (!k?.wa) { toast('Nomor WA tidak ada!', 'error'); return; }
  const msg = encodeURIComponent(document.getElementById('rereachMsgPreview').value);
  window.open(`https://wa.me/${k.wa.replace(/\D/g,'')}?text=${msg}`, '_blank');
}

function doRereachTT() {
  const k = DB.kols.find(x => x.id === _rereachKolId);
  if (!k?.tiktok) { toast('Username TikTok tidak ada!', 'error'); return; }
  navigator.clipboard.writeText(document.getElementById('rereachMsgPreview').value);
  window.open(`https://www.tiktok.com/${k.tiktok.startsWith('@')?k.tiktok:'@'+k.tiktok}`, '_blank');
  toast('TikTok dibuka, pesan di-copy — paste di DM!', 'info');
}

function copyRereachMsg() {
  navigator.clipboard.writeText(document.getElementById('rereachMsgPreview').value)
    .then(() => toast('Pesan di-copy!', 'success'));
}

async function demotePriority(kolId, kolName) {
  if (!confirm(`Hapus "${kolName}" dari Talent Prioritas?`)) return;
  const kol = DB.kols.find(k => k.id === kolId);
  if (kol) kol.isPriority = false;
  const { error } = await _sb.from('kols').update({ is_priority: false }).eq('id', kolId);
  if (error) { toast('Gagal: ' + error.message, 'error'); return; }
  toast(`${kolName} dihapus dari Talent Prioritas.`, 'success');
  renderPriorityPage();
}

// ===== MODAL EVALUASI (shared: dipanggil dari listing & priority) =====

function openEvalModal(kolId) {
  const kol = DB.kols.find(k => k.id === kolId);
  if (!kol) return;

  const isAff = kol.kolType === 'affiliator';
  const cache = isAff
    ? (typeof affiliatorListingCache !== 'undefined' ? affiliatorListingCache : {})
    : (typeof listingCache !== 'undefined' ? listingCache : {});
  const rec = cache[kolId] || {};

  document.getElementById('evalKolId').value        = kolId;
  document.getElementById('evalKolNameDisplay').textContent = kol.name;
  document.getElementById('evalViews').value         = rec.eval_views  || '';
  document.getElementById('evalNotes').value         = rec.eval_notes  || '';

  _evalCurrentRating = rec.eval_rating || 0;
  _evalCurrentResult = rec.eval_result || '';
  renderEvalStars(_evalCurrentRating);
  renderEvalResultBtns(_evalCurrentResult);

  openModal('modal-evaluasi');
}

let _evalCurrentRating = 0;
let _evalCurrentResult = '';

function renderEvalStars(rating) {
  const el = document.getElementById('evalStars');
  if (!el) return;
  el.innerHTML = [1,2,3,4,5].map(i => `
    <span class="eval-star" data-v="${i}"
      onclick="setEvalRating(${i})"
      onmouseover="previewStars(${i})"
      onmouseout="renderEvalStars(${_evalCurrentRating})"
      style="color:${i <= rating ? 'var(--yellow)' : 'var(--muted)'};">★</span>
  `).join('');
}

function previewStars(n) {
  document.querySelectorAll('.eval-star').forEach((s, i) => {
    s.style.color = i < n ? 'var(--yellow)' : 'var(--muted)';
  });
}

function setEvalRating(n) {
  _evalCurrentRating = n;
  renderEvalStars(n);
}

function setEvalResult(val) {
  _evalCurrentResult = val;
  renderEvalResultBtns(val);
}

function renderEvalResultBtns(active) {
  document.querySelectorAll('.eval-result-btn').forEach(btn => {
    const on = btn.dataset.val === active;
    btn.classList.toggle('eval-result-active', on);
  });
}

async function saveEval() {
  const kolId  = document.getElementById('evalKolId').value;
  const views  = parseInt(document.getElementById('evalViews').value) || 0;
  const notes  = document.getElementById('evalNotes').value.trim();
  const rating = _evalCurrentRating;
  const result = _evalCurrentResult;

  if (!result) { toast('Pilih hasil evaluasi dulu (Bagus / Cukup / Kurang)', 'error'); return; }

  const kol   = DB.kols.find(k => k.id === kolId);
  const isAff = kol?.kolType === 'affiliator';

  const updates = { eval_views: views, eval_rating: rating, eval_notes: notes, eval_result: result };

  if (isAff) await upsertAffiliatorListing(kolId, updates);
  else        await upsertListing(kolId, updates);

  // Jika Bagus → Talent Prioritas
  const isPriority = result === 'bagus';
  if (kol) kol.isPriority = isPriority;
  await _sb.from('kols').update({ is_priority: isPriority }).eq('id', kolId);

  closeModal('modal-evaluasi');

  const msg = isPriority
    ? `Evaluasi disimpan! ⭐ ${kol?.name} masuk Talent Prioritas.`
    : 'Evaluasi disimpan.';
  toast(msg, 'success', 4000);

  if (currentPage === 'listing')    renderListingPage();
  if (currentPage === 'affiliator') renderAffiliatorListingPage();
  if (currentPage === 'priority')   renderPriorityPage();
}
