// simulation.js - 몬테카를로 시뮬레이션 제어, Worker 통신, 진행률, 예측 결과

function startSimulation() {
    if (isSimulating) return;
    if (!currentWinningNumbers) { alert('먼저 당첨번호를 설정해주세요!'); return; }
    if (typeof trackPrediction === 'function') trackPrediction();
    if (typeof Worker === 'undefined') { alert('이 브라우저는 시뮬레이션을 지원하지 않습니다.'); return; }
    const maxIterations = parseInt(document.getElementById('iterationSelect').value);
    document.getElementById('startSimBtn').classList.add('hidden');
    document.getElementById('stopSimBtn').classList.remove('hidden');
    document.getElementById('simProgress').classList.remove('hidden');
    document.getElementById('predictionResult').classList.add('hidden');
    document.getElementById('simRunningBanner').classList.remove('hidden');
    predictions = []; isSimulating = true;
    window.addEventListener('beforeunload', preventRefresh);
    window.addEventListener('pagehide', cleanupSimulation);

    const expectedMatches = (maxIterations / LOTTO_TOTAL_COMBINATIONS).toFixed(1);
    document.getElementById('expectedMatches').textContent = `약 ${expectedMatches}회`;
    document.getElementById('simNote').textContent = `${formatNumber(maxIterations)}회 시뮬레이션 중 약 ${expectedMatches}회 패턴 발견 예상`;

    simulationWorker = new Worker('worker.js');
    simulationWorker.onerror = function(err) {
        console.error('Worker error:', err);
        showStatus('error', '시뮬레이션 Worker 로드 실패. 페이지를 새로고침해주세요.');
        stopSimulation();
    };
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
    document.getElementById('simRunningBanner').classList.add('hidden');
    showStatus('warning', '⏹️ 시뮬레이션이 중지되었습니다.');
}

function cleanupSimulation() {
    if (simulationWorker) { simulationWorker.terminate(); simulationWorker = null; }
    isSimulating = false;
    document.getElementById('simRunningBanner').classList.add('hidden');
}

function updateProgress(data) {
    const { attempts, progress, speed, elapsed, matchCount } = data;
    document.getElementById('progressBar').style.width = `${progress * 100}%`;
    document.getElementById('progressText').textContent = `${(progress * 100).toFixed(1)}% 완료 (${formatNumber(attempts)}회)`;
    document.getElementById('statAttempts').textContent = formatNumber(attempts);
    document.getElementById('statSpeed').textContent = formatNumber(speed);
    document.getElementById('statMatches').textContent = matchCount;
    document.getElementById('statTime').textContent = `${elapsed.toFixed(1)}s`;

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
    document.getElementById('simRunningBanner').classList.add('hidden');
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

    const crossResult = crossMatchAllHistory(prediction);
    const top3 = findTop3SimilarRounds(prediction);
    const recent5 = runRecentMatchSimulation(prediction);
    updateAdvancedAnalysis('prediction', crossResult, top3, recent5, percentileRank);

    document.getElementById('predictionAnalysisContent').innerHTML = renderDetailedAnalysis(analysis);

    const matching = prediction.filter(n => (currentWinningNumbers || []).includes(n));
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

const PRED_PAGE_SIZE = 5;
let predVisibleCount = 0;

function updatePredictionList() {
    document.getElementById('predictionCount').textContent = predictions.length;
    predVisibleCount = PRED_PAGE_SIZE;
    renderPredictionPage();
}

function renderPredictionPage() {
    const list = document.getElementById('predictionList');
    // 최초 로드 시에만 초기화
    if (predVisibleCount <= PRED_PAGE_SIZE) list.innerHTML = '';

    const startIdx = Math.max(0, predVisibleCount - PRED_PAGE_SIZE);
    const pageItems = predictions.slice(startIdx, predVisibleCount);
    pageItems.forEach((pred, relIdx) => {
        const index = startIdx + relIdx;
        const existing = document.getElementById('predCard' + index);
        if (existing) return; // 이미 렌더링된 항목은 건너뜀
        const item = document.createElement('div');
        item.className = 'prediction-item-expanded';
        const ballsHtml = pred.prediction.map(n => `<span class="ball ${getBallClass(n)}" style="width:40px;height:40px;line-height:40px;font-size:0.9rem;">${n}</span>`).join('');
        const matching = pred.prediction.filter(n => (currentWinningNumbers || []).includes(n));
        const analysis = analyzeNumbers(pred.prediction);
        const score = calculateQualityScore(analysis);

        let gradeInfo = '', gradeClass = '';
        const bonusMatch = currentBonusNumber && pred.prediction.includes(currentBonusNumber);
        if (matching.length >= 6) { gradeInfo = '🏆 1등'; gradeClass = 'grade-jackpot'; }
        else if (matching.length === 5 && bonusMatch) { gradeInfo = '🥈 2등'; gradeClass = 'grade-jackpot'; }
        else if (matching.length === 5) { gradeInfo = '🥉 3등'; gradeClass = 'grade-high'; }
        else if (matching.length === 4) { gradeInfo = '4등'; gradeClass = 'grade-mid'; }
        else if (matching.length === 3) { gradeInfo = '5등'; gradeClass = 'grade-low'; }
        else { gradeInfo = '-'; gradeClass = ''; }

        item.innerHTML = `
            <div class="pred-card" id="predCard${index}">
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

                <div style="display:flex;gap:8px;justify-content:center;padding:0 20px 12px;">
                    <button class="btn btn-secondary" style="padding:6px 12px;font-size:0.8rem;" onclick="event.stopPropagation();shareSmartPrediction([${pred.prediction}], ${score.totalScore})">📤 공유</button>
                    <button class="btn btn-secondary" style="padding:6px 12px;font-size:0.8rem;" onclick="event.stopPropagation();saveSimPrediction([${pred.prediction}], ${score.totalScore}, '${score.grade}', ${pred.attempt}, '${pred.time.toFixed(1)}')">💾 저장</button>
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

    // "더보기" 버튼
    const existingBtn = document.getElementById('loadMoreBtn');
    if (existingBtn) existingBtn.remove();

    if (predVisibleCount < predictions.length) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.id = 'loadMoreBtn';
        loadMoreBtn.className = 'btn btn-secondary';
        loadMoreBtn.style.cssText = 'width:100%;margin-top:12px;justify-content:center;';
        loadMoreBtn.textContent = `📋 더보기 (${predVisibleCount}/${predictions.length})`;
        loadMoreBtn.onclick = () => {
            predVisibleCount = Math.min(predictions.length, predVisibleCount + PRED_PAGE_SIZE);
            renderPredictionPage();
        };
        list.appendChild(loadMoreBtn);
    }

    // "전체 접기" 버튼
    if (predictions.length > PRED_PAGE_SIZE && !document.getElementById('collapseAllBtn')) {
        const collapseBtn = document.createElement('button');
        collapseBtn.id = 'collapseAllBtn';
        collapseBtn.className = 'btn btn-secondary';
        collapseBtn.style.cssText = 'width:100%;margin-top:6px;justify-content:center;font-size:0.85rem;';
        collapseBtn.textContent = '🔼 목록 접기';
        collapseBtn.onclick = () => {
            predVisibleCount = PRED_PAGE_SIZE;
            renderPredictionPage();
            collapseBtn.remove();
        };
        list.appendChild(collapseBtn);
    }
}

function togglePredictionDetail(index) {
    const detail = document.getElementById('predDetail' + index);
    const icon = document.getElementById('expandIcon' + index);
    const text = document.getElementById('toggleText' + index);

    if (!detail) return;

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

function setupPredictionToggleEvents() {
    document.body.addEventListener('click', handleToggleClick, false);
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
        if (index != null) togglePredictionDetail(parseInt(index));
    }
    touchStartTarget = null;
}

function handleToggleClick(e) {
    const toggleBtn = e.target.closest('.pred-toggle-btn');
    if (toggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        const index = toggleBtn.getAttribute('data-index');
        if (index !== null && index !== undefined) togglePredictionDetail(parseInt(index));
        return;
    }
}

// ========== AI 모드 전환 ==========
function switchAiMode(mode) {
    document.querySelectorAll('.ai-mode-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.ai-mode-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.ai-mode-tab[data-mode="${mode}"]`).classList.add('active');
    document.getElementById('aiMode' + mode.charAt(0).toUpperCase() + mode.slice(1)).classList.add('active');
    if (mode === 'custom' && !document.getElementById('excludeGrid')?.children.length) {
        initExcludeGrid();
    }
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
        const fixedBtn = document.querySelector(`.fixed-btn[data-num="${num}"]`);
        if (fixedBtn) fixedBtn.disabled = false;
    } else if (excludedNumbers.size < 20) {
        excludedNumbers.add(num);
        btn.classList.add('excluded');
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
    if (typeof trackPrediction === 'function') trackPrediction();
    const count = parseInt(document.getElementById('customCount').value);

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
            w += (4 - numScores[n].recScore) * 2;
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
    const customHeader = document.querySelector('#customResult h4');
    if (customHeader && !document.getElementById('customShareAllBtn')) {
        const allBtn = document.createElement('button');
        allBtn.id = 'customShareAllBtn';
        allBtn.className = 'btn btn-secondary';
        allBtn.style.cssText = 'padding:6px 14px;font-size:0.8rem;margin-left:12px;';
        allBtn.textContent = '📤 전체 공유';
        allBtn.onclick = () => shareAllCombos(combos);
        customHeader.appendChild(allBtn);
    }
}

// ========== 스마트 추천 ==========
function runSmartRecommend() {
    if (!dbStats) {
        showStatus('warning', '⚠️ 통계 DB가 로드되지 않았습니다.');
        return;
    }
    if (!currentWinningNumbers) {
        showStatus('warning', '⚠️ 먼저 당첨번호를 설정해주세요.');
        return;
    }
    if (typeof trackPrediction === 'function') trackPrediction();

    const recommendations = generateSmartRecommendation(10);
    const list = document.getElementById('smartRecommendList');
    list.innerHTML = recommendations.map((rec, i) => {
        const matching = rec.numbers.filter(n => (currentWinningNumbers || []).includes(n));
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
    const smartHeader = document.querySelector('#smartResult h4');
    if (smartHeader && !document.getElementById('smartShareAllBtn')) {
        const allBtn = document.createElement('button');
        allBtn.id = 'smartShareAllBtn';
        allBtn.className = 'btn btn-secondary';
        allBtn.style.cssText = 'padding:6px 14px;font-size:0.8rem;margin-left:12px;';
        allBtn.textContent = '📤 전체 공유';
        allBtn.onclick = () => shareAllCombos(recommendations);
        smartHeader.appendChild(allBtn);
    }
    vibrate(30);
    showStatus('success', `✅ ${recommendations.length}개의 스마트 추천 조합을 생성했습니다!`);
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

function saveSimPrediction(numbers, score, grade, attempts, elapsed) {
    const saved = getSavedPredictions();
    saved.unshift({
        date: new Date().toLocaleString('ko-KR'),
        round: currentRound || '-',
        numbers,
        meta: `시뮬레이션 | ${formatNumber(attempts)}회 중 발견 (${elapsed}초)`,
        score,
        grade
    });
    if (saved.length > 50) saved.length = 50;
    localStorage.setItem('lotto-predictions', JSON.stringify(saved));
    loadSavedPredictions();
    showStatus('success', '💾 시뮬레이션 결과가 저장되었습니다!');
    playBeep(600, 0.08);
}
