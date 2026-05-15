// fun2.js - Fun Zone 2: 가상추첨, 상식퀴즈, 당첨금쇼핑, 번호궁합, 운세달력, 내번호기록, 공유카드
// ========== 탭 전환 ==========
function switchFun2Tab(tabName) {
    // 이전 탭 정리
    if (typeof stopSoundtrack === 'function') stopSoundtrack();
    if (drawAnimId) { cancelAnimationFrame(drawAnimId); drawAnimId = null; }
    const drawBtn = document.getElementById('drawBtn');
    if (drawBtn) { drawBtn.disabled = false; drawBtn.textContent = '🎱 추첨 시작!'; }

    if (typeof _hook === 'function') _hook('switchFun2Tab', tabName);

    document.querySelectorAll('.fun2-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.fun2-tab-content').forEach(c => c.classList.remove('active'));
    const tabEl = document.querySelector(`.fun2-tab[data-fun2="${tabName}"]`);
    const contentEl = document.getElementById(`fun2Content${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    if (tabEl) tabEl.classList.add('active');
    if (contentEl) contentEl.classList.add('active');
    switch (tabName) {
        case 'draw': initDrawMachine(); break;
        case 'history': renderMyHistory(); break;
        case 'calendar': renderFortuneCalendar(); break;
    }
}

// ========== 1. 가상 추첨 시뮬레이터 ==========
let drawAnimId = null;

function initDrawMachine() {
    const el = document.getElementById('drawMachineContent');
    if (!el) return;
    el.innerHTML = `
        <div class="draw-machine">
            <canvas id="drawCanvas" width="520" height="440" class="draw-canvas"></canvas>
            <div class="draw-result" id="drawResult"></div>
            <button class="btn btn-gold" onclick="startDraw()" id="drawBtn" style="width:100%;justify-content:center;">🎱 추첨 시작!</button>
        </div>
    `;
    renderDrawBalls();
}

function renderDrawBalls() {
    const canvas = document.getElementById('drawCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.roundRect(10, 10, w - 20, h - 20, 20); ctx.fill();

    // 상단: 45개 공 (9×5 그리드)
    for (let i = 1; i <= 45; i++) {
        const row = Math.floor((i - 1) / 9);
        const col = (i - 1) % 9;
        const x = 30 + col * 52, y = 25 + row * 50;
        const cls = getBallClass(i);
        const colors = { yellow: ['#ffd700', '#b8860b'], blue: ['#60a5fa', '#1d4ed8'], red: ['#f87171', '#991b1b'], gray: ['#9ca3af', '#374151'], green: ['#34d399', '#065f46'] };
        const [c1, c2] = colors[cls] || colors.gray;
        const grad = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, 18);
        grad.addColorStop(0, c1); grad.addColorStop(1, c2);
        ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(i, x, y);
    }
}

function startDraw() {
    const canvas = document.getElementById('drawCanvas');
    const resultEl = document.getElementById('drawResult');
    const btn = document.getElementById('drawBtn');
    if (!canvas || !resultEl || !btn) return;

    if (drawAnimId) cancelAnimationFrame(drawAnimId);
    btn.disabled = true;
    btn.textContent = '🎱 추첨 중...';
    resultEl.innerHTML = '';

    // 공 생성
    const allBalls = [];
    for (let i = 1; i <= 45; i++) {
        allBalls.push({ num: i, x: 0, y: 0, vx: 0, vy: 0, selected: false, cls: getBallClass(i) });
    }
    // Fisher-Yates 셔플
    for (let i = allBalls.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allBalls[i], allBalls[j]] = [allBalls[j], allBalls[i]];
    }
    const selected = allBalls.slice(0, 7);
    const mainNums = selected.slice(0, 6);
    const bonusNum = selected[6];

    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = 380, cy = 100;    // 기계 중심 (우측 상단)
    const machineR = 90;

    let t = 0;
    const drawn = [];
    const drawnSet = new Set();

    function animate() {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.roundRect(10, 10, w - 20, h - 20, 20); ctx.fill();

        // 추첨기 원
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, machineR, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath(); ctx.arc(cx, cy, machineR, 0, Math.PI * 2); ctx.fill();

        // 나가는 통로 (우측 아래로)
        const tubeX = cx + machineR - 15, tubeY = cy + machineR - 5;
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(tubeX - 15, tubeY, 30, 60);
        // 통로 화살표
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('▼', tubeX, tubeY + 50);

        // 혼합 중인 공들
        const remaining = selected.filter(s => !drawnSet.has(s.num));
        const mixCount = remaining.length || 1;
        remaining.forEach((ball, i) => {
            const angle = (t * (0.5 + i * 0.3) + i * (Math.PI * 2 / mixCount)) % (Math.PI * 2);
            const r = machineR * 0.55 + Math.sin(t * 1.3 + i) * 18;
            ball.x = cx + Math.cos(angle) * r;
            ball.y = cy + Math.sin(angle) * r;
            drawBallAt(ctx, ball.x, ball.y, ball);
        });

        // 뽑힌 공들 (2열, 4+3 배열)
        drawn.forEach((ball, i) => {
            const bx = i < 4 ? tubeX - 20 : tubeX + 30;
            const by = tubeY + 75 + (i < 4 ? i : i - 4) * 38;
            drawBallAt(ctx, bx, by, ball, true);
        });

        // 결과에 공 추가
        if (drawn.length < 7) {
            const interval = drawn.length === 0 ? 120 : drawn.length === 6 ? 90 : 50 + drawn.length * 8;
            if (t > 60 && t % interval < 1 && remaining.length > 0) {
                const picked = remaining.shift();
                drawnSet.add(picked.num);
                drawn.push(picked);
                if (typeof vibrate === 'function') vibrate(30);
                if (typeof playBeep === 'function') playBeep(600 + drawn.length * 100, 0.1);
            }
        }

        t++;
        if (drawn.length >= 7 && t > 50 + 7 * 40 + 30) {
            // 완료
            cancelAnimationFrame(drawAnimId);
            const numsSorted = [...mainNums.map(b => b.num)].sort((a, b) => a - b);
            const bonusCls = getBallClass(bonusNum.num);
            resultEl.innerHTML = `
                <div class="draw-final-result">
                    <h4 style="color:var(--accent-gold);">🎉 추첨 완료!</h4>
                    <div class="balls-container">
                        ${numsSorted.map(n => `<span class="ball ${getBallClass(n)}">${n}</span>`).join('')}
                        <span class="plus-sign">+</span>
                        <span class="ball ${bonusCls}">${bonusNum.num}</span>
                    </div>
                </div>
            `;
            btn.disabled = false;
            btn.textContent = '🎱 다시 추첨!';
            return;
        }
        drawAnimId = requestAnimationFrame(animate);
    }
    drawAnimId = requestAnimationFrame(animate);
}

function drawBallAt(ctx, x, y, ball, highlight) {
    const r = highlight ? 20 : 15;
    const cls = ball.cls || 'gray';
    const colors = { yellow: ['#ffd700', '#b8860b'], blue: ['#60a5fa', '#1d4ed8'], red: ['#f87171', '#991b1b'], gray: ['#9ca3af', '#374151'], green: ['#34d399', '#065f46'] };
    const [c1, c2] = colors[cls] || colors.gray;
    const grad = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, r);
    grad.addColorStop(0, c1); grad.addColorStop(1, c2);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
    if (highlight) {
        ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.fillStyle = '#fff'; ctx.font = `bold ${highlight ? 13 : 10}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ball.num, x, y);
}

// ========== 2. 로또 상식 퀴즈 ==========
const LOTTO_QUIZ = [
    { q: '로또 6/45의 1등 당첨 확률은?', a: ['1/8,145,060', '1/1,000,000', '1/45,000,000', '1/6,000,000'], correct: 0, info: '8,145,060분의 1 — 벼락 맞을 확률보다 낮습니다.' },
    { q: '대한민국 로또 추첨은 언제 시작됐나요?', a: ['2000년', '2002년', '2005년', '1998년'], correct: 1, info: '2002년 12월 7일 첫 추첨이 시작됐습니다.' },
    { q: '로또 추첨 방송은 매주 언제 하나요?', a: ['금요일 저녁', '토요일 오후 8:45', '일요일 저녁', '토요일 오전'], correct: 1, info: 'MBC에서 매주 토요일 오후 8시 45분에 방송합니다.' },
    { q: '로또 1등 당첨금의 세율은 얼마인가요?', a: ['22%', '33%', '15.4%', '0% (비과세)'], correct: 1, info: '3억 초과분은 소득세 30% + 주민세 3% = 33%입니다.' },
    { q: '로또 번호 6개 중 숫자가 1~10 사이인 번호는 평균 몇 개일까요?', a: ['약 1.3개', '약 3개', '약 4.5개', '약 0.5개'], correct: 0, info: '45개 중 10개(22%)가 1~10 구간 → 6×22%=약 1.3개' },
    { q: '로또 추첨에서 가장 많이 나온 번호는? (2025년 기준)', a: ['34번', '27번', '1번', '17번'], correct: 0, info: '34번이 가장 높은 출현 빈도를 보이고 있습니다.' },
    { q: '로또 판매 수익금은 어디에 쓰일까요?', a: ['전액 국고 귀속', '법정배분 + 복권기금', '전액 당첨금', '운영사 수익'], correct: 1, info: '판매액의 42%는 복권기금으로 저소득층 지원 등 공익사업에 사용됩니다.' },
    { q: '한 회차에 6개 번호를 모두 맞추는 사람이 없으면 어떻게 되나요?', a: ['다음 회차로 이월', '소멸됨', '정부 귀속', '2등에게 분배'], correct: 0, info: '1등 당첨자가 없으면 해당 금액은 다음 회차로 이월됩니다.' },
];

function startLottoQuiz() {
    const el = document.getElementById('quiz2Content');
    if (!el) return;

    let qi = 0, score = 0;
    const questions = [...LOTTO_QUIZ].sort(() => Math.random() - 0.5).slice(0, 5);

    function show() {
        if (qi >= questions.length) {
            const pct = Math.round((score / questions.length) * 100);
            const grade = pct >= 80 ? '🏆 로또 박사!' : pct >= 60 ? '📚 꽤 아는 편!' : pct >= 40 ? '🤔 공부가 필요해요' : '🫣 초보자';
            el.innerHTML = `
                <div class="quiz2-result">
                    <div style="font-size:3rem;">${grade.split(' ')[0]}</div>
                    <h3 style="color:var(--accent-gold);">${grade}</h3>
                    <p class="text-secondary">${score} / ${questions.length} 정답 (${pct}점)</p>
                    <button class="btn btn-primary" onclick="startLottoQuiz()" style="width:100%;margin-top:15px;justify-content:center;">🔄 다시 도전</button>
                </div>
            `;
            return;
        }
        const q = questions[qi];
        el.innerHTML = `
            <div class="quiz2-card">
                <div class="quiz2-progress">${qi + 1} / ${questions.length}</div>
                <h3 class="quiz2-question">${q.q}</h3>
                <div class="quiz2-options">
                    ${q.a.map((ans, i) => `
                        <button class="quiz2-option" onclick="answerLottoQuiz(${i}, ${q.correct}, '${q.info.replace(/'/g, "\\'")}')">${ans}</button>
                    `).join('')}
                </div>
                <div id="quiz2Feedback" class="hidden" style="margin-top:12px;"></div>
            </div>
        `;
    }

    window.answerLottoQuiz = function(idx, correct, info) {
        const feedback = document.getElementById('quiz2Feedback');
        const isCorrect = idx === correct;
        if (isCorrect) score++;
        feedback.className = `quiz2-feedback ${isCorrect ? 'correct' : 'wrong'}`;
        feedback.innerHTML = `${isCorrect ? '✅ 정답!' : '❌ 오답!'} ${info}`;
        feedback.classList.remove('hidden');
        document.querySelectorAll('.quiz2-option').forEach((b, i) => {
            b.disabled = true;
            if (i === correct) b.style.background = 'rgba(16,185,129,0.3)';
            if (i === idx && !isCorrect) b.style.background = 'rgba(239,68,68,0.3)';
        });
        setTimeout(() => { qi++; show(); }, 1500);
    };

    show();
}

// ========== 3. 당첨금 쇼핑 시뮬레이터 ==========
function renderShoppingSim() {
    const el = document.getElementById('shoppingContent');
    if (!el) return;

    const items = [
        { name: '🍜 편의점 삼각김밥', price: 1200, icon: '🍙' },
        { name: '☕ 스타벅스 아메리카노', price: 4500, icon: '☕' },
        { name: '🍗 치킨', price: 20000, icon: '🍗' },
        { name: '👟 나이키 운동화', price: 150000, icon: '👟' },
        { name: '📱 갤럭시 스마트폰', price: 1500000, icon: '📱' },
        { name: '💻 맥북 프로', price: 3500000, icon: '💻' },
        { name: '🚗 현대 아반떼', price: 30000000, icon: '🚗' },
        { name: '🚙 제네시스 G80', price: 70000000, icon: '🚙' },
        { name: '🏠 수도권 아파트 (30평)', price: 900000000, icon: '🏠' },
        { name: '🏢 강남 아파트', price: 2500000000, icon: '🏢' },
    ];

    const prizes = [
        { tier: '5등', amount: 5000 },
        { tier: '4등', amount: 50000 },
        { tier: '3등', amount: 1500000 },
        { tier: '2등', amount: 50000000 },
        { tier: '1등', amount: 2000000000 },
    ];

    el.innerHTML = `
        <div class="shopping-tiers">
            ${prizes.map((p, i) => `
                <button class="shopping-tier-btn" onclick="selectPrizeTier(${p.amount}, '${p.tier}')">
                    <span class="shopping-tier-name">${p.tier}</span>
                    <span class="shopping-tier-amount">${p.amount.toLocaleString()}원</span>
                </button>
            `).join('')}
        </div>
        <div style="margin-top:10px;">
            <label style="color:var(--text-secondary);font-size:0.8rem;">💰 직접 입력:</label>
            <div class="input-group" style="margin-top:5px;">
                <input type="number" id="customPrizeInput" class="input-field" placeholder="금액 직접 입력 (원)" min="1000" step="1000" style="flex:1;">
                <button class="btn btn-primary" onclick="selectPrizeTier(parseInt(document.getElementById('customPrizeInput').value)||0, '직접입력')" style="white-space:nowrap;">🏪 쇼핑하기</button>
            </div>
        </div>
        <div id="shoppingResult" style="margin-top:15px;">
            <p class="text-secondary text-center">👆 당첨 등수를 선택하거나 금액을 입력하면<br>무엇을 살 수 있는지 알려드려요!</p>
        </div>
    `;
}

function selectPrizeTier(amount, tier) {
    const el = document.getElementById('shoppingResult');
    if (!el || amount <= 0) return;

    const items = [
        { name: '🍜 편의점 삼각김밥', price: 1200, icon: '🍙' },
        { name: '☕ 스타벅스 아메리카노', price: 4500, icon: '☕' },
        { name: '🍗 치킨', price: 20000, icon: '🍗' },
        { name: '👟 나이키 운동화', price: 150000, icon: '👟' },
        { name: '📱 갤럭시 스마트폰', price: 1500000, icon: '📱' },
        { name: '💻 맥북 프로', price: 3500000, icon: '💻' },
        { name: '🚗 현대 아반떼', price: 30000000, icon: '🚗' },
        { name: '🚙 제네시스 G80', price: 70000000, icon: '🚙' },
        { name: '🏠 수도권 아파트 (30평)', price: 900000000, icon: '🏠' },
        { name: '🏢 강남 아파트', price: 2500000000, icon: '🏢' },
    ];

    const taxRate = amount > 300000000 ? 0.33 : 0.22;
    const net = amount - Math.floor(amount * taxRate);

    const rows = items.map(item => {
        const count = Math.floor(net / item.price);
        return { ...item, count };
    }).filter(r => r.count > 0).slice(0, 6);

    el.innerHTML = `
        <div class="shopping-result-card">
            <div class="shopping-header">${tier} 당첨</div>
            <div class="shopping-net">실수령 <strong>${net.toLocaleString()}원</strong></div>
            <div class="shopping-tax">(세금 ${(taxRate*100).toFixed(0)}% 차감)</div>
            <div class="shopping-items">
                ${rows.map(r => `
                    <div class="shopping-item-row">
                        <span class="shopping-item-icon">${r.icon}</span>
                        <span class="shopping-item-name">${r.name}</span>
                        <span class="shopping-item-count">× <strong>${r.count.toLocaleString()}</strong>개</span>
                    </div>
                `).join('')}
            </div>
            ${rows.length === 0 ? '<p class="text-secondary text-center">구매 가능한 항목이 없어요 😅</p>' : ''}
        </div>
    `;
}

// ========== 4. 번호 궁합 테스트 ==========
function renderCompatibility() {
    const el = document.getElementById('compatibilityContent');
    if (!el) return;
    el.innerHTML = `
        <p class="text-secondary text-center mb-15">두 개의 번호 조합을 입력하면 궁합을 분석해드려요!</p>
        <div class="compat-inputs">
            <div class="compat-input-group">
                <label class="compat-label">🔢 첫 번째 조합</label>
                <input type="text" id="compatInput1" class="input-field" placeholder="예: 1,13,21,27,34,42">
            </div>
            <div class="compat-vs">VS</div>
            <div class="compat-input-group">
                <label class="compat-label">🔢 두 번째 조합</label>
                <input type="text" id="compatInput2" class="input-field" placeholder="예: 7,14,22,28,35,43">
            </div>
        </div>
        <button class="btn btn-primary" onclick="runCompatibility()" style="width:100%;margin-top:15px;justify-content:center;">💕 궁합 분석하기</button>
        <div id="compatResult" style="margin-top:15px;"></div>
    `;
}

function runCompatibility() {
    const parse = str => {
        const nums = (str || '').split(/[,·\s]+/).map(Number).filter(n => n >= 1 && n <= 45);
        return nums.length === 6 && new Set(nums).size === 6 ? nums.sort((a, b) => a - b) : null;
    };
    const a = parse(document.getElementById('compatInput1').value);
    const b = parse(document.getElementById('compatInput2').value);
    const el = document.getElementById('compatResult');
    if (!a || !b) { el.innerHTML = '<p class="text-secondary text-center">⚠️ 두 조합 모두 6개 번호를 올바르게 입력해주세요.</p>'; return; }

    const common = a.filter(n => b.includes(n));
    const sumA = a.reduce((s, n) => s + n, 0), sumB = b.reduce((s, n) => s + n, 0);
    const oddA = a.filter(n => n % 2 === 1).length, oddB = b.filter(n => n % 2 === 1).length;
    const lowA = a.filter(n => n <= 22).length, lowB = b.filter(n => n <= 22).length;

    // 궁합 점수 (100점 만점)
    let compatScore = 50; // 기본
    if (common.length === 0) compatScore += 15; // 겹치는 번호 없음 = 다양성 ↑
    else if (common.length === 1) compatScore += 5;
    else compatScore -= common.length * 10;

    const sumDiff = Math.abs(sumA - sumB);
    if (sumDiff < 20) compatScore += 15; // 비슷한 합계
    else if (sumDiff > 80) compatScore -= 10;

    const oddDiff = Math.abs(oddA - oddB);
    if (oddDiff <= 1) compatScore += 15; // 비슷한 홀짝 비율
    else compatScore -= 5 * oddDiff;

    const lowDiff = Math.abs(lowA - lowB);
    if (lowDiff <= 1) compatScore += 10;
    else compatScore -= 3 * lowDiff;

    compatScore = Math.max(0, Math.min(100, compatScore));
    const emoji = compatScore >= 80 ? '💖' : compatScore >= 60 ? '💛' : compatScore >= 40 ? '🤝' : '💔';
    const label = compatScore >= 80 ? '환상의 궁합!' : compatScore >= 60 ? '잘 맞아요' : compatScore >= 40 ? '나쁘지 않아요' : '글쎄요...';

    el.innerHTML = `
        <div class="compat-result-card">
            <div style="font-size:3rem;">${emoji}</div>
            <h3 style="color:var(--accent-gold);">궁합 점수: ${compatScore}점</h3>
            <p class="text-secondary">${label}</p>
            <div class="compat-details">
                <div class="compat-detail-row"><span>겹치는 번호</span><span>${common.length > 0 ? common.join(', ') : '없음 (다양성 ↑)'}</span></div>
                <div class="compat-detail-row"><span>합계 차이</span><span>${sumDiff} (A:${sumA} / B:${sumB})</span></div>
                <div class="compat-detail-row"><span>홀짝 비율</span><span>A: 홀${oddA} 짝${6-oddA} / B: 홀${oddB} 짝${6-oddB}</span></div>
                <div class="compat-detail-row"><span>저/고 비율</span><span>A: 저${lowA} 고${6-lowA} / B: 저${lowB} 고${6-lowB}</span></div>
            </div>
            <div class="balls-container">
                <div style="text-align:center;"><p class="text-xs-secondary">조합 A</p>${a.map(n => `<span class="ball ${getBallClass(n)}">${n}</span>`).join('')}</div>
            </div>
            <div class="balls-container">
                <div style="text-align:center;"><p class="text-xs-secondary">조합 B</p>${b.map(n => `<span class="ball ${getBallClass(n)}">${n}</span>`).join('')}</div>
            </div>
        </div>
    `;
}

// ========== 5. 운세 달력 ==========
function renderFortuneCalendar() {
    const el = document.getElementById('calendarContent');
    if (!el) return;

    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const today = now.getDate();

    // 결정론적 "행운도" (날짜 기반 시드)
    function luckyScore(d) {
        const seed = year * 10000 + (month + 1) * 100 + d;
        let x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
        return Math.abs(x - Math.floor(x));
    }

    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    let html = '<div class="fortune-calendar">';
    html += `<h4 style="color:var(--accent-gold);text-align:center;margin-bottom:10px;">📅 ${year}년 ${month + 1}월 행운 달력</h4>`;
    html += '<div class="fortune-weekdays">' + weekDays.map(d => `<span>${d}</span>`).join('') + '</div>';

    html += '<div class="fortune-grid">';
    for (let i = 0; i < firstDay; i++) html += '<div class="fortune-day empty"></div>';
    for (let d = 1; d <= lastDate; d++) {
        const score = luckyScore(d);
        const isToday = d === today;
        const level = score >= 0.8 ? 'jackpot' : score >= 0.6 ? 'great' : score >= 0.4 ? 'good' : score >= 0.2 ? 'normal' : 'low';
        const icons = { jackpot: '👑', great: '🌟', good: '🍀', normal: '😊', low: '🌧️' };
        html += `<div class="fortune-day ${level} ${isToday ? 'today' : ''}" title="행운도: ${(score*100).toFixed(0)}%">
            <span class="fortune-date">${d}</span>
            <span class="fortune-icon">${icons[level]}</span>
        </div>`;
    }
    html += '</div>';
    html += '<div class="fortune-legend">';
    ['jackpot', 'great', 'good', 'normal', 'low'].forEach(l => {
        html += `<span class="fortune-legend-item"><span class="fortune-dot ${l}"></span> ${l === 'jackpot' ? '최고의 날' : l === 'great' ? '행운' : l === 'good' ? '좋음' : l === 'normal' ? '보통' : '주의'}</span>`;
    });
    html += '</div></div>';

    // 오늘의 운세
    const todayScore = luckyScore(today);
    const todayLevel = todayScore >= 0.8 ? '👑 최고의 로또 운세! 꼭 구매하세요!' : todayScore >= 0.6 ? '🌟 행운이 함께하는 날! 기대해도 좋아요.' : todayScore >= 0.4 ? '🍀 무난한 날. 가볍게 한 장 어때요?' : todayScore >= 0.2 ? '😊 평범한 날. 기대는 접어두세요.' : '🌧️ 로또보다는 저축을 추천드려요.';

    html += `<div class="fortune-today"><span>오늘의 로또 운세</span><strong>${todayLevel}</strong></div>`;

    el.innerHTML = html;
}

// ========== 6. 나만의 번호 기록 ==========
function getMyHistory() {
    try { return JSON.parse(localStorage.getItem('lotto-my-numbers') || '[]'); } catch (e) { return []; }
}

function saveMyHistory(data) {
    try { localStorage.setItem('lotto-my-numbers', JSON.stringify(data)); } catch (e) {}
}

function addMyNumber(numbers, note) {
    const history = getMyHistory();
    history.unshift({ date: new Date().toISOString().slice(0, 10), numbers, note: note || '', round: currentRound || null });
    if (history.length > 200) history.length = 200;
    saveMyHistory(history);
    renderMyHistory();
}

function deleteMyNumber(idx) {
    const history = getMyHistory();
    history.splice(idx, 1);
    saveMyHistory(history);
    renderMyHistory();
}

function renderMyHistory() {
    const el = document.getElementById('historyContent');
    if (!el) return;
    const history = getMyHistory();

    el.innerHTML = `
        <div class="myhistory-add">
            <p class="text-secondary mb-15">구매했거나 관심 있는 번호를 기록하고, 당첨 여부를 확인해보세요.</p>
            <div class="input-group">
                <input type="text" id="myNumberInput" class="input-field" placeholder="6개 번호 (예: 1,13,21,27,34,42)">
                <button class="btn btn-primary" onclick="addMyNumberFromInput()" style="white-space:nowrap;">📝 기록</button>
            </div>
            <input type="text" id="myNumberNote" class="input-field" placeholder="메모 (선택사항, 예: 생일조합)" style="margin-top:8px;">
        </div>
        <div id="myHistoryList" style="margin-top:15px;">
            ${history.length === 0 ? '<p class="text-secondary text-center">아직 기록된 번호가 없어요.</p>' :
            history.map((h, i) => {
                const balls = h.numbers.map(n => `<span class="ball ${getBallClass(n)}" style="width:30px;height:30px;line-height:30px;font-size:0.65rem;">${n}</span>`).join('');
                const matchInfo = h.round && currentWinningNumbers && h.round === currentRound
                    ? (() => { const m = h.numbers.filter(n => currentWinningNumbers.includes(n)); return m.length > 0 ? `<span style="color:#10b981;">🎯 ${m.length}개 일치!</span>` : '<span style="color:var(--text-secondary);">미당첨</span>'; })()
                    : '';
                return `
                    <div class="myhistory-item">
                        <div class="myhistory-header">
                            <span class="myhistory-date">${h.date}</span>
                            ${h.round ? `<span class="myhistory-round">제${h.round}회</span>` : ''}
                            ${matchInfo}
                            <button class="btn btn-secondary" style="padding:2px 8px;font-size:0.7rem;" onclick="deleteMyNumber(${i})">✕</button>
                        </div>
                        <div class="balls-container" style="justify-content:flex-start;gap:4px;padding:5px 0;">${balls}</div>
                        ${h.note ? `<p class="text-xs-secondary">${h.note}</p>` : ''}
                    </div>
                `;
            }).join('')
            }
        </div>
        ${history.length > 0 ? `<button class="btn btn-secondary" onclick="checkAllMyHistory()" style="width:100%;margin-top:10px;justify-content:center;">🔍 전체 당첨 확인</button>` : ''}
        <div id="myHistoryCheckResult" style="margin-top:10px;"></div>
    `;
}

function addMyNumberFromInput() {
    const input = document.getElementById('myNumberInput');
    const note = document.getElementById('myNumberNote').value.trim();
    const nums = (input.value || '').split(/[,·\s]+/).map(Number).filter(n => n >= 1 && n <= 45);
    if (nums.length !== 6 || new Set(nums).size !== 6) {
        showStatus('warning', '⚠️ 6개의 올바른 번호를 입력해주세요.');
        return;
    }
    nums.sort((a, b) => a - b);
    addMyNumber(nums, note);
    input.value = '';
    document.getElementById('myNumberNote').value = '';
    showStatus('success', '📝 번호가 기록되었습니다!');
}

function checkAllMyHistory() {
    if (!lottoDb || lottoDb.length === 0) {
        showStatus('warning', '⚠️ DB 데이터가 필요합니다.');
        return;
    }
    const history = getMyHistory();
    const el = document.getElementById('myHistoryCheckResult');
    let totalSpent = 0, totalWon = 0;
    const prizeMap = { 6: '1등', 5: '3등', 4: '4등', 3: '5등' };
    const prizeAmt = { '1등': 2000000000, '2등': 50000000, '3등': 1500000, '4등': 50000, '5등': 5000 };
    const hits = [];

    history.forEach(h => {
        totalSpent += 1000;
        lottoDb.forEach(entry => {
            if (!entry.numbers) return;
            const matches = h.numbers.filter(n => entry.numbers.includes(n));
            const bonusMatch = entry.bonus && h.numbers.includes(entry.bonus);
            if (matches.length >= 3) {
                let grade;
                if (matches.length === 6) grade = '1등';
                else if (matches.length === 5 && bonusMatch) grade = '2등';
                else grade = prizeMap[matches.length];
                if (grade) {
                    hits.push({ ...h, grade, matches: matches.length, round: entry.round, amount: prizeAmt[grade] });
                    totalWon += prizeAmt[grade] || 0;
                }
            }
        });
    });

    el.innerHTML = `
        <div class="myhistory-summary">
            <div class="myhistory-summary-row"><span>확인한 번호</span><strong>${history.length}개</strong></div>
            <div class="myhistory-summary-row"><span>총 구매 추정</span><strong>${totalSpent.toLocaleString()}원</strong></div>
            <div class="myhistory-summary-row"><span>총 당첨 추정</span><strong style="color:${totalWon > totalSpent ? '#10b981' : '#ef4444'}">${totalWon.toLocaleString()}원</strong></div>
        </div>
        ${hits.length > 0 ? hits.slice(0, 10).map(h => `
            <div class="myhistory-hit">🎯 <strong>${h.grade}</strong> — 제${h.round}회 ${h.matches}개 일치 (${h.date} 기록)</div>
        `).join('') : '<p class="text-secondary text-center mt-10">아쉽게도 당첨 내역이 없습니다.</p>'}
    `;
}

// ========== 7. 공유 카드 생성기 ==========
function renderShareCard() {
    const el = document.getElementById('sharecardContent');
    if (!el) return;
    el.innerHTML = `
        <p class="text-secondary text-center mb-15">내 번호로 예쁜 공유 카드를 만들어보세요!</p>
        <div class="input-group">
            <input type="text" id="sharecardInput" class="input-field" placeholder="6개 번호 (예: 1,13,21,27,34,42)">
            <button class="btn btn-primary" onclick="generateShareCard()" style="white-space:nowrap;">🎨 카드 생성</button>
        </div>
        <div style="margin-top:10px;">
            <label class="text-xs-secondary">카드 스타일:</label>
            <select id="sharecardStyle" class="sim-input" style="width:100%;margin-top:5px;">
                <option value="dark">🌑 다크</option>
                <option value="gold">✨ 골드</option>
                <option value="neon">💜 네온</option>
                <option value="spring">🌸 봄</option>
            </select>
        </div>
        <div id="sharecardResult" style="margin-top:15px;"></div>
    `;
}

function generateShareCard() {
    const input = document.getElementById('sharecardInput').value.trim();
    const style = document.getElementById('sharecardStyle').value;
    const nums = input.split(/[,·\s]+/).map(Number).filter(n => n >= 1 && n <= 45);
    const el = document.getElementById('sharecardResult');
    if (nums.length !== 6 || new Set(nums).size !== 6) {
        el.innerHTML = '<p class="text-secondary text-center">⚠️ 6개의 올바른 번호를 입력해주세요.</p>';
        return;
    }
    nums.sort((a, b) => a - b);

    const canvas = document.createElement('canvas');
    canvas.width = 500; canvas.height = 300;
    const ctx = canvas.getContext('2d');

    // 배경
    const bgGradients = {
        dark: ['#0a0a1a', '#1a1040'],
        gold: ['#1a1500', '#332200'],
        neon: ['#0f001a', '#1a0033'],
        spring: ['#f0e6ff', '#ffe6f0'],
    };
    const [bg1, bg2] = bgGradients[style] || bgGradients.dark;
    const bgGrad = ctx.createLinearGradient(0, 0, 500, 300);
    bgGrad.addColorStop(0, bg1); bgGrad.addColorStop(1, bg2);
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, 500, 300);

    // 테두리
    ctx.strokeStyle = style === 'spring' ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(10, 10, 480, 280, 16); ctx.stroke();

    // 타이틀
    const titleColor = style === 'spring' ? '#1a1a2e' : '#ffffff';
    const subColor = style === 'spring' ? '#555577' : '#a0a0c0';
    ctx.fillStyle = titleColor; ctx.font = 'bold 24px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('🎰 나의 로또 645 번호', 250, 55);

    // 날짜
    ctx.fillStyle = subColor; ctx.font = '14px "Noto Sans KR", sans-serif';
    ctx.fillText(new Date().toLocaleDateString('ko-KR'), 250, 80);

    // 번호 공
    const ballR = 30, startX = 60, ballY = 170;
    const ballColors = { yellow: ['#ffd700', '#b8860b'], blue: ['#60a5fa', '#1d4ed8'], red: ['#f87171', '#991b1b'], gray: ['#9ca3af', '#374151'], green: ['#34d399', '#065f46'] };
    nums.forEach((n, i) => {
        const bx = startX + i * 78;
        const cls = getBallClass(n);
        const [c1, c2] = ballColors[cls] || ballColors.gray;
        const g = ctx.createRadialGradient(bx - 6, ballY - 6, 3, bx, ballY, ballR);
        g.addColorStop(0, c1); g.addColorStop(0.7, c2);
        ctx.beginPath(); ctx.arc(bx, ballY, ballR, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(n, bx, ballY);
    });

    // URL
    ctx.fillStyle = subColor; ctx.font = '12px "Noto Sans KR", sans-serif';
    ctx.fillText('123lotto.co.kr', 250, 250);

    const imgUrl = canvas.toDataURL('image/png');
    el.innerHTML = `
        <div style="text-align:center;">
            <img src="${imgUrl}" alt="공유 카드" style="width:100%;max-width:500px;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.4);">
            <div style="display:flex;gap:10px;justify-content:center;margin-top:10px;flex-wrap:wrap;">
                <button class="btn btn-primary" onclick="downloadShareCard('${imgUrl.replace(/'/g, "\\'")}')">💾 이미지 저장</button>
                <button class="btn btn-secondary" onclick="copyShareCard()">📋 클립보드 복사</button>
            </div>
            <p class="text-xs-secondary mt-8">이미지를 길게 눌러 저장하거나 공유하세요.</p>
        </div>
    `;
    window._shareCardUrl = imgUrl;
}

function downloadShareCard(url) {
    const a = document.createElement('a');
    a.href = url; a.download = 'lotto645-card.png';
    a.click();
    showStatus('success', '💾 카드가 다운로드되었습니다!');
}

async function copyShareCard() {
    if (window._shareCardUrl) {
        try {
            const resp = await fetch(window._shareCardUrl);
            const blob = await resp.blob();
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            showStatus('success', '📋 카드가 클립보드에 복사됐습니다!');
        } catch (e) {
            showStatus('info', '⚠️ 이미지 복사가 지원되지 않습니다. 다운로드를 이용해주세요.');
        }
    }
}

// ========== 초기화 ==========
document.addEventListener('DOMContentLoaded', () => {
    renderShoppingSim();
    renderCompatibility();
    renderFortuneCalendar();
    renderShareCard();
}, { once: true });
