// fun2.js - Fun Zone 2: 가상추첨, 상식퀴즈, 당첨금쇼핑, 번호궁합, 운세달력, 내번호기록, 공유카드
// ========== 탭 전환 ==========
function switchFun2Tab(tabName) {
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
        case 'luckycolor': renderLuckyColor(); break;
        case 'luckydraw': renderLuckyDraw(); break;
    }
}

// ========== 1. 가상 추첨 시뮬레이터 ==========
let drawAnimId = null;

function getDrawCanvasSize() {
    const el = document.getElementById('drawMachineContent');
    if (!el) return { w: 520, h: 440, dpr: 1 };
    const containerW = el.clientWidth - 20;
    const w = Math.min(containerW, 520);
    const h = Math.round(w * (440 / 520));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    return { w, h, dpr };
}

function initDrawMachine() {
    const el = document.getElementById('drawMachineContent');
    if (!el) return;
    const size = getDrawCanvasSize();
    el.innerHTML = `
        <div class="draw-machine">
            <canvas id="drawCanvas" class="draw-canvas" style="width:100%;height:auto;max-width:520px;border-radius:16px;"></canvas>
            <div class="draw-result" id="drawResult"></div>
            <button class="btn btn-gold" onclick="startDraw()" id="drawBtn" style="width:100%;justify-content:center;">🎱 추첨 시작!</button>
        </div>
    `;
    const canvas = document.getElementById('drawCanvas');
    if (canvas) {
        canvas.width = size.w * size.dpr;
        canvas.height = size.h * size.dpr;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    }
    renderDrawBalls();
}

function renderDrawBalls() {
    const canvas = document.getElementById('drawCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.roundRect(10, 10, w - 20, h - 20, 20); ctx.fill();

    // 상단: 45개 공 (9×5 그리드) — canvas 크기에 비례
    const cols = 9, rows = 5;
    const padX = Math.max(20, w * 0.04);
    const padY = Math.max(16, h * 0.04);
    const availW = w - padX * 2;
    const availH = h * 0.55 - padY;
    const cellW = availW / cols;
    const cellH = availH / rows;
    const r = Math.min(cellW, cellH) * 0.35;
    const fontSize = Math.max(8, Math.min(11, r * 0.7));

    for (let i = 1; i <= 45; i++) {
        const row = Math.floor((i - 1) / cols);
        const col = (i - 1) % cols;
        const x = padX + col * cellW + cellW / 2;
        const y = padY + row * cellH + cellH / 2;
        const cls = getBallClass(i);
        const colors = { yellow: ['#ffd700', '#b8860b'], blue: ['#60a5fa', '#1d4ed8'], red: ['#f87171', '#991b1b'], gray: ['#9ca3af', '#374151'], green: ['#34d399', '#065f46'] };
        const [c1, c2] = colors[cls] || colors.gray;
        const grad = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, 1, x, y, r);
        grad.addColorStop(0, c1); grad.addColorStop(1, c2);
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = `bold ${fontSize}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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

function drawBallAt(ctx, x, y, ball, rOrHighlight) {
    let r = 15, highlight = false;
    if (typeof rOrHighlight === 'number') { r = rOrHighlight; highlight = r > 18; }
    else if (rOrHighlight) { r = 20; highlight = true; }
    const cls = ball.cls || 'gray';
    const colors = { yellow: ['#ffd700', '#b8860b'], blue: ['#60a5fa', '#1d4ed8'], red: ['#f87171', '#991b1b'], gray: ['#9ca3af', '#374151'], green: ['#34d399', '#065f46'] };
    const [c1, c2] = colors[cls] || colors.gray;
    const grad = ctx.createRadialGradient(x - r * 0.15, y - r * 0.15, 1, x, y, r);
    grad.addColorStop(0, c1); grad.addColorStop(1, c2);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
    if (highlight) {
        ctx.strokeStyle = '#ffd700'; ctx.lineWidth = Math.max(2, r * 0.15); ctx.stroke();
    }
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(8, r * 0.65)}px sans-serif`;
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

    // 기존 리스너 중복 등록 방지
    if (!el._quiz2ListenerAdded) {
        el.addEventListener('click', function(e) {
            const btn = e.target.closest('.quiz2-option');
            if (!btn || btn.disabled) return;
            const idx = parseInt(btn.getAttribute('data-idx'));
            const correct = parseInt(btn.getAttribute('data-correct'));
            const info = btn.getAttribute('data-info') || '';
            if (isNaN(idx) || isNaN(correct)) return;
            const feedback = document.getElementById('quiz2Feedback');
            const isCorrect = idx === correct;
            if (isCorrect) score++;
            if (feedback) {
                feedback.className = `quiz2-feedback ${isCorrect ? 'correct' : 'wrong'}`;
                feedback.innerHTML = `${isCorrect ? '✅ 정답!' : '❌ 오답!'} ${info}`;
                feedback.classList.remove('hidden');
            }
            el.querySelectorAll('.quiz2-option').forEach((b, i) => {
                b.disabled = true;
                if (i === correct) b.style.background = 'rgba(16,185,129,0.3)';
                if (i === idx && !isCorrect) b.style.background = 'rgba(239,68,68,0.3)';
            });
            setTimeout(() => { qi++; show(); }, 1500);
        });
        el._quiz2ListenerAdded = true;
    }

    function show() {
        if (qi >= questions.length) {
            const pct = Math.round((score / questions.length) * 100);
            const grade = pct >= 80 ? '🏆 로또 박사!' : pct >= 60 ? '📚 꽤 아는 편!' : pct >= 40 ? '🤔 공부가 필요해요' : '🫣 초보자';
            el.innerHTML = `
                <div class="quiz2-result">
                    <div style="font-size:3rem;">${grade.split(' ')[0]}</div>
                    <h3 style="color:var(--accent-gold);">${grade}</h3>
                    <p class="text-secondary">${score} / ${questions.length} 정답 (${pct}점)</p>
                    <button class="btn btn-primary" data-action="startLottoQuiz" style="width:100%;margin-top:15px;justify-content:center;">🔄 다시 도전</button>
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
                        <button class="quiz2-option" data-idx="${i}" data-correct="${q.correct}" data-info="${q.info.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}">${ans}</button>
                    `).join('')}
                </div>
                <div id="quiz2Feedback" class="hidden" style="margin-top:12px;"></div>
            </div>
        `;
    }

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

    // 헤더 먼저 표시
    el.innerHTML = `
        <div class="shopping-result-card" style="animation:answerReveal 0.4s ease-out;">
            <div class="shopping-header">${tier} 당첨</div>
            <div class="shopping-net">실수령 <strong>${net.toLocaleString()}원</strong></div>
            <div class="shopping-tax">(세금 ${(taxRate*100).toFixed(0)}% 차감)</div>
            <div class="shopping-items" id="shoppingItemsList"></div>
            ${rows.length === 0 ? '<p class="text-secondary text-center">구매 가능한 항목이 없어요 😅</p>' : ''}
        </div>
    `;

    // 아이템 하나씩 순차 공개
    const listEl = document.getElementById('shoppingItemsList');
    if (listEl && rows.length > 0) {
        rows.forEach((r, i) => {
            setTimeout(() => {
                const div = document.createElement('div');
                div.className = 'shopping-item-row';
                div.style.cssText = 'animation:answerReveal 0.3s ease-out;';
                div.innerHTML = `
                    <span class="shopping-item-icon">${r.icon}</span>
                    <span class="shopping-item-name">${r.name}</span>
                    <span class="shopping-item-count">× <strong>${r.count.toLocaleString()}</strong>개</span>
                `;
                listEl.appendChild(div);
                if (typeof playBeep === 'function') playBeep(600 + i * 100, 0.06);
            }, i * 200);
        });
    }
}

// ========== 4. 오늘의 럭키 컬러 ==========
function renderLuckyColor() {
    const el = document.getElementById('luckycolorContent');
    if (!el) return;
    const today = new Date().toISOString().slice(0,10);
    const colors = [
        { name: '골드', hex: '#ffd700', range: [1,9], emoji: '🌟', desc: '부와 행운을 상징하는 색! 1~9번 구간에 행운이 깃들어 있어요.' },
        { name: '블루', hex: '#3b82f6', range: [10,18], emoji: '💧', desc: '차분함 속에 강한 집중력! 10~18번 구간을 주목하세요.' },
        { name: '레드', hex: '#ef4444', range: [19,27], emoji: '🔥', desc: '열정과 에너지가 폭발하는 날! 19~27번 구간에 주목.' },
        { name: '그린', hex: '#10b981', range: [28,36], emoji: '🍀', desc: '성장과 희망의 색! 28~36번 구간이 오늘의 행운을 담고 있어요.' },
        { name: '퍼플', hex: '#8b5cf6', range: [37,45], emoji: '🔮', desc: '신비로운 직감이 살아있는 날! 37~45번 구간을 믿어보세요.' },
    ];
    const seed = today.split('-').reduce((a,b)=>a+parseInt(b),0);
    const idx = Math.floor(Math.abs(Math.sin(seed*127.1)*10000)) % colors.length;
    const c = colors[idx];
    const nums = [];
    while(nums.length<6){ const n=c.range[0]+Math.floor(Math.random()*(c.range[1]-c.range[0]+1)); if(!nums.includes(n)) nums.push(n); }
    nums.sort((a,b)=>a-b);

    el.innerHTML = `
        <div style="text-align:center;padding:20px 0;">
            <div style="font-size:4rem;margin-bottom:10px;">${c.emoji}</div>
            <div style="width:80px;height:80px;border-radius:50%;background:${c.hex};margin:0 auto 15px;box-shadow:0 0 30px ${c.hex}66,0 4px 15px rgba(0,0,0,0.3);"></div>
            <h3 style="color:${c.hex};margin-bottom:8px;">오늘의 행운 컬러: ${c.name}</h3>
            <p class="text-secondary" style="max-width:320px;margin:0 auto 15px;font-size:0.9rem;">${c.desc}</p>
            <div class="balls-container" style="gap:8px;margin-bottom:15px;">
                ${nums.map(n => `<span class="ball ${typeof getBallClass==='function'?getBallClass(n):''}" style="width:44px;height:44px;line-height:44px;font-size:1rem;">${n}</span>`).join('')}
            </div>
            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                <button class="btn btn-primary" onclick="_applyFunNumbers([${nums}],'🌈 ${c.name} 럭키 컬러 번호','🌈 럭키 컬러 번호로 분석 완료!')" style="padding:8px 18px;font-size:0.85rem;">📊 분석하기</button>
                <button class="btn btn-secondary" onclick="renderLuckyColor()" style="padding:8px 18px;font-size:0.85rem;">🔄 다른 색상</button>
            </div>
        </div>
    `;
}

// ========== 5. 행운의 번호 뽑기 ==========
function renderLuckyDraw() {
    const el = document.getElementById('luckydrawContent');
    if (!el) return;
    el.innerHTML = `
        <p class="text-secondary text-center mb-15">🎲 버튼을 누르면 행운의 번호가 하나씩 공개됩니다!</p>
        <div id="luckyDrawBalls" class="balls-container" style="gap:8px;min-height:60px;margin-bottom:15px;"></div>
        <div style="text-align:center;">
            <button class="btn btn-gold" id="luckyDrawBtn" onclick="startLuckyDraw()" style="padding:10px 28px;font-size:1rem;">🎲 행운 뽑기 시작!</button>
            <div id="luckyDrawResult" style="margin-top:12px;"></div>
        </div>
    `;
}

function startLuckyDraw() {
    const btn = document.getElementById('luckyDrawBtn');
    const container = document.getElementById('luckyDrawBalls');
    const resultEl = document.getElementById('luckyDrawResult');
    if (!btn || !container) return;
    btn.disabled = true;
    btn.textContent = '🎲 뽑는 중...';
    if (resultEl) resultEl.innerHTML = '';

    const pool = Array.from({length:45}, (_,i)=>i+1);
    for (let i = pool.length-1; i>0; i--) { const j = Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
    const selected = pool.slice(0,6).sort((a,b)=>a-b);
    container.innerHTML = '';

    let i = 0;
    function revealNext() {
        if (i >= selected.length) {
            btn.disabled = false;
            btn.textContent = '🎲 다시 뽑기';
            if (resultEl) {
                resultEl.innerHTML = `
                    <div style="animation:answerReveal 0.5s ease-out;">
                        <button class="btn btn-primary" onclick="_applyFunNumbers([${selected}],'🎲 행운 뽑기 번호','🎲 행운 뽑기 번호로 분석 완료!')" style="padding:8px 18px;font-size:0.85rem;">📊 분석하기</button>
                    </div>
                `;
            }
            if (typeof fireConfetti==='function') fireConfetti();
            return;
        }
        const n = selected[i];
        const ball = document.createElement('span');
        ball.className = 'ball ' + (typeof getBallClass==='function'?getBallClass(n):'');
        ball.textContent = n;
        ball.style.cssText = 'width:48px;height:48px;line-height:48px;font-size:1.1rem;animation:popIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275);';
        container.appendChild(ball);
        if (typeof playBeep==='function') playBeep(500+i*80, 0.12);
        if (typeof vibrate==='function') vibrate(25);
        i++;
        setTimeout(revealNext, 450);
    }
    revealNext();
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

    // 내 번호 통계 계산
    let statsHtml = '';
    if (history.length > 0 && lottoDb && lottoDb.length > 0) {
        const numFreq = {};
        let totalMatches = 0, checkedCount = 0;
        history.forEach(h => {
            h.numbers.forEach(n => { numFreq[n] = (numFreq[n] || 0) + 1; });
            if (h.round && currentWinningNumbers) {
                checkedCount++;
                totalMatches += h.numbers.filter(n => (currentWinningNumbers || []).includes(n)).length;
            }
        });
        const topNums = Object.entries(numFreq).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const avgMatch = checkedCount > 0 ? (totalMatches / checkedCount).toFixed(1) : '-';
        statsHtml = `
            <div class="myhistory-stats">
                <div class="myhistory-stat-item"><span class="myhistory-stat-val">${history.length}</span><span class="myhistory-stat-lbl">저장된 조합</span></div>
                <div class="myhistory-stat-item"><span class="myhistory-stat-val">${avgMatch}개</span><span class="myhistory-stat-lbl">평균 일치</span></div>
                <div class="myhistory-stat-item"><span class="myhistory-stat-val">${new Set(history.flatMap(h => h.numbers)).size}</span><span class="myhistory-stat-lbl">고유 번호</span></div>
            </div>
            ${topNums.length > 0 ? `<div style="font-size:0.8rem;color:var(--text-secondary);margin-top:8px;">가장 자주 선택한 번호: ${topNums.map(([n, c]) => `<span class="ball ${getBallClass(parseInt(n))}" style="width:28px;height:28px;line-height:28px;font-size:0.65rem;">${n}</span>`).join(' ')}</div>` : ''}
        `;
    }

    el.innerHTML = `
        <div class="myhistory-add">
            <p class="text-secondary mb-15">구매했거나 관심 있는 번호를 기록하고, 당첨 여부를 확인해보세요.</p>
            <div class="input-group">
                <input type="text" id="myNumberInput" class="input-field" placeholder="6개 번호 (예: 1,13,21,27,34,42)">
                <button class="btn btn-primary" onclick="addMyNumberFromInput()" style="white-space:nowrap;">📝 기록</button>
            </div>
            <input type="text" id="myNumberNote" class="input-field" placeholder="메모 (선택사항, 예: 생일조합)" style="margin-top:8px;">
        </div>
        ${statsHtml}
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

    // 번호별 종합 점수 계산
    const ranked = history.map((h, idx) => {
        let crossScore = 0, bestMatch = 0, bestRound = 0, total3Plus = 0, totalMatches = 0;
        lottoDb.forEach(entry => {
            if (!entry.numbers) return;
            const matches = h.numbers.filter(n => entry.numbers.includes(n));
            const bonusMatch = entry.bonus && h.numbers.includes(entry.bonus);
            totalMatches += matches.length;
            if (matches.length > bestMatch) { bestMatch = matches.length; bestRound = entry.round; }
            if (matches.length >= 3) {
                total3Plus++;
                if (matches.length >= 6) crossScore += 6;
                else if (matches.length === 5 && bonusMatch) crossScore += 5;
                else if (matches.length === 5) crossScore += 4;
                else if (matches.length === 4) crossScore += 3;
                else crossScore += 2;
            }
        });
        const avgMatch = (totalMatches / lottoDb.length).toFixed(1);
        return { ...h, idx, crossScore, bestMatch, bestRound, total3Plus, avgMatch };
    });
    ranked.sort((a, b) => b.crossScore - a.crossScore);

    // 당첨 내역 수집
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
        <div class="myhistory-rank-panel">
            <div class="rank-title">🏆 내 번호 전체 순위 분석</div>
            <p class="text-xs-secondary" style="margin-bottom:10px;">전체 ${lottoDb.length}회차 기준 교차 점수 순위입니다. 점수가 높을수록 과거 당첨번호와 유사합니다.</p>
            ${ranked.slice(0, 5).map((r, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
                return `
                    <div class="rank-item rank-${i}">
                        <span class="rank-medal">${medal}</span>
                        <span class="rank-balls">${r.numbers.map(n => `<span class="ball ${getBallClass(n)}" style="width:26px;height:26px;line-height:26px;font-size:0.6rem;">${n}</span>`).join(' ')}</span>
                        <span class="rank-score">${r.crossScore}점</span>
                        <span class="rank-info">최고 ${r.bestMatch}개 일치(제${r.bestRound}회) · 3회이상 ${r.total3Plus}회 · 평균 ${r.avgMatch}개</span>
                    </div>
                `;
            }).join('')}
        </div>
        <div class="myhistory-summary" style="margin-top:12px;">
            <div class="myhistory-summary-row"><span>확인한 번호</span><strong>${history.length}개</strong></div>
            <div class="myhistory-summary-row"><span>총 구매 추정</span><strong>${totalSpent.toLocaleString()}원</strong></div>
            <div class="myhistory-summary-row"><span>총 당첨 추정</span><strong style="color:${totalWon > totalSpent ? '#10b981' : '#ef4444'}">${totalWon.toLocaleString()}원</strong></div>
        </div>
        ${hits.length > 0 ? hits.slice(0, 10).map(h => `
            <div class="myhistory-hit">🎯 <strong>${h.grade}</strong> — 제${h.round}회 ${h.matches}개 일치 (${h.date} 기록)</div>
        `).join('') : '<p class="text-secondary text-center mt-10">아쉽게도 당첨 내역이 없습니다.</p>'}
    `;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
