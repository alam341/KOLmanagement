// ===== DASHBOARD =====
let dashCharts = {};

function initDashboard() {
  renderDashStats();
  renderDashCharts();
  renderDashTopKOL();
  renderDashActivity();
}

function renderDashStats() {
  const kols = DB.kols;
  const count = s => kols.filter(k => k.status === s).length;
  const deals = count('deal');
  const total = kols.length;
  const conv = total ? Math.round((deals/total)*100) : 0;

  document.getElementById('dashStats').innerHTML = `
    <div class="stat-card s-total">
      <div class="stat-icon">👥</div>
      <div class="stat-label">Total KOL</div>
      <div class="stat-num">${total}</div>
      <div class="stat-sub">Database kreator</div>
    </div>
    <div class="stat-card s-contacted">
      <div class="stat-icon">📤</div>
      <div class="stat-label">Sudah Dihubungi</div>
      <div class="stat-num">${count('contacted')+count('replied')+count('deal')+count('followup')}</div>
      <div class="stat-sub">dari ${total} total</div>
    </div>
    <div class="stat-card s-replied">
      <div class="stat-icon">💬</div>
      <div class="stat-label">Reply / Active</div>
      <div class="stat-num">${count('replied')+count('followup')}</div>
      <div class="stat-sub">menunggu follow up</div>
    </div>
    <div class="stat-card s-deal">
      <div class="stat-icon">🎉</div>
      <div class="stat-label">Deal</div>
      <div class="stat-num">${deals}</div>
      <div class="stat-sub">konversi ${conv}%</div>
    </div>
    <div class="stat-card s-followup">
      <div class="stat-icon">🔔</div>
      <div class="stat-label">Follow Up</div>
      <div class="stat-num">${count('followup')}</div>
      <div class="stat-sub">perlu tindakan</div>
    </div>
    <div class="stat-card s-rejected">
      <div class="stat-icon">❌</div>
      <div class="stat-label">Rejected</div>
      <div class="stat-num">${count('rejected')}</div>
      <div class="stat-sub">tidak berminat</div>
    </div>
  `;
}

function renderDashCharts() {
  const kols = DB.kols;

  // Destroy old charts
  Object.values(dashCharts).forEach(c => c && c.destroy());
  dashCharts = {};

  // Chart 1: Pipeline status
  const statusCounts = ['new','contacted','replied','followup','deal','rejected'].map(s => kols.filter(k=>k.status===s).length);
  const ctx1 = document.getElementById('chartPipeline');
  if (ctx1) {
    dashCharts.pipeline = new Chart(ctx1, {
      type: 'doughnut',
      data: {
        labels: ['Belum','Dihubungi','Reply','Follow Up','Deal','Rejected'],
        datasets: [{ data: statusCounts, backgroundColor: ['#475569','#f59e0b','#7c3aed','#f97316','#10b981','#ef4444'], borderWidth: 0 }]
      },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, padding: 10 } } }, cutout: '65%' }
    });
  }

  // Chart 2: Tier distribution
  const tierCounts = ['nano','micro','macro','mega'].map(t => kols.filter(k=>k.tier===t).length);
  const ctx2 = document.getElementById('chartTier');
  if (ctx2) {
    dashCharts.tier = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: ['Nano\n(<10K)','Micro\n(10K-100K)','Macro\n(100K-1M)','Mega\n(>1M)'],
        datasets: [{ data: tierCounts, backgroundColor: ['#475569','#06b6d4','#7c3aed','#f59e0b'], borderRadius: 6, borderWidth: 0 }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#2a2a3d' } },
          y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#2a2a3d' } }
        }
      }
    });
  }
}

function renderDashTopKOL() {
  const kols = [...DB.kols].filter(k => k.followersRaw > 0).sort((a,b) => (b.score||0)-(a.score||0)).slice(0,8);
  const el = document.getElementById('dashTopKOL');
  if (!el) return;
  if (!kols.length) { el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:20px;text-align:center;">Belum ada data KOL.</div>'; return; }
  el.innerHTML = kols.map((k, i) => {
    const score = k.score || 0;
    const barClass = score >= 70 ? 'score-high' : score >= 40 ? 'score-mid' : 'score-low';
    return `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
      <div style="font-size:13px;font-weight:800;color:var(--muted);width:20px;text-align:center;">${i+1}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(k.name)}</div>
        <div style="font-size:11px;color:var(--muted);">${esc(k.tiktok||'')} · ${esc(k.followers||'-')}</div>
        <div style="margin-top:5px;"><div class="score-bar-wrap"><div class="score-bar ${barClass}" style="width:${score}%"></div></div></div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:14px;font-weight:800;color:var(--accent2);">${score}</div>
        <div style="font-size:10px;color:var(--muted);">skor</div>
      </div>
    </div>`;
  }).join('');
}

function renderDashActivity() {
  const h = DB.history.slice(0, 10);
  const el = document.getElementById('dashActivity');
  if (!el) return;
  if (!h.length) { el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:20px;text-align:center;">Belum ada aktivitas.</div>'; return; }
  el.innerHTML = h.map(x => `
    <div class="history-item">
      <div class="history-dot ${x.status||'new'}"></div>
      <div>
        <div class="history-text"><strong>${esc(x.kolName)}</strong> — ${esc(x.action)}</div>
        <div class="history-meta">${relativeTime(x.ts)}</div>
      </div>
    </div>
  `).join('');
}
