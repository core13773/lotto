// analysis.js - 번호 분석, 품질 점수, 필터, 등급, 상세 분석 렌더링

const isPrime = n => { if (n < 2) return false; const limit = Math.sqrt(n); for (let i = 2; i <= limit; i++) if (n % i === 0) return false; return true; };

function analyzeNumbers(nums) {
    const sorted = [...nums].sort((a, b) => a - b);
    const diffs = new Set();
    for (let i = 0; i < sorted.length; i++) for (let j = i + 1; j < sorted.length; j++) diffs.add(sorted[j] - sorted[i]);
    const ac = diffs.size - 5;
    const odd = sorted.filter(n => n % 2 === 1), even = sorted.filter(n => n % 2 === 0);
    const low = sorted.filter(n => n <= 22), high = sorted.filter(n => n > 22);
    const sections = {
        '1-10': sorted.filter(n => n >= 1 && n <= 10),
        '11-20': sorted.filter(n => n >= 11 && n <= 20),
        '21-30': sorted.filter(n => n >= 21 && n <= 30),
        '31-40': sorted.filter(n => n >= 31 && n <= 40),
        '41-45': sorted.filter(n => n >= 41 && n <= 45)
    };
    const consecutiveGroups = [];
    let tempGroup = [sorted[0]];
    for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i + 1] - sorted[i] === 1) tempGroup.push(sorted[i + 1]);
        else { if (tempGroup.length > 1) consecutiveGroups.push([...tempGroup]); tempGroup = [sorted[i + 1]]; }
    }
    if (tempGroup.length > 1) consecutiveGroups.push(tempGroup);
    const gaps = []; for (let i = 0; i < sorted.length - 1; i++) gaps.push(sorted[i + 1] - sorted[i]);
    const primes = sorted.filter(isPrime), mult3 = sorted.filter(n => n % 3 === 0), mult5 = sorted.filter(n => n % 5 === 0);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const sectionsWithNumbers = Object.values(sections).filter(s => s.length > 0).length;

    return {
        numbers: sorted, sum, avg: (sum / 6).toFixed(1), ac,
        odd, even, oddCount: odd.length, evenCount: even.length, oddEvenRatio: `${odd.length}:${even.length}`,
        low, high, lowCount: low.length, highCount: high.length, lowHighRatio: `${low.length}:${high.length}`,
        sections, sectionsWithNumbers, consecutiveGroups,
        gaps, minGap: Math.min(...gaps), maxGap: Math.max(...gaps), avgGap: (gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1),
        primes, mult3, mult5,
        uniqueLastDigits: new Set(sorted.map(n => n % 10)).size,
        range: sorted[5] - sorted[0]
    };
}

// 품질 점수 계산 함수
function calculateQualityScore(a) {
    let totalScore = 0;
    let breakdown = {};

    // 1. 합계 점수 (0-25점)
    let sumScore = 0;
    if (a.sum >= 115 && a.sum <= 150) sumScore = 25;
    else if (a.sum >= 100 && a.sum <= 175) sumScore = 20;
    else if (a.sum >= 80 && a.sum <= 200) sumScore = 10;
    else sumScore = 5;
    breakdown.sum = { score: sumScore, max: 25, label: '합계' };
    totalScore += sumScore;

    // 2. AC값 점수 (0-20점)
    let acScore = 0;
    if (a.ac >= 7 && a.ac <= 10) acScore = 20;
    else if (a.ac >= 5 && a.ac <= 6) acScore = 15;
    else if (a.ac >= 4) acScore = 10;
    else acScore = 5;
    breakdown.ac = { score: acScore, max: 20, label: 'AC값' };
    totalScore += acScore;

    // 3. 홀짝 비율 점수 (0-20점)
    let oddEvenScore = 0;
    const oddEvenDiff = Math.abs(a.oddCount - a.evenCount);
    if (oddEvenDiff <= 2) oddEvenScore = 20;
    else if (oddEvenDiff <= 4) oddEvenScore = 10;
    else oddEvenScore = 5;
    breakdown.oddEven = { score: oddEvenScore, max: 20, label: '홀짝' };
    totalScore += oddEvenScore;

    // 4. 고저 비율 점수 (0-15점)
    let lowHighScore = 0;
    const lowHighDiff = Math.abs(a.lowCount - a.highCount);
    if (lowHighDiff <= 2) lowHighScore = 15;
    else if (lowHighDiff <= 4) lowHighScore = 10;
    else lowHighScore = 5;
    breakdown.lowHigh = { score: lowHighScore, max: 15, label: '고저' };
    totalScore += lowHighScore;

    // 5. 구간 분포 점수 (0-20점)
    let sectionScore = 0;
    if (a.sectionsWithNumbers >= 4) sectionScore = 20;
    else if (a.sectionsWithNumbers === 3) sectionScore = 15;
    else if (a.sectionsWithNumbers === 2) sectionScore = 10;
    else sectionScore = 5;
    breakdown.section = { score: sectionScore, max: 20, label: '분포' };
    totalScore += sectionScore;

    const grade = totalScore >= 90 ? '최상' : totalScore >= 75 ? '양호' : totalScore >= 60 ? '보통' : totalScore >= 45 ? '주의' : '미흡';
    const gradeClass = totalScore >= 90 ? 'excellent' : totalScore >= 75 ? 'good' : totalScore >= 60 ? 'normal' : totalScore >= 45 ? 'caution' : 'bad';

    return { totalScore, breakdown, grade, gradeClass };
}

// 점수 카드 표시
function displayScoreCard(prefix, scoreData, analysis, filterResult = null, gradeResult = null) {
    document.getElementById(`${prefix}Score`).textContent = scoreData.totalScore;
    document.getElementById(`${prefix}ScoreGrade`).textContent = `등급: ${scoreData.grade} (상위 ${getPercentile(scoreData.totalScore)}%)`;

    const breakdownHtml = Object.values(scoreData.breakdown).map(item => `
        <div class="score-item">
            <div class="score-item-value" style="color: ${item.score >= item.max * 0.8 ? 'var(--grade-excellent)' : item.score >= item.max * 0.6 ? 'var(--grade-good)' : 'var(--grade-caution)'}">
                ${item.score}/${item.max}
            </div>
            <div class="score-item-label">${item.label}</div>
        </div>
    `).join('');
    document.getElementById(`${prefix}ScoreBreakdown`).innerHTML = breakdownHtml;

    // 필터 결과 표시
    const filterEl = document.getElementById(`${prefix}FilterResult`);
    if (filterEl && filterResult) {
        filterEl.innerHTML = renderFilterBadge(filterResult);
        filterEl.classList.remove('hidden');
    }

    // 등급 판정 표시
    const gradeEl = document.getElementById(`${prefix}GradeResult`);
    if (gradeEl && gradeResult) {
        gradeEl.innerHTML = `<span class="grade-badge-large ${gradeResult.cls}">${gradeResult.grade} ${gradeResult.label}</span>`;
        gradeEl.classList.remove('hidden');
    }
}

function getPercentile(score) {
    if (score >= 90) return '10';
    if (score >= 80) return '25';
    if (score >= 70) return '40';
    if (score >= 60) return '55';
    if (score >= 50) return '70';
    return '85';
}

// ========== 통합 필터 시스템 (Excel 번호_생성기 기준) ==========
function checkFilters(nums) {
    const sorted = [...nums].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const oddCount = sorted.filter(n => n % 2 === 1).length;
    const range = sorted[5] - sorted[0];

    // 연속쌍 계산
    let consecPairs = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i + 1] - sorted[i] === 1) consecPairs++;
    }

    // 구간 밀집도 (한 구간에 최대 몇 개)
    const sections = [0, 0, 0, 0, 0]; // 1-9, 10-19, 20-29, 30-39, 40-45
    sorted.forEach(n => {
        if (n <= 9) sections[0]++;
        else if (n <= 19) sections[1]++;
        else if (n <= 29) sections[2]++;
        else if (n <= 39) sections[3]++;
        else sections[4]++;
    });
    const maxSectionConcentration = Math.max(...sections);

    const results = {
        sum: { pass: sum >= 78 && sum <= 197, value: sum, label: '합계', icon: sum >= 78 && sum <= 197 ? '✓' : '✗', range: '78~197' },
        oddEven: { pass: oddCount >= 1 && oddCount <= 5, value: `홀${oddCount} 짝${6-oddCount}`, label: '홀짝', icon: oddCount >= 1 && oddCount <= 5 ? '✓' : '✗', range: '홀1~5' },
        consec: { pass: consecPairs <= 2, value: `${consecPairs}쌍`, label: '연속쌍', icon: consecPairs <= 2 ? '✓' : '✗', range: '≤2쌍' },
        section: { pass: maxSectionConcentration <= 3, value: `최대${maxSectionConcentration}개`, label: '구간밀집', icon: maxSectionConcentration <= 3 ? '✓' : '✗', range: '≤3개' },
        range: { pass: range >= 14, value: `${range}`, label: '번호폭', icon: range >= 14 ? '✓' : '✗', range: '≥14' }
    };

    const allPass = Object.values(results).every(r => r.pass);
    const passCount = Object.values(results).filter(r => r.pass).length;

    return { results, allPass, passCount, details: { sum, oddCount, consecPairs, maxSectionConcentration, range } };
}

// ========== 등급 판정 (Excel 번호_생성기 기준) ==========
function determineGrade(filterResult, percentileRank) {
    let gradeScore = 0;
    if (filterResult.allPass) gradeScore += 3;
    else if (filterResult.passCount >= 3) gradeScore += 1;

    if (percentileRank >= 75) gradeScore += 3;
    else if (percentileRank >= 50) gradeScore += 2;
    else if (percentileRank >= 25) gradeScore += 1;

    if (gradeScore >= 6) return { grade: '★★★', label: '적극권장', cls: 'grade-jackpot' };
    if (gradeScore >= 4) return { grade: '★★☆', label: '긍정적', cls: 'grade-high' };
    if (gradeScore >= 2) return { grade: '★☆☆', label: '중립', cls: 'grade-mid' };
    return { grade: '☆☆☆', label: '신중', cls: 'grade-low' };
}

// ========== 전체 회차 교차 매칭 (Excel _참고계산 시트 로직) ==========
function crossMatchAllHistory(nums) {
    if (!lottoDb || lottoDb.length === 0) return null;
    const numSet = new Set(nums);
    let results = [];

    lottoDb.forEach(entry => {
        if (!entry.numbers) return;
        const matchCount = entry.numbers.filter(n => numSet.has(n)).length;
        const bonusMatch = entry.bonus && numSet.has(entry.bonus) ? 1 : 0;

        let crossScore = 0;
        if (matchCount === 6) crossScore = 6;
        else if (matchCount === 5 && bonusMatch) crossScore = 5;
        else if (matchCount === 5) crossScore = 4;
        else if (matchCount === 4) crossScore = 3;
        else if (matchCount === 3) crossScore = 2;

        let gradeLabel = '-';
        if (matchCount >= 6) gradeLabel = '1등';
        else if (matchCount === 5 && bonusMatch) gradeLabel = '2등';
        else if (matchCount === 5) gradeLabel = '3등';
        else if (matchCount === 4) gradeLabel = '4등';
        else if (matchCount === 3) gradeLabel = '5등';

        results.push({
            round: entry.round,
            numbers: entry.numbers,
            bonus: entry.bonus,
            matchCount,
            bonusMatch,
            crossScore,
            gradeLabel
        });
    });

    const totalCrossScore = results.reduce((sum, r) => sum + r.crossScore, 0);
    const totalMatches = results.reduce((sum, r) => sum + (r.matchCount >= 3 ? 1 : 0), 0);
    const statBreakdown = {
        first: results.filter(r => r.matchCount >= 6).length,
        second: results.filter(r => r.matchCount === 5 && r.bonusMatch).length,
        third: results.filter(r => r.matchCount === 5 && !r.bonusMatch).length,
        fourth: results.filter(r => r.matchCount === 4).length,
        fifth: results.filter(r => r.matchCount === 3).length
    };

    return { results, totalCrossScore, totalMatches, statBreakdown };
}

// ========== 교차 매칭 점수 캐싱 ==========
let _cachedCrossScores = null;
let _cachedCrossScoresDbLength = 0;

function getCachedCrossScores() {
    if (!lottoDb || lottoDb.length === 0) return null;
    if (_cachedCrossScores && _cachedCrossScoresDbLength === lottoDb.length) {
        return _cachedCrossScores;
    }
    // 캐시 재생성: 각 회차의 교차 매칭 점수를 미리 계산
    const scores = {};
    lottoDb.forEach(entry => {
        if (!entry.numbers) return;
        scores[entry.round] = _computeCrossMatchScore(entry.numbers);
    });
    _cachedCrossScores = scores;
    _cachedCrossScoresDbLength = lottoDb.length;
    return scores;
}

function _computeCrossMatchScore(nums) {
    if (!lottoDb || lottoDb.length === 0) return 0;
    const numSet = new Set(nums);
    let total = 0;
    lottoDb.forEach(entry => {
        if (!entry.numbers) return;
        const matchCount = entry.numbers.filter(n => numSet.has(n)).length;
        const bonusMatch = entry.bonus && numSet.has(entry.bonus) ? 1 : 0;
        if (matchCount >= 6) total += 6;
        else if (matchCount === 5 && bonusMatch) total += 5;
        else if (matchCount === 5) total += 4;
        else if (matchCount === 4) total += 3;
        else if (matchCount === 3) total += 2;
    });
    return total;
}

// ========== 백분위 순위 계산 ==========
function calculatePercentileRank(nums) {
    if (!lottoDb || lottoDb.length === 0) return 0;
    const ownScore = crossMatchScore(nums);
    const cachedScores = getCachedCrossScores();

    let lowerCount = 0;
    if (cachedScores) {
        Object.values(cachedScores).forEach(entryScore => {
            if (entryScore < ownScore) lowerCount++;
        });
    } else {
        lottoDb.forEach(entry => {
            if (!entry.numbers) return;
            const entryScore = crossMatchScore(entry.numbers);
            if (entryScore < ownScore) lowerCount++;
        });
    }

    return Math.round((1 - lowerCount / lottoDb.length) * 1000) / 10;
}

function crossMatchScore(nums) {
    if (!lottoDb || lottoDb.length === 0) return 0;
    // 현재 분석 중인 번호가 DB에 있는 회차라면 캐시 활용
    const cachedScores = getCachedCrossScores();
    if (cachedScores) {
        // 입력 번호를 정렬해서 문자열 키로 만듦 (캐시 히트 확인용)
        const sorted = [...nums].sort((a, b) => a - b);
        // lottoDb에서 정확히 일치하는 회차가 있으면 캐시된 점수 반환
        for (const entry of lottoDb) {
            if (entry.numbers && entry.numbers.length === 6) {
                const en = [...entry.numbers].sort((a, b) => a - b);
                if (en[0] === sorted[0] && en[1] === sorted[1] && en[2] === sorted[2] &&
                    en[3] === sorted[3] && en[4] === sorted[4] && en[5] === sorted[5]) {
                    return cachedScores[entry.round] || 0;
                }
            }
        }
    }
    return _computeCrossMatchScore(nums);
}

// ========== 유사 과거 회차 TOP3 ==========
function findTop3SimilarRounds(nums) {
    if (!lottoDb || lottoDb.length === 0) return [];
    const numSet = new Set(nums);
    const scored = lottoDb.map(entry => {
        if (!entry.numbers) return null;
        const matchCount = entry.numbers.filter(n => numSet.has(n)).length;
        const bonusMatch = entry.bonus && numSet.has(entry.bonus) ? 1 : 0;
        const sortKey = matchCount * 10000 + bonusMatch * 1000 + Math.random() * 100;
        return { ...entry, matchCount, bonusMatch, sortKey };
    }).filter(Boolean);

    scored.sort((a, b) => b.sortKey - a.sortKey);
    return scored.slice(0, 3);
}

// ========== 최근 5회차 가상 매칭 ==========
function runRecentMatchSimulation(nums) {
    if (!lottoDb || lottoDb.length < 5) return [];
    const numSet = new Set(nums);
    const recent5 = lottoDb.slice(-5).reverse();

    return recent5.map(entry => {
        const matchCount = entry.numbers.filter(n => numSet.has(n)).length;
        const bonusMatch = entry.bonus && numSet.has(entry.bonus) ? true : false;

        let gradeLabel = '-', gradeClass = '';
        if (matchCount >= 6) { gradeLabel = '1등'; gradeClass = 'grade-jackpot'; }
        else if (matchCount === 5 && bonusMatch) { gradeLabel = '2등'; gradeClass = 'grade-jackpot'; }
        else if (matchCount === 5) { gradeLabel = '3등'; gradeClass = 'grade-high'; }
        else if (matchCount === 4) { gradeLabel = '4등'; gradeClass = 'grade-mid'; }
        else if (matchCount === 3) { gradeLabel = '5등'; gradeClass = 'grade-low'; }

        return { round: entry.round, numbers: entry.numbers, bonus: entry.bonus, matchCount, bonusMatch, gradeLabel, gradeClass };
    });
}

// ========== 번호별 추천점수/제외점수 ==========
let cachedNumberScores = null;
function computeNumberScores() {
    if (!lottoDb || lottoDb.length === 0) return null;
    if (cachedNumberScores) return cachedNumberScores;
    const scores = {};
    const latestRound = lottoDb[lottoDb.length - 1].round;
    const recent10 = lottoDb.slice(-10);
    const recent20 = lottoDb.slice(-20);
    const recent50 = lottoDb.slice(-50);

    // 각 번호별 기본 통계
    for (let n = 1; n <= 45; n++) {
        const appearances = [];
        lottoDb.forEach((entry, idx) => {
            if (entry.numbers && entry.numbers.includes(n)) {
                appearances.push({ round: entry.round, bonus: entry.bonus === n });
            }
        });

        const totalAppearances = appearances.length;
        const recent10Count = recent10.filter(e => e.numbers && e.numbers.includes(n)).length;
        const recent20Count = recent20.filter(e => e.numbers && e.numbers.includes(n)).length;
        const recent50Count = recent50.filter(e => e.numbers && e.numbers.includes(n)).length;

        // 갭 계산
        let lastSeen = 0;
        for (let i = lottoDb.length - 1; i >= 0; i--) {
            if (lottoDb[i].numbers && lottoDb[i].numbers.includes(n)) {
                lastSeen = lottoDb[i].round;
                break;
            }
        }
        const currentGap = latestRound - lastSeen;

        // 평균 갭과 최대 갭
        let gaps = [];
        for (let i = 1; i < appearances.length; i++) {
            gaps.push(appearances[i].round - appearances[i-1].round);
        }
        const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
        const maxGap = gaps.length > 0 ? Math.max(...gaps) : 0;
        const stdDev = gaps.length > 1 ? Math.sqrt(gaps.reduce((s, g) => s + Math.pow(g - avgGap, 2), 0) / gaps.length) : 1;
        const zScore = stdDev > 0 ? (currentGap - avgGap) / stdDev : 0;

        // 최근 10회 갭 추이
        const recentGaps = gaps.slice(-10);

        // 추세 (↑↑ 가속 / ↑ 증가 / → 유지 / ↓ 감소 / ↓↓ 감속)
        let trend = '→';
        if (recent20Count >= 5) trend = recent20Count >= 7 ? '↑↑' : '↑';
        else if (recent20Count <= 1) trend = recent20Count === 0 ? '↓↓' : '↓';

        // 추천점수 (0~4): 낮을수록 포함 추천
        let recScore = 0;
        if (recent10Count >= 3) recScore = 0; // 핫넘버
        else if (zScore > 1.0) recScore = 0; // 과도결번 (평균회귀 신호)
        else if (recent10Count >= 2) recScore = 1;
        else if (zScore > 0.5) recScore = 1;
        else if (zScore > -0.5) recScore = 2;
        else recScore = 3;

        // 제외점수 (0~4): 높을수록 제외 고려
        let exclScore = 0;
        if (recent5Count(n) >= 3) exclScore = 3; // 최근 과출현
        else if (trend === '↓↓') exclScore = 2;
        else if (trend === '↓' && recent10Count === 0) exclScore = 3;
        else if (recent10Count === 0 && currentGap < 15) exclScore = 1;
        else exclScore = recScore >= 3 ? 2 : 0;

        scores[n] = {
            appearances: totalAppearances,
            recent10: recent10Count,
            recent20: recent20Count,
            recent50: recent50Count,
            avgGap: Math.round(avgGap * 10) / 10,
            currentGap,
            maxGap,
            zScore: Math.round(zScore * 100) / 100,
            trend,
            recScore,
            exclScore,
            recentGaps,
            lastSeen
        };
    }
    cachedNumberScores = scores;
    return scores;
}

function recent5Count(n) {
    return (lottoDb || []).slice(-5).filter(e => e.numbers && e.numbers.includes(n)).length;
}

// ========== 필터 결과 렌더링 ==========
function renderFilterBadge(filterResult) {
    const { results, allPass, passCount } = filterResult;
    return `
        <div class="filter-badge-container">
            <div class="filter-summary ${allPass ? 'filter-pass' : 'filter-fail'}">
                ${allPass ? '★ 필터 전체 통과' : `✗ 필터 ${5 - passCount}개 불통과`}
            </div>
            <div class="filter-details">
                ${Object.entries(results).map(([key, r]) => `
                    <span class="filter-item ${r.pass ? 'pass' : 'fail'}" title="${r.label}: ${r.value} (기준: ${r.range})">
                        ${r.icon} ${r.label}
                    </span>
                `).join('')}
            </div>
        </div>
    `;
}

function renderCrossMatchSummary(crossResult) {
    if (!crossResult) return '';
    return `
        <div class="crossmatch-summary">
            <div class="crossmatch-title">📊 전체 회차 교차 매칭</div>
            <div class="crossmatch-stats">
                <span>1등: ${crossResult.statBreakdown.first}회</span>
                <span>2등: ${crossResult.statBreakdown.second}회</span>
                <span>3등: ${crossResult.statBreakdown.third}회</span>
                <span>4등: ${crossResult.statBreakdown.fourth}회</span>
                <span>5등: ${crossResult.statBreakdown.fifth}회</span>
            </div>
            <div style="font-size:0.8rem;color:var(--text-secondary);">총 교차점수: ${crossResult.totalCrossScore}점 | 3등 이상 매칭: ${crossResult.totalMatches}회</div>
        </div>
    `;
}

function renderTop3Similar(top3) {
    if (!top3 || top3.length === 0) return '';
    return `
        <div class="top3-container">
            <div class="top3-title">🔍 유사 과거 회차 TOP3</div>
            ${top3.map((r, i) => `
                <div class="top3-item">
                    <span class="top3-rank">TOP${i + 1}</span>
                    <span class="top3-round">제 ${r.round}회</span>
                    <span class="top3-numbers">${r.numbers.join(' ')}</span>
                    ${r.bonus ? `<span class="top3-bonus">+${r.bonus}</span>` : ''}
                    <span class="top3-match">${r.matchCount}개 일치${r.bonusMatch ? '+보너스' : ''}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function renderRecent5Match(recent5) {
    if (!recent5 || recent5.length === 0) return '';
    return `
        <div class="recent5-container">
            <div class="recent5-title">📅 최근 5회차 가상 매칭</div>
            <div class="recent5-list">
                ${recent5.map(r => `
                    <div class="recent5-item ${r.matchCount >= 3 ? 'has-match' : ''}">
                        <span class="recent5-round">${r.round}회</span>
                        <span class="recent5-nums">${r.numbers.join(' ')}</span>
                        ${r.bonus ? `<span class="recent5-bonus">+${r.bonus}</span>` : ''}
                        <span class="recent5-match ${r.gradeClass}">${r.matchCount}개${r.gradeLabel !== '-' ? ` (${r.gradeLabel})` : ''}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// 상세 분석 렌더링 (개선된 버전)
function renderDetailedAnalysis(a) {
    const getGrade = (value, optimal, good, normal) => {
        if (value >= optimal[0] && value <= optimal[1]) return { grade: 'excellent', text: '최적', badge: 'badge-excellent' };
        if (value >= good[0] && value <= good[1]) return { grade: 'good', text: '양호', badge: 'badge-good' };
        if (value >= normal[0] && value <= normal[1]) return { grade: 'normal', text: '보통', badge: 'badge-normal' };
        return { grade: 'caution', text: '주의', badge: 'badge-caution' };
    };

    const sumGrade = getGrade(a.sum, [115, 150], [100, 175], [80, 200]);
    const acGrade = getGrade(a.ac, [7, 10], [5, 6], [4, 4]);
    const oddEvenDiff = Math.abs(a.oddCount - a.evenCount);
    const oddEvenGrade = getGrade(6 - oddEvenDiff, [4, 6], [2, 3], [1, 1]);
    const lowHighDiff = Math.abs(a.lowCount - a.highCount);
    const lowHighGrade = getGrade(6 - lowHighDiff, [4, 6], [2, 3], [1, 1]);

    return `
        <!-- 종합 해석 -->
        <div class="interpretation-box">
            <div class="interpretation-title">📋 종합 해석</div>
            <div class="interpretation-content">
                이 번호 조합은 <strong>합계 ${a.sum}</strong>으로 ${sumGrade.text} 범위에 있습니다.
                홀짝 비율 <strong>${a.oddEvenRatio}</strong>, 고저 비율 <strong>${a.lowHighRatio}</strong>으로
                ${oddEvenDiff <= 2 && lowHighDiff <= 2 ? '매우 균형잡힌' : oddEvenDiff <= 4 && lowHighDiff <= 4 ? '적절히 분산된' : '다소 편중된'} 구성입니다.
                <strong>${a.sectionsWithNumbers}개 구간</strong>에 분포하며,
                ${a.consecutiveGroups.length > 0 ? `연속번호 ${a.consecutiveGroups.length}그룹이 포함되어 있습니다.` : '연속번호는 없습니다.'}
            </div>
        </div>

        <div class="analysis-grid">
            <!-- 합계 -->
            <div class="analysis-item grade-${sumGrade.grade}">
                <div class="analysis-header">
                    <div class="analysis-label">
                        합계
                        <span class="help-icon" tabindex="0">?
                            <div class="tooltip">
                                <div class="tooltip-title">합계란?</div>
                                6개 번호를 모두 더한 값입니다.<br><br>
                                <strong>권장 범위:</strong> 115~150<br>
                                <strong>통계:</strong> 역대 당첨번호의 약 65%가 이 범위 내
                            </div>
                        </span>
                    </div>
                    <span class="analysis-badge ${sumGrade.badge}">${sumGrade.text}</span>
                </div>
                <div class="analysis-value">${a.sum}</div>
                <div class="analysis-detail">
                    권장: 115~150 | 평균: ${a.avg}<br>
                    ${a.sum < 100 ? '⚠️ 낮은 번호에 치우침' : a.sum > 180 ? '⚠️ 높은 번호에 치우침' : '✓ 적정 범위'}
                </div>
            </div>

            <!-- AC값 -->
            <div class="analysis-item grade-${acGrade.grade}">
                <div class="analysis-header">
                    <div class="analysis-label">
                        AC값
                        <span class="help-icon" tabindex="0">?
                            <div class="tooltip">
                                <div class="tooltip-title">AC값 (Arithmetic Complexity)</div>
                                번호들 간의 차이값 다양성을 나타내는 지표입니다.<br><br>
                                <strong>계산:</strong> (번호쌍 차이 종류 수) - 5<br>
                                <strong>범위:</strong> 0~10<br>
                                <strong>권장:</strong> 7~10 (복잡할수록 좋음)
                            </div>
                        </span>
                    </div>
                    <span class="analysis-badge ${acGrade.badge}">${acGrade.text}</span>
                </div>
                <div class="analysis-value">${a.ac}</div>
                <div class="analysis-detail">
                    권장: 7~10 | 최대: 10<br>
                    ${a.ac >= 7 ? '✓ 번호 구성이 다양함' : a.ac >= 5 ? '○ 적당한 다양성' : '⚠️ 번호가 단조로움'}
                </div>
            </div>

            <!-- 번호 범위 -->
            <div class="analysis-item">
                <div class="analysis-header">
                    <div class="analysis-label">
                        번호 범위
                        <span class="help-icon" tabindex="0">?
                            <div class="tooltip">
                                <div class="tooltip-title">번호 범위</div>
                                가장 큰 번호와 가장 작은 번호의 차이입니다.<br><br>
                                <strong>최소 번호:</strong> ${a.numbers[0]}<br>
                                <strong>최대 번호:</strong> ${a.numbers[5]}<br>
                                <strong>권장:</strong> 25 이상이면 넓게 분포
                            </div>
                        </span>
                    </div>
                </div>
                <div class="analysis-value">${a.range}</div>
                <div class="analysis-detail">
                    ${a.numbers[0]} ~ ${a.numbers[5]}<br>
                    ${a.range >= 30 ? '✓ 넓은 분포' : a.range >= 20 ? '○ 적당한 분포' : '⚠️ 좁은 분포'}
                </div>
            </div>

            <!-- 끝자리 -->
            <div class="analysis-item">
                <div class="analysis-header">
                    <div class="analysis-label">
                        끝자리 종류
                        <span class="help-icon" tabindex="0">?
                            <div class="tooltip">
                                <div class="tooltip-title">끝자리 종류</div>
                                6개 번호의 끝자리(일의 자리)가 몇 가지인지 나타냅니다.<br><br>
                                <strong>예:</strong> 3, 13, 23은 모두 끝자리가 3<br>
                                <strong>권장:</strong> 4개 이상이면 다양함
                            </div>
                        </span>
                    </div>
                </div>
                <div class="analysis-value">${a.uniqueLastDigits}개</div>
                <div class="analysis-detail">
                    최대 6개 가능<br>
                    ${a.uniqueLastDigits >= 5 ? '✓ 매우 다양함' : a.uniqueLastDigits >= 4 ? '○ 적당함' : '⚠️ 중복 많음'}
                </div>
            </div>
        </div>

        <!-- 홀짝 분석 -->
        <div style="margin-top:25px;">
            <h4 style="color:var(--accent-cyan);margin-bottom:15px;display:flex;align-items:center;gap:8px;">
                🎲 홀짝 분석
                <span class="analysis-badge ${oddEvenGrade.badge}">${oddEvenGrade.text}</span>
            </h4>
            <div style="display:flex;gap:20px;flex-wrap:wrap;">
                <div style="flex:1;min-width:200px;background:rgba(0,0,0,0.2);padding:15px;border-radius:10px;">
                    <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">비율</div>
                    <div style="font-size:1.5rem;color:var(--accent-gold);">${a.oddEvenRatio}</div>
                    <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:5px;">홀수 : 짝수</div>
                </div>
                <div style="flex:2;min-width:200px;">
                    <div style="margin-bottom:10px;">
                        <span style="color:var(--accent-pink);">홀수 (${a.oddCount}개):</span>
                        <span style="color:var(--text-secondary);margin-left:10px;">${a.odd.join(', ') || '없음'}</span>
                    </div>
                    <div>
                        <span style="color:var(--accent-cyan);">짝수 (${a.evenCount}개):</span>
                        <span style="color:var(--text-secondary);margin-left:10px;">${a.even.join(', ') || '없음'}</span>
                    </div>
                    <div style="margin-top:10px;padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;font-size:0.85rem;">
                        💡 <strong>통계:</strong> 3:3 비율이 가장 많이 출현 (약 33%), 4:2 또는 2:4가 그 다음 (약 26%)
                    </div>
                </div>
            </div>
        </div>

        <!-- 고저 분석 -->
        <div style="margin-top:25px;">
            <h4 style="color:var(--accent-cyan);margin-bottom:15px;display:flex;align-items:center;gap:8px;">
                📈 고저 분석
                <span class="analysis-badge ${lowHighGrade.badge}">${lowHighGrade.text}</span>
            </h4>
            <div style="display:flex;gap:20px;flex-wrap:wrap;">
                <div style="flex:1;min-width:200px;background:rgba(0,0,0,0.2);padding:15px;border-radius:10px;">
                    <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">비율</div>
                    <div style="font-size:1.5rem;color:var(--accent-gold);">${a.lowHighRatio}</div>
                    <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:5px;">저번호 : 고번호</div>
                </div>
                <div style="flex:2;min-width:200px;">
                    <div style="margin-bottom:10px;">
                        <span style="color:#60a5fa;">저번호 1~22 (${a.lowCount}개):</span>
                        <span style="color:var(--text-secondary);margin-left:10px;">${a.low.join(', ') || '없음'}</span>
                    </div>
                    <div>
                        <span style="color:#f87171;">고번호 23~45 (${a.highCount}개):</span>
                        <span style="color:var(--text-secondary);margin-left:10px;">${a.high.join(', ') || '없음'}</span>
                    </div>
                    <div style="margin-top:10px;padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;font-size:0.85rem;">
                        💡 <strong>통계:</strong> 3:3 비율이 가장 많이 출현 (약 33%), 4:2 또는 2:4가 그 다음 (약 26%)
                    </div>
                </div>
            </div>
        </div>

        <!-- 구간별 분포 -->
        <div style="margin-top:25px;">
            <h4 style="color:var(--accent-cyan);margin-bottom:15px;">📍 구간별 분포 (${a.sectionsWithNumbers}개 구간 사용)</h4>
            <div class="section-bar">
                <div class="section-segment s1 ${a.sections['1-10'].length > 0 ? 'active' : ''}">
                    <span>${a.sections['1-10'].length}</span>
                </div>
                <div class="section-segment s2 ${a.sections['11-20'].length > 0 ? 'active' : ''}">
                    <span>${a.sections['11-20'].length}</span>
                </div>
                <div class="section-segment s3 ${a.sections['21-30'].length > 0 ? 'active' : ''}">
                    <span>${a.sections['21-30'].length}</span>
                </div>
                <div class="section-segment s4 ${a.sections['31-40'].length > 0 ? 'active' : ''}">
                    <span>${a.sections['31-40'].length}</span>
                </div>
                <div class="section-segment s5 ${a.sections['41-45'].length > 0 ? 'active' : ''}">
                    <span>${a.sections['41-45'].length}</span>
                </div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-secondary);margin-top:8px;">
                <span>1-10</span><span>11-20</span><span>21-30</span><span>31-40</span><span>41-45</span>
            </div>
            <div style="margin-top:15px;display:grid;grid-template-columns:repeat(auto-fit, minmax(150px, 1fr));gap:10px;">
                ${Object.entries(a.sections).map(([range, nums]) => `
                    <div style="background:rgba(0,0,0,0.2);padding:10px;border-radius:8px;text-align:center;">
                        <div style="font-size:0.75rem;color:var(--text-secondary);">${range}</div>
                        <div style="color:${nums.length > 0 ? 'var(--accent-cyan)' : 'var(--text-secondary)'};margin-top:5px;">
                            ${nums.length > 0 ? nums.join(', ') : '-'}
                        </div>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top:10px;padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;font-size:0.85rem;">
                💡 <strong>권장:</strong> 4개 이상의 구간에 분포되어 있으면 균형적 (현재 ${a.sectionsWithNumbers}개 구간)
            </div>
        </div>

        <!-- 연속번호 -->
        <div style="margin-top:25px;">
            <h4 style="color:var(--accent-cyan);margin-bottom:15px;">🔗 연속번호 분석</h4>
            <div style="background:rgba(0,0,0,0.2);padding:15px;border-radius:10px;">
                ${a.consecutiveGroups.length > 0 ? `
                    <div style="margin-bottom:10px;">
                        <span style="color:var(--accent-gold);">${a.consecutiveGroups.length}개 그룹</span> 발견
                    </div>
                    <div style="display:flex;gap:10px;flex-wrap:wrap;">
                        ${a.consecutiveGroups.map(g => `
                            <div style="background:rgba(139,92,246,0.2);padding:8px 15px;border-radius:20px;border:1px solid rgba(139,92,246,0.5);">
                                ${g.join(' → ')}
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div style="color:var(--text-secondary);">연속번호 없음</div>
                `}
                <div style="margin-top:15px;font-size:0.85rem;color:var(--text-secondary);">
                    💡 <strong>통계:</strong> 역대 당첨번호의 약 60%가 연속번호 1개 이상 포함
                </div>
            </div>
        </div>

        <!-- 간격 분석 -->
        <div style="margin-top:25px;">
            <h4 style="color:var(--accent-cyan);margin-bottom:15px;">📏 번호 간격 분석</h4>
            <div style="background:rgba(0,0,0,0.2);padding:15px;border-radius:10px;">
                <div style="display:flex;gap:15px;flex-wrap:wrap;margin-bottom:15px;">
                    <div style="text-align:center;">
                        <div style="font-size:0.75rem;color:var(--text-secondary);">최소 간격</div>
                        <div style="font-size:1.3rem;color:${a.minGap === 1 ? 'var(--accent-pink)' : 'var(--accent-cyan)'}">${a.minGap}</div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:0.75rem;color:var(--text-secondary);">최대 간격</div>
                        <div style="font-size:1.3rem;color:var(--accent-cyan)">${a.maxGap}</div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:0.75rem;color:var(--text-secondary);">평균 간격</div>
                        <div style="font-size:1.3rem;color:var(--accent-cyan)">${a.avgGap}</div>
                    </div>
                </div>
                <div style="font-size:0.9rem;color:var(--text-secondary);">
                    간격 순서: <span style="color:var(--text-primary)">${a.gaps.join(' → ')}</span>
                </div>
                <div style="margin-top:10px;font-size:0.85rem;color:var(--text-secondary);">
                    💡 평균 간격 ${a.avgGap}은(는) ${parseFloat(a.avgGap) >= 5 && parseFloat(a.avgGap) <= 9 ? '적정 범위입니다.' : '다소 ' + (parseFloat(a.avgGap) < 5 ? '좁습니다.' : '넓습니다.')}
                </div>
            </div>
        </div>

        <!-- 수학적 특성 -->
        <div style="margin-top:25px;">
            <h4 style="color:var(--accent-cyan);margin-bottom:15px;">🔬 수학적 특성</h4>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:15px;">
                <div style="background:rgba(0,0,0,0.2);padding:15px;border-radius:10px;">
                    <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">소수 (Prime)</div>
                    <div style="color:var(--accent-cyan);">${a.primes.length > 0 ? a.primes.join(', ') : '없음'}</div>
                    <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:5px;">${a.primes.length}개 / 1~45 중 소수: 2,3,5,7,11,13,17,19,23,29,31,37,41,43</div>
                </div>
                <div style="background:rgba(0,0,0,0.2);padding:15px;border-radius:10px;">
                    <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">3의 배수</div>
                    <div style="color:var(--accent-cyan);">${a.mult3.length > 0 ? a.mult3.join(', ') : '없음'}</div>
                    <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:5px;">${a.mult3.length}개</div>
                </div>
                <div style="background:rgba(0,0,0,0.2);padding:15px;border-radius:10px;">
                    <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">5의 배수</div>
                    <div style="color:var(--accent-cyan);">${a.mult5.length > 0 ? a.mult5.join(', ') : '없음'}</div>
                    <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:5px;">${a.mult5.length}개</div>
                </div>
            </div>
        </div>
    `;
}

function renderCompactAnalysis(a, score, matching) {
    const getGradeInfo = (value, optimal, good, normal) => {
        if (value >= optimal[0] && value <= optimal[1]) return { class: 'excellent', text: '최적', color: 'var(--grade-excellent)' };
        if (value >= good[0] && value <= good[1]) return { class: 'good', text: '양호', color: 'var(--grade-good)' };
        if (value >= normal[0] && value <= normal[1]) return { class: 'normal', text: '보통', color: 'var(--grade-normal)' };
        return { class: 'caution', text: '주의', color: 'var(--grade-caution)' };
    };

    const sumGrade = getGradeInfo(a.sum, [115, 150], [100, 175], [80, 200]);
    const acGrade = getGradeInfo(a.ac, [7, 10], [5, 6], [4, 4]);
    const oddEvenDiff = Math.abs(a.oddCount - a.evenCount);
    const oddEvenGrade = getGradeInfo(6 - oddEvenDiff, [4, 6], [2, 3], [1, 1]);
    const lowHighDiff = Math.abs(a.lowCount - a.highCount);
    const lowHighGrade = getGradeInfo(6 - lowHighDiff, [4, 6], [2, 3], [1, 1]);
    const sectionGrade = getGradeInfo(a.sectionsWithNumbers, [4, 5], [3, 3], [2, 2]);

    return `
        <!-- 점수 분해 -->
        <div class="detail-section">
            <div class="detail-title">📊 품질 점수 분석</div>
            <div class="score-breakdown-detail">
                ${Object.entries(score.breakdown).map(([key, item]) => `
                    <div class="score-bar-item">
                        <div class="score-bar-header">
                            <span>${item.label}</span>
                            <span style="color: ${item.score >= item.max * 0.8 ? 'var(--grade-excellent)' : item.score >= item.max * 0.6 ? 'var(--grade-good)' : 'var(--grade-caution)'}">${item.score}/${item.max}</span>
                        </div>
                        <div class="score-bar-bg">
                            <div class="score-bar-fill" style="width: ${(item.score / item.max) * 100}%; background: ${item.score >= item.max * 0.8 ? 'var(--grade-excellent)' : item.score >= item.max * 0.6 ? 'var(--grade-good)' : 'var(--grade-caution)'}"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- 종합 해석 -->
        <div class="detail-section">
            <div class="detail-title">📋 종합 해석</div>
            <div class="detail-interpretation">
                이 번호 조합은 <strong>합계 ${a.sum}</strong> (${sumGrade.text})이며,
                <strong>AC값 ${a.ac}</strong> (${acGrade.text})입니다.
                홀짝 <strong>${a.oddEvenRatio}</strong> (${oddEvenGrade.text}),
                고저 <strong>${a.lowHighRatio}</strong> (${lowHighGrade.text})로
                ${oddEvenDiff <= 2 && lowHighDiff <= 2 ? '매우 균형잡힌' : oddEvenDiff <= 4 && lowHighDiff <= 4 ? '적절히 분산된' : '다소 편중된'} 구성입니다.
                ${a.consecutiveGroups.length > 0 ? `연속번호 ${a.consecutiveGroups.length}그룹 포함.` : ''}
            </div>
        </div>

        <!-- 상세 지표 -->
        <div class="detail-section">
            <div class="detail-title">🔍 상세 지표</div>
            <div class="detail-metrics-grid">
                <div class="detail-metric">
                    <div class="metric-header">
                        <span class="metric-label">합계</span>
                        <span class="metric-grade" style="background: ${sumGrade.color}20; color: ${sumGrade.color}">${sumGrade.text}</span>
                    </div>
                    <div class="metric-value">${a.sum}</div>
                    <div class="metric-range">권장: 115~150</div>
                    <div class="metric-detail">${a.sum >= 115 && a.sum <= 150 ? '✓ 최적 범위' : a.sum >= 100 && a.sum <= 175 ? '○ 적정 범위' : '⚠️ 범위 벗어남'}</div>
                </div>

                <div class="detail-metric">
                    <div class="metric-header">
                        <span class="metric-label">AC값</span>
                        <span class="metric-grade" style="background: ${acGrade.color}20; color: ${acGrade.color}">${acGrade.text}</span>
                    </div>
                    <div class="metric-value">${a.ac}</div>
                    <div class="metric-range">권장: 7~10</div>
                    <div class="metric-detail">${a.ac >= 7 ? '✓ 다양한 구성' : a.ac >= 5 ? '○ 보통 구성' : '⚠️ 단조로운 구성'}</div>
                </div>

                <div class="detail-metric">
                    <div class="metric-header">
                        <span class="metric-label">번호 범위</span>
                    </div>
                    <div class="metric-value">${a.range}</div>
                    <div class="metric-range">${a.numbers[0]} ~ ${a.numbers[5]}</div>
                    <div class="metric-detail">${a.range >= 30 ? '✓ 넓은 분포' : a.range >= 20 ? '○ 적당한 분포' : '⚠️ 좁은 분포'}</div>
                </div>

                <div class="detail-metric">
                    <div class="metric-header">
                        <span class="metric-label">끝자리 종류</span>
                    </div>
                    <div class="metric-value">${a.uniqueLastDigits}개</div>
                    <div class="metric-range">최대: 6개</div>
                    <div class="metric-detail">${a.uniqueLastDigits >= 5 ? '✓ 매우 다양' : a.uniqueLastDigits >= 4 ? '○ 적당함' : '⚠️ 중복 많음'}</div>
                </div>
            </div>
        </div>

        <!-- 홀짝/고저 분석 -->
        <div class="detail-section">
            <div class="detail-title">🎲 홀짝 & 고저 분석</div>
            <div class="dual-analysis">
                <div class="dual-box">
                    <div class="dual-header">
                        <span>홀짝 비율</span>
                        <span class="metric-grade" style="background: ${oddEvenGrade.color}20; color: ${oddEvenGrade.color}">${oddEvenGrade.text}</span>
                    </div>
                    <div class="dual-ratio">${a.oddEvenRatio}</div>
                    <div class="dual-detail">
                        <div>홀수: <span style="color:var(--accent-pink)">${a.odd.join(', ') || '없음'}</span></div>
                        <div>짝수: <span style="color:var(--accent-cyan)">${a.even.join(', ') || '없음'}</span></div>
                    </div>
                </div>
                <div class="dual-box">
                    <div class="dual-header">
                        <span>고저 비율</span>
                        <span class="metric-grade" style="background: ${lowHighGrade.color}20; color: ${lowHighGrade.color}">${lowHighGrade.text}</span>
                    </div>
                    <div class="dual-ratio">${a.lowHighRatio}</div>
                    <div class="dual-detail">
                        <div>저(1-22): <span style="color:#60a5fa">${a.low.join(', ') || '없음'}</span></div>
                        <div>고(23-45): <span style="color:#f87171">${a.high.join(', ') || '없음'}</span></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 구간 분포 -->
        <div class="detail-section">
            <div class="detail-title">📍 구간별 분포
                <span class="metric-grade" style="background: ${sectionGrade.color}20; color: ${sectionGrade.color}">${a.sectionsWithNumbers}개 구간 (${sectionGrade.text})</span>
            </div>
            <div class="section-visual">
                <div class="section-bar-detail">
                    <div class="section-seg s1 ${a.sections['1-10'].length > 0 ? 'active' : ''}">
                        <span class="seg-count">${a.sections['1-10'].length}</span>
                        <span class="seg-label">1-10</span>
                    </div>
                    <div class="section-seg s2 ${a.sections['11-20'].length > 0 ? 'active' : ''}">
                        <span class="seg-count">${a.sections['11-20'].length}</span>
                        <span class="seg-label">11-20</span>
                    </div>
                    <div class="section-seg s3 ${a.sections['21-30'].length > 0 ? 'active' : ''}">
                        <span class="seg-count">${a.sections['21-30'].length}</span>
                        <span class="seg-label">21-30</span>
                    </div>
                    <div class="section-seg s4 ${a.sections['31-40'].length > 0 ? 'active' : ''}">
                        <span class="seg-count">${a.sections['31-40'].length}</span>
                        <span class="seg-label">31-40</span>
                    </div>
                    <div class="section-seg s5 ${a.sections['41-45'].length > 0 ? 'active' : ''}">
                        <span class="seg-count">${a.sections['41-45'].length}</span>
                        <span class="seg-label">41-45</span>
                    </div>
                </div>
                <div class="section-numbers">
                    ${Object.entries(a.sections).map(([range, nums]) =>
                        nums.length > 0 ? `<span class="section-num-item">${range}: ${nums.join(', ')}</span>` : ''
                    ).filter(x => x).join('')}
                </div>
            </div>
        </div>

        <!-- 연속번호 & 간격 -->
        <div class="detail-section">
            <div class="detail-title">🔗 연속번호 & 간격</div>
            <div class="dual-analysis">
                <div class="dual-box">
                    <div class="dual-header">연속번호</div>
                    ${a.consecutiveGroups.length > 0 ? `
                        <div class="consecutive-groups">
                            ${a.consecutiveGroups.map(g => `<span class="consec-group">${g.join('→')}</span>`).join('')}
                        </div>
                    ` : '<div style="color:var(--text-secondary);font-size:0.85rem;">없음</div>'}
                </div>
                <div class="dual-box">
                    <div class="dual-header">번호 간격</div>
                    <div class="gap-stats">
                        <span>최소: <strong>${a.minGap}</strong></span>
                        <span>최대: <strong>${a.maxGap}</strong></span>
                        <span>평균: <strong>${a.avgGap}</strong></span>
                    </div>
                    <div class="gap-sequence">간격: ${a.gaps.join(' → ')}</div>
                </div>
            </div>
        </div>

        <!-- 수학적 특성 -->
        <div class="detail-section">
            <div class="detail-title">🔬 수학적 특성</div>
            <div class="math-props">
                <div class="math-item">
                    <span class="math-label">소수</span>
                    <span class="math-value">${a.primes.length > 0 ? a.primes.join(', ') : '없음'} (${a.primes.length}개)</span>
                </div>
                <div class="math-item">
                    <span class="math-label">3의 배수</span>
                    <span class="math-value">${a.mult3.length > 0 ? a.mult3.join(', ') : '없음'} (${a.mult3.length}개)</span>
                </div>
                <div class="math-item">
                    <span class="math-label">5의 배수</span>
                    <span class="math-value">${a.mult5.length > 0 ? a.mult5.join(', ') : '없음'} (${a.mult5.length}개)</span>
                </div>
            </div>
        </div>

        <!-- 당첨 가능성 -->
        ${matching.length >= 3 ? `
        <div class="detail-section prize-section">
            <div class="detail-title">🏆 당첨 등급 분석</div>
            <div class="prize-analysis">
                <div class="prize-current">
                    <span>현재 일치</span>
                    <span class="prize-match-count">${matching.length}개</span>
                </div>
                <div class="prize-breakdown">
                    ${matching.length >= 6 ? '<div class="prize-tier tier-1">🏆 1등 당첨!</div>' : ''}
                    ${matching.length === 5 && currentBonusNumber && a.numbers.includes(currentBonusNumber) ? '<div class="prize-tier tier-1">🥈 2등 당첨!</div>' : ''}
                    ${matching.length === 5 && !(currentBonusNumber && a.numbers.includes(currentBonusNumber)) ? '<div class="prize-tier tier-3">🥉 3등 (보너스 불일치)</div>' : ''}
                    ${matching.length === 4 ? '<div class="prize-tier tier-4">4등 당첨!</div>' : ''}
                    ${matching.length === 3 ? '<div class="prize-tier tier-5">5등 당첨!</div>' : ''}
                </div>
                <div class="matching-balls-detail">
                    <span>일치 번호:</span>
                    ${matching.map(n => `<span class="ball ${getBallClass(n)}" style="width:32px;height:32px;line-height:32px;font-size:0.8rem;">${n}</span>`).join('')}
                </div>
            </div>
        </div>
        ` : ''}
    `;
}

function generateRandomNumbers() { const pool = Array.from({length: 45}, (_, i) => i + 1); for (let i = pool.length - 1; i > 0; i--) { const randomArray = new Uint32Array(1); crypto.getRandomValues(randomArray); const j = randomArray[0] % (i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; } return pool.slice(0, 6).sort((a, b) => a - b); }

function weightedRandomPick(pool, weights) {
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const rand = new Uint32Array(1);
    crypto.getRandomValues(rand);
    let r = rand[0] / 4294967296 * totalWeight;
    for (let i = 0; i < pool.length; i++) {
        r -= weights[i];
        if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
}

function scoreCombination(nums, stats) {
    let score = 0;
    const analysis = analyzeNumbers(nums);

    // 핫 번호 점수 (40%)
    const hotSet = new Set(stats.hot.map(h => h.number));
    const hotCount = nums.filter(n => hotSet.has(n)).length;
    score += (hotCount / 6) * 40;

    // 콜드 번호 점수 (25%)
    const dormantSet = new Set(stats.topDormant.map(d => d.number));
    const dormantCount = nums.filter(n => dormantSet.has(n)).length;
    score += (dormantCount / 6) * 25;

    // 균형 점수 (25%)
    const oddEvenDiff = Math.abs(analysis.oddCount - analysis.evenCount);
    score += (1 - oddEvenDiff / 6) * 15;
    const sectionScore = Math.min(analysis.sectionsWithNumbers / 5, 1) * 10;
    score += sectionScore;

    // AC값 점수 (10%)
    score += Math.min(analysis.ac / 10, 1) * 10;

    return score;
}

function generateSmartRecommendation(count = 10) {
    if (!dbStats) return [];
    const results = [];
    const seen = new Set();

    const pool = Array.from({ length: 45 }, (_, i) => i + 1);
    const weights = pool.map(n => {
        const hotItem = dbStats.hot.find(h => h.number === n);
        const dormantItem = dbStats.topDormant.find(d => d.number === n);
        let w = 1;
        if (hotItem) w += hotItem.count * 3;
        if (dormantItem && dormantItem.gap > 10) w += dormantItem.gap * 2;
        return w;
    });

    let attempts = 0;
    while (results.length < count && attempts < count * 100) {
        attempts++;
        const selected = [];
        const available = [...pool];
        const availableWeights = [...weights];

        for (let i = 0; i < 6; i++) {
            const idx = weightedRandomPick(
                available.map((_, j) => j),
                availableWeights
            );
            selected.push(available[idx]);
            available.splice(idx, 1);
            availableWeights.splice(idx, 1);
        }
        selected.sort((a, b) => a - b);
        const key = selected.join(',');
        if (seen.has(key)) continue;
        seen.add(key);

        const score = scoreCombination(selected, dbStats);
        results.push({ numbers: selected, score });
    }
    results.sort((a, b) => b.score - a.score);
    return results;
}
