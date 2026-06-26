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
    renderTrackingGames({ games, pool, scored, latest: t.latest, total: t.total });

    if (typeof vibrate === 'function') vibrate(30);
    if (typeof playBeep === 'function') playBeep(500, 0.05);
    showStatus('success', `✅ 번호별 추적 기반 ${games.length}게임 추천 완료! (추천풀 ${pool.length}개)`);
}

// ---- 번호 간단 통계(외부 의존성 없이 자체 계산) ----
function _quickStats(nums) {
    const sum = nums.reduce((a, b) => a + b, 0);
    const odd = nums.filter(n => n % 2 === 1).length;
    const low = nums.filter(n => n <= 22).length;
    return { sum, oddEven: `${odd}:${6 - odd}`, lowHigh: `${low}:${6 - low}` };
}

function _ball(n, size, fs) {
    return `<span class="ball ${getBallClass(n)}" style="width:${size}px;height:${size}px;line-height:${size}px;font-size:${fs};">${n}</span>`;
}

// ===========================================================================
// 6) 결과 렌더링 (기존 .smart-card / .balls-container 스타일 재사용)
// ===========================================================================
function renderTrackingGames({ games, pool, scored, latest, total }) {
    const root = document.getElementById('trackingResult');
    if (!root) return;

    const poolBalls = pool.map(n => _ball(n, 30, '0.8rem')).join('');
    const scoreColor = (gs) => gs >= 3.4 ? 'var(--grade-excellent)'
                     : gs >= 3.1 ? 'var(--grade-good)' : 'var(--grade-normal)';

    const cards = games.map(g => {
        const qs = _quickStats(g.nums);
        return `
            <div class="smart-card">
                <div class="smart-card-header">
                    <span class="smart-rank">#${g.rank}</span>
                    <span class="smart-score" style="color:${scoreColor(g.score)};">추적점수 ${g.score.toFixed(3)}</span>
                    <span style="font-size:0.72rem;color:var(--text-secondary);margin-left:auto;">합 ${qs.sum} · 홀짝 ${qs.oddEven} · 고저 ${qs.lowHigh}</span>
                </div>
                <div class="balls-container" style="padding:8px 0;gap:6px;">
                    ${g.nums.map(n => _ball(n, 40, '0.9rem')).join('')}
                </div>
            </div>`;
    }).join('');

    root.innerHTML = `
        <div class="interpretation-box" style="margin-bottom:14px;">
            <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:6px;">
                분석 범위: 1~${latest}회 (총 ${total.toLocaleString()}회) · 매 클릭마다 새로운 20게임이 생성됩니다.
            </div>
            <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:6px;">
                <strong>추천 풀(추적점수 상위 ${pool.length}개)</strong>
            </div>
            <div class="balls-container" style="gap:4px;margin-bottom:8px;">${poolBalls}</div>
            <div style="font-size:0.78rem;color:var(--text-secondary);">
                점수 = (모멘텀×0.40) + (출현예정성×0.35) + (빈도×0.15) + (간격일관성×0.10). 상위 ${pool.length}개 풀 안에서 점수 비례 가중 추출로 6개를 뽑아 ${games.length}게임을 만듭니다.
            </div>
        </div>
        <h4 style="color:var(--accent-cyan);text-align:center;margin-bottom:12px;">번호별 추적 기반 추천 ${games.length}게임</h4>
        ${cards}`;
    root.classList.remove('hidden');
}
