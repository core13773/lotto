let currentWinningNumbers = null, currentBonusNumber = null, currentRound = null, selectedManualNumbers = [], simulationWorker = null, predictions = [], isSimulating = false, isFetching = false;
const CORS_PROXIES = [];
// 로컬 프록시 서버 (node server.js 실행 시 사용 가능)
// GitHub Pages 등 정적 호스팅에서는 수동 입력을 사용하세요.
const LOCAL_PROXY = 'http://localhost:3456';
// 참고: corsproxy.io는 유료화, codetabs.com은 작동 중단됨
// 필요시 추가 프록시: 'https://proxy.cors.sh/' (API 키 필요)
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
    } catch (e) {}
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
    try { localStorage.setItem('lotto-theme', next); } catch (e) {}

    // 버튼 아이콘 즉시 변경 (시각적 피드백)
    const btn = document.querySelector('.theme-toggle');
    if (btn) btn.textContent = next === 'light' ? '☀️' : '🌓';
}

function loadTheme() {
    let saved;
    try { saved = localStorage.getItem('lotto-theme'); } catch (e) { saved = null; }
    saved = saved || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    // 초기 아이콘 설정
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
                        <button class="btn btn-secondary" style="padding:6px 12px;font-size:0.8rem;" onclick="loadSavedPrediction(${index})">📋 불러오기</button>
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
    displayScoreCard('prediction', score, analysis);
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

// ========== 내보내기 ==========
async function exportPrediction() {
    const predictionBalls = document.getElementById('predictionBalls');
    if (!predictionBalls || predictionBalls.children.length === 0) return;

    const numbers = [...predictionBalls.querySelectorAll('.ball')].map(b => b.textContent).join(', ');
    const meta = document.getElementById('predictionMeta')?.textContent || '';
    const score = document.getElementById('predictionScore')?.textContent || '-';
    const grade = document.getElementById('predictionScoreGrade')?.textContent || '';

    const text = `🎱 로또 645 AI 예측 번호\n━━━━━━━━━━━━━━\n📌 예측 번호: ${numbers}\n📊 품질 점수: ${score}점 (${grade})\n📝 기준: ${meta}\n━━━━━━━━━━━━━━\n🔗 https://lotto645.app`;

    try {
        await navigator.clipboard.writeText(text);
        showStatus('success', '📋 클립보드에 복사되었습니다!');
    } catch (e) {
        // 클립보드 API 실패 시 텍스트 영역으로 폴백
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showStatus('success', '📋 클립보드에 복사되었습니다!');
    }
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
    if (!touchStartTarget || touchStartTarget !== e.target) {
        touchStartTarget = null;
        return;
    }
    const toggleBtn = e.target.closest(".pred-toggle-btn");
    if (toggleBtn) {
        e.preventDefault();
        const index = toggleBtn.getAttribute("data-index");
        if (index !== null && index !== undefined) {
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

async function fetchWithProxy(url) {
    for (const proxy of CORS_PROXIES) {
        try {
            const response = await fetch(proxy + encodeURIComponent(url), { signal: AbortSignal.timeout(10000) });
            if (response.ok) return await response.text();
        } catch (e) { continue; }
    }
    return null;
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

async function fetchFromOfficial(roundNo) {
    const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${roundNo}`;
    try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (resp.ok) {
            const data = await resp.json();
            if (data.returnValue === 'success') {
                return {
                    numbers: [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6].sort((a, b) => a - b),
                    bonus: data.bnusNo
                };
            }
        }
    } catch (e) {}
    for (const proxy of CORS_PROXIES) {
        try {
            const resp = await fetch(proxy + encodeURIComponent(url), { signal: AbortSignal.timeout(10000) });
            if (resp.ok) {
                const data = await resp.json();
                if (data.returnValue === 'success') {
                    return {
                        numbers: [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6].sort((a, b) => a - b),
                        bonus: data.bnusNo
                    };
                }
            }
        } catch (e) { continue; }
    }
    return null;
}

function extractLottoNumbers(text) {
    // 보너스 번호 포함 7개 패턴 (6개 + 보너스)
    const patterns7 = [
        /(\d{1,2})\s*[,·\s]+\s*(\d{1,2})\s*[,·\s]+\s*(\d{1,2})\s*[,·\s]+\s*(\d{1,2})\s*[,·\s]+\s*(\d{1,2})\s*[,·\s]+\s*(\d{1,2})\s*[^\d]*\+?\s*보?너?스?\s*:?\s*(\d{1,2})/g,
        /(\d{1,2})\s*[,·\s]+\s*(\d{1,2})\s*[,·\s]+\s*(\d{1,2})\s*[,·\s]+\s*(\d{1,2})\s*[,·\s]+\s*(\d{1,2})\s*[,·\s]+\s*(\d{1,2})\s*[,·\s]+\s*(\d{1,2})/g
    ];
    const patterns6 = [/(\d{1,2})\s*[,·\s]+\s*(\d{1,2})\s*[,·\s]+\s*(\d{1,2})\s*[,·\s]+\s*(\d{1,2})\s*[,·\s]+\s*(\d{1,2})\s*[,·\s]+\s*(\d{1,2})/g];

    // 먼저 보너스 포함 7개 번호 패턴 시도
    for (const pattern of patterns7) {
        const matches = [...text.matchAll(pattern)];
        for (const match of matches) {
            const nums = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), parseInt(match[4]), parseInt(match[5]), parseInt(match[6])];
            const bonus = parseInt(match[7]);
            const allNums = [...nums, bonus];
            if (allNums.every(n => n >= 1 && n <= 45) && new Set(allNums).size === 7) {
                return { numbers: nums.sort((a, b) => a - b), bonus };
            }
        }
    }
    // 6개 번호만 있는 패턴
    for (const pattern of patterns6) {
        const matches = [...text.matchAll(pattern)];
        for (const match of matches) {
            const nums = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), parseInt(match[4]), parseInt(match[5]), parseInt(match[6])];
            if (nums.every(n => n >= 1 && n <= 45) && new Set(nums).size === 6) {
                return { numbers: nums.sort((a, b) => a - b), bonus: null };
            }
        }
    }
    return null;
}

async function fetchFromNaver(roundNo) {
    try {
        const html = await fetchWithProxy(`https://search.naver.com/search.naver?where=nexearch&query=${roundNo}회+로또+당첨번호`);
        if (html) return extractLottoNumbers(html);
    } catch (e) {}
    return null;
}

async function fetchFromDaum(roundNo) {
    try {
        const html = await fetchWithProxy(`https://search.daum.net/search?w=tot&q=${roundNo}회+로또+당첨번호`);
        if (html) return extractLottoNumbers(html);
    } catch (e) {}
    return null;
}

async function fetchFromNate(roundNo) {
    try {
        const html = await fetchWithProxy(`https://search.nate.com/search/all.html?q=${roundNo}회+로또+당첨번호`);
        if (html) return extractLottoNumbers(html);
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

    // 2. 로컬 프록시 서버 시도 (node server.js 실행 시)
    showStatus('info', '🔍 당첨번호 조회 중...');
    const localResult = await fetchFromLocalProxy(roundNo);
    if (localResult) {
        setWinningNumbers(localResult.numbers, localResult.bonus, roundNo, '네이버 검색');
        showStatus('success', '✅ 조회 성공!');
        finishFetch(btn);
        return;
    }

    // 3. 실패 시 수동 입력 안내
    showStatus('warning', '⚠️ 조회 실패. 프록시 서버가 실행 중인지 확인하거나 아래 수동 입력을 사용하세요.');
    document.getElementById('manualInputSection').classList.add('open');
    finishFetch(btn);
}

function finishFetch(btn) {
    isFetching = false;
    btn.disabled = false;
    btn.textContent = '🔍 조회';
}

function showPortalResults(results) {
    const container = document.getElementById('portalResultsList');
    container.innerHTML = '';
    results.forEach(r => {
        const div = document.createElement('div');
        div.className = 'portal-result';
        div.innerHTML = `<span class="portal-status">${r.success ? '✅' : '❌'}</span><span class="portal-name">${r.name}</span><span style="color:${r.success ? 'var(--accent-cyan)' : 'var(--text-secondary)'}">${r.success ? r.nums.join(', ') : (r.reason || '실패')}</span>`;
        container.appendChild(div);
    });
    document.getElementById('portalResults').classList.remove('hidden');
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
    displayScoreCard('winning', score, analysis);
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
    const isPrime = n => { if (n < 2) return false; for (let i = 2; i <= Math.sqrt(n); i++) if (n % i === 0) return false; return true; };
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
function displayScoreCard(prefix, scoreData, analysis) {
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
}

function getPercentile(score) {
    if (score >= 90) return '10';
    if (score >= 80) return '25';
    if (score >= 70) return '40';
    if (score >= 60) return '55';
    if (score >= 50) return '70';
    return '85';
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
    displayScoreCard('prediction', score, analysis);
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

function generateRandomNumbers() { const nums = [], pool = Array.from({length: 45}, (_, i) => i + 1); for (let i = 0; i < 6; i++) { const randomArray = new Uint32Array(1); crypto.getRandomValues(randomArray); const idx = randomArray[0] % pool.length; nums.push(pool.splice(idx, 1)[0]); } return nums.sort((a, b) => a - b); }
function showStatus(type, message) { const container = document.getElementById('fetchStatus'); container.className = `status ${type}`; container.textContent = message; container.classList.remove('hidden'); }
function toggleCollapsible(id) { document.getElementById(id).classList.toggle('open'); }
function preventRefresh(e) { e.preventDefault(); e.returnValue = ''; }
function formatNumber(num) { if (num >= 100000000) return (num / 100000000).toFixed(1) + '억'; if (num >= 10000) return (num / 10000).toFixed(0) + '만'; return num.toLocaleString(); }

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
