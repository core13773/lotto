// stats.js - 통계 대시보드: 빈도, 핫/콜드, 차트, 번호쌍, 바코드, 분포표

// ========== 통계 대시보드 ==========
let dbStats = null;

function computeDbStats() {
    if (!lottoDb || lottoDb.length === 0) return null;
    const rounds = lottoDb.length;
    const freq = new Array(46).fill(0); // 1-indexed
    const lastSeen = new Array(46).fill(0);

    lottoDb.forEach((entry, idx) => {
        if (entry.numbers) {
            entry.numbers.forEach(n => { freq[n]++; lastSeen[n] = entry.round; });
        }
    });

    const latestRound = lottoDb[lottoDb.length - 1].round;
    const dormant = [];
    for (let n = 1; n <= 45; n++) {
        dormant.push({ number: n, lastSeen: lastSeen[n], gap: latestRound - lastSeen[n] });
    }
    dormant.sort((a, b) => b.gap - a.gap);
    const topDormant = dormant.slice(0, 10);

    const recent50 = lottoDb.slice(-50);
    const recentFreq = new Array(46).fill(0);
    recent50.forEach(entry => {
        if (entry.numbers) entry.numbers.forEach(n => recentFreq[n]++);
    });
    const hotCold = [];
    for (let n = 1; n <= 45; n++) {
        hotCold.push({ number: n, count: recentFreq[n] });
    }
    hotCold.sort((a, b) => b.count - a.count);
    const hot = hotCold.slice(0, 10);
    const cold = hotCold.slice(-10).reverse();

    // 구간별 통계
    const sections = { '1-10': 0, '11-20': 0, '21-30': 0, '31-40': 0, '41-45': 0 };
    lottoDb.forEach(entry => {
        if (entry.numbers) {
            entry.numbers.forEach(n => {
                if (n <= 10) sections['1-10']++;
                else if (n <= 20) sections['11-20']++;
                else if (n <= 30) sections['21-30']++;
                else if (n <= 40) sections['31-40']++;
                else sections['41-45']++;
            });
        }
    });

    // 전체 홀짝 통계
    let totalOdd = 0, totalEven = 0;
    lottoDb.forEach(entry => {
        if (entry.numbers) {
            entry.numbers.forEach(n => { n % 2 ? totalOdd++ : totalEven++; });
        }
    });

    // 합계 분포 통계
    const sumHist = { '21-80': 0, '81-110': 0, '111-140': 0, '141-170': 0, '171-200': 0, '201-279': 0 };
    lottoDb.forEach(entry => {
        if (entry.numbers) {
            const s = entry.numbers.reduce((a, b) => a + b, 0);
            if (s <= 80) sumHist['21-80']++;
            else if (s <= 110) sumHist['81-110']++;
            else if (s <= 140) sumHist['111-140']++;
            else if (s <= 170) sumHist['141-170']++;
            else if (s <= 200) sumHist['171-200']++;
            else sumHist['201-279']++;
        }
    });

    // 홀짝 구성 분포
    const oddEvenDist = {};
    lottoDb.forEach(entry => {
        if (entry.numbers) {
            const oc = entry.numbers.filter(n => n % 2 === 1).length;
            const key = `홀${oc} 짝${6-oc}`;
            oddEvenDist[key] = (oddEvenDist[key] || 0) + 1;
        }
    });

    // 고저 구성 분포
    const lowHighDist = {};
    lottoDb.forEach(entry => {
        if (entry.numbers) {
            const hi = entry.numbers.filter(n => n >= 23).length;
            const key = `고${hi} 저${6-hi}`;
            lowHighDist[key] = (lowHighDist[key] || 0) + 1;
        }
    });

    // AC값 분포
    const acDist = {};
    lottoDb.forEach(entry => {
        if (entry.numbers) {
            const s = [...entry.numbers].sort((a, b) => a - b);
            const diffs = new Set();
            for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) diffs.add(s[j] - s[i]);
            const ac = diffs.size - 5;
            acDist[ac] = (acDist[ac] || 0) + 1;
        }
    });

    // 연속쌍 분포
    const consecDist = { '없음': 0, '1쌍': 0, '2쌍': 0, '3쌍': 0, '4쌍': 0 };
    lottoDb.forEach(entry => {
        if (entry.numbers) {
            const s = [...entry.numbers].sort((a, b) => a - b);
            let cp = 0;
            for (let i = 0; i < 5; i++) if (s[i+1] - s[i] === 1) cp++;
            if (cp === 0) consecDist['없음']++;
            else if (cp === 1) consecDist['1쌍']++;
            else if (cp === 2) consecDist['2쌍']++;
            else if (cp === 3) consecDist['3쌍']++;
            else consecDist['4쌍']++;
        }
    });

    // 번호별 갭 분석
    const numGapAnalysis = [];
    for (let n = 1; n <= 45; n++) {
        const appearances = [];
        lottoDb.forEach(entry => {
            if (entry.numbers && entry.numbers.includes(n)) {
                appearances.push(entry.round);
            }
        });
        const gaps = [];
        for (let i = 1; i < appearances.length; i++) {
            gaps.push(appearances[i] - appearances[i-1]);
        }
        const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
        const maxGap = gaps.length > 0 ? Math.max(...gaps) : 0;
        const stdDev = gaps.length > 1 ? Math.sqrt(gaps.reduce((s, g) => s + Math.pow(g - avgGap, 2), 0) / gaps.length) : 1;
        const currentGap = latestRound - (lastSeen[n] || 0);
        const zScore = stdDev > 0 ? Math.round((currentGap - avgGap) / stdDev * 100) / 100 : 0;
        const recentGaps = gaps.slice(-10);

        let trend = '→';
        const recent20Count = lottoDb.slice(-20).filter(e => e.numbers && e.numbers.includes(n)).length;
        if (recent20Count >= 5) trend = recent20Count >= 7 ? '↑↑' : '↑';
        else if (recent20Count <= 1) trend = recent20Count === 0 ? '↓↓' : '↓';

        numGapAnalysis.push({
            number: n, freq: freq[n], avgGap: Math.round(avgGap * 10) / 10,
            currentGap, maxGap, zScore, trend, recentGaps, lastSeen: lastSeen[n]
        });
    }

    return {
        rounds, freq, hot, cold, topDormant, recent50Freq: recentFreq,
        sections, totalOdd, totalEven,
        sumHist, oddEvenDist, lowHighDist, acDist, consecDist, numGapAnalysis
    };
}

function renderStatsDashboard() {
    dbStats = computeDbStats();
    if (!dbStats) {
        document.getElementById('statsNotReady').textContent = '⚠️ DB 데이터를 불러오는 중입니다...';
        document.getElementById('statsNotReady').classList.remove('hidden');
        document.getElementById('statsReady').classList.add('hidden');
        return;
    }
    document.getElementById('statsNotReady').classList.add('hidden');
    document.getElementById('statsReady').classList.remove('hidden');
    document.getElementById('statsTotalRounds').textContent = dbStats.rounds;

    // 빈도 히트맵 (추천 상태 색상 반영)
    const numScores = computeNumberScores();
    const maxFreq = Math.max(...dbStats.freq.slice(1));
    const heatmap = document.getElementById('frequencyHeatmap');
    heatmap.innerHTML = '';
    for (let n = 1; n <= 45; n++) {
        const intensity = dbStats.freq[n] / maxFreq;
        const ns = numScores ? numScores[n] : null;
        let statusColor = 'var(--accent-cyan)';
        let statusLabel = '';
        if (ns) {
            if (ns.recScore <= 0) { statusColor = '#10b981'; statusLabel = '포함 추천'; }
            else if (ns.recScore <= 1) { statusColor = '#10b981'; statusLabel = '포함 추천'; }
            else if (ns.recScore <= 2) { statusColor = '#f59e0b'; statusLabel = '중립'; }
            else if (ns.recScore <= 3) { statusColor = '#f97316'; statusLabel = '제외 고려'; }
        }
        const span = document.createElement('span');
        span.className = 'freq-cell';
        span.style.backgroundColor = `rgba(0, 245, 255, ${(0.15 + intensity * 0.85).toFixed(2)})`;
        span.style.color = intensity > 0.5 ? '#000' : 'var(--text-primary)';
        span.style.borderBottom = `3px solid ${statusColor}`;
        span.setAttribute('title', ns ? `${n}번 | 출현 ${dbStats.freq[n]}회 | 현재갭 ${ns.currentGap}회 | Z점수 ${ns.zScore} | ${statusLabel} | 추세 ${ns.trend}` : '');
        span.innerHTML = `<div class="freq-num">${n}</div><div class="freq-count">${dbStats.freq[n]}</div>`;
        if (intensity > 0.85) span.classList.add('freq-hot');
        heatmap.appendChild(span);
    }

    // 핫/콜드 리스트
    renderHotColdList('hotNumbersList', dbStats.hot, 'hot', dbStats.recent50Freq);
    renderHotColdList('coldNumbersList', dbStats.cold, 'cold', dbStats.recent50Freq);
    renderDormantList('dormantNumbersList', dbStats.topDormant);

    // 갭 분석 히트맵
    renderGapHeatmap();

    // 바코드
    renderBarcodeView();

    // 분포표
    renderDistributionStats();

    // 차트 그리기 (탭 열릴 때 lazy draw)
    drawFrequencyChart();
    drawSectionDonut();
    drawOddEvenPie();
}

// ========== 갭 분석 히트맵 ==========
function renderGapHeatmap() {
    if (!dbStats || !dbStats.numGapAnalysis) return;
    const container = document.getElementById('gapHeatmap');
    if (!container) return;
    const maxGap = Math.max(...dbStats.numGapAnalysis.map(n => n.currentGap), 1);
    container.innerHTML = dbStats.numGapAnalysis.map(n => {
        const intensity = n.currentGap / maxGap;
        let bgColor;
        if (n.zScore > 1.5) bgColor = 'rgba(16,185,129,0.5)'; // 강한 평균회귀 신호
        else if (n.zScore > 0.5) bgColor = 'rgba(16,185,129,0.3)';
        else if (n.zScore > -0.5) bgColor = 'rgba(245,158,11,0.3)';
        else bgColor = 'rgba(239,68,68,0.3)';
        return `
            <div class="gap-cell" style="background:${bgColor};border:1px solid rgba(255,255,255,0.1);padding:8px 5px;border-radius:6px;text-align:center;cursor:help;"
                 title="${n.number}번 | 평균갭 ${n.avgGap}회 | 현재갭 ${n.currentGap}회 | 최대갭 ${n.maxGap}회 | Z점수 ${n.zScore} | 추세 ${n.trend}">
                <div style="font-weight:700;color:var(--accent-gold);font-size:0.9rem;">${n.number}</div>
                <div style="font-size:0.7rem;color:var(--text-primary);">갭${n.currentGap}</div>
                <div style="font-size:0.65rem;color:${n.zScore > 0 ? 'var(--grade-excellent)' : 'var(--grade-caution)'};">Z:${n.zScore}</div>
                <div style="font-size:0.7rem;">${n.trend}</div>
            </div>
        `;
    }).join('');
}

// ========== 52주 바코드 ==========
function renderBarcodeView() {
    if (!lottoDb || lottoDb.length < 52) return;
    const container = document.getElementById('barcodeContainer');
    if (!container) return;
    const recent52 = lottoDb.slice(-52);
    const latestRound = lottoDb[lottoDb.length - 1].round;

    let html = '<div class="barcode-legend"><span>■=당첨</span><span>○=보너스</span><span>□=미출현</span><span>←좌최신</span></div>';
    html += '<div class="barcode-grid">';

    for (let n = 1; n <= 45; n++) {
        let barcode = '';
        for (let i = recent52.length - 1; i >= 0; i--) {
            const entry = recent52[i];
            if (entry.numbers && entry.numbers.includes(n)) barcode += '■';
            else if (entry.bonus === n) barcode += '○';
            else barcode += '□';
        }

        // 13주 x 4구간
        const segments = [];
        for (let s = 0; s < 4; s++) {
            segments.push(barcode.slice(s * 13, (s + 1) * 13));
        }

        const numData = dbStats.numGapAnalysis ? dbStats.numGapAnalysis.find(x => x.number === n) : null;
        let statusColor = 'var(--text-secondary)';
        let statusText = '';
        if (numData) {
            if (numData.zScore > 1.0) { statusColor = '#10b981'; statusText = '포함추천'; }
            else if (numData.zScore > 0) { statusColor = '#f59e0b'; statusText = '중립'; }
            else { statusColor = '#ef4444'; statusText = '제외고려'; }
        }

        html += `
            <div class="barcode-row">
                <span class="barcode-num" style="color:${statusColor};" title="${statusText}">${n}</span>
                <span class="barcode-segments">
                    ${segments.map(seg => `<span class="barcode-seg">${seg}</span>`).join('<span class="barcode-sep"> </span>')}
                </span>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
}

// ========== 분포 통계 ==========
function renderDistributionStats() {
    if (!dbStats) return;
    const container = document.getElementById('distributionStats');
    if (!container) return;

    const totalRounds = dbStats.rounds;

    const buildDistTable = (title, dist, headers) => {
        const entries = Object.entries(dist).sort((a, b) => b[1] - a[1]);
        return `
            <div class="dist-section">
                <h4 class="dist-title">${title}</h4>
                <div class="dist-table">
                    ${entries.map(([key, count]) => `
                        <div class="dist-row">
                            <span class="dist-label">${key}</span>
                            <span class="dist-bar" style="width:${Math.max(count / totalRounds * 100, 1)}%"></span>
                            <span class="dist-count">${count}회 (${(count / totalRounds * 100).toFixed(1)}%)</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    };

    container.innerHTML = `
        <div class="distribution-grid">
            ${buildDistTable('합계 구간 분포', dbStats.sumHist)}
            ${buildDistTable('홀짝 구성 분포', dbStats.oddEvenDist)}
            ${buildDistTable('고저 구성 분포', dbStats.lowHighDist)}
            ${buildDistTable('AC값 분포', dbStats.acDist)}
            ${buildDistTable('연속쌍 분포', dbStats.consecDist)}
        </div>
        <div style="text-align:center;color:var(--text-secondary);font-size:0.8rem;margin-top:15px;">
            전체 ${totalRounds}회차 기준 | 평균 합계 138.2 | 평균 교차점수 59.4점
        </div>
    `;
}

function renderHotColdList(containerId, items, type, freq) {
    const container = document.getElementById(containerId);
    container.innerHTML = items.map((item, i) => `
        <div class="hotcold-item">
            <span class="hotcold-rank">${i + 1}</span>
            <span class="ball ${getBallClass(item.number)}" style="width:36px;height:36px;line-height:36px;font-size:0.85rem;">${item.number}</span>
            <span class="hotcold-count">${item.count}회</span>
        </div>
    `).join('');
}

function renderDormantList(containerId, items) {
    const container = document.getElementById(containerId);
    container.innerHTML = items.map((item, i) => `
        <div class="hotcold-item">
            <span class="hotcold-rank">${i + 1}</span>
            <span class="ball ${getBallClass(item.number)}" style="width:36px;height:36px;line-height:36px;font-size:0.85rem;">${item.number}</span>
            <span class="hotcold-count" style="color:var(--accent-pink);">${item.gap}회 연속 미출현</span>
        </div>
    `).join('');
}

function switchStatsTab(tab) {
    if (typeof _hook === 'function') _hook('switchStatsTab', tab);
    document.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.stats-tab-content').forEach(c => c.classList.remove('active'));
    const targetTab = document.querySelector(`.stats-tab[data-tab="${tab}"]`);
    if (targetTab) targetTab.classList.add('active');
    const contentId = 'statsTab' + tab.charAt(0).toUpperCase() + tab.slice(1);
    document.getElementById(contentId)?.classList.add('active');

    if (tab === 'charts') {
        setTimeout(() => { drawFrequencyChart(); drawSectionDonut(); drawOddEvenPie(); }, 100);
    } else if (tab === 'pairs') {
        setTimeout(() => renderPairAnalysis(), 100);
    } else if (tab === 'barcode') {
        setTimeout(() => renderBarcodeView(), 100);
    } else if (tab === 'distribution') {
        setTimeout(() => renderDistributionStats(), 100);
    }
}

// ========== Canvas 차트 ==========
function getCanvasCtx(id) {
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = Math.min(rect.width - 20, 600);
    canvas.style.width = w + 'px';
    canvas.width = w * dpr;
    canvas.height = (id === 'freqChart' ? 300 : 250) * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    canvas.ctxW = w;
    canvas.ctxH = id === 'freqChart' ? 300 : 250;
    return ctx;
}

function drawFrequencyChart() {
    const ctx = getCanvasCtx('freqChart');
    if (!ctx || !dbStats) return;
    const canvas = ctx.canvas;
    const w = canvas.ctxW, h = canvas.ctxH;
    ctx.clearRect(0, 0, w, h);
    const textSecondary = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#a0a0c0';

    const pad = { top: 20, right: 15, bottom: 35, left: 35 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const maxVal = Math.max(...dbStats.freq.slice(1));
    const barW = Math.max(chartW / 45 - 1, 2);

    // 배경
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(pad.left, pad.top, chartW, chartH);

    // 격자선
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
        const y = pad.top + (chartH / 4) * i;
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
    }

    // 바 그리기
    for (let n = 1; n <= 45; n++) {
        const barH = (dbStats.freq[n] / maxVal) * chartH;
        const x = pad.left + ((n - 1) / 45) * chartW;
        const y = pad.top + chartH - barH;
        const intensity = dbStats.freq[n] / maxVal;
        ctx.fillStyle = `hsl(${200 - intensity * 60}, 80%, ${50 + intensity * 20}%)`;
        ctx.fillRect(x, y, barW, barH);
    }

    // 라벨
    ctx.fillStyle = textSecondary;
    ctx.font = '9px "Noto Sans KR"';
    ctx.textAlign = 'center';
    for (let n = 1; n <= 45; n += 5) {
        const x = pad.left + ((n - 1) / 45) * chartW + barW / 2;
        ctx.fillText(n, x, h - 5);
    }
    ctx.fillStyle = '#a0a0c0';
    ctx.fillText('번호', w / 2, h - 2);
}

function drawSectionDonut() {
    const ctx = getCanvasCtx('sectionChart');
    if (!ctx || !dbStats) return;
    const canvas = ctx.canvas;
    const w = canvas.ctxW, h = canvas.ctxH;
    const cx = w / 2, cy = h / 2;
    const outerR = Math.min(w, h) / 2 - 20;
    const innerR = outerR * 0.55;
    ctx.clearRect(0, 0, w, h);

    const sections = [
        { label: '1-10', value: dbStats.sections['1-10'], color: '#ffd700' },
        { label: '11-20', value: dbStats.sections['11-20'], color: '#3b82f6' },
        { label: '21-30', value: dbStats.sections['21-30'], color: '#ef4444' },
        { label: '31-40', value: dbStats.sections['31-40'], color: '#6b7280' },
        { label: '41-45', value: dbStats.sections['41-45'], color: '#10b981' }
    ];
    const total = sections.reduce((s, sec) => s + sec.value, 0);
    let angle = -Math.PI / 2;

    sections.forEach(sec => {
        const slice = (sec.value / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, angle, angle + slice);
        ctx.arc(cx, cy, innerR, angle + slice, angle, true);
        ctx.closePath();
        ctx.fillStyle = sec.color;
        ctx.fill();
        const midAngle = angle + slice / 2;
        const lx = cx + Math.cos(midAngle) * (outerR + innerR) / 2;
        const ly = cy + Math.sin(midAngle) * (outerR + innerR) / 2;
        ctx.fillStyle = sec.color === '#ffd700' ? '#333' : '#fff';
        ctx.font = 'bold 10px "Noto Sans KR"';
        ctx.textAlign = 'center';
        ctx.fillText(sec.label, lx, ly);
        ctx.fillText(((sec.value / total) * 100).toFixed(1) + '%', lx, ly + 14);
        angle += slice;
    });
}

function drawOddEvenPie() {
    const ctx = getCanvasCtx('oddEvenChart');
    if (!ctx || !dbStats) return;
    const canvas = ctx.canvas;
    const w = canvas.ctxW, h = canvas.ctxH;
    const cx = w / 2, cy = h / 2;
    const r = Math.min(w, h) / 2 - 20;
    ctx.clearRect(0, 0, w, h);

    const total = dbStats.totalOdd + dbStats.totalEven;
    const oddAngle = (dbStats.totalOdd / total) * Math.PI * 2;

    // 홀수
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + oddAngle);
    ctx.closePath();
    ctx.fillStyle = '#ef4444';
    ctx.fill();

    // 짝수
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, -Math.PI / 2 + oddAngle, -Math.PI / 2 + Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = '#3b82f6';
    ctx.fill();

    // 라벨
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px "Noto Sans KR"';
    ctx.textAlign = 'center';
    ctx.fillText(`홀 ${(dbStats.totalOdd / total * 100).toFixed(1)}%`, cx - r * 0.4, cy - 10);
    ctx.fillText(`짝 ${(dbStats.totalEven / total * 100).toFixed(1)}%`, cx + r * 0.4, cy + 15);
}

// ========== 번호쌍 분석 ==========
function computePairStats() {
    if (!lottoDb || lottoDb.length === 0) return null;
    const pairCount = {}; // "1-2": count
    lottoDb.forEach(entry => {
        if (!entry.numbers) return;
        for (let i = 0; i < entry.numbers.length; i++) {
            for (let j = i + 1; j < entry.numbers.length; j++) {
                const key = entry.numbers[i] + '-' + entry.numbers[j];
                pairCount[key] = (pairCount[key] || 0) + 1;
            }
        }
    });
    const pairs = Object.entries(pairCount)
        .map(([key, count]) => {
            const [a, b] = key.split('-').map(Number);
            return { a, b, count };
        })
        .sort((x, y) => y.count - x.count);
    return pairs;
}

function renderPairAnalysis() {
    const pairs = computePairStats();
    if (!pairs) return;
    const container = document.getElementById('pairAnalysisResult');
    const topPairs = pairs.slice(0, 30);
    const maxCount = topPairs[0]?.count || 1;

    // 번호별로 가장 강한 연결 찾기
    const topPerNumber = {};
    for (let n = 1; n <= 45; n++) {
        const related = pairs.filter(p => p.a === n || p.b === n).slice(0, 5);
        topPerNumber[n] = related;
    }

    container.innerHTML = `
        <div style="margin-bottom:20px;">
            <h4 style="color:var(--accent-gold);margin-bottom:12px;">🏆 TOP 30 동반 출현 번호쌍</h4>
            <div class="pair-list">
                ${topPairs.map((p, i) => `
                    <div class="pair-item" style="background:rgba(0,245,255,${(0.1 + p.count/maxCount * 0.3).toFixed(2)});">
                        <span class="pair-rank">#${i + 1}</span>
                        <span class="ball ${getBallClass(p.a)}" style="width:36px;height:36px;line-height:36px;font-size:0.85rem;">${p.a}</span>
                        <span style="color:var(--accent-gold);">+</span>
                        <span class="ball ${getBallClass(p.b)}" style="width:36px;height:36px;line-height:36px;font-size:0.85rem;">${p.b}</span>
                        <span class="pair-count">${p.count}회</span>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="collapsible" id="pairDetail">
            <div class="collapsible-header" onclick="toggleCollapsible('pairDetail')"><span>🔍 번호별 최강 파트너 찾기</span><span class="collapsible-icon">▼</span></div>
            <div class="collapsible-content">
                <p style="color:var(--text-secondary);margin-bottom:10px;">각 번호 옆의 숫자는 가장 자주 함께 출현한 파트너입니다.</p>
                <div class="pair-matrix" id="pairMatrix"></div>
            </div>
        </div>
    `;

    // 번호별 최강 파트너 그리드
    const pairContent = document.querySelector('#pairDetail .collapsible-content');
    const matrixDiv = document.createElement('div');
    matrixDiv.className = 'pair-matrix';
    for (let n = 1; n <= 45; n++) {
        const best = topPerNumber[n]?.[0];
        const cell = document.createElement('div');
        cell.className = 'pair-matrix-cell';
        cell.innerHTML = `
            <span class="ball ${getBallClass(n)}" style="width:32px;height:32px;line-height:32px;font-size:0.8rem;">${n}</span>
            ${best ? `<span style="font-size:0.7rem;color:var(--text-secondary);">→</span>
            <span class="ball ${getBallClass(best.a === n ? best.b : best.a)}" style="width:28px;height:28px;line-height:28px;font-size:0.7rem;">${best.a === n ? best.b : best.a}</span>
            <span style="font-size:0.6rem;color:var(--accent-cyan);">${best.count}회</span>` : '<span style="font-size:0.7rem;color:var(--text-secondary);">-</span>'}
        `;
        matrixDiv.appendChild(cell);
    }
    if (pairContent) { pairContent.appendChild(matrixDiv); }
}
