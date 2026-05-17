// script.js - 핵심 초기화, 이벤트, 데이터 조회, 저장, 회차 비교, 당첨 회고
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
    const roundInput = document.getElementById('roundInput');
    roundInput.value = latestRound;
    roundInput.max = latestRound;
    roundInput.addEventListener('focus', () => roundInput.select());
    createNumberGrid();
    setupPredictionToggleEvents();
    loadTheme();
    loadFontSetting();
    loadSavedPredictions();
    loadLatestJson();
    handleSharedPrediction();
    loadUxSettings();
    initRetroGrid();
    initBonusGrid();
    initScrollTopBtn();
    initOnboarding();
    if (typeof initGameZone === 'function') initGameZone();
    if (typeof renderMissions === 'function') renderMissions();
    try { notificationEnabled = localStorage.getItem('lotto-notify') === 'true'; } catch (e) {}
    if (notificationEnabled && Notification.permission === 'granted') { scheduleNotification(); }
    updateNotifyBtn();
});

let lottoDb = null;

async function loadLatestJson() {
    try {
        const resp = await fetch('latest.json?_=' + Date.now(), { cache: 'no-store' });
        if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data) && data.length > 0) {
                lottoDb = data;
                cachedNumberScores = null;
                const latest = data[data.length - 1];
                const inputEl = document.getElementById('roundInput');
                const initialRound = calculateLatestRound();
                // 사용자가 직접 입력한 경우 덮어쓰지 않음
                if (!inputEl.value || parseInt(inputEl.value) === initialRound) {
                    inputEl.value = latest.round;
                }
                inputEl.max = latest.round;
                setWinningNumbers(latest.numbers, latest.bonus, latest.round, '내장 DB (최신)');
                showStatus('success', `✅ ${data.length}개 회차 DB 로드 완료! 제 ${latest.round}회 자동 적용`);
                if (typeof _hook === 'function') _hook('loadLatestJson');
                return;
            }
            if (data.numbers && data.numbers.length === 6) {
                document.getElementById('roundInput').value = data.round;
                setWinningNumbers(data.numbers, data.bonus, data.round, `자동 로드 (${data.updated || '최신'})`);
                showStatus('success', `✅ 제 ${data.round}회 당첨번호 자동 로드 완료!`);
            }
        }
    } catch (e) {
        const msg = '⚠️ latest.json을 불러올 수 없습니다. 인터넷 연결을 확인해주세요.';
        document.getElementById('statsNotReady').textContent = msg;
        showStatus('warning', msg + ' 수동 입력 모드로 전환됩니다.');
        document.getElementById('manualInputSection').classList.add('open');
    }
}

function findRoundInDb(roundNo) {
    if (!lottoDb) return null;
    return lottoDb.find(r => r.round === roundNo);
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
    saved.unshift({ date: new Date().toLocaleString('ko-KR'), round: currentRound || '-', numbers, meta, score, grade });
    if (saved.length > 50) saved.length = 50;
    localStorage.setItem('lotto-predictions', JSON.stringify(saved));
    loadSavedPredictions();
    showStatus('success', '💾 예측 결과가 저장되었습니다!');
    if (typeof trackMission === 'function') trackMission('save_prediction');
}

function getSavedPredictions() {
    try { return JSON.parse(localStorage.getItem('lotto-predictions') || '[]'); } catch (e) { return []; }
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
    if (!currentWinningNumbers) { showStatus('warning', '⚠️ 먼저 당첨번호를 조회해주세요.'); return; }
    renderBalls(item.numbers, 'predictionBalls');
    document.getElementById('predictionMeta').textContent = `저장된 결과 | 제 ${item.round}회 | ${item.date}`;
    const analysis = analyzeNumbers(item.numbers);
    const score = calculateQualityScore(analysis);
    const filterResult = checkFilters(item.numbers);
    const percentileRank = calculatePercentileRank(item.numbers);
    const gradeResult = determineGrade(filterResult, percentileRank);
    displayScoreCard('prediction', score, analysis, filterResult, gradeResult);
    document.getElementById('predictionAnalysisContent').innerHTML = renderDetailedAnalysis(analysis);
    const matching = item.numbers.filter(n => (currentWinningNumbers || []).includes(n));
    if (matching.length > 0) {
        document.getElementById('matchCount').textContent = matching.length;
        renderBalls(matching, 'matchingBalls');
        document.getElementById('matchingSection').classList.remove('hidden');
    } else { document.getElementById('matchingSection').classList.add('hidden'); }
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
    saved.unshift({ date: new Date().toLocaleString('ko-KR'), round: currentRound || '-', numbers, meta: `스마트 추천 | ${meta}`, score, grade: score >= 70 ? '최상' : score >= 50 ? '양호' : '보통' });
    if (saved.length > 50) saved.length = 50;
    localStorage.setItem('lotto-predictions', JSON.stringify(saved));
    loadSavedPredictions();
    showStatus('success', '💾 스마트 추천 결과가 저장되었습니다!');
    playBeep(600, 0.08);
}

async function exportPrediction() {
    const predictionBalls = document.getElementById('predictionBalls');
    if (!predictionBalls || predictionBalls.children.length === 0) return;
    const numbers = [...predictionBalls.querySelectorAll('.ball')].map(b => b.textContent).join(', ');
    const meta = document.getElementById('predictionMeta')?.textContent || '';
    const score = document.getElementById('predictionScore')?.textContent || '-';
    const grade = document.getElementById('predictionScoreGrade')?.textContent || '';
    const text = `🎱 로또 645 AI 예측 번호\n━━━━━━━━━━━━━━\n📌 예측 번호: ${numbers}\n📊 품질 점수: ${score}점 (${grade})\n📝 기준: ${meta}\n━━━━━━━━━━━━━━\n🔗 https://123lotto.co.kr`;
    await copyToClipboard(text);
    showStatus('success', '📋 클립보드에 복사되었습니다!');
}

function handleSharedPrediction() {
    const params = new URLSearchParams(window.location.search);
    const predStr = params.get('pred');
    if (!predStr) return;
    const nums = predStr.split(/[,·\s]+/).map(Number).filter(n => n >= 1 && n <= 45);
    if (nums.length !== 6 || new Set(nums).size !== 6) return;
    nums.sort((a, b) => a - b);
    const banner = document.createElement('div');
    banner.className = 'card';
    banner.style.cssText = 'background:linear-gradient(135deg,rgba(139,92,246,0.2),rgba(0,245,255,0.15));border:1px solid rgba(139,92,246,0.4);margin-bottom:20px;text-align:center;';
    banner.innerHTML = `
        <div class="card-header" style="justify-content:center;"><div class="card-icon" style="background:linear-gradient(135deg,#8b5cf6,#00f5ff);">📤</div><h2 class="card-title">공유받은 예측 번호</h2></div>
        <div class="balls-container" style="padding:15px 0;gap:8px;">${nums.map(n => `<span class="ball ${getBallClass(n)}" style="width:48px;height:48px;line-height:48px;font-size:1rem;">${n}</span>`).join('')}</div>
        <p class="text-secondary mb-15" style="font-size:0.9rem;">친구가 공유한 번호예요. 이 번호로 분석을 시작해보세요!</p>
        <button class="btn btn-primary" id="useSharedPredBtn" style="margin-bottom:15px;">🎯 이 번호로 AI 예측 시작하기</button>
        <button class="btn btn-secondary" id="dismissSharedPredBtn" style="margin-bottom:10px;">✕ 닫기</button>
    `;
    const container = document.querySelector('.container');
    if (container) container.insertBefore(banner, container.firstChild);
    banner.querySelector('#useSharedPredBtn').onclick = () => {
        banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
        document.getElementById('roundInput')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (typeof setWinningNumbers === 'function') {
            setWinningNumbers(nums, null, '공유받은 번호', '공유 링크');
        }
        setTimeout(() => {
            const aiCard = document.getElementById('aiReady')?.closest('.card');
            if (aiCard) aiCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 800);
        banner.style.opacity = '0.6';
        banner.querySelector('#useSharedPredBtn').disabled = true;
    };
    banner.querySelector('#dismissSharedPredBtn').onclick = () => banner.remove();
    // URL에서 pred 파라미터 제거
    if (window.history.replaceState) {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
    }
}

function calculateLatestRound() {
    const now = new Date();
    const kstNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 9 * 3600000);
    const kstDay = kstNow.getUTCDay();
    const kstHours = kstNow.getUTCHours();
    const firstDraw = Date.UTC(2002, 11, 7, 12, 0, 0);
    let lastDraw;
    if (kstDay === 6 && kstHours >= 21) {
        lastDraw = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate(), 12, 0, 0);
    } else {
        const daysSinceSat = kstDay === 6 ? 7 : kstDay + 1;
        const prev = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate(), 12, 0, 0));
        prev.setUTCDate(prev.getUTCDate() - daysSinceSat);
        lastDraw = prev.getTime();
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

// ========== 서버리스 API 다중 폴백 ==========
function extractLottoNumbersFromHtml(html) {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ');
    const normalized = text.replace(/['']/g, "'");
    const num6Match = normalized.match(/(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})/);
    if (!num6Match) return null;
    const nums = [parseInt(num6Match[1]), parseInt(num6Match[2]), parseInt(num6Match[3]), parseInt(num6Match[4]), parseInt(num6Match[5]), parseInt(num6Match[6])];
    if (!nums.every(n => n >= 1 && n <= 45) || new Set(nums).size !== 6) return null;
    const after = normalized.substring(num6Match.index + num6Match[0].length, num6Match.index + num6Match[0].length + 200);
    let bonus = null;
    const bonusPatterns = [/보너스[^0-9]*(\d{1,2})/, /보너스[^0-9]*'(\d{1,2})'/, /bonus[^0-9]*(\d{1,2})/i];
    for (const bp of bonusPatterns) {
        const bm = after.match(bp);
        if (bm) { const bn = parseInt(bm[1]); if (bn >= 1 && bn <= 45 && !nums.includes(bn)) { bonus = bn; break; } }
    }
    return { numbers: nums.sort((a, b) => a - b), bonus };
}

const CORS_PROXIES = [
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url='
];

async function fetchLottoFromProxy(roundNo) {
    const url = `https://search.naver.com/search.naver?where=nexearch&query=${roundNo}%ED%9A%8C%20%EB%A1%9C%EB%98%90%20%EB%8B%B9%EC%B2%A8%EB%B2%88%ED%98%B8`;
    for (const proxy of CORS_PROXIES) {
        try {
            const resp = await fetch(proxy + encodeURIComponent(url), { signal: AbortSignal.timeout(10000) });
            if (resp.ok) {
                const html = await resp.text();
                const result = extractLottoNumbersFromHtml(html);
                if (result) return result;
            }
        } catch (e) { continue; }
    }
    return null;
}

async function fetchWinningNumbers() {
    if (isFetching) return;
    const roundNo = parseInt(document.getElementById('roundInput').value);
    if (!roundNo || roundNo < 1) { showStatus('error', '올바른 회차를 입력해주세요.'); return; }
    isFetching = true;
    const btn = document.querySelector('#fetchBtn');
    try {
        if (!btn) return;
        btn.disabled = true;
        btn.textContent = '⏳ 조회 중...';
        const dbResult = findRoundInDb(roundNo);
        if (dbResult) {
            setWinningNumbers(dbResult.numbers, dbResult.bonus, roundNo, '내장 DB');
            showStatus('success', `✅ 제 ${roundNo}회 당첨번호 (내장 DB)`);
            return;
        }
        showStatus('info', '🔍 당첨번호 조회 중...');
        const localResult = await fetchFromLocalProxy(roundNo);
        if (localResult) {
            setWinningNumbers(localResult.numbers, localResult.bonus, roundNo, '네이버 검색');
            showStatus('success', '✅ 조회 성공!');
            return;
        }
        // 서버리스 CORS 프록시 폴백
        showStatus('info', '🔍 CORS 프록시로 조회 중...');
        const proxyResult = await fetchLottoFromProxy(roundNo);
        if (proxyResult) {
            setWinningNumbers(proxyResult.numbers, proxyResult.bonus, roundNo, 'CORS 프록시');
            showStatus('success', '✅ 조회 성공! (프록시)');
            return;
        }
        showStatus('warning', '⚠️ DB에 없는 회차입니다. 아래에서 직접 번호를 선택해주세요.');
        document.getElementById('manualInputSection').classList.add('open');
    } finally {
        if (btn) finishFetch(btn);
    }
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

    // 퍼널: 당첨번호 조회 완료 → AI 예측 카드로 스크롤
    setTimeout(() => {
        const aiCard = document.getElementById('aiReady').closest('.card');
        if (aiCard) aiCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const aiModeSim = document.getElementById('aiModeSimulation');
        if (aiModeSim) aiModeSim.classList.add('funnel-highlight');
        setTimeout(() => aiModeSim && aiModeSim.classList.remove('funnel-highlight'), 2000);
    }, 600);

    // 퍼널: 시뮬레이션 완료 시 회고 제안 (showPredictionResult에서 사용할 round 저장)
    if (typeof trackMission === 'function') trackMission('view_winning');
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

// ========== 보너스 번호 수동 입력 ==========
let selectedBonusNumber = null;

function applyManualNumbers() {
    if (selectedManualNumbers.length !== 6) return;
    const round = document.getElementById('roundInput').value || '수동입력';
    const nums = [...selectedManualNumbers].sort((a, b) => a - b);
    setWinningNumbers(nums, selectedBonusNumber, round, '수동입력');
    showStatus('success', '✅ 수동 입력 적용 완료!');
    document.getElementById('manualInputSection').classList.remove('open');
}

function selectBonusNumber(num, btn) {
    document.querySelectorAll('.bonus-btn.selected-bonus').forEach(b => b.classList.remove('selected-bonus'));
    if (selectedBonusNumber === num) {
        selectedBonusNumber = null;
    } else {
        selectedBonusNumber = num;
        btn.classList.add('selected-bonus');
    }
    updateBonusDisplay();
}

function updateBonusDisplay() {
    const display = document.getElementById('bonusSelectedDisplay');
    if (display) {
        display.innerHTML = selectedBonusNumber
            ? `<span class="ball bonus" style="width:36px;height:36px;line-height:36px;font-size:0.85rem;">${selectedBonusNumber}</span><span style="font-size:0.8rem;color:var(--text-secondary);margin-left:5px;">보너스 번호</span>`
            : '<span style="font-size:0.8rem;color:var(--text-secondary);">보너스 번호 미선택</span>';
    }
}

function preventRefresh(e) { e.preventDefault(); e.returnValue = ''; }

// ========== 회차 비교 ==========
let compareRoundData = null;

async function compareRounds() {
    if (!currentWinningNumbers) { showStatus('warning', '⚠️ 먼저 기준 회차의 당첨번호를 조회해주세요.'); return; }
    const compareRound = parseInt(document.getElementById('compareRoundInput').value);
    if (!compareRound || compareRound < 1) { showStatus('error', '비교할 회차를 입력해주세요.'); return; }
    showStatus('info', '🔍 비교 회차 조회 중...');
    const dbResult = findRoundInDb(compareRound);
    if (dbResult) {
        compareRoundData = { numbers: dbResult.numbers, bonus: dbResult.bonus, round: compareRound };
        renderComparison(dbResult.numbers, dbResult.bonus, compareRound);
        showStatus('success', `✅ ${compareRound}회차 비교 분석 완료!`);
        return;
    }
    let result = await fetchFromLocalProxy(compareRound);
    if (!result) { result = await fetchLottoFromProxy(compareRound); }
    if (!result) { showStatus('error', '❌ 비교 회차 조회에 실패했습니다. 내장 DB에 없는 회차입니다.'); return; }
    compareRoundData = { numbers: result.numbers, bonus: result.bonus, round: compareRound };
    renderComparison(result.numbers, result.bonus, compareRound);
    showStatus('success', `✅ ${compareRound}회차 비교 분석 완료!`);
}

function renderComparison(compareNums, compareBonus, compareRound) {
    const currentNums = currentWinningNumbers;
    const currentAnalysis = analyzeNumbers(currentNums);
    const compareAnalysis = analyzeNumbers(compareNums);
    const common = currentNums.filter(n => compareNums.includes(n));
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
                <div style="text-align:center;"><div style="font-size:0.75rem;color:var(--text-secondary);">합계 변화</div><div style="font-size:1.2rem;color:${sumDiff > 0 ? 'var(--accent-pink)' : sumDiff < 0 ? 'var(--accent-cyan)' : 'var(--text-secondary)'};">${sumDiff > 0 ? '+' : ''}${sumDiff}</div></div>
                <div style="text-align:center;"><div style="font-size:0.75rem;color:var(--text-secondary);">AC값 변화</div><div style="font-size:1.2rem;color:${acDiff > 0 ? 'var(--grade-excellent)' : acDiff < 0 ? 'var(--grade-caution)' : 'var(--text-secondary)'};">${acDiff > 0 ? '+' : ''}${acDiff}</div></div>
                <div style="text-align:center;"><div style="font-size:0.75rem;color:var(--text-secondary);">홀짝 (기준 → 비교)</div><div style="font-size:1.2rem;color:var(--accent-cyan);">${currentAnalysis.oddEvenRatio} → ${compareAnalysis.oddEvenRatio}</div></div>
                <div style="text-align:center;"><div style="font-size:0.75rem;color:var(--text-secondary);">고저 (기준 → 비교)</div><div style="font-size:1.2rem;color:var(--accent-cyan);">${currentAnalysis.lowHighRatio} → ${compareAnalysis.lowHighRatio}</div></div>
            </div>
        </div>
        <div style="margin-top:15px;background:${common.length > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(100,100,100,0.1)'};padding:15px;border-radius:12px;text-align:center;">
            <h4 style="color:var(--accent-gold);margin-bottom:10px;">🔗 공통 번호 (${common.length}개)</h4>
            ${common.length > 0 ? `<div class="balls-container" style="padding:10px 0;">${common.map(n => `<span class="ball ${getBallClass(n)}" style="width:42px;height:42px;line-height:42px;">${n}</span>`).join('')}</div><div style="font-size:0.85rem;color:var(--text-secondary);margin-top:8px;">💡 두 회차에 걸쳐 나타난 번호입니다. 로또는 독립시행이지만 참고 자료로 활용하세요.</div>` : '<div style="color:var(--text-secondary);">공통 번호가 없습니다.</div>'}
        </div>
        <div style="margin-top:15px;font-size:0.85rem;color:var(--text-secondary);text-align:center;padding:10px;background:rgba(0,0,0,0.2);border-radius:10px;">💡 <strong>참고:</strong> 로또는 매 회차 완전 독립된 확률 게임입니다.<br>이전 회차의 번호가 다음 회차에 영향을 미치지 않습니다.</div>
    `;
    document.getElementById('comparisonResult').classList.remove('hidden');
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
    if (!lottoDb || lottoDb.length === 0) { showStatus('warning', '⚠️ DB 데이터가 필요합니다.'); return; }
    if (typeof trackRetroUse === 'function') trackRetroUse();
    const input = document.getElementById('retroInput').value.trim();
    const nums = input.split(/[,·\s]+/).map(Number).filter(n => n >= 1 && n <= 45);
    if (nums.length !== 6 || new Set(nums).size !== 6) { showStatus('error', '올바른 6개 번호를 입력해주세요.'); return; }
    nums.sort((a, b) => a - b);
    const oneYearAgo = lottoDb.length >= 52 ? lottoDb.length - 52 : 0;
    const recentRounds = lottoDb.slice(oneYearAgo);
    const results = { round5: [], round4: [], round3: [] };
    let totalSpent = 0;
    recentRounds.forEach(entry => {
        if (!entry.numbers) return;
        totalSpent += 1000;
        const matches = nums.filter(n => entry.numbers.includes(n));
        const bonusMatch = entry.bonus && nums.includes(entry.bonus);
        if (matches.length === 6) results.round5.push({ ...entry, match: 6, grade: '1등' });
        else if (matches.length === 5 && bonusMatch) results.round5.push({ ...entry, match: 6, grade: '2등' });
        else if (matches.length === 5) results.round4.push({ ...entry, match: 5, grade: '3등' });
        else if (matches.length === 4) results.round3.push({ ...entry, match: 4, grade: '4등' });
        else if (matches.length === 3) results.round3.push({ ...entry, match: 3, grade: '5등' });
    });
    const prizeEstimate = { '1등': 2000000000, '2등': 50000000, '3등': 1500000, '4등': 50000, '5등': 5000 };
    let totalPrize = 0;
    [...results.round5, ...results.round4, ...results.round3].forEach(r => { totalPrize += prizeEstimate[r.grade] || 0; });
    document.getElementById('retroContent').innerHTML = `
        <div style="text-align:center;margin-top:20px;">
            <div class="balls-container" style="padding:10px 0;">${nums.map(n => `<span class="ball ${getBallClass(n)}" style="width:48px;height:48px;line-height:48px;">${n}</span>`).join('')}</div>
            <p style="color:var(--text-secondary);margin-bottom:20px;">최근 ${recentRounds.length}회차 분석 (약 1년)</p>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px;">
                <div class="retro-stat"><div class="retro-stat-value" style="color:var(--accent-gold);">${totalSpent.toLocaleString()}원</div><div class="retro-stat-label">총 구매 금액</div></div>
                <div class="retro-stat"><div class="retro-stat-value" style="color:${totalPrize > totalSpent ? 'var(--grade-excellent)' : 'var(--grade-caution)'};">${totalPrize.toLocaleString()}원</div><div class="retro-stat-label">예상 당첨금</div></div>
                <div class="retro-stat"><div class="retro-stat-value" style="color:${totalPrize > totalSpent ? 'var(--grade-excellent)' : 'var(--grade-caution)'};">${totalPrize > totalSpent ? '+' : ''}${(totalPrize - totalSpent).toLocaleString()}원</div><div class="retro-stat-label">손익</div></div>
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
                            <div class="retro-item"><span class="prize-rank">${r.grade}</span><span>제 ${r.round}회</span><span class="balls-container" style="padding:5px 0;gap:4px;">${r.numbers.map(n => `<span class="ball ${getBallClass(n)}" style="width:28px;height:28px;line-height:28px;font-size:0.7rem;">${n}</span>`).join('')}</span>${r.bonus ? `<span class="ball bonus" style="width:28px;height:28px;line-height:28px;font-size:0.7rem;">${r.bonus}</span>` : ''}</div>
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
