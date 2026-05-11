let currentWinningNumbers = null, currentBonusNumber = null, currentRound = null, selectedManualNumbers = [], simulationWorker = null, predictions = [], isSimulating = false, isFetching = false;
const LOCAL_PROXY = 'http://localhost:3456';
const LOTTO_TOTAL_COMBINATIONS = 8145060;

// 구형 브라우저 AbortSignal.timeout 폴백
if (!AbortSignal.timeout) {
    AbortSignal.timeout = function(ms) {
        const controller = new AbortController();
        setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), ms);
        return controller.signal;
    };
}

document.addEventListener('DOMContentLoaded', () => {
    const latestRound = calculateLatestRound();
    document.getElementById('roundInput').value = latestRound;
    document.getElementById('roundInput').max = latestRound;
    createNumberGrid();
    setupPredictionToggleEvents();
    loadTheme();
    loadSavedPredictions();
    // GitHub Pages: latest.json에서 최신 당첨번호 자동 로드
    loadLatestJson();
});

let lottoDb = null; // 전체 당첨번호 DB (latest.json)

async function loadLatestJson() {
    try {
        const resp = await fetch('latest.json', { cache: 'no-cache' });
        if (resp.ok) {
            const data = await resp.json();
            // 배열 형식 (전체 회차 DB)
            if (Array.isArray(data) && data.length > 0) {
                lottoDb = data;
                cachedNumberScores = null; // DB 변경 시 캐시 초기화
                const latest = data[data.length - 1];
                document.getElementById('roundInput').value = latest.round;
                document.getElementById('roundInput').max = latest.round;
                setWinningNumbers(latest.numbers, latest.bonus, latest.round, '내장 DB (최신)');
                showStatus('success', `✅ ${data.length}개 회차 DB 로드 완료! 제 ${latest.round}회 자동 적용`);
                return;
            }
            // 단일 객체 형식 (레거시)
            if (data.numbers && data.numbers.length === 6) {
                document.getElementById('roundInput').value = data.round;
                setWinningNumbers(data.numbers, data.bonus, data.round, `자동 로드 (${data.updated || '최신'})`);
                showStatus('success', `✅ 제 ${data.round}회 당첨번호 자동 로드 완료!`);
            }
        }
    } catch (e) {
        document.getElementById('statsNotReady').textContent = '⚠️ latest.json을 불러올 수 없습니다. 인터넷 연결을 확인해주세요.';
    }
}

function findRoundInDb(roundNo) {
    if (!lottoDb) return null;
    return lottoDb.find(r => r.round === roundNo);
}

// ========== 테마 전환 ==========
function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    document.body.setAttribute('data-theme', next);
    try { localStorage.setItem('lotto-theme', next); } catch (e) {}

    // 버튼 아이콘 즉시 변경 (시각적 피드백)
    const btn = document.querySelector('.theme-toggle');
    if (btn) btn.textContent = next === 'light' ? '☀️' : '🌓';
}

function loadTheme() {
    let saved;
    try { saved = localStorage.getItem('lotto-theme'); } catch (e) { saved = null; }
    if (!saved) {
        saved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', saved);
    document.body.setAttribute('data-theme', saved);
    const btn = document.querySelector('.theme-toggle');
    if (btn) btn.textContent = saved === 'light' ? '☀️' : '🌓';
}

// ========== 예측 결과 저장/불러오기 ==========
function savePrediction() {
    const predictionBalls = document.getElementById('predictionBalls');
    if (!predictionBalls || predictionBalls.children.length === 0) return;

    const numbers = [...predictionBalls.querySelectorAll('.ball')].map(b => parseInt(b.textContent));
    const meta = document.getElementById('predictionMeta')?.textContent || '';
    const score = document.getElementById('predictionScore')?.textContent || '-';
    const grade = document.getElementById('predictionScoreGrade')?.textContent || '';

    const saved = getSavedPredictions();
    saved.unshift({
        date: new Date().toLocaleString('ko-KR'),
        round: currentRound || '-',
        numbers,
        meta,
        score,
        grade
    });
    // 최대 50개 저장
    if (saved.length > 50) saved.length = 50;

    localStorage.setItem('lotto-predictions', JSON.stringify(saved));
    loadSavedPredictions();
    showStatus('success', '💾 예측 결과가 저장되었습니다!');
}

function getSavedPredictions() {
    try {
        return JSON.parse(localStorage.getItem('lotto-predictions') || '[]');
    } catch (e) { return []; }
}

function loadSavedPredictions() {
    const saved = getSavedPredictions();
    const container = document.getElementById('savedPredictionsList');
    const clearBtn = document.getElementById('clearSavedBtn');

    if (saved.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;">저장된 결과가 없습니다.</p>';
        clearBtn.style.display = 'none';
        return;
    }

    clearBtn.style.display = 'block';
    container.innerHTML = saved.map((item, index) => {
        const ballsHtml = item.numbers.map(n => `<span class="ball ${getBallClass(n)}" style="width:40px;height:40px;line-height:40px;font-size:0.85rem;">${n}</span>`).join('');
        return `
            <div class="saved-item" style="background:rgba(0,0,0,0.2);border-radius:12px;padding:15px;margin-bottom:10px;border-left:4px solid var(--accent-purple);">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:10px;">
                    <div>
                        <span style="font-weight:700;color:var(--accent-gold);">제 ${item.round}회</span>
                        <span style="color:var(--text-secondary);font-size:0.8rem;margin-left:10px;">${item.date}</span>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <span style="color:var(--accent-cyan);font-size:0.9rem;">${item.score}점 (${item.grade})</span>
                        <button class="btn btn-secondary" style="padding:6px 10px;font-size:0.75rem;" onclick="shareSmartPrediction([${item.numbers}], ${item.score})">📤</button>
                        <button class="btn btn-secondary" style="padding:6px 12px;font-size:0.8rem;" onclick="loadSavedPrediction(${index})">📋</button>
                        <button class="btn btn-secondary" style="padding:6px 12px;font-size:0.8rem;" onclick="deleteSavedPrediction(${index})">✕</button>
                    </div>
                </div>
                <div class="balls-container" style="justify-content:flex-start;gap:6px;padding:10px 0;">${ballsHtml}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary);">${item.meta}</div>
            </div>
        `;
    }).join('');
}

function loadSavedPrediction(index) {
    const saved = getSavedPredictions();
    if (index < 0 || index >= saved.length) return;
    const item = saved[index];

    // 먼저 당첨번호 설정이 필요
    if (!currentWinningNumbers) {
        showStatus('warning', '⚠️ 먼저 당첨번호를 조회해주세요.');
        return;
    }

    renderBalls(item.numbers, 'predictionBalls');
    document.getElementById('predictionMeta').textContent = `저장된 결과 | 제 ${item.round}회 | ${item.date}`;

    const analysis = analyzeNumbers(item.numbers);
    const score = calculateQualityScore(analysis);
    const filterResult = checkFilters(item.numbers);
    const percentileRank = calculatePercentileRank(item.numbers);
    const gradeResult = determineGrade(filterResult, percentileRank);
    displayScoreCard('prediction', score, analysis, filterResult, gradeResult);
    document.getElementById('predictionAnalysisContent').innerHTML = renderDetailedAnalysis(analysis);

    const matching = item.numbers.filter(n => currentWinningNumbers.includes(n));
    if (matching.length > 0) {
        document.getElementById('matchCount').textContent = matching.length;
        renderBalls(matching, 'matchingBalls');
        document.getElementById('matchingSection').classList.remove('hidden');
    } else {
        document.getElementById('matchingSection').classList.add('hidden');
    }
    document.getElementById('predictionResult').classList.remove('hidden');
    showStatus('success', '✅ 저장된 결과를 불러왔습니다.');
}

function deleteSavedPrediction(index) {
    const saved = getSavedPredictions();
    saved.splice(index, 1);
    localStorage.setItem('lotto-predictions', JSON.stringify(saved));
    loadSavedPredictions();
    showStatus('success', '🗑️ 삭제되었습니다.');
}

function clearSavedPredictions() {
    if (confirm('모든 저장된 예측 결과를 삭제하시겠습니까?')) {
        localStorage.removeItem('lotto-predictions');
        loadSavedPredictions();
        showStatus('success', '🗑️ 모두 삭제되었습니다.');
    }
}

function saveSmartPrediction(numbers, score, meta) {
    const saved = getSavedPredictions();
    saved.unshift({
        date: new Date().toLocaleString('ko-KR'),
        round: currentRound || '-',
        numbers,
        meta: `스마트 추천 | ${meta}`,
        score,
        grade: score >= 70 ? '최상' : score >= 50 ? '양호' : '보통'
    });
    if (saved.length > 50) saved.length = 50;
    localStorage.setItem('lotto-predictions', JSON.stringify(saved));
    loadSavedPredictions();
    showStatus('success', '💾 스마트 추천 결과가 저장되었습니다!');
    playBeep(600, 0.08);
}

// ========== 내보내기 ==========
async function exportPrediction() {
    const predictionBalls = document.getElementById('predictionBalls');
    if (!predictionBalls || predictionBalls.children.length === 0) return;

    const numbers = [...predictionBalls.querySelectorAll('.ball')].map(b => b.textContent).join(', ');
    const meta = document.getElementById('predictionMeta')?.textContent || '';
    const score = document.getElementById('predictionScore')?.textContent || '-';
    const grade = document.getElementById('predictionScoreGrade')?.textContent || '';

    const text = `🎱 로또 645 AI 예측 번호\n━━━━━━━━━━━━━━\n📌 예측 번호: ${numbers}\n📊 품질 점수: ${score}점 (${grade})\n📝 기준: ${meta}\n━━━━━━━━━━━━━━\n🔗 https://lotto645.app`;

    await copyToClipboard(text);
    showStatus('success', '📋 클립보드에 복사되었습니다!');
}

function setupPredictionToggleEvents() {
    // 클릭 이벤트 위임
    document.body.addEventListener('click', handleToggleClick, false);
    
    // 터치 이벤트 위임 (모바일용)
    document.body.addEventListener('touchstart', handleTouchStart, {passive: true});
    document.body.addEventListener('touchend', handleTouchEnd, false);
}

let touchStartTarget = null;

function handleTouchStart(e) {
    const toggleBtn = e.target.closest(".pred-toggle-btn");
    if (toggleBtn) touchStartTarget = e.target;
}

function handleTouchEnd(e) {
    if (!touchStartTarget) return;
    const toggleBtn = e.target.closest(".pred-toggle-btn");
    if (toggleBtn) {
        e.preventDefault();
        const index = toggleBtn.getAttribute("data-index");
        if (index != null) {
            togglePredictionDetail(parseInt(index));
        }
    }
    touchStartTarget = null;
}

function handleToggleClick(e) {
    // 토글 버튼 클릭 처리만
    const toggleBtn = e.target.closest('.pred-toggle-btn');
    if (toggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        const index = toggleBtn.getAttribute('data-index');
        if (index !== null && index !== undefined) {
            togglePredictionDetail(parseInt(index));
        }
        return;
    }
}

function calculateLatestRound() {
    // 최초 추첨: 2002년 12월 7일 토요일 20:00 KST
    const firstDraw = new Date(2002, 11, 7, 21, 0, 0);
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=일, 6=토
    const hours = now.getHours();

    // 토요일 21시 이후면 오늘 추첨 완료, 아니면 지난 토요일 기준
    let lastDraw;
    if (dayOfWeek === 6 && hours >= 21) {
        lastDraw = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 0, 0);
    } else {
        const daysSinceSat = dayOfWeek === 6 ? 7 : dayOfWeek + 1;
        lastDraw = new Date(now);
        lastDraw.setDate(now.getDate() - daysSinceSat);
        lastDraw.setHours(21, 0, 0, 0);
    }
    return Math.floor((lastDraw - firstDraw) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

function getBallClass(num) {
    if (num <= 10) return 'yellow';
    if (num <= 20) return 'blue';
    if (num <= 30) return 'red';
    if (num <= 40) return 'gray';
    return 'green';
}

function renderBalls(numbers, containerId, bonus = null) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    [...numbers].sort((a, b) => a - b).forEach((num, i) => {
        const ball = document.createElement('span');
        ball.className = `ball ${getBallClass(num)}`;
        ball.textContent = num;
        ball.style.animationDelay = `${i * 0.1}s`;
        container.appendChild(ball);
    });
    if (bonus !== null) {
        const plus = document.createElement('span');
        plus.className = 'plus-sign';
        plus.textContent = '+';
        container.appendChild(plus);
        const bonusBall = document.createElement('span');
        bonusBall.className = 'ball bonus';
        bonusBall.textContent = bonus;
        bonusBall.style.animationDelay = '0.7s';
        container.appendChild(bonusBall);
    }
}

async function fetchFromLocalProxy(roundNo) {
    try {
        const resp = await fetch(`${LOCAL_PROXY}/api/lotto?round=${roundNo}`, { signal: AbortSignal.timeout(8000) });
        if (resp.ok) {
            const data = await resp.json();
            if (data.numbers) return data;
        }
    } catch (e) {}
    return null;
}

async function fetchWinningNumbers() {
    if (isFetching) return;
    const roundNo = parseInt(document.getElementById('roundInput').value);
    if (!roundNo || roundNo < 1) { showStatus('error', '올바른 회차를 입력해주세요.'); return; }

    isFetching = true;
    const btn = document.querySelector('.btn-primary');
    btn.disabled = true;
    btn.textContent = '⏳ 조회 중...';
    // 1. 내장 DB에서 먼저 확인
    const dbResult = findRoundInDb(roundNo);
    if (dbResult) {
        setWinningNumbers(dbResult.numbers, dbResult.bonus, roundNo, '내장 DB');
        showStatus('success', `✅ 제 ${roundNo}회 당첨번호 (내장 DB)`);
        finishFetch(btn);
        return;
    }

    // 2. 로컬 프록시 서버 시도 (node server.js 실행 시에만 동작)
    showStatus('info', '🔍 당첨번호 조회 중...');
    const localResult = await fetchFromLocalProxy(roundNo);
    if (localResult) {
        setWinningNumbers(localResult.numbers, localResult.bonus, roundNo, '네이버 검색');
        showStatus('success', '✅ 조회 성공!');
        finishFetch(btn);
        return;
    }

    // 3. 조회 실패 → 수동 입력으로 안내
    showStatus('warning', '⚠️ DB에 없는 회차입니다. 아래에서 직접 번호를 선택해주세요.');
    document.getElementById('manualInputSection').classList.add('open');
    finishFetch(btn);
}

function finishFetch(btn) {
    isFetching = false;
    btn.disabled = false;
    btn.textContent = '🔍 조회';
}

function setWinningNumbers(numbers, bonus, round, source) {
    currentWinningNumbers = numbers;
    currentBonusNumber = bonus;
    currentRound = round;
    document.getElementById('winningRound').textContent = round;
    document.getElementById('winningSource').textContent = source + (bonus ? ` (보너스: ${bonus})` : '');
    renderBalls(numbers, 'winningBalls', bonus);

    const analysis = analyzeNumbers(numbers);
    const score = calculateQualityScore(analysis);
    const filterResult = checkFilters(numbers);
    const percentileRank = calculatePercentileRank(numbers);
    const gradeResult = determineGrade(filterResult, percentileRank);
    displayScoreCard('winning', score, analysis, filterResult, gradeResult);
    document.getElementById('winningAnalysisContent').innerHTML = renderDetailedAnalysis(analysis);

    document.getElementById('currentWinning').classList.remove('hidden');
    document.getElementById('aiNotReady').classList.add('hidden');
    document.getElementById('aiReady').classList.remove('hidden');
    document.getElementById('targetRound').textContent = round;
}

function createNumberGrid() {
    const grid = document.getElementById('numberGrid');
    grid.innerHTML = '';
    for (let i = 1; i <= 45; i++) {
        const btn = document.createElement('button');
        btn.className = `number-btn ${getBallClass(i)}`;
        btn.textContent = i;
        btn.onclick = () => toggleNumber(i, btn);
        grid.appendChild(btn);
    }
}

function toggleNumber(num, btn) {
    const idx = selectedManualNumbers.indexOf(num);
    if (idx > -1) { selectedManualNumbers.splice(idx, 1); btn.classList.remove('selected'); }
    else if (selectedManualNumbers.length < 6) { selectedManualNumbers.push(num); btn.classList.add('selected'); }
    updateSelectedDisplay();
}

function updateSelectedDisplay() {
    document.getElementById('selectedCount').textContent = `선택: ${selectedManualNumbers.length}개 / 6개`;
    if (selectedManualNumbers.length > 0) renderBalls(selectedManualNumbers, 'selectedBalls');
    else document.getElementById('selectedBalls').innerHTML = '';
    document.getElementById('applyBtn').disabled = selectedManualNumbers.length !== 6;
}

function applyManualNumbers() {
    if (selectedManualNumbers.length !== 6) return;
    const round = document.getElementById('roundInput').value || '수동입력';
    setWinningNumbers([...selectedManualNumbers].sort((a, b) => a - b), null, round, '수동입력');
    showStatus('success', '✅ 수동 입력 적용 완료!');
    document.getElementById('manualInputSection').classList.remove('open');
}

const isPrime = n => { if (n < 2) return false; for (let i = 2; i <= Math.sqrt(n); i++) if (n % i === 0) return false; return true; };

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

// ========== 백분위 순위 계산 ==========
function calculatePercentileRank(nums) {
    if (!lottoDb || lottoDb.length === 0) return 0;
    const numSet = new Set(nums);
    const ownScore = crossMatchScore(nums);

    let lowerCount = 0;
    lottoDb.forEach(entry => {
        if (!entry.numbers) return;
        const entryScore = crossMatchScore(entry.numbers);
        if (entryScore < ownScore) lowerCount++;
    });

    return Math.round((1 - lowerCount / lottoDb.length) * 1000) / 10;
}

function crossMatchScore(nums) {
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
        else total += 0;
    });
    return total;
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
        else if (recent20Count <= 1) recScore = 3;
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

    function recent5Count(n) {
        return lottoDb.slice(-5).filter(e => e.numbers && e.numbers.includes(n)).length;
    }
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
                        <span class="help-icon">?
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
                        <span class="help-icon">?
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
                        <span class="help-icon">?
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
                        <span class="help-icon">?
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
                    <div style="font-family:'Orbitron';font-size:1.5rem;color:var(--accent-gold);">${a.oddEvenRatio}</div>
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
                    <div style="font-family:'Orbitron';font-size:1.5rem;color:var(--accent-gold);">${a.lowHighRatio}</div>
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
                        <div style="font-family:'Orbitron';font-size:1.3rem;color:${a.minGap === 1 ? 'var(--accent-pink)' : 'var(--accent-cyan)'}">${a.minGap}</div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:0.75rem;color:var(--text-secondary);">최대 간격</div>
                        <div style="font-family:'Orbitron';font-size:1.3rem;color:var(--accent-cyan)">${a.maxGap}</div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:0.75rem;color:var(--text-secondary);">평균 간격</div>
                        <div style="font-family:'Orbitron';font-size:1.3rem;color:var(--accent-cyan)">${a.avgGap}</div>
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

function startSimulation() {
    if (!currentWinningNumbers) { alert('먼저 당첨번호를 설정해주세요!'); return; }
    const maxIterations = parseInt(document.getElementById('iterationSelect').value);
    document.getElementById('startSimBtn').classList.add('hidden');
    document.getElementById('stopSimBtn').classList.remove('hidden');
    document.getElementById('simProgress').classList.remove('hidden');
    document.getElementById('predictionResult').classList.add('hidden');
    predictions = []; isSimulating = true;
    window.addEventListener('beforeunload', preventRefresh);
    window.addEventListener('pagehide', cleanupSimulation);
    
    // 예상 발견 횟수 계산
    const expectedMatches = (maxIterations / LOTTO_TOTAL_COMBINATIONS).toFixed(1);
    document.getElementById('expectedMatches').textContent = `약 ${expectedMatches}회`;
    document.getElementById('simNote').textContent = `${formatNumber(maxIterations)}회 시뮬레이션 중 약 ${expectedMatches}회 패턴 발견 예상`;
    
    simulationWorker = new Worker('worker.js');
    simulationWorker.onmessage = function(e) { const { type, data } = e.data; if (type === 'progress') updateProgress(data); else if (type === 'match') handleMatch(data); else if (type === 'complete') handleComplete(data); };
    simulationWorker.postMessage({ targetNums: currentWinningNumbers, maxIterations });
}

function stopSimulation() {
    if (simulationWorker) { simulationWorker.terminate(); simulationWorker = null; }
    isSimulating = false;
    window.removeEventListener('beforeunload', preventRefresh);
    window.removeEventListener('pagehide', cleanupSimulation);
    document.getElementById('startSimBtn').classList.remove('hidden');
    document.getElementById('stopSimBtn').classList.add('hidden');
    showStatus('warning', '⏹️ 시뮬레이션이 중지되었습니다.');
}

function cleanupSimulation() {
    if (simulationWorker) { simulationWorker.terminate(); simulationWorker = null; }
    isSimulating = false;
}

function updateProgress(data) {
    const { attempts, progress, speed, elapsed, matchCount } = data;
    document.getElementById('progressBar').style.width = `${progress * 100}%`;
    document.getElementById('progressText').textContent = `${(progress * 100).toFixed(1)}% 완료 (${formatNumber(attempts)}회)`;
    document.getElementById('statAttempts').textContent = formatNumber(attempts);
    document.getElementById('statSpeed').textContent = formatNumber(speed);
    document.getElementById('statMatches').textContent = matchCount;
    document.getElementById('statTime').textContent = `${elapsed.toFixed(1)}s`;
    
    // 실시간 통계 업데이트
    const currentRate = attempts > 0 ? (matchCount / attempts * LOTTO_TOTAL_COMBINATIONS).toFixed(2) : '0';
    document.getElementById('currentMatchRate').textContent = matchCount > 0 ? `${formatNumber(Math.round(attempts / matchCount))}회당 1회` : '아직 미발견';
    document.getElementById('theoreticalComparison').textContent = matchCount > 0 ? 
        (parseFloat(currentRate) > 0.8 && parseFloat(currentRate) < 1.2 ? '정상 범위' : parseFloat(currentRate) >= 1.2 ? '행운!' : '조금 낮음') : '-';
}

function handleMatch(data) {
    const { matchCount, attempts, elapsed, prediction } = data;
    predictions.push({ matchNum: matchCount, attempt: attempts, time: elapsed, prediction });
    if (matchCount === 1) showPredictionResult(prediction, attempts, elapsed);
    updatePredictionList();
}

function handleComplete(data) {
    isSimulating = false;
    window.removeEventListener('beforeunload', preventRefresh);
    window.removeEventListener('pagehide', cleanupSimulation);
    document.getElementById('startSimBtn').classList.remove('hidden');
    document.getElementById('stopSimBtn').classList.add('hidden');
    document.getElementById('progressBar').style.width = '100%';
    const { attempts, matchCount, elapsed } = data;
    if (matchCount > 0) showStatus('success', `🎉 완료! ${formatNumber(attempts)}회 분석, ${matchCount}회 패턴 발견 (${elapsed.toFixed(1)}초)`);
    else { showStatus('info', `✅ 완료! ${formatNumber(attempts)}회 분석, 패턴 미발견 (${elapsed.toFixed(1)}초)`); showPredictionResult(generateRandomNumbers(), attempts, elapsed, true); }
    if (simulationWorker) { simulationWorker.terminate(); simulationWorker = null; }
}

function showPredictionResult(prediction, attempts, elapsed, isRandom = false) {
    renderBalls(prediction, 'predictionBalls');
    document.getElementById('predictionMeta').textContent = isRandom ? `랜덤 생성 | ${formatNumber(attempts)}회 분석 (패턴 미발견)` : `제 ${currentRound}회 기준 | ${formatNumber(attempts)}회에서 발견 (${elapsed.toFixed(1)}초)`;

    const analysis = analyzeNumbers(prediction);
    const score = calculateQualityScore(analysis);
    const filterResult = checkFilters(prediction);
    const percentileRank = calculatePercentileRank(prediction);
    const gradeResult = determineGrade(filterResult, percentileRank);
    displayScoreCard('prediction', score, analysis, filterResult, gradeResult);

    // 교차 매칭, TOP3, 최근5회
    const crossResult = crossMatchAllHistory(prediction);
    const top3 = findTop3SimilarRounds(prediction);
    const recent5 = runRecentMatchSimulation(prediction);
    updateAdvancedAnalysis('prediction', crossResult, top3, recent5, percentileRank);

    document.getElementById('predictionAnalysisContent').innerHTML = renderDetailedAnalysis(analysis);

    const matching = prediction.filter(n => currentWinningNumbers.includes(n));
    const bonusMatch = currentBonusNumber && prediction.includes(currentBonusNumber);
    if (matching.length > 0) {
        document.getElementById('matchCount').textContent = matching.length;
        renderBalls(matching, 'matchingBalls');

        let gradeInfo = '';
        if (matching.length >= 6) gradeInfo = '🏆 1등 조건 충족! (모든 번호 일치)';
        else if (matching.length === 5 && bonusMatch) gradeInfo = '🥈 2등 조건 충족! (5개 + 보너스 일치)';
        else if (matching.length === 5) gradeInfo = '🥉 3등 조건 충족! (5개 일치, 보너스 불일치)';
        else if (matching.length === 4) gradeInfo = '4등 조건 충족!';
        else if (matching.length === 3) gradeInfo = '5등 조건 충족!';
        else gradeInfo = `${matching.length}개 일치 (당첨 조건 미달)`;
        document.getElementById('matchGradeInfo').textContent = gradeInfo;

        document.getElementById('matchingSection').classList.remove('hidden');
    }
    else document.getElementById('matchingSection').classList.add('hidden');
    document.getElementById('predictionResult').classList.remove('hidden');
}

function updateAdvancedAnalysis(prefix, crossResult, top3, recent5, percentileRank) {
    const container = document.getElementById(`${prefix}AdvancedAnalysis`);
    if (!container) return;
    container.innerHTML = `
        ${crossResult ? renderCrossMatchSummary(crossResult) : ''}
        ${top3 && top3.length > 0 ? renderTop3Similar(top3) : ''}
        ${recent5 && recent5.length > 0 ? renderRecent5Match(recent5) : ''}
        <div class="percentile-info">📊 백분위 순위: <strong>상위 ${percentileRank}%</strong> (전체 ${lottoDb ? lottoDb.length : 0}회차 기준)</div>
    `;
    container.classList.remove('hidden');
}

function updatePredictionList() {
    document.getElementById('predictionCount').textContent = predictions.length;
    const list = document.getElementById('predictionList');
    list.innerHTML = '';
    predictions.forEach((pred, index) => {
        const item = document.createElement('div');
        item.className = 'prediction-item-expanded';
        const ballsHtml = pred.prediction.map(n => `<span class="ball ${getBallClass(n)}" style="width:40px;height:40px;line-height:40px;font-size:0.9rem;">${n}</span>`).join('');
        const matching = pred.prediction.filter(n => currentWinningNumbers.includes(n));
        const analysis = analyzeNumbers(pred.prediction);
        const score = calculateQualityScore(analysis);
        
        // 등급 결정 (보너스 번호 반영)
        let gradeInfo = '', gradeClass = '';
        const bonusMatch = currentBonusNumber && pred.prediction.includes(currentBonusNumber);
        if (matching.length >= 6) { gradeInfo = '🏆 1등'; gradeClass = 'grade-jackpot'; }
        else if (matching.length === 5 && bonusMatch) { gradeInfo = '🥈 2등'; gradeClass = 'grade-jackpot'; }
        else if (matching.length === 5) { gradeInfo = '🥉 3등'; gradeClass = 'grade-high'; }
        else if (matching.length === 4) { gradeInfo = '4등'; gradeClass = 'grade-mid'; }
        else if (matching.length === 3) { gradeInfo = '5등'; gradeClass = 'grade-low'; }
        else { gradeInfo = '-'; gradeClass = ''; }
        
        item.innerHTML = `
            <div class="pred-card">
                <div class="pred-card-header" data-index="${index}">
                    <div class="pred-card-title">
                        <span class="prediction-number">#${pred.matchNum}</span>
                        <div class="pred-score-badge score-${score.gradeClass}">${score.totalScore}점 (${score.grade})</div>
                        ${matching.length >= 3 ? `<div class="pred-grade-badge ${gradeClass}">${gradeInfo}</div>` : ''}
                    </div>
                    <div class="pred-card-meta">
                        <span>${formatNumber(pred.attempt)}회에서 발견</span>
                        <span>|</span>
                        <span>${pred.time.toFixed(1)}초</span>
                        <span class="expand-icon" id="expandIcon${index}">▼</span>
                    </div>
                </div>
                
                <div class="pred-balls-row">
                    ${ballsHtml}
                </div>
                
                ${matching.length > 0 ? `
                    <div class="pred-match-info">
                        <span class="match-label">✓ 당첨번호와 일치:</span>
                        <span class="match-numbers">${matching.join(', ')}</span>
                        <span class="match-count-badge">${matching.length}개</span>
                    </div>
                ` : `
                    <div class="pred-match-info no-match">
                        <span>당첨번호와 일치하는 번호 없음</span>
                    </div>
                `}
                
                <!-- 간단 요약 (항상 표시) -->
                <div class="pred-quick-stats">
                    <div class="quick-stat">
                        <span class="quick-stat-label">합계</span>
                        <span class="quick-stat-value">${analysis.sum}</span>
                    </div>
                    <div class="quick-stat">
                        <span class="quick-stat-label">AC값</span>
                        <span class="quick-stat-value">${analysis.ac}</span>
                    </div>
                    <div class="quick-stat">
                        <span class="quick-stat-label">홀:짝</span>
                        <span class="quick-stat-value">${analysis.oddEvenRatio}</span>
                    </div>
                    <div class="quick-stat">
                        <span class="quick-stat-label">고:저</span>
                        <span class="quick-stat-value">${analysis.lowHighRatio}</span>
                    </div>
                    <div class="quick-stat">
                        <span class="quick-stat-label">구간</span>
                        <span class="quick-stat-value">${analysis.sectionsWithNumbers}개</span>
                    </div>
                </div>
                
                <!-- 상세 분석 (토글) -->
                <div class="pred-detail-section" id="predDetail${index}" data-open="false" style="display:none; padding:0;">
                    ${renderCompactAnalysis(analysis, score, matching)}
                </div>
                
                <button type="button" class="pred-toggle-btn" data-index="${index}">
                    <span id="toggleText${index}">상세 분석 보기</span>
                </button>
            </div>
        `;
        list.appendChild(item);
    });
}

function togglePredictionDetail(index) {
    const detail = document.getElementById('predDetail' + index);
    const icon = document.getElementById('expandIcon' + index);
    const text = document.getElementById('toggleText' + index);
    
    if (!detail) {
        console.log('Detail not found for index:', index);
        return;
    }
    
    const isOpen = detail.getAttribute('data-open') === 'true';
    
    if (isOpen) {
        detail.setAttribute('data-open', 'false');
        detail.style.display = 'none';
        detail.style.padding = '0';
        if (icon) icon.style.transform = 'rotate(0deg)';
        if (text) text.textContent = '상세 분석 보기';
    } else {
        detail.setAttribute('data-open', 'true');
        detail.style.display = 'block';
        detail.style.padding = '20px';
        if (icon) icon.style.transform = 'rotate(180deg)';
        if (text) text.textContent = '상세 분석 접기';
    }
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
function showStatus(type, message) { const container = document.getElementById('fetchStatus'); container.className = `status ${type}`; container.textContent = message; container.classList.remove('hidden'); }
function toggleCollapsible(id) { document.getElementById(id).classList.toggle('open'); }
function preventRefresh(e) { e.preventDefault(); e.returnValue = ''; }
function formatNumber(num) { if (num >= 100000000) return (num / 100000000).toFixed(1) + '억'; if (num >= 10000) return (num / 10000).toFixed(0) + '만'; return num.toLocaleString(); }

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {}
    // 폴백: textarea + execCommand
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text; textarea.style.position = 'fixed'; textarea.style.opacity = '0';
        document.body.appendChild(textarea); textarea.select();
        document.execCommand('copy'); document.body.removeChild(textarea);
        return true;
    } catch (e) { return false; }
}

// ========== 회차 비교 ==========
let compareRoundData = null;

async function compareRounds() {
    if (!currentWinningNumbers) {
        showStatus('warning', '⚠️ 먼저 기준 회차의 당첨번호를 조회해주세요.');
        return;
    }
    const compareRound = parseInt(document.getElementById('compareRoundInput').value);
    if (!compareRound || compareRound < 1) {
        showStatus('error', '비교할 회차를 입력해주세요.');
        return;
    }

    showStatus('info', '🔍 비교 회차 조회 중...');

    // 내장 DB에서 먼저 확인
    const dbResult = findRoundInDb(compareRound);
    if (dbResult) {
        compareRoundData = { numbers: dbResult.numbers, bonus: dbResult.bonus, round: compareRound };
        renderComparison(dbResult.numbers, dbResult.bonus, compareRound);
        showStatus('success', `✅ ${compareRound}회차 비교 분석 완료!`);
        return;
    }

    // 로컬 프록시 시도
    showStatus('info', '🔍 비교 회차 조회 중...');
    let result = await fetchFromLocalProxy(compareRound);

    if (!result) {
        showStatus('error', '❌ 비교 회차 조회에 실패했습니다. 내장 DB에 없는 회차입니다.');
        return;
    }

    compareRoundData = { numbers: result.numbers, bonus: result.bonus, round: compareRound };
    renderComparison(result.numbers, result.bonus, compareRound);
    showStatus('success', `✅ ${compareRound}회차 비교 분석 완료!`);
}

function renderComparison(compareNums, compareBonus, compareRound) {
    const currentNums = currentWinningNumbers;
    const currentAnalysis = analyzeNumbers(currentNums);
    const compareAnalysis = analyzeNumbers(compareNums);

    const common = currentNums.filter(n => compareNums.includes(n));
    const allNums = [...new Set([...currentNums, ...compareNums])].sort((a, b) => a - b);

    const sumDiff = compareAnalysis.sum - currentAnalysis.sum;
    const acDiff = compareAnalysis.ac - currentAnalysis.ac;

    document.getElementById('comparisonContent').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-top:15px;">
            <div style="background:rgba(0,0,0,0.2);padding:15px;border-radius:12px;text-align:center;">
                <div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:8px;">제 ${currentRound}회 (기준)</div>
                <div class="balls-container" style="padding:10px 0;">${currentNums.map(n => `<span class="ball ${getBallClass(n)}" style="width:36px;height:36px;line-height:36px;font-size:0.85rem;">${n}</span>`).join('')}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary);">합계 ${currentAnalysis.sum} | AC ${currentAnalysis.ac} | ${currentAnalysis.oddEvenRatio} | ${currentAnalysis.lowHighRatio}</div>
            </div>
            <div style="background:rgba(0,0,0,0.2);padding:15px;border-radius:12px;text-align:center;">
                <div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:8px;">제 ${compareRound}회 (비교)</div>
                <div class="balls-container" style="padding:10px 0;">${compareNums.map(n => `<span class="ball ${getBallClass(n)}" style="width:36px;height:36px;line-height:36px;font-size:0.85rem;">${n}</span>`).join('')}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary);">합계 ${compareAnalysis.sum} | AC ${compareAnalysis.ac} | ${compareAnalysis.oddEvenRatio} | ${compareAnalysis.lowHighRatio}</div>
            </div>
        </div>

        <div style="margin-top:20px;background:rgba(0,0,0,0.2);padding:15px;border-radius:12px;">
            <h4 style="color:var(--accent-gold);margin-bottom:12px;">🔍 변화 분석</h4>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;">
                <div style="text-align:center;">
                    <div style="font-size:0.75rem;color:var(--text-secondary);">합계 변화</div>
                    <div style="font-family:'Orbitron';font-size:1.2rem;color:${sumDiff > 0 ? 'var(--accent-pink)' : sumDiff < 0 ? 'var(--accent-cyan)' : 'var(--text-secondary)'};">${sumDiff > 0 ? '+' : ''}${sumDiff}</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:0.75rem;color:var(--text-secondary);">AC값 변화</div>
                    <div style="font-family:'Orbitron';font-size:1.2rem;color:${acDiff > 0 ? 'var(--grade-excellent)' : acDiff < 0 ? 'var(--grade-caution)' : 'var(--text-secondary)'};">${acDiff > 0 ? '+' : ''}${acDiff}</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:0.75rem;color:var(--text-secondary);">홀짝 (기준 → 비교)</div>
                    <div style="font-family:'Orbitron';font-size:1.2rem;color:var(--accent-cyan);">${currentAnalysis.oddEvenRatio} → ${compareAnalysis.oddEvenRatio}</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:0.75rem;color:var(--text-secondary);">고저 (기준 → 비교)</div>
                    <div style="font-family:'Orbitron';font-size:1.2rem;color:var(--accent-cyan);">${currentAnalysis.lowHighRatio} → ${compareAnalysis.lowHighRatio}</div>
                </div>
            </div>
        </div>

        <div style="margin-top:15px;background:${common.length > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(100,100,100,0.1)'};padding:15px;border-radius:12px;text-align:center;">
            <h4 style="color:var(--accent-gold);margin-bottom:10px;">🔗 공통 번호 (${common.length}개)</h4>
            ${common.length > 0 ? `
                <div class="balls-container" style="padding:10px 0;">${common.map(n => `<span class="ball ${getBallClass(n)}" style="width:42px;height:42px;line-height:42px;">${n}</span>`).join('')}</div>
                <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:8px;">
                    💡 두 회차에 걸쳐 나타난 번호입니다. 로또는 독립시행이지만 참고 자료로 활용하세요.
                </div>
            ` : `
                <div style="color:var(--text-secondary);">공통 번호가 없습니다.</div>
            `}
        </div>

        <div style="margin-top:15px;font-size:0.85rem;color:var(--text-secondary);text-align:center;padding:10px;background:rgba(0,0,0,0.2);border-radius:10px;">
            💡 <strong>참고:</strong> 로또는 매 회차 완전 독립된 확률 게임입니다.<br>이전 회차의 번호가 다음 회차에 영향을 미치지 않습니다.
        </div>
    `;
    document.getElementById('comparisonResult').classList.remove('hidden');
}

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
    ctx.fillStyle = 'var(--text-secondary)';
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

// ========== 스마트 추천 ==========
function switchAiMode(mode) {
    document.querySelectorAll('.ai-mode-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.ai-mode-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.ai-mode-tab[data-mode="${mode}"]`).classList.add('active');
    document.getElementById('aiMode' + mode.charAt(0).toUpperCase() + mode.slice(1)).classList.add('active');
    if (mode === 'custom' && !document.getElementById('excludeGrid')?.children.length) {
        initExcludeGrid();
    }
}

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

function runSmartRecommend() {
    if (!dbStats) {
        showStatus('warning', '⚠️ 통계 DB가 로드되지 않았습니다.');
        return;
    }
    if (!currentWinningNumbers) {
        showStatus('warning', '⚠️ 먼저 당첨번호를 설정해주세요.');
        return;
    }

    const recommendations = generateSmartRecommendation(10);
    const list = document.getElementById('smartRecommendList');
    list.innerHTML = recommendations.map((rec, i) => {
        const matching = rec.numbers.filter(n => currentWinningNumbers.includes(n));
        const analysis = analyzeNumbers(rec.numbers);
        const filterResult = checkFilters(rec.numbers);
        const percentileRank = calculatePercentileRank(rec.numbers);
        const gradeResult = determineGrade(filterResult, percentileRank);
        return `
            <div class="smart-card">
                <div class="smart-card-header">
                    <span class="smart-rank">#${i + 1}</span>
                    <span class="smart-score" style="color:${rec.score >= 70 ? 'var(--grade-excellent)' : rec.score >= 50 ? 'var(--grade-good)' : 'var(--grade-normal)'}">${rec.score.toFixed(0)}점</span>
                    <span class="grade-badge-inline ${gradeResult.cls}">${gradeResult.grade} ${gradeResult.label}</span>
                    ${matching.length >= 3 ? `<span class="pred-grade-badge grade-low">${matching.length}개 일치</span>` : ''}
                    <div style="margin-left:auto;display:flex;gap:4px;">
                        <button class="btn btn-secondary" style="padding:6px 10px;font-size:0.75rem;" onclick="shareSmartPrediction([${rec.numbers}], ${rec.score.toFixed(0)})">📤</button>
                        <button class="btn btn-secondary" style="padding:6px 10px;font-size:0.75rem;" onclick="saveSmartPrediction([${rec.numbers}], ${rec.score.toFixed(0)}, '${analysis.sum}|${analysis.ac}|${analysis.oddEvenRatio}|${analysis.sectionsWithNumbers}개구간')">💾</button>
                    </div>
                </div>
                <div class="balls-container" style="padding:10px 0;gap:6px;">
                    ${rec.numbers.map(n => `<span class="ball ${getBallClass(n)}" style="width:42px;height:42px;line-height:42px;font-size:0.9rem;">${n}</span>`).join('')}
                </div>
                <div class="smart-quick-stats">
                    <span>합계 ${analysis.sum}</span>
                    <span>AC ${analysis.ac}</span>
                    <span>${analysis.oddEvenRatio}</span>
                    <span>${analysis.lowHighRatio}</span>
                    <span>${analysis.sectionsWithNumbers}개 구간</span>
                </div>
                <div class="smart-filter-row">
                    ${Object.entries(filterResult.results).map(([k, r]) => `
                        <span class="mini-filter ${r.pass ? 'pass' : 'fail'}">${r.icon} ${r.label}</span>
                    `).join('')}
                    <span style="font-size:0.7rem;color:var(--text-secondary);">상위 ${percentileRank}%</span>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('smartResult').classList.remove('hidden');
    vibrate(30);
    showStatus('success', `✅ ${recommendations.length}개의 스마트 추천 조합을 생성했습니다!`);
}

// ========== 수동 조합 생성 ==========
let excludedNumbers = new Set();
let fixedNumbers = new Set();

function initExcludeGrid() {
    const grid = document.getElementById('excludeGrid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 1; i <= 45; i++) {
        const btn = document.createElement('button');
        btn.className = `exclude-btn ${getBallClass(i)}`;
        btn.textContent = i;
        btn.setAttribute('data-num', i);
        btn.onclick = () => toggleExclude(i, btn);
        grid.appendChild(btn);
    }
    initFixedGrid();
}

function initFixedGrid() {
    const grid = document.getElementById('fixedGrid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 1; i <= 45; i++) {
        const btn = document.createElement('button');
        btn.className = `fixed-btn ${getBallClass(i)}`;
        btn.textContent = i;
        btn.setAttribute('data-num', i);
        btn.onclick = () => toggleFixed(i, btn);
        grid.appendChild(btn);
    }
}

function toggleExclude(num, btn) {
    if (excludedNumbers.has(num)) {
        excludedNumbers.delete(num);
        btn.classList.remove('excluded');
        // 제외 해제 시 고정 가능하도록
        const fixedBtn = document.querySelector(`.fixed-btn[data-num="${num}"]`);
        if (fixedBtn) fixedBtn.disabled = false;
    } else if (excludedNumbers.size < 20) {
        excludedNumbers.add(num);
        btn.classList.add('excluded');
        // 제외된 번호는 고정 불가
        if (fixedNumbers.has(num)) {
            fixedNumbers.delete(num);
            const fixedBtn = document.querySelector(`.fixed-btn[data-num="${num}"]`);
            if (fixedBtn) fixedBtn.classList.remove('fixed-selected');
        }
    }
    document.getElementById('excludeCount').textContent = `선택: ${excludedNumbers.size}개`;
}

function toggleFixed(num, btn) {
    if (fixedNumbers.has(num)) {
        fixedNumbers.delete(num);
        btn.classList.remove('fixed-selected');
    } else if (fixedNumbers.size < 5 && !excludedNumbers.has(num)) {
        fixedNumbers.add(num);
        btn.classList.add('fixed-selected');
    }
    document.getElementById('fixedCount').textContent = `선택: ${fixedNumbers.size}개`;
}

function clearExcludes() {
    excludedNumbers.clear();
    document.querySelectorAll('.exclude-btn').forEach(b => b.classList.remove('excluded'));
    document.getElementById('excludeCount').textContent = '선택: 0개';
}

function clearFixed() {
    fixedNumbers.clear();
    document.querySelectorAll('.fixed-btn').forEach(b => b.classList.remove('fixed-selected'));
    document.getElementById('fixedCount').textContent = '선택: 0개';
}

function quickExclude() {
    if (!dbStats) { showStatus('warning', '⚠️ 통계 DB가 로드되지 않았습니다.'); return; }
    // 제외점수 기반으로 제외 추천 (제외점수 3 이상 번호)
    const numScores = computeNumberScores();
    if (!numScores) { showStatus('warning', '⚠️ 번호 점수를 계산할 수 없습니다.'); return; }
    clearExcludes();
    const highExclScores = [];
    for (let n = 1; n <= 45; n++) {
        if (numScores[n].exclScore >= 2) highExclScores.push({ num: n, score: numScores[n].exclScore });
    }
    highExclScores.sort((a, b) => b.score - a.score);
    const topExclude = highExclScores.slice(0, 10);
    document.querySelectorAll('.exclude-btn').forEach(btn => {
        const num = parseInt(btn.getAttribute('data-num'));
        if (topExclude.some(e => e.num === num)) {
            excludedNumbers.add(num);
            btn.classList.add('excluded');
        }
    });
    document.getElementById('excludeCount').textContent = `선택: ${excludedNumbers.size}개`;
    showStatus('info', '⚡ 제외점수 기준 추천 번호 10개를 제외 목록에 추가했습니다.');
    playBeep(500, 0.05);
}

function quickFix() {
    if (!dbStats) { showStatus('warning', '⚠️ 통계 DB가 로드되지 않았습니다.'); return; }
    const numScores = computeNumberScores();
    if (!numScores) return;
    clearFixed();
    const highRecScores = [];
    for (let n = 1; n <= 45; n++) {
        if (numScores[n].recScore <= 0) highRecScores.push({ num: n, score: numScores[n].recScore });
    }
    highRecScores.sort((a, b) => a.score - b.score);
    const topFix = highRecScores.slice(0, 3);
    document.querySelectorAll('.fixed-btn').forEach(btn => {
        const num = parseInt(btn.getAttribute('data-num'));
        if (topFix.some(f => f.num === num)) {
            fixedNumbers.add(num);
            btn.classList.add('fixed-selected');
        }
    });
    document.getElementById('fixedCount').textContent = `선택: ${fixedNumbers.size}개`;
    showStatus('info', '⚡ 추천점수 기준 3개 번호를 고정 목록에 추가했습니다.');
    playBeep(500, 0.05);
}

function generateCustomCombos() {
    if (!dbStats) { showStatus('warning', '⚠️ 통계 DB가 로드되지 않았습니다.'); return; }
    const count = parseInt(document.getElementById('customCount').value);

    // 고정 번호는 항상 포함
    const fixedArr = [...fixedNumbers];
    if (fixedArr.length > 6) {
        showStatus('error', '❌ 고정 번호는 최대 6개까지 가능합니다.');
        return;
    }

    const available = [];
    for (let i = 1; i <= 45; i++) {
        if (!excludedNumbers.has(i) && !fixedNumbers.has(i)) available.push(i);
    }
    const needCount = 6 - fixedArr.length;
    if (available.length < needCount) {
        showStatus('error', `❌ 선택 가능한 번호가 ${needCount}개 미만입니다. 제외 번호를 줄여주세요.`);
        return;
    }

    const numScores = computeNumberScores();
    const combos = [];
    const seen = new Set();
    const weights = available.map(n => {
        let w = 1;
        if (numScores && numScores[n]) {
            // 추천점수 낮을수록 가중치 높음
            w += (4 - numScores[n].recScore) * 2;
            // Z-score 양수(평균회귀 신호) 가중치
            if (numScores[n].zScore > 1.0) w += 4;
            else if (numScores[n].zScore > 0.5) w += 2;
        }
        return Math.max(w, 1);
    });

    let attempts = 0;
    while (combos.length < count && attempts < count * 200) {
        attempts++;
        const selected = [...fixedArr];
        const pool = [...available];
        const poolWeights = [...weights];

        for (let i = 0; i < needCount; i++) {
            const totalW = poolWeights.reduce((a, b) => a + b, 0);
            const rand = new Uint32Array(1);
            crypto.getRandomValues(rand);
            let r = rand[0] / 4294967296 * totalW;
            let idx = 0;
            while (idx < poolWeights.length - 1 && r > poolWeights[idx]) {
                r -= poolWeights[idx];
                idx++;
            }
            selected.push(pool[idx]);
            pool.splice(idx, 1);
            poolWeights.splice(idx, 1);
        }
        selected.sort((a, b) => a - b);
        const key = selected.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        combos.push(selected);
    }

    renderCustomCombos(combos);
    vibrate(30);
    showStatus('success', `✅ ${combos.length}개의 조합을 생성했습니다!`);
}

function renderCustomCombos(combos) {
    const list = document.getElementById('customComboList');
    list.innerHTML = combos.map((nums, i) => {
        const analysis = analyzeNumbers(nums);
        const score = calculateQualityScore(analysis);
        const filterResult = checkFilters(nums);
        const matching = currentWinningNumbers ? nums.filter(n => currentWinningNumbers.includes(n)) : [];
        const percentileRank = calculatePercentileRank(nums);
        const gradeResult = determineGrade(filterResult, percentileRank);
        return `
            <div class="smart-card">
                <div class="smart-card-header">
                    <span class="smart-rank">#${i + 1}</span>
                    <span class="smart-score" style="color:${score.totalScore >= 75 ? 'var(--grade-excellent)' : score.totalScore >= 60 ? 'var(--grade-good)' : 'var(--grade-normal)'}">${score.totalScore}점 (${score.grade})</span>
                    <span class="grade-badge-inline ${gradeResult.cls}">${gradeResult.grade} ${gradeResult.label}</span>
                    ${matching.length >= 3 ? `<span class="pred-grade-badge grade-low">${matching.length}개 일치</span>` : ''}
                    <div style="margin-left:auto;display:flex;gap:4px;">
                        <button class="btn btn-secondary" style="padding:6px 10px;font-size:0.75rem;" onclick="shareSmartPrediction([${nums}], ${score.totalScore})">📤</button>
                        <button class="btn btn-secondary" style="padding:6px 10px;font-size:0.75rem;" onclick="saveCustomPrediction([${nums}], ${score.totalScore}, '${score.grade}')">💾</button>
                    </div>
                </div>
                <div class="balls-container" style="padding:10px 0;gap:6px;">
                    ${nums.map(n => `<span class="ball ${getBallClass(n)}" style="width:42px;height:42px;line-height:42px;font-size:0.9rem;">${n}</span>`).join('')}
                </div>
                <div class="smart-quick-stats">
                    <span>합계 ${analysis.sum}</span>
                    <span>AC ${analysis.ac}</span>
                    <span>${analysis.oddEvenRatio}</span>
                    <span>${analysis.lowHighRatio}</span>
                    <span>${analysis.sectionsWithNumbers}개 구간</span>
                </div>
                <div class="smart-filter-row">
                    ${Object.entries(filterResult.results).map(([k, r]) => `
                        <span class="mini-filter ${r.pass ? 'pass' : 'fail'}">${r.icon} ${r.label}</span>
                    `).join('')}
                    <span style="font-size:0.7rem;color:var(--text-secondary);">상위 ${percentileRank}%</span>
                </div>
            </div>
        `;
    }).join('');
    document.getElementById('customResult').classList.remove('hidden');
}

function saveCustomPrediction(numbers, score, grade) {
    const saved = getSavedPredictions();
    const analysis = analyzeNumbers(numbers);
    saved.unshift({
        date: new Date().toLocaleString('ko-KR'),
        round: currentRound || '-',
        numbers,
        meta: `수동 조합 | 제외 ${excludedNumbers.size}개`,
        score,
        grade
    });
    if (saved.length > 50) saved.length = 50;
    localStorage.setItem('lotto-predictions', JSON.stringify(saved));
    loadSavedPredictions();
    showStatus('success', '💾 수동 조합이 저장되었습니다!');
    playBeep(600, 0.08);
}

// ========== UI/UX 고급화 ==========
let uxSettings = { vibration: true, sound: false, animation: true };

function loadUxSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem('lotto-ux-settings'));
        if (saved) uxSettings = { ...uxSettings, ...saved };
    } catch (e) {}
    document.querySelectorAll('.ux-toggle').forEach(toggle => {
        const key = toggle.dataset.key;
        if (uxSettings[key] !== undefined) toggle.checked = uxSettings[key];
    });
}

function toggleSettings() {
    const overlay = document.getElementById('settingsOverlay');
    overlay.classList.toggle('open');
}

function toggleUxSetting(key, checked) {
    uxSettings[key] = checked;
    try { localStorage.setItem('lotto-ux-settings', JSON.stringify(uxSettings)); } catch (e) {}
    if (checked && key === 'sound') playBeep(800, 0.05); // 확인 비프
    if (checked && key === 'vibration') vibrate(30);
    showStatus('info', `⚙️ ${key === 'vibration' ? '진동' : key === 'sound' ? '사운드' : '애니메이션'} ${checked ? 'ON' : 'OFF'}`);
}

function vibrate(ms) {
    if (uxSettings.vibration && navigator.vibrate) {
        try { navigator.vibrate(ms); } catch (e) {}
    }
}

let audioCtx = null;
function getAudioCtx() {
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    return audioCtx;
}

function playBeep(freq = 800, duration = 0.1) {
    if (!uxSettings.sound) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
}

function fireConfetti() {
    if (!uxSettings.animation) return;
    const container = document.getElementById('confettiContainer');
    const batch = document.createElement('div');
    batch.className = 'confetti-batch';
    const colors = ['#ffd700', '#00f5ff', '#ff006e', '#8b5cf6', '#10b981', '#f97316', '#ef4444', '#3b82f6'];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 60; i++) {
        const particle = document.createElement('div');
        particle.className = 'confetti-particle';
        const size = 6 + Math.random() * 8;
        particle.style.cssText = `
            position:absolute;
            width:${size}px;height:${size * (0.5 + Math.random())}px;
            background:${colors[Math.floor(Math.random() * colors.length)]};
            left:${Math.random() * 100}%;
            top:-20px;
            border-radius:2px;
            animation:confettiFall ${2 + Math.random() * 3}s ease-out forwards;
            animation-delay:${Math.random() * 0.5}s;
            opacity:${0.7 + Math.random() * 0.3};
        `;
        frag.appendChild(particle);
    }
    batch.appendChild(frag);
    container.appendChild(batch);
    setTimeout(() => { batch.remove(); }, 4000);
}

async function copyEmail() {
    await copyToClipboard('core13773@gmail.com');
    showStatus('success', '📋 이메일이 복사되었습니다: core13773@gmail.com');
}

// ========== 번호 쌍 분석 ==========
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

// ========== 당첨 회고 ==========
let retroSelected = [];

function initRetroGrid() {
    const grid = document.getElementById('retroNumberGrid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 1; i <= 45; i++) {
        const btn = document.createElement('button');
        btn.className = `number-btn ${getBallClass(i)}`;
        btn.textContent = i;
        btn.setAttribute('data-num', i);
        btn.onclick = () => {
            const idx = retroSelected.indexOf(i);
            if (idx > -1) { retroSelected.splice(idx, 1); btn.classList.remove('selected'); }
            else if (retroSelected.length < 6) { retroSelected.push(i); btn.classList.add('selected'); }
            updateRetroDisplay();
        };
        grid.appendChild(btn);
    }
}

function updateRetroDisplay() {
    document.getElementById('retroSelectedCount').textContent = `선택: ${retroSelected.length}개 / 6개`;
    renderBalls(retroSelected, 'retroSelectedBalls');
    document.getElementById('retroApplyBtn').disabled = retroSelected.length !== 6;
}

function applyRetroNumbers() {
    if (retroSelected.length !== 6) return;
    document.getElementById('retroInput').value = retroSelected.sort((a, b) => a - b).join(', ');
    runRetrospective();
}

function runRetrospective() {
    if (!lottoDb || lottoDb.length === 0) {
        showStatus('warning', '⚠️ DB 데이터가 필요합니다.');
        return;
    }

    const input = document.getElementById('retroInput').value.trim();
    const nums = input.split(/[,·\s]+/).map(Number).filter(n => n >= 1 && n <= 45);
    if (nums.length !== 6 || new Set(nums).size !== 6) {
        showStatus('error', '올바른 6개 번호를 입력해주세요.');
        return;
    }
    nums.sort((a, b) => a - b);

    // 최근 1년 (약 52회차) 분석
    const oneYearAgo = lottoDb.length >= 52 ? lottoDb.length - 52 : 0;
    const recentRounds = lottoDb.slice(oneYearAgo);

    const results = { round5: [], round4: [], round3: [] };
    let totalSpent = 0;

    recentRounds.forEach(entry => {
        if (!entry.numbers) return;
        totalSpent += 1000; // 회당 1,000원 가정
        const matches = nums.filter(n => entry.numbers.includes(n));
        const bonusMatch = entry.bonus && nums.includes(entry.bonus);

        if (matches.length === 6) results.round5.push({ ...entry, match: 6, grade: '1등' });
        else if (matches.length === 5 && bonusMatch) results.round5.push({ ...entry, match: 6, grade: '2등' });
        else if (matches.length === 5) results.round4.push({ ...entry, match: 5, grade: '3등' });
        else if (matches.length === 4) results.round3.push({ ...entry, match: 4, grade: '4등' });
        else if (matches.length === 3) results.round3.push({ ...entry, match: 3, grade: '5등' });
    });

    // 예상 당첨금 (대략적인 평균값)
    const prizeEstimate = {
        '1등': 2000000000, '2등': 50000000, '3등': 1500000, '4등': 50000, '5등': 5000
    };
    let totalPrize = 0;
    [...results.round5, ...results.round4, ...results.round3].forEach(r => {
        totalPrize += prizeEstimate[r.grade] || 0;
    });

    document.getElementById('retroContent').innerHTML = `
        <div style="text-align:center;margin-top:20px;">
            <div class="balls-container" style="padding:10px 0;">
                ${nums.map(n => `<span class="ball ${getBallClass(n)}" style="width:48px;height:48px;line-height:48px;">${n}</span>`).join('')}
            </div>
            <p style="color:var(--text-secondary);margin-bottom:20px;">최근 ${recentRounds.length}회차 분석 (약 1년)</p>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px;">
                <div class="retro-stat">
                    <div class="retro-stat-value" style="color:var(--accent-gold);">${totalSpent.toLocaleString()}원</div>
                    <div class="retro-stat-label">총 구매 금액</div>
                </div>
                <div class="retro-stat">
                    <div class="retro-stat-value" style="color:${totalPrize > totalSpent ? 'var(--grade-excellent)' : 'var(--grade-caution)'};">${totalPrize.toLocaleString()}원</div>
                    <div class="retro-stat-label">예상 당첨금</div>
                </div>
                <div class="retro-stat">
                    <div class="retro-stat-value" style="color:${totalPrize > totalSpent ? 'var(--grade-excellent)' : 'var(--grade-caution)'};">${totalPrize > totalSpent ? '+' : ''}${(totalPrize - totalSpent).toLocaleString()}원</div>
                    <div class="retro-stat-label">손익</div>
                </div>
            </div>

            <table class="retro-table">
                <tr><th>등수</th><th>조건</th><th>당첨 횟수</th><th>예상 금액</th></tr>
                <tr><td class="prize-rank">1등</td><td>6개 일치</td><td>${results.round5.filter(r => r.grade === '1등').length}회</td><td>약 20억원</td></tr>
                <tr><td class="prize-rank">2등</td><td>5개+보너스</td><td>${results.round5.filter(r => r.grade === '2등').length}회</td><td>약 5천만원</td></tr>
                <tr><td class="prize-rank">3등</td><td>5개 일치</td><td>${results.round4.filter(r => r.grade === '3등').length}회</td><td>약 150만원</td></tr>
                <tr><td class="prize-rank">4등</td><td>4개 일치</td><td>${results.round3.filter(r => r.grade === '4등').length}회</td><td>5만원</td></tr>
                <tr><td class="prize-rank">5등</td><td>3개 일치</td><td>${results.round3.filter(r => r.grade === '5등').length}회</td><td>5천원</td></tr>
            </table>

            ${results.round3.length > 0 ? `
                <div class="collapsible" id="retroDetail" style="margin-top:20px;">
                    <div class="collapsible-header" onclick="toggleCollapsible('retroDetail')"><span>📋 당첨 상세 내역</span><span class="collapsible-icon">▼</span></div>
                    <div class="collapsible-content">
                        ${[...results.round5, ...results.round4, ...results.round3].map(r => `
                            <div class="retro-item">
                                <span class="prize-rank">${r.grade}</span>
                                <span>제 ${r.round}회</span>
                                <span class="balls-container" style="padding:5px 0;gap:4px;">${r.numbers.map(n => `<span class="ball ${getBallClass(n)}" style="width:28px;height:28px;line-height:28px;font-size:0.7rem;">${n}</span>`).join('')}</span>
                                ${r.bonus ? `<span class="ball bonus" style="width:28px;height:28px;line-height:28px;font-size:0.7rem;">${r.bonus}</span>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : '<p style="color:var(--text-secondary);margin-top:15px;">아쉽게도 당첨 내역이 없습니다.</p>'}
        </div>
    `;
    document.getElementById('retroResult').classList.remove('hidden');
    showStatus('success', `⏪ ${recentRounds.length}회차 분석 완료!`);
    playBeep(800, 0.1);
}

// ========== 카카오톡 공유 ==========
async function shareToKakao(text) {
    // Web Share API 우선 시도 (모바일에서 카카오톡 선택 가능)
    if (navigator.share) {
        try {
            await navigator.share({ title: '로또 645 번호', text });
            return true;
        } catch (e) {}
    }
    return false;
}

async function sharePrediction() {
    const balls = document.getElementById('predictionBalls');
    if (!balls || balls.children.length === 0) return;
    const numbers = [...balls.querySelectorAll('.ball')].map(b => b.textContent).join(', ');
    const score = document.getElementById('predictionScore')?.textContent || '-';
    const text = `🎱 로또 645 예측 번호\n${numbers}\n품질 점수: ${score}점\n기준: 제 ${currentRound || '-'}회\nhttps://123lotto.co.kr`;

    const shared = await shareToKakao(text);
    if (!shared) {
        await copyToClipboard(text);
        showStatus('success', '📋 공유 텍스트가 복사되었습니다!');
    }
}

async function shareSmartPrediction(numbers, score) {
    const nums = numbers.join(', ');
    const text = `🎱 로또 645 스마트 추천\n${nums}\n품질 점수: ${score}점\nhttps://123lotto.co.kr`;

    const shared = await shareToKakao(text);
    if (!shared) {
        await copyToClipboard(text);
        showStatus('success', '📋 공유 텍스트가 복사되었습니다!');
    }
}

async function shareSite() {
    const text = `🎰 로또 645 AI 예측 시스템\n몬테카를로 시뮬레이션 + 통계 분석 + 스마트 추천\nhttps://123lotto.co.kr`;

    if (navigator.share) {
        try {
            await navigator.share({ title: '로또 645 AI 예측', text, url: 'https://123lotto.co.kr' });
            return;
        } catch (e) {}
    }
    await copyToClipboard(text);
    showStatus('success', '📋 사이트 주소가 복사됐습니다! 카톡/문자에 붙여넣기 하세요.');
}

// ========== PWA 알림 ==========
let notificationEnabled = false, notifyTimeout = null;

async function toggleNotifications() {
    if (!('Notification' in window)) {
        showStatus('warning', '⚠️ 이 브라우저는 알림을 지원하지 않습니다.');
        return;
    }

    if (Notification.permission === 'granted') {
        notificationEnabled = !notificationEnabled;
        updateNotifyBtn();
        if (notificationEnabled) {
            scheduleNotification();
            showStatus('success', '🔔 토요일 추첨 알림이 켜졌습니다!');
        } else {
            showStatus('info', '🔕 알림이 꺼졌습니다.');
        }
    } else if (Notification.permission === 'denied') {
        showStatus('warning', '⚠️ 알림 권한이 거부되어 있습니다. 브라우저 설정에서 허용해주세요.');
    } else {
        const result = await Notification.requestPermission();
        if (result === 'granted') {
            notificationEnabled = true;
            updateNotifyBtn();
            scheduleNotification();
            showStatus('success', '🔔 알림이 활성화되었습니다!');
            playBeep(800, 0.1);
        } else {
            showStatus('info', '알림이 거부되었습니다.');
        }
    }
    try { localStorage.setItem('lotto-notify', notificationEnabled); } catch (e) {}
}

function updateNotifyBtn() {
    const btn = document.getElementById('notifyBtn');
    if (btn) btn.textContent = notificationEnabled ? '🔔' : '🔕';
}

function scheduleNotification() {
    if (!notificationEnabled || Notification.permission !== 'granted') return;
    if (notifyTimeout) clearTimeout(notifyTimeout);

    // 다음 토요일 20:50 KST 계산
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 3600000);
    const day = kst.getUTCDay();
    const hours = kst.getUTCHours();
    const minutes = kst.getUTCMinutes();

    let nextSat = new Date(kst);
    if (day === 6 && hours < 20) {
        // 오늘 토요일이고 20:50 이전
        nextSat.setUTCHours(20, 50 - minutes, 0, 0);
    } else if (day === 6 && hours >= 20 && minutes >= 50) {
        // 오늘 토요일이고 이미 20:50 이후 → 다음주
        nextSat.setUTCDate(nextSat.getUTCDate() + 7);
        nextSat.setUTCHours(20, 50 - minutes, 0, 0);
    } else {
        // 평일 → 다음 토요일
        const daysUntil = day === 6 ? 0 : 6 - day;
        nextSat.setUTCDate(nextSat.getUTCDate() + (daysUntil === 0 ? 7 : daysUntil));
        nextSat.setUTCHours(20, 50 - minutes, 0, 0);
    }

    const delay = nextSat.getTime() - kst.getTime();
    if (delay > 0) {
        notifyTimeout = setTimeout(() => {
            if (notificationEnabled) {
                new Notification('🎰 로또 645 추첨 10분 전!', {
                    body: '곧 로또 추첨이 시작됩니다. 로또645 앱에서 번호 확인하세요!',
                    vibrate: [200, 100, 200],
                    requireInteraction: true
                });
                // 7일 후 다시 스케줄
                setTimeout(scheduleNotification, 7 * 24 * 3600000);
            }
        }, delay);
    }
}

// 통계 대시보드 초기화 (latest.json 로드 후 호출)
const origLoadLatestJson = loadLatestJson;
loadLatestJson = async function() {
    await origLoadLatestJson();
    if (lottoDb && lottoDb.length > 0) renderStatsDashboard();
};

// 시뮬레이션 매치 발생 시 파티클 효과 추가
const origHandleMatch = handleMatch;
handleMatch = function(data) {
    origHandleMatch(data);
    playBeep(1000, 0.15);
    vibrate(50);
    if (data.matchCount === 1) fireConfetti();
};

// DOMContentLoaded에 초기화 추가
document.addEventListener('DOMContentLoaded', () => {
    loadUxSettings();
    initRetroGrid();
    try { notificationEnabled = localStorage.getItem('lotto-notify') === 'true'; } catch (e) {}
    if (notificationEnabled && Notification.permission === 'granted') {
        scheduleNotification();
    }
    updateNotifyBtn();
}, { once: true });
