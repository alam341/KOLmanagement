// ===== ANALISIS KOL =====
let analysisCharts = {};

function initAnalysis() {
  renderAnalysisStats();
  renderAnalysisCharts();
  renderScoreTable();
}

function renderAnalysisStats() {
  const kols = DB.kols;
  if (!kols.length) return;

  const withFollowers = kols.filter(k => k.followersRaw > 0);
  const totalFollowers = withFollowers.reduce((s,k) => s+(k.followersRaw||0), 0);
  const avgFollowers = withFollowers.length ? totalFollowers/withFollowers.length : 0;
  const topScore = kols.reduce((m,k) => Math.max(m, k.score||0), 0);
  const withEng = kols.filter(k => k.engagementRaw > 0);
  const avgEng = withEng.length ? withEng.reduce((s,k)=>s+(k.engagementRaw||0),0)/withEng.length : 0;
  const totalPend = kols.reduce((s,k)=>s+(k.pendapatanRaw||0),0);

  document.getElementById('analysisStats').innerHTML = `
    <div class="stat-card s-total">
      <div class="stat-icon">📊</div>
      <div class="stat-label">Rata-rata Followers</div>
      <div class="stat-num" style="font-size:20px;">${formatFollowers(avgFollowers)}</div>
      <div class="stat-sub">${withFollowers.length} kreator terdata</div>
    </div>
    <div class="stat-card s-replied">
      <div class="stat-icon">⚡</div>
      <div class="stat-label">Avg Engagement</div>
      <div class="stat-num" style="font-size:20px;">${avgEng.toFixed(2)}%</div>
      <div class="stat-sub">${withEng.length} kreator terdata</div>
    </div>
    <div class="stat-card s-deal">
      <div class="stat-icon">🏆</div>
      <div class="stat-label">Skor Tertinggi</div>
      <div class="stat-num" style="font-size:20px;">${topScore}</div>
      <div class="stat-sub">dari 100 poin</div>
    </div>
    <div class="stat-card s-contacted">
      <div class="stat-icon">💰</div>
      <div class="stat-label">Total Est. Revenue</div>
      <div class="stat-num" style="font-size:18px;">${formatRupiah(totalPend)}</div>
      <div class="stat-sub">dari data Kalodata</div>
    </div>
  `;
}

function renderAnalysisCharts() {
  Object.values(analysisCharts).forEach(c => c?.destroy());
  analysisCharts = {};

  const kols = DB.kols;

  // Chart 1: Top 10 KOL by Score
  const top10 = [...kols].filter(k=>k.score>0).sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,10);
  const ctx1 = document.getElementById('chartTopScore');
  if (ctx1 && top10.length) {
    analysisCharts.topScore = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: top10.map(k => k.name.length>14 ? k.name.slice(0,14)+'…' : k.name),
        datasets: [{
          data: top10.map(k => k.score||0),
          backgroundColor: top10.map(k => (k.score||0)>=70?'#10b981':(k.score||0)>=40?'#f59e0b':'#ef4444'),
          borderRadius: 5, borderWidth: 0
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { min:0, max:100, ticks:{color:'#94a3b8',font:{size:10}}, grid:{color:'#2a2a3d'} },
          y: { ticks:{color:'#e2e8f0',font:{size:11}}, grid:{display:false} }
        }
      }
    });
  }

  // Chart 2: Tier distribution pie
  const tierCounts = ['nano','micro','macro','mega'].map(t => kols.filter(k=>k.tier===t).length);
  const ctx2 = document.getElementById('chartTierPie');
  if (ctx2) {
    analysisCharts.tierPie = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: ['Nano (<10K)','Micro (10K-100K)','Macro (100K-1M)','Mega (>1M)'],
        datasets: [{ data: tierCounts, backgroundColor: ['#475569','#06b6d4','#7c3aed','#f59e0b'], borderWidth: 0 }]
      },
      options: { plugins: { legend: { position:'bottom', labels:{ color:'#94a3b8', font:{size:11}, padding:12 } } }, cutout:'60%' }
    });
  }

  // Chart 3: Engagement vs Followers scatter
  const scatterData = kols.filter(k=>k.followersRaw>0&&k.engagementRaw>0).map(k=>({
    x: k.followersRaw, y: k.engagementRaw,
    label: k.name
  }));
  const ctx3 = document.getElementById('chartScatter');
  if (ctx3 && scatterData.length) {
    analysisCharts.scatter = new Chart(ctx3, {
      type: 'scatter',
      data: { datasets: [{
        data: scatterData, backgroundColor: 'rgba(124,58,237,.6)',
        pointRadius: 5, pointHoverRadius: 7
      }]},
      options: {
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => {
            const d = scatterData[ctx.dataIndex];
            return `${d.label}: Followers ${formatFollowers(d.x)}, Engagement ${d.y}%`;
          }}}
        },
        scales: {
          x: { ticks:{color:'#94a3b8',font:{size:10},callback:v=>formatFollowers(v)}, grid:{color:'#2a2a3d'} },
          y: { ticks:{color:'#94a3b8',font:{size:10},callback:v=>v+'%'}, grid:{color:'#2a2a3d'} }
        }
      }
    });
  }

  // Chart 4: Top 10 by Revenue
  const top10rev = [...kols].filter(k=>k.pendapatanRaw>0).sort((a,b)=>(b.pendapatanRaw||0)-(a.pendapatanRaw||0)).slice(0,10);
  const ctx4 = document.getElementById('chartTopRevenue');
  if (ctx4 && top10rev.length) {
    analysisCharts.topRev = new Chart(ctx4, {
      type: 'bar',
      data: {
        labels: top10rev.map(k => k.name.length>14 ? k.name.slice(0,14)+'…' : k.name),
        datasets: [{
          data: top10rev.map(k => k.pendapatanRaw||0),
          backgroundColor: '#06b6d4', borderRadius: 5, borderWidth: 0
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks:{color:'#94a3b8',font:{size:10},callback:v=>formatRupiah(v)}, grid:{color:'#2a2a3d'} },
          y: { ticks:{color:'#e2e8f0',font:{size:11}}, grid:{display:false} }
        }
      }
    });
  }
}

function renderScoreTable() {
  const sortBy = document.getElementById('analysisSortBy')?.value || 'score';
  const filterTier = document.getElementById('analysisFilterTier')?.value || '';
  let kols = DB.kols.filter(k => !filterTier || k.tier === filterTier);
  kols.sort((a,b) => {
    if (sortBy === 'score')       return (b.score||0)-(a.score||0);
    if (sortBy === 'followers')   return (b.followersRaw||0)-(a.followersRaw||0);
    if (sortBy === 'engagement')  return (b.engagementRaw||0)-(a.engagementRaw||0);
    if (sortBy === 'pendapatan')  return (b.pendapatanRaw||0)-(a.pendapatanRaw||0);
    if (sortBy === 'views')       return (b.viewsRaw||0)-(a.viewsRaw||0);
    return 0;
  });

  const body = document.getElementById('analysisTableBody');
  if (!body) return;
  if (!kols.length) { body.innerHTML = '<tr class="empty-row"><td colspan="9">Belum ada data. Import KOL terlebih dahulu.</td></tr>'; return; }

  body.innerHTML = kols.map((k,i) => {
    const score = k.score || 0;
    const barClass = score >= 70 ? 'score-high' : score >= 40 ? 'score-mid' : 'score-low';
    const priority = score >= 70 ? '🔥 Prioritas' : score >= 40 ? '⚡ Potensial' : '📌 Biasa';
    return `
    <tr>
      <td><strong style="color:var(--muted);">#${i+1}</strong></td>
      <td>
        <div style="font-weight:600;">${esc(k.name)}</div>
        <div style="font-size:11px;color:var(--muted);">${esc(k.tiktok||'')}</div>
      </td>
      <td>${tierBadge(k.tier)}</td>
      <td style="font-weight:600;">${esc(k.followers||'-')}</td>
      <td>${k.engagementRaw ? k.engagementRaw+'%' : '-'}</td>
      <td>${k.viewsRaw ? formatNumber(k.viewsRaw) : '-'}</td>
      <td>${k.pendapatanRaw ? formatRupiah(k.pendapatanRaw) : '-'}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="flex:1;"><div class="score-bar-wrap"><div class="score-bar ${barClass}" style="width:${score}%"></div></div></div>
          <div style="font-weight:800;font-size:13px;color:${score>=70?'var(--green)':score>=40?'var(--yellow)':'var(--red)'};">${score}</div>
        </div>
      </td>
      <td><span style="font-size:12px;">${priority}</span></td>
    </tr>`;
  }).join('');
}

function refreshAnalysis() {
  // Recompute scores for all KOLs
  const kols = DB.kols.map(k => {
    k.tier = computeTier(k.followersRaw || parseFollowersRaw(k.followers));
    k.score = computeScore(k);
    return k;
  });
  DB.kols = kols;
  initAnalysis();
  toast('Analisis diperbarui!', 'success');
}
