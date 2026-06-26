// tracking.js - 번호별 추적(Number-by-Number Tracking) 기반 20게임 추천
// ===========================================================================
// C:\project\lotto_num\lotto_recommend.py 의 알고리즘을 JavaScript로 포팅.
//  - 홀짝/총합/구간/쌍 패턴은 배제하고 "오로지 번호별 추적"만 사용 (Python과 동일)
//  - 데이터는 페이지에 이미 로드된 lottoDb(latest.json)를 그대로 사용 (엑셀 불필요)
//  - 매 클릭마다 crypto.getRandomValues 로 새 시드 → 매번 다른 20게임 (Python Q2 수정과 동일)
//  - 결과는 기존 .smart-card 스타일로 렌더링
// ===========================================================================

// ---- 설정 (lotto_recommend.py 의 CONFIG와 동일) ----
const TRACKING_CFG = {
    RECENT_WINDOWS: [10, 30, 50],   // 최근 N회 출현 카운트(모멘텀)에 사용할 창
    POOL_SIZE: 16,                  // 추천 풀: 추적 점수 상위 N개
    NUM_GAMES: 20,                  // 추천 게임 수
    W_MOMENTUM: 0.40,               // 최근 30회 출현(핫/모멘텀)
    W_DUE: 0.35,                    // 현재 건너뜀 / 평균간격 (출현 예정성)
    W_FREQUENCY: 0.15,              // 전체 출현 빈도
    W_CONSISTENCY: 0.10,            // 간격 일관성(간격 표준편차 역수)
};

// ---- crypto 난수: 매 호출마다 다른 값 (재현성 없음 → 매번 새 조합) ----
function _cryptoRandom() {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 4294967296; // [0, 1)
}

// ---- 통계 헬퍼 (Python statistics.mean / pstdev 포팅) ----
function _mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function _pstdev(arr) {
    if (arr.length < 2) return 0;
    const m = _mean(arr);
    const variance = arr.reduce((s, x) => s + (x - m) * (x - m), 0) / arr.length;
    return Math.sqrt(variance);
}

// ===========================================================================
// 1) 번호별 추적 지표 계산  (compute_tracking 포팅)
// ===========================================================================
function computeTracking(draws) {
    // draws: [{round, numbers:[6], bonus}, ...] 회차 오름차순(과거->최신)
    const db = draws.filter(d => d && Array.isArray(d.numbers) && d.numbers.length === 6);
    if (!db.length) return null;
    const latest = db[db.length - 1].round;
    const total = db.length;

    // 번호별 출현 회차(오름차순)
    const appearances = {};
    for (let n = 1; n <= 45; n++) appearances[n] = [];
    for (const d of db) {
        for (const n of d.numbers) {
            if (n >= 1 && n <= 45) appearances[n].push(d.round);
        }
    }

    // 최근 N회 회차 집합
    const recentSets = {};
    for (const w of TRACKING_CFG.RECENT_WINDOWS) {
        recentSets[w] = new Set(db.slice(-w).map(d => d.round));
    }

    const metrics = {};
    for (let n = 1; n <= 45; n++) {
        const apps = appearances[n];
        const freq = apps.length;
        const first = freq ? apps[0] : null;
        const last = freq ? apps[apps.length - 1] : null;
        const currentSkip = last != null ? (latest - last) : total;

        // 출현 간격
        const gaps = [];
        for (let i = 1; i < apps.length; i++) gaps.push(apps[i] - apps[i - 1]);
        let avgGap = null;
        if (gaps.length) avgGap = _mean(gaps);
        else if (freq <= 1) avgGap = total;   // 1회 이하 출현: 간격 대용
        const gapStd = gaps.length >= 2 ? _pstdev(gaps) : 0;

        // 최근 N회 출현 횟수
        const recentCounts = {};
        for (const w of TRACKING_CFG.RECENT_WINDOWS) {
            recentCounts[w] = apps.filter(r => recentSets[w].has(r)).length;
        }

        // 최근 페이스(최근 5회 출연의 평균간격)
        const recentApps = apps.length >= 2 ? apps.slice(-5) : apps;
        const recentGaps = [];
        for (let i = 1; i < recentApps.length; i++) recentGaps.push(recentApps[i] - recentApps[i - 1]);
        const recentAvgGap = recentGaps.length ? _mean(recentGaps) : avgGap;

        // 예정성: 현재 건너뜀이 평균간격의 몇 배인가
        const overdueRatio = avgGap ? (currentSkip / avgGap) : 0;

        metrics[n] = {
            n, freq, first, last, currentSkip, avgGap, gapStd,
            recentCounts, recentAvgGap, overdueRatio, latest, totalDraws: total
        };
    }
    return { metrics, latest, total };
}

// ---- 정규화: [0,1]. 범위 0이면 중립 0.5 ----
function _normalize(vals) {
    let lo = Infinity, hi = -Infinity;
    for (const v of vals) { if (v < lo) lo = v; if (v > hi) hi = v; }
    if (hi === lo) return vals.map(() => 0.5);
    const span = hi - lo;
    return vals.map(v => (v - lo) / span);
}

// ===========================================================================
// 2) 추적 점수 산출  (score_numbers 포팅)
// ===========================================================================
function scoreTrackingNumbers(metrics) {
    const nums = [];
    for (let n = 1; n <= 45; n++) nums.push(n);
    const sMom  = _normalize(nums.map(n => metrics[n].recentCounts[30]));              // 최근30회
    const sDue  = _normalize(nums.map(n => Math.min(metrics[n].overdueRatio, 2.5)));   // 예정성(상한)
    const sFreq = _normalize(nums.map(n => metrics[n].freq));                          // 전체 빈도
    const sCons = _normalize(nums.map(n => 1 / (1 + metrics[n].gapStd)));              // 간격 일관성

    const scored = nums.map((n, i) => ({
        n,
        score: TRACKING_CFG.W_MOMENTUM * sMom[i]
             + TRACKING_CFG.W_DUE * sDue[i]
             + TRACKING_CFG.W_FREQUENCY * sFreq[i]
             + TRACKING_CFG.W_CONSISTENCY * sCons[i],
        parts: { momentum: sMom[i], due: sDue[i], frequency: sFreq[i], consistency: sCons[i] },
        m: metrics[n]
    }));
    scored.sort((a, b) => b.score - a.score);
    scored.forEach((s, i) => s.rank = i + 1);
    return scored;
}

// ===========================================================================
// 3) 가중 복원없는 추출 (crypto 난수 기반)
// ===========================================================================
function _weightedSampleWithoutReplacement(poolItems, weights, k) {
    const pool = [...poolItems];
    const wts = [...weights];
    const chosen = [];
    for (let i = 0; i < k; i++) {
        const total = wts.reduce((a, b) => a + b, 0);
        let pick = 0;
        if (total <= 0) {
            pick = Math.floor(_cryptoRandom() * pool.length);
        } else {
            const r = _cryptoRandom() * total;
            let acc = 0;
            pick = pool.length - 1;
            for (let j = 0; j < wts.length; j++) {
                acc += wts[j];
                if (r <= acc) { pick = j; break; }
            }
        }
        chosen.push(pool[pick]);
        pool.splice(pick, 1);
        wts.splice(pick, 1);
    }
    return chosen;
}

// ===========================================================================
// 4) 추천 게임 생성  (generate_games 포팅, 단 시드=매번 crypto)
// ===========================================================================
function generateTrackingGames(scored) {
    const pool = scored.slice(0, TRACKING_CFG.POOL_SIZE);
    const poolNums = pool.map(s => s.n);
    const raw = pool.map(s => Math.max(s.score, 0.01));   // 점수비례 가중치(최소치 보장)
    const scoreMap = {};
    pool.forEach(s => scoreMap[s.n] = s.score);

    const gamesSet = new Set();
    let attempts = 0;
    const maxAttempts = 200000;
    while (gamesSet.size < TRACKING_CFG.NUM_GAMES && attempts < maxAttempts) {
        const picks = _weightedSampleWithoutReplacement(poolNums, raw, 6);
        gamesSet.add([...picks].sort((a, b) => a - b).join(','));
        attempts++;
    }

    const games = [...gamesSet].map(g => {
        const arr = g.split(',').map(Number);
        return { nums: arr, score: arr.reduce((s, n) => s + scoreMap[n], 0) };
    });
    games.sort((a, b) => b.score - a.score);   // 강한 게임 우선
    games.forEach((g, i) => g.rank = i + 1);
    return { games, pool: poolNums };
}

// ===========================================================================
// 5) 진입점 (runSmartRecommend 와 대칭)
// ===========================================================================
let _trackingScored = null;     // 최근 계산된 1~45 추적 점수(번호별 정보표 재사용)
let _trackingPool = [];         // 추천 풀(상위 POOL_SIZE)
let _trackingGames = null;      // 최근 생성된 게임(전체 공유용)

function runTrackingRecommend() {
    if (!lottoDb || !lottoDb.length) {
        showStatus('warning', '⚠️ 통계 DB가 로드되지 않았습니다.');
        return;
    }
    const draws = [...lottoDb].sort((a, b) => a.round - b.round);   // 오름차순 보장
    const t = computeTracking(draws);
    if (!t) { showStatus('warning', '⚠️ 추첨 데이터가 부족합니다.'); return; }

    const scored = scoreTrackingNumbers(t.metrics);
    const { games, pool } = generateTrackingGames(scored);
    _trackingScored = scored;
    _trackingPool = pool;
    _trackingGames = games;

    // 교차매칭 점수 캐시를 미리 빌드 → 카드 20개의 백분위 계산을 O(n)으로
    try { if (typeof getCachedCrossScores === 'function') getCachedCrossScores(); } catch (e) {}

    renderTrackingGames({ games, pool, latest: t.latest, total: t.total });

    if (typeof vibrate === 'function') vibrate(30);
    if (typeof playBeep === 'function') playBeep(500, 0.05);
    showStatus('success', `✅ 번호별 추적 기반 ${games.length}게임 추천 완료! (추천풀 ${pool.length}개)`);
}

// 추천 실행 전이라도 번호별 정보표를 볼 수 있도록 필요시 계산
function _ensureTrackingScored() {
    if (_trackingScored) return _trackingScored;
    if (!lottoDb || !lottoDb.length) return null;
    const draws = [...lottoDb].sort((a, b) => a.round - b.round);
    const t = computeTracking(draws);
    if (!t) return null;
    _trackingScored = scoreTrackingNumbers(t.metrics);
    _trackingPool = _trackingScored.slice(0, TRACKING_CFG.POOL_SIZE).map(s => s.n);
    return _trackingScored;
}

function _ball(n, size, fs) {
    return `<span class="ball ${getBallClass(n)}" style="width:${size}px;height:${size}px;line-height:${size}px;font-size:${fs};">${n}</span>`;
}

function _gradeColor(total) {
    return total >= 75 ? 'var(--grade-excellent)' : total >= 60 ? 'var(--grade-good)' : 'var(--grade-normal)';
}

// ===========================================================================
// 6) 결과 렌더링 (.smart-card + 상세 분석 + 저장/공유)
// ===========================================================================
function renderTrackingGames({ games, pool, latest, total }) {
    const root = document.getElementById('trackingResult');
    if (!root) return;

    const poolBalls = pool.map(n => _ball(n, 30, '0.8rem')).join('');

    const cards = games.map(g => {
        // 상세 분석: 기존 analyzeNumbers/품질점수/필터/백분위/등급 재사용
        const analysis = (typeof analyzeNumbers === 'function') ? analyzeNumbers(g.nums) : null;
        const qScore = (analysis && typeof calculateQualityScore === 'function') ? calculateQualityScore(analysis) : null;
        const filterResult = (typeof checkFilters === 'function') ? checkFilters(g.nums) : null;
        let percentile = null, gradeResult = null;
        try {
            if (typeof calculatePercentileRank === 'function') percentile = calculatePercentileRank(g.nums);
            if (filterResult && percentile !== null && typeof determineGrade === 'function') {
                gradeResult = determineGrade(filterResult, percentile);
            }
        } catch (e) { /* 캐시/DB 미비 시에도 카드는 표시 */ }
        const matching = (typeof currentWinningNumbers !== 'undefined' && currentWinningNumbers)
            ? g.nums.filter(n => currentWinningNumbers.includes(n)) : [];

        const extras = [];
        if (qScore) extras.push(`<span class="smart-score" style="color:${_gradeColor(qScore.totalScore)};">${qScore.totalScore}점 (${qScore.grade})</span>`);
        extras.push(`<span style="font-size:0.72rem;color:var(--text-secondary);">추적점수 ${g.score.toFixed(3)}</span>`);
        if (gradeResult) extras.push(`<span class="grade-badge-inline ${gradeResult.cls}">${gradeResult.grade} ${gradeResult.label}</span>`);
        if (matching.length >= 3) extras.push(`<span class="pred-grade-badge grade-low">${matching.length}개 일치</span>`);

        const quickStats = analysis ? `
            <div class="smart-quick-stats">
                <span>합계 ${analysis.sum}</span>
                <span>AC ${analysis.ac}</span>
                <span>홀짝 ${analysis.oddEvenRatio}</span>
                <span>고저 ${analysis.lowHighRatio}</span>
                <span>${analysis.sectionsWithNumbers}개 구간</span>
            </div>` : '';
        const filterRow = filterResult ? `
            <div class="smart-filter-row">
                ${Object.entries(filterResult.results).map(([, r]) =>
                    `<span class="mini-filter ${r.pass ? 'pass' : 'fail'}">${r.icon} ${r.label}</span>`).join('')}
                ${percentile !== null ? `<span style="font-size:0.7rem;color:var(--text-secondary);">상위 ${percentile}%</span>` : ''}
            </div>` : '';

        return `
            <div class="smart-card">
                <div class="smart-card-header">
                    <span class="smart-rank">#${g.rank}</span>
                    ${extras.join('')}
                    <div style="margin-left:auto;display:flex;gap:4px;">
                        <button class="btn btn-secondary" style="padding:6px 10px;font-size:0.75rem;" onclick="shareTrackingGame([${g.nums}], ${g.score.toFixed(3)})" aria-label="이 조합 공유">📤</button>
                        <button class="btn btn-secondary" style="padding:6px 10px;font-size:0.75rem;" onclick="saveTrackingPrediction([${g.nums}], ${g.score.toFixed(3)})" aria-label="이 조합 저장">💾</button>
                    </div>
                </div>
                <div class="balls-container" style="padding:10px 0;gap:6px;">
                    ${g.nums.map(n => _ball(n, 40, '0.9rem')).join('')}
                </div>
                ${quickStats}
                ${filterRow}
            </div>`;
    }).join('');

    root.innerHTML = `
        <div class="interpretation-box" style="margin-bottom:14px;">
            <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:6px;">
                분석 범위: 1~${latest}회 (총 ${total.toLocaleString()}회) · 매 클릭마다 새로운 ${games.length}게임이 생성됩니다.
            </div>
            <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:6px;">
                <strong>추천 풀(추적점수 상위 ${pool.length}개)</strong>
            </div>
            <div class="balls-container" style="gap:4px;margin-bottom:8px;">${poolBalls}</div>
            <div style="font-size:0.78rem;color:var(--text-secondary);">
                점수 = (모멘텀×0.40) + (출현예정성×0.35) + (빈도×0.15) + (간격일관성×0.10). 상위 ${pool.length}개 풀 안에서 점수 비례 가중 추출로 6개를 뽑아 ${games.length}게임을 만듭니다.
            </div>
        </div>
        <div style="text-align:center;margin-bottom:12px;">
            <button class="btn btn-secondary" style="padding:8px 16px;font-size:0.82rem;" onclick="shareAllTracking()" aria-label="전체 20게임 공유">📤 전체 공유</button>
        </div>
        <h4 style="color:var(--accent-cyan);text-align:center;margin-bottom:12px;">번호별 추적 기반 추천 ${games.length}게임</h4>
        ${cards}`;
    root.classList.remove('hidden');
}

// ---- 저장 (saveCustomPrediction 과 대칭, 메타는 추적 추천) ----
function saveTrackingPrediction(numbers, score) {
    if (typeof getSavedPredictions !== 'function') return;
    const saved = getSavedPredictions();
    const grade = (typeof analyzeNumbers === 'function' && typeof calculateQualityScore === 'function')
        ? calculateQualityScore(analyzeNumbers(numbers)).grade : '-';
    saved.unshift({
        date: new Date().toLocaleString('ko-KR'),
        round: (typeof currentRound !== 'undefined' && currentRound) || '-',
        numbers,
        meta: `번호별 추적 추천 | 추적점수 ${Number(score).toFixed(3)}`,
        score: grade !== '-' ? grade : Number(score).toFixed(3),
        grade
    });
    if (saved.length > 50) saved.length = 50;
    try { localStorage.setItem('lotto-predictions', JSON.stringify(saved)); } catch (e) {}
    if (typeof loadSavedPredictions === 'function') loadSavedPredictions();
    showStatus('success', '💾 번호별 추적 추천이 저장되었습니다!');
    if (typeof playBeep === 'function') playBeep(600, 0.08);
}

// ---- 공유 (단건 / 전체) ----
async function shareTrackingGame(numbers, score) {
    const text = `📈 로또645 번호별 추적 추천\n${numbers.join(', ')}\n추적점수 ${Number(score).toFixed(3)}\nhttps://123lotto.co.kr`;
    let shared = false;
    try { if (typeof shareToKakao === 'function') shared = await shareToKakao(text); } catch (e) {}
    if (!shared) {
        if (typeof copyToClipboard === 'function') await copyToClipboard(text);
        showStatus('success', '📋 공유 텍스트가 복사되었습니다!');
    }
}

async function shareAllTracking() {
    if (!_trackingGames || !_trackingGames.length) return;
    let text = `📈 로또645 번호별 추적 추천 ${_trackingGames.length}게임\n━━━━━━━━━━━━━━\n`;
    _trackingGames.forEach((g, i) => {
        text += `#${i + 1} ${g.nums.join(', ')} (추적점수 ${g.score.toFixed(3)})\n`;
    });
    text += `━━━━━━━━━━━━━━\n🔗 https://123lotto.co.kr`;
    let shared = false;
    try { if (typeof shareToKakao === 'function') shared = await shareToKakao(text); } catch (e) {}
    if (!shared) {
        if (typeof copyToClipboard === 'function') await copyToClipboard(text);
        showStatus('success', '📋 전체 조합이 복사되었습니다!');
    }
}

// ===========================================================================
// 7) 1~45번 번호별 추적 정보표 (lotto_num 의 '전체 번호 추적 분석표' 참고)
// ===========================================================================
function toggleTrackingNumberTable() {
    const box = document.getElementById('trackingNumberTable');
    if (!box) return;
    const scored = _ensureTrackingScored();
    if (!scored) { showStatus('warning', '⚠️ 통계 DB가 로드되지 않았습니다.'); return; }
    const btn = document.getElementById('trackingTableBtn');
    if (box.dataset.shown === '1') {
        box.innerHTML = ''; box.dataset.shown = '0'; box.classList.add('hidden');
        if (btn) btn.textContent = '🔢 1~45번 번호별 정보';
        return;
    }
    box.innerHTML = _renderNumberTable(scored);
    box.dataset.shown = '1';
    box.classList.remove('hidden');
    if (btn) btn.textContent = '🔼 번호별 정보 접기';
    if (typeof vibrate === 'function') vibrate(20);
}

function _renderNumberTable(scored) {
    const poolSet = new Set(_trackingPool);
    const byRank = [...scored].sort((a, b) => a.rank - b.rank);
    const poolBadge = '<span style="background:rgba(0,245,255,.16);color:#9cc0ff;border:1px solid rgba(0,245,255,.4);border-radius:999px;padding:1px 6px;font-size:0.6rem;margin-left:4px;vertical-align:middle;">POOL</span>';
    const th = (t) => `<th style="padding:6px 4px;color:var(--text-secondary);font-weight:600;border-bottom:1px solid rgba(255,255,255,.1);white-space:nowrap;">${t}</th>`;
    const td = (v, strong) => `<td style="padding:6px 4px;text-align:center;border-bottom:1px solid rgba(255,255,255,.04);${strong ? 'font-weight:700;color:var(--accent-cyan);' : ''}">${v}</td>`;
    const rows = byRank.map(s => {
        const m = s.m, inPool = poolSet.has(s.n);
        return `<tr style="${inPool ? 'background:rgba(0,245,255,.06);' : ''}">
            ${td(_ball(s.n, 24, '0.72rem') + (inPool ? poolBadge : ''))}
            ${td(s.rank, true)}
            ${td(s.score.toFixed(3))}
            ${td(m.freq)}
            ${td(m.recentCounts[10])}
            ${td(m.recentCounts[30], true)}
            ${td(m.recentCounts[50])}
            ${td(m.last != null ? m.last : '-')}
            ${td(m.currentSkip)}
            ${td(m.avgGap != null ? m.avgGap.toFixed(1) : '-')}
            ${td(m.overdueRatio.toFixed(2))}
        </tr>`;
    }).join('');
    return `
        <div class="card" style="padding:14px;margin-top:10px;">
            <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:10px;line-height:1.6;">
                각 번호(1~45)의 추적 지표. <strong style="color:#9cc0ff;">POOL</strong> = 추천 풀(상위 ${TRACKING_CFG.POOL_SIZE}개).<br>
                <b>예정성</b> = 현재 건너뜀 ÷ 평균간격 (1.0 이상이면 평소보다 오래 안 나온 상태).
            </div>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:0.78rem;min-width:600px;">
                    <thead><tr>
                        ${th('번호')}${th('순위')}${th('점수')}${th('누적')}${th('최근10')}${th('최근30')}${th('최근50')}${th('마지막출현')}${th('건너뜀')}${th('평균간격')}${th('예정성')}
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>`;
}
