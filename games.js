// games.js - 미니 게임존: 번호 경마, 번호 낚시터, 번호 메모리, 번호 슬롯
// 모든 게임: 번호는 ?로 숨김 → 완료 시 공개 + 번호 추천

// ========== 공통 ==========
let gameAnimId = null;
let gameCollected = [];
const GAME_TARGET = 6;

function stopGame() {
    if (gameAnimId) { cancelAnimationFrame(gameAnimId); gameAnimId = null; }
}

function addCollected(num) {
    if (gameCollected.includes(num)) return;
    if (gameCollected.length >= GAME_TARGET) return;
    gameCollected.push(num);
    gameCollected.sort((a, b) => a - b);
    updateGameBasket();
    if (gameCollected.length >= GAME_TARGET) onGameComplete();
    if (typeof _hook === 'function') _hook('addCollected', num);
}

function onGameComplete() {
    stopGame();
    const nums = gameCollected.slice(0, GAME_TARGET);
    const analysis = typeof analyzeNumbers === 'function' ? analyzeNumbers(nums) : null;
    const score = analysis && typeof calculateQualityScore === 'function' ? calculateQualityScore(analysis) : null;
    const basket = document.getElementById('gameBasket');
    if (!basket) return;
    basket.innerHTML = `
        <div class="game-complete">
            <div class="game-reveal-anim">
                <h4 style="color:var(--accent-gold);margin-bottom:12px;">🎉 번호 공개!</h4>
                <div class="balls-container" style="padding:10px 0;gap:8px;">
                    ${nums.map((n, i) => `<span class="ball ${typeof getBallClass === 'function' ? getBallClass(n) : ''} reveal-ball" style="width:46px;height:46px;line-height:46px;font-size:1rem;animation-delay:${i*0.2}s;">${n}</span>`).join('')}
                </div>
                ${score ? `
                <div class="game-score-card">
                    <div class="game-score-main">${score.totalScore}점</div>
                    <div class="game-score-grade" style="color:${score.totalScore>=75?'var(--grade-excellent)':score.totalScore>=60?'var(--grade-good)':'var(--grade-normal)'}">${score.grade}</div>
                    <div class="game-score-detail">합계 ${analysis.sum} · AC ${analysis.ac} · ${analysis.oddEvenRatio} · ${analysis.lowHighRatio}</div>
                </div>` : ''}
            </div>
            <button class="btn btn-gold" onclick="resetGameBasket();switchGameTab(currentGame)" style="margin-top:10px;padding:8px 20px;font-size:0.85rem;">🔄 다시하기</button>
        </div>
    `;
    if (typeof vibrate === 'function') vibrate([50, 30, 50, 30, 100]);
    if (typeof playBeep === 'function') { playBeep(600, 0.1); setTimeout(() => playBeep(800, 0.15), 150); setTimeout(() => playBeep(1000, 0.2), 300); }
    if (typeof fireConfetti === 'function' && score && score.totalScore >= 75) fireConfetti();
}

function resetGameBasket() {
    gameCollected = [];
    updateGameBasket();
    stopGame();
}

function updateGameBasket() {
    const basket = document.getElementById('gameBasket');
    if (!basket) return;
    if (gameCollected.length === 0) {
        basket.innerHTML = '<span style="color:var(--text-secondary);font-size:0.85rem;">🎱 아직 모은 번호가 없습니다 (0/6)</span>';
        return;
    }
    basket.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;">
            <span style="color:var(--text-secondary);font-size:0.75rem;">모은 번호:</span>
            ${gameCollected.map(n => {
                // 마지막으로 추가된 번호는 공개, 나머지는 ? (단 완성 시 모두 공개)
                const show = gameCollected.length >= GAME_TARGET ? true : (n === gameCollected[gameCollected.length - 1]);
                if (show) return `<span class="ball ${typeof getBallClass === 'function' ? getBallClass(n) : ''}" style="width:30px;height:30px;line-height:30px;font-size:0.7rem;">${n}</span>`;
                return `<span class="ball hidden-ball" style="width:30px;height:30px;line-height:30px;font-size:0.7rem;">?</span>`;
            }).join('')}
            <span style="color:var(--text-secondary);font-size:0.7rem;">(${gameCollected.length}/${GAME_TARGET})</span>
        </div>
    `;
}

// ========== 게임존 탭 전환 ==========
let currentGame = 'race';

function switchGameTab(name) {
    stopGame();
    resetGameBasket();
    currentGame = name;
    document.querySelectorAll('.game-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.game-content').forEach(c => c.classList.remove('active'));
    const tab = document.querySelector(`.game-tab[data-game="${name}"]`);
    const content = document.getElementById('gameContent' + name.charAt(0).toUpperCase() + name.slice(1));
    if (tab) tab.classList.add('active');
    if (content) content.classList.add('active');
    switch (name) {
        case 'race': initRaceGame(); break;
        case 'fishing': initFishingGame(); break;
        case 'memory': initMemoryGame(); break;
        case 'slot': initSlotGame(); break;
    }
}

// ===================================================================
// 1. 🏇 번호 경마 — 12마리 ? 말, 완주 후 6말 번호 공개 + 추천
// ===================================================================
let raceState = null;

function initRaceGame() {
    stopGame();
    resetGameBasket();
    const el = document.getElementById('gameContentRace');
    if (!el) return;
    el.innerHTML = `
        <div class="game-info-box">🏇 12마리 말 중 <strong>6마리</strong>가 결승선을 통과하면 번호가 공개됩니다!</div>
        <canvas id="raceCanvas" class="game-canvas" role="img" aria-label="번호 경마 게임 화면. 시작 버튼을 누르면 6개의 말이 달리고 도착 순서대로 번호를 모읍니다." style="width:100%;max-width:520px;height:auto;border-radius:12px;"></canvas>
        <div id="raceResult" class="hidden"></div>
        <button class="btn btn-gold" id="raceStartBtn" onclick="startRace()" style="width:100%;margin-top:8px;justify-content:center;">🏁 경주 시작!</button>
        <p class="text-xs-secondary text-center" id="raceHint" style="margin-top:6px;">🏇 <strong>경주 중 화면을 터치/클릭</strong>하면 해당 레인의 말이 가속합니다!</p>
    `;
    initRaceCanvas();
}

function initRaceCanvas() {
    const canvas = document.getElementById('raceCanvas');
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const logicalW = 520, logicalH = 520;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width, h = rect.height;

    const pool = Array.from({length: 45}, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const laneH = h / 12;
    const horses = pool.slice(0, 12).map((num, i) => ({
        num, lane: i,
        x: w * 0.08, y: laneH * i + laneH * 0.55,
        speed: 0, baseSpeed: 1.0 + Math.random() * 2.2,
        color: ['#ffd700','#60a5fa','#f87171','#9ca3af','#34d399','#f97316','#a78bfa','#fbbf24','#f472b6','#818cf8','#fb923c','#4ade80'][i],
        finished: false, rank: 0, boost: 0
    }));

    raceState = { horses, running: false, finished: [], particles: [], startTime: 0, w, h, laneH };

    // 터치/클릭 인터랙션
    function handlePointer(e) {
        if (!raceState || !raceState.running) return;
        e.preventDefault();
        const r = canvas.getBoundingClientRect();
        const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
        const y = clientY - r.top;
        const lane = Math.floor(y / raceState.laneH);
        if (lane >= 0 && lane < 12 && raceState.horses[lane] && !raceState.horses[lane].finished) {
            raceState.horses[lane].boost = 12; // 12프레임 동안 가속
            // 파티클 폭발
            for (let k = 0; k < 8; k++) {
                raceState.particles.push({
                    x: raceState.horses[lane].x + 10,
                    y: raceState.horses[lane].y,
                    vx: (Math.random() - 0.5) * 6,
                    vy: (Math.random() - 0.5) * 4,
                    life: 1, size: 2 + Math.random() * 3,
                    color: raceState.horses[lane].color
                });
            }
            if (typeof playBeep === 'function') playBeep(900, 0.06);
            if (typeof vibrate === 'function') vibrate(15);
        }
    }
    canvas.onclick = handlePointer;
    canvas.ontouchstart = handlePointer;

    function draw() {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#2d5a1e';
        ctx.fillRect(0, 0, w, h);

        const horses = raceState.horses;
        for (let i = 0; i < 12; i++) {
            const y = raceState.laneH * i + 2;
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            ctx.fillRect(w * 0.03, y, w * 0.94, raceState.laneH - 4);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.strokeRect(w * 0.03, y, w * 0.94, raceState.laneH - 4);
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.font = `${Math.max(8, w * 0.018)}px sans-serif`;
            ctx.textAlign = 'right';
            ctx.fillText(`${i+1}`, w * 0.025, y + raceState.laneH * 0.5);
        }

        const finishX = w * 0.88;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(finishX, 2, 3, h - 4);
        const checkSize = Math.max(4, h * 0.014);
        for (let yy = 6; yy < h - 6; yy += checkSize * 1.6) {
            ctx.fillStyle = (Math.floor(yy / (checkSize * 1.6)) % 2 === 0) ? '#fff' : '#333';
            ctx.fillRect(finishX - checkSize * 0.4, yy, checkSize, checkSize);
        }

        horses.forEach(h => { drawHorseSprite(ctx, h, raceState.laneH); });

        raceState.particles = raceState.particles.filter(p => p.life > 0);
        raceState.particles.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.life -= 0.03;
            if (p.color && p.color.startsWith('#')) {
                ctx.globalAlpha = p.life;
                ctx.fillStyle = p.color;
            } else {
                ctx.fillStyle = `rgba(180,150,100,${p.life})`;
            }
            ctx.fillRect(p.x, p.y, p.size, p.size);
            ctx.globalAlpha = 1;
        });

        if (raceState.finished.length > 0) {
            const panelW = Math.min(70, w * 0.18);
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(w - panelW - 4, 4, panelW, raceState.finished.length * Math.max(18, h * 0.04) + 10);
            ctx.fillStyle = '#ffd700';
            ctx.font = `bold ${Math.max(10, w * 0.022)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('도착', w - panelW / 2 - 4, 18);
            const rowH = Math.max(18, h * 0.04);
            raceState.finished.forEach((horse, i) => {
                ctx.fillStyle = horse.color;
                ctx.font = `bold ${Math.max(9, w * 0.02)}px sans-serif`;
                ctx.fillText(`${i+1}위`, w - panelW / 2 - 4, 32 + i * rowH);
            });
        }

        if (!raceState.running && raceState.finished.length === 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#ffd700';
            ctx.font = `bold ${Math.max(16, w * 0.05)}px "Noto Sans KR"`;
            ctx.textAlign = 'center';
            ctx.fillText('🏁 경주 시작! 버튼을 누르세요', w/2, h/2);
        }
    }
    draw();
}

function drawHorseSprite(ctx, h, laneH) {
    const {x, y, color} = h;
    const s = Math.min(laneH * 0.35, 14);
    ctx.save();
    ctx.translate(x, y);
    // 몸통
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(s * 0.5, 0, s * 0.9, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    // 머리
    ctx.beginPath(); ctx.arc(s * 1.4, -s * 0.25, s * 0.45, 0, Math.PI * 2); ctx.fill();
    // 다리
    ctx.fillStyle = '#222';
    ctx.fillRect(s * 0.05, s * 0.4, s * 0.18, s * 0.6);
    ctx.fillRect(s * 0.7, s * 0.4, s * 0.18, s * 0.6);
    // ? 표시 또는 번호
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(8, s * 0.65)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(h.finished ? h.num : '?', s * 0.5, 0);
    // boost 표시
    if (h.boost > 0) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s * 0.5, 0, s * 1.1, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}

function startRace() {
    const canvas = document.getElementById('raceCanvas');
    const btn = document.getElementById('raceStartBtn');
    const hint = document.getElementById('raceHint');
    if (!canvas || !btn || !raceState || raceState.running) return;
    stopGame();

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    const finishX = w * 0.86;

    raceState.running = true;
    raceState.finished = [];
    raceState.particles = [];
    raceState.startTime = performance.now();
    raceState.w = w; raceState.h = h;
    const laneH = h / 12;
    raceState.laneH = laneH;
    raceState.horses.forEach(h => { h.x = w * 0.06; h.finished = false; h.rank = 0; h.speed = 0; h.boost = 0; });
    btn.disabled = true;
    btn.textContent = '🏇 경주 중...';
    if (hint) hint.style.display = 'block';

    function spawnParticles(x, y, color) {
        for (let i = 0; i < 4; i++) {
            raceState.particles.push({
                x, y, vx: -Math.random() * 2 - 0.5, vy: (Math.random() - 0.5) * 2,
                life: 1, size: 1 + Math.random() * 2, color
            });
        }
    }

    function animate(now) {
        const elapsed = (now - raceState.startTime) / 1000;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#2d5a1e';
        ctx.fillRect(0, 0, w, h);

        for (let i = 0; i < 12; i++) {
            const y = laneH * i + 2;
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            ctx.fillRect(w * 0.03, y, w * 0.94, laneH - 4);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.strokeRect(w * 0.03, y, w * 0.94, laneH - 4);
        }

        const checkSize = Math.max(4, h * 0.014);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(finishX, 2, 3, h - 4);
        for (let yy = 6; yy < h - 6; yy += checkSize * 1.6) {
            ctx.fillStyle = (Math.floor(yy / (checkSize * 1.6)) % 2 === 0) ? '#fff' : '#333';
            ctx.fillRect(finishX - checkSize * 0.4, yy, checkSize, checkSize);
        }

        raceState.horses.forEach(h => {
            if (h.finished) { drawHorseSprite(ctx, h, laneH); return; }

            const burst = Math.sin(elapsed * 2.7 + h.lane * 0.8) * 0.5 + Math.random() * 0.7;
            h.speed = Math.max(w * 0.001, Math.min(w * 0.008, (h.baseSpeed / 520) * w + burst));
            // 사용자 boost
            if (h.boost > 0) { h.speed *= 2.5; h.boost--; }
            // 막판 스퍼트
            if (h.x > finishX - w * 0.22) h.speed += Math.random() * (w * 0.004);
            // 긴장감: 갑작스런 둔화
            if (h.x > finishX - w * 0.38 && h.x < finishX - w * 0.18 && Math.random() < 0.015) {
                h.speed *= 0.3; spawnParticles(h.x + w * 0.02, h.y + laneH * 0.2, '#ff6b6b');
            }
            h.x += h.speed;
            if (Math.random() < 0.35) spawnParticles(h.x + 1, h.y + laneH * 0.25, h.color);

            if (h.x >= finishX && !h.finished) {
                h.finished = true; h.x = finishX;
                h.rank = raceState.finished.length + 1;
                raceState.finished.push(h);
                if (typeof playBeep === 'function') playBeep(350 + h.rank * 70, 0.1);
            }
            drawHorseSprite(ctx, h, laneH);
        });

        raceState.particles = raceState.particles.filter(p => p.life > 0);
        raceState.particles.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.life -= 0.03;
            if (p.color && p.color.startsWith('#')) {
                ctx.globalAlpha = Math.max(0, p.life);
                ctx.fillStyle = p.color;
            } else {
                ctx.fillStyle = `rgba(180,150,100,${Math.max(0, p.life)})`;
            }
            ctx.fillRect(p.x, p.y, p.size, p.size);
            ctx.globalAlpha = 1;
        });

        if (raceState.finished.length > 0) {
            const panelW = Math.min(70, w * 0.18);
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(w - panelW - 4, 4, panelW, Math.min(raceState.finished.length, 12) * Math.max(18, h * 0.04) + 12);
            ctx.fillStyle = '#ffd700';
            ctx.font = `bold ${Math.max(10, w * 0.022)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('순위', w - panelW / 2 - 4, 18);
            const rowH2 = Math.max(18, h * 0.04);
            raceState.finished.forEach((horse, i) => {
                ctx.fillStyle = i < 6 ? '#ffd700' : '#888';
                ctx.font = `bold ${i < 6 ? Math.max(10, w * 0.022) : Math.max(8, w * 0.018)}px sans-serif`;
                const label = i < 6 ? `${['🥇','🥈','🥉','4','5','6'][i]} ${horse.num}` : `${i+1}위`;
                ctx.fillText(label, w - panelW / 2 - 4, 32 + i * rowH2);
            });
        }

        if (raceState.finished.length >= 12) {
            raceState.running = false;
            btn.disabled = false;
            btn.textContent = '🔄 다시 경주';
            if (hint) hint.style.display = 'none';
            showRaceResult();
            return;
        }
        gameAnimId = requestAnimationFrame(animate);
    }
    gameAnimId = requestAnimationFrame(animate);
}

function showRaceResult() {
    if (!raceState) return;
    const top6 = raceState.finished.slice(0, 6);
    gameCollected = top6.map(h => h.num).sort((a, b) => a - b);

    const resultEl = document.getElementById('raceResult');
    if (!resultEl) return;
    resultEl.classList.remove('hidden');

    const analysis = typeof analyzeNumbers === 'function' ? analyzeNumbers(gameCollected) : null;
    const score = analysis && typeof calculateQualityScore === 'function' ? calculateQualityScore(analysis) : null;

    resultEl.innerHTML = `
        <div class="race-result-box" style="border:2px solid #ffd700;">
            <h4 style="color:#ffd700;margin-bottom:12px;">🏇 결승선 통과! TOP 6 공개</h4>
            <div style="margin-bottom:12px;font-size:0.8rem;color:var(--text-secondary);">
                ${top6.map((h,i) => `<span style="color:${h.color};">${['🥇','🥈','🥉','4위','5위','6위'][i]} ${h.num}번</span>`).join(' · ')}
            </div>
            <div class="balls-container" style="padding:8px 0;gap:8px;">
                ${gameCollected.map((n,i) => `<span class="ball ${typeof getBallClass === 'function' ? getBallClass(n) : ''} reveal-ball" style="width:44px;height:44px;line-height:44px;font-size:1rem;animation-delay:${i*0.15}s;">${n}</span>`).join('')}
            </div>
            ${score ? `
            <div class="game-score-card">
                <div class="game-score-main">${score.totalScore}점</div>
                <div class="game-score-grade" style="color:${score.totalScore>=75?'var(--grade-excellent)':score.totalScore>=60?'var(--grade-good)':'var(--grade-normal)'}">${score.grade}</div>
                <div class="game-score-detail">합계 ${analysis.sum} · AC ${analysis.ac} · ${analysis.oddEvenRatio} · ${analysis.lowHighRatio}</div>
            </div>` : ''}
            <button class="btn btn-gold" onclick="resetGameBasket();initRaceGame()" style="margin-top:10px;padding:8px 16px;font-size:0.85rem;">🔄 다시 경주</button>
        </div>
    `;
    updateGameBasket();
    if (typeof vibrate === 'function') vibrate([50,30,50,30,100]);
    if (typeof playBeep === 'function') { playBeep(600,0.1); setTimeout(()=>playBeep(800,0.15),150); setTimeout(()=>playBeep(1000,0.2),300); }
    if (typeof fireConfetti === 'function' && score && score.totalScore >= 70) fireConfetti();
}

// ===================================================================
// 2. 🎣 번호 낚시터 — 45마리 ? 물고기, 6마리 낚으면 추천
// ===================================================================
let fishList = [], fishBubbles = [];

function initFishingGame() {
    stopGame();
    resetGameBasket();
    const el = document.getElementById('gameContentFishing');
    if (!el) return;
    el.innerHTML = `
        <div class="game-info-box">🎣 물고기를 터치해서 낚으세요! <strong>6마리</strong>를 낚으면 번호가 공개됩니다.<br><span style="color:#ffd700;">✨ 황금 물고기</span>는 <strong>2마리</strong>로 계산돼요! 빠르게 연속 낚으면 <strong style="color:#ff6b35;">콤보</strong>!</div>
        <canvas id="fishCanvas" class="game-canvas" role="img" aria-label="번호 낚시 게임 화면. 헤엄치는 물고기를 클릭해 6개 번호를 모으세요." width="400" height="380"></canvas>
    `;
    const canvas = document.getElementById('fishCanvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;

    fishList = [];
    fishBubbles = [];
    const goldenIdx = new Set();
    while (goldenIdx.size < 5) goldenIdx.add(Math.floor(Math.random() * 45));
    for (let num = 1; num <= 45; num++) {
        const isGolden = goldenIdx.has(num - 1);
        fishList.push({
            num,
            x: 25 + Math.random() * (w - 50),
            y: 25 + Math.random() * (h - 50),
            vx: (Math.random() - 0.5) * 1.3,
            vy: (Math.random() - 0.5) * 1.0,
            size: isGolden ? 16 + Math.random() * 4 : 10 + Math.random() * 5,
            color: isGolden ? '#ffd700' : ['#60a5fa','#f87171','#34d399','#f97316','#a78bfa'][Math.floor(Math.random() * 5)],
            angle: Math.random() * Math.PI * 2,
            caught: false,
            golden: isGolden
        });
    }

    let fishCombo = 0, lastCatchTime = 0;

    canvas.onclick = (e) => {
        if (gameCollected.length >= GAME_TARGET) return;
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (w / rect.width);
        const my = (e.clientY - rect.top) * (h / rect.height);
        let bestFish = null, bestDist = 30;
        fishList.forEach(f => {
            if (f.caught) return;
            const dist = Math.hypot(f.x - mx, f.y - my);
            if (dist < bestDist) { bestDist = dist; bestFish = f; }
        });
        if (bestFish) {
            bestFish.caught = true;
            const now = Date.now();
            fishCombo = (now - lastCatchTime < 1500) ? fishCombo + 1 : 1;
            lastCatchTime = now;
            const isGolden = bestFish.golden;
            const particleCount = isGolden ? 25 : 12;
            for (let i = 0; i < particleCount; i++) {
                fishBubbles.push({
                    x: bestFish.x, y: bestFish.y,
                    vx: (Math.random() - 0.5) * (isGolden ? 8 : 5),
                    vy: -Math.random() * (isGolden ? 7 : 5) - 3,
                    life: 1, size: (isGolden ? 3 : 2) + Math.random() * (isGolden ? 5 : 4),
                    golden: isGolden
                });
            }
            addCollected(bestFish.num);
            if (isGolden && gameCollected.length < GAME_TARGET) {
                // 황금 물고기: 추가 번호 (미수집 중 랜덤)
                const allNums = []; for (let i=1;i<=45;i++) if(!gameCollected.includes(i)) allNums.push(i);
                if (allNums.length > 0) {
                    addCollected(allNums[Math.floor(Math.random() * allNums.length)]);
                }
            }
            if (typeof playBeep === 'function') playBeep(isGolden ? 800 : 500, isGolden ? 0.15 : 0.08);
            if (isGolden && typeof playBeep === 'function') setTimeout(() => playBeep(1000, 0.12), 100);
            if (typeof vibrate === 'function') vibrate(isGolden ? [30, 20, 50] : 20);
            if (isGolden && typeof fireConfetti === 'function') fireConfetti();
        }
    };

    function animate() {
        ctx.clearRect(0, 0, w, h);
        const waterGrad = ctx.createLinearGradient(0, 0, 0, h);
        waterGrad.addColorStop(0, '#0a3d62');
        waterGrad.addColorStop(1, '#0c5e8a');
        ctx.fillStyle = waterGrad;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(255,255,255,0.025)';
        for (let i = 0; i < 6; i++) ctx.fillRect(40 + i * 70, 0, 2, h);

        fishList.forEach(f => {
            if (f.caught) return;
            f.x += f.vx; f.y += f.vy; f.angle += 0.02;
            if (f.x < 12 || f.x > w - 12) f.vx *= -1;
            if (f.y < 12 || f.y > h - 12) f.vy *= -1;
            f.vy += (Math.random() - 0.5) * 0.08;

            ctx.save();
            ctx.translate(f.x, f.y);
            ctx.rotate(f.angle * 0.25);
            ctx.fillStyle = f.color;
            ctx.beginPath();
            ctx.moveTo(-f.size, 0);
            ctx.lineTo(-f.size - 7, -5);
            ctx.lineTo(-f.size - 5, 0);
            ctx.lineTo(-f.size - 7, 5);
            ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.ellipse(0, 0, f.size, f.size * 0.55, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(f.size * 0.4, -1.5, f.size * 0.22, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.arc(f.size * 0.5, -1.5, f.size * 0.1, 0, Math.PI * 2); ctx.fill();

            if (f.golden) {
                // 황금 빛 반짝임
                ctx.fillStyle = `rgba(255,215,0,${0.3 + Math.sin(Date.now()*0.01)*0.2})`;
                ctx.beginPath(); ctx.arc(0, 0, f.size + 3, 0, Math.PI*2); ctx.fill();
            }

            ctx.fillStyle = f.golden ? '#000' : '#fff';
            ctx.font = `bold ${Math.max(8, f.size*0.6)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', 0, 0);
            ctx.restore();

            if (Math.random() < 0.03) {
                fishBubbles.push({
                    x: f.x + (Math.random()-0.5)*8,
                    y: f.y - 6,
                    vx: (Math.random()-0.5)*0.3,
                    vy: -0.2 - Math.random()*0.5,
                    life: 1, size: 1 + Math.random()*3,
                    golden: false
                });
            }
        });

        fishBubbles = fishBubbles.filter(b => b.life > 0);
        fishBubbles.forEach(b => {
            b.x += b.vx; b.y += b.vy; b.life -= 0.012;
            const alpha = b.life * (b.golden ? 0.8 : 0.5);
            ctx.fillStyle = b.golden ? `rgba(255,215,0,${alpha})` : `rgba(255,255,255,${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI*2);
            b.golden ? ctx.fill() : ctx.stroke();
        });

        if (gameCollected.length >= GAME_TARGET) {
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 22px "Noto Sans KR"';
            ctx.textAlign = 'center';
            ctx.fillText('🎉 6마리 낚시 완료!', w/2, h/2 - 15);
            ctx.fillText('아래에서 번호를 확인하세요', w/2, h/2 + 20);
            return;
        }
        // 카운터 + 콤보
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(w - 95, h - 55, 88, 50);
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 13px "Noto Sans KR"';
        ctx.textAlign = 'center';
        ctx.fillText(`🐟 ${Math.min(gameCollected.length, GAME_TARGET)}/${GAME_TARGET}`, w - 50, h - 38);
        if (fishCombo >= 2) {
            ctx.fillStyle = '#ff6b35';
            ctx.font = 'bold 11px "Noto Sans KR"';
            ctx.fillText(`🔥 ${fishCombo}콤보!`, w - 50, h - 18);
        }

        gameAnimId = requestAnimationFrame(animate);
    }
    gameAnimId = requestAnimationFrame(animate);
}

// ===================================================================
// 3. 🃏 번호 메모리 카드 — 20장(10쌍) 뒤집어 맞추기, 완료 시 번호 공개
// ===================================================================
let memoryState = null;

function initMemoryGame() {
    stopGame();
    resetGameBasket();
    const el = document.getElementById('gameContentMemory');
    if (!el) return;
    // 10쌍 (20장) — 랜덤 번호
    const pool = Array.from({length: 45}, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const pairNums = pool.slice(0, 10);
    const cards = [];
    pairNums.forEach(num => {
        cards.push({ num, id: cards.length, flipped: false, matched: false });
        cards.push({ num, id: cards.length, flipped: false, matched: false });
    });
    // 셔플
    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }

    memoryState = { cards, flippedIdx: null, locked: false, matchedCount: 0 };

    el.innerHTML = `
        <div class="game-info-box">🃏 카드를 뒤집어 같은 번호 <strong>10쌍</strong>을 찾으세요! 모두 맞추면 번호 공개</div>
        <div class="memory-grid" id="memoryGrid"></div>
    `;
    renderMemoryCards();
}

function renderMemoryCards() {
    const grid = document.getElementById('memoryGrid');
    if (!grid || !memoryState) return;
    grid.innerHTML = memoryState.cards.map((card, idx) => {
        const show = card.flipped || card.matched;
        const cls = typeof getBallClass === 'function' ? getBallClass(card.num) : '';
        return `
            <div class="memory-card${card.flipped ? ' flipped' : ''}${card.matched ? ' matched' : ''}"
                 onclick="flipMemoryCard(${idx})" data-idx="${idx}">
                <div class="memory-card-inner">
                    <div class="memory-card-front">?</div>
                    <div class="memory-card-back ${cls}">${show ? card.num : '?'}</div>
                </div>
            </div>
        `;
    }).join('');
}

function flipMemoryCard(idx) {
    if (!memoryState || memoryState.locked) return;
    const card = memoryState.cards[idx];
    if (card.flipped || card.matched) return;

    card.flipped = true;
    if (typeof playBeep === 'function') playBeep(500, 0.05);

    if (memoryState.flippedIdx === null) {
        // 첫 번째 카드
        memoryState.flippedIdx = idx;
        renderMemoryCards();
    } else if (memoryState.flippedIdx !== idx) {
        // 두 번째 카드
        const first = memoryState.cards[memoryState.flippedIdx];
        if (first.num === card.num) {
            // 매치 성공!
            first.matched = true;
            card.matched = true;
            memoryState.matchedCount++;
            memoryState.flippedIdx = null;
            renderMemoryCards();
            if (typeof playBeep === 'function') playBeep(800, 0.15);
            if (typeof vibrate === 'function') vibrate(30);
            // 매치된 번호 수집
            addCollected(card.num);
            // 6개 수집 완료 시 즉시 종료
            if (gameCollected.length >= GAME_TARGET) {
                onGameComplete();
                return;
            }
        } else {
            // 불일치 — 흔들림 + 뒤집기
            memoryState.locked = true;
            renderMemoryCards();
            // 흔들림 효과 적용
            setTimeout(() => {
                const c1 = document.querySelector(`.memory-card[data-idx="${memoryState.flippedIdx}"]`);
                const c2 = document.querySelector(`.memory-card[data-idx="${idx}"]`);
                if (c1) c1.classList.add('shake');
                if (c2) c2.classList.add('shake');
                if (typeof vibrate === 'function') vibrate([10, 30]);
            }, 50);
            setTimeout(() => {
                first.flipped = false;
                card.flipped = false;
                memoryState.flippedIdx = null;
                memoryState.locked = false;
                renderMemoryCards();
            }, 700);
        }
    }
}

// ===================================================================
// 4. 🎰 번호 슬롯 머신 — 3릴, 2회 돌려 6번호 조합
// ===================================================================
let slotState = null;

function initSlotGame() {
    stopGame();
    resetGameBasket();
    const el = document.getElementById('gameContentSlot');
    if (!el) return;
    slotState = { spinning: false, reels: [0, 0, 0], targetReels: [0, 0, 0], spinCount: 0 };
    el.innerHTML = `
        <div class="game-info-box">🎰 슬롯을 <strong>2회</strong> 돌려 총 6개 번호를 모으세요!</div>
        <div class="slot-machine">
            <div class="slot-display">
                <div class="slot-reel" id="slotReel0"><div class="slot-item">?</div></div>
                <div class="slot-reel" id="slotReel1"><div class="slot-item">?</div></div>
                <div class="slot-reel" id="slotReel2"><div class="slot-item">?</div></div>
            </div>
            <div class="slot-info" id="slotInfo">레버를 당겨 돌려보세요!</div>
        </div>
        <button class="btn btn-gold" id="slotSpinBtn" onclick="spinSlot()" style="width:100%;margin-top:12px;justify-content:center;position:relative;overflow:hidden;">
            <span style="position:relative;z-index:1;">🎰 레버 당기기 (남은 횟수: 2)</span>
        </button>
        <div id="slotResult" class="hidden"></div>
    `;
}

function spinSlot() {
    if (!slotState || slotState.spinning) return;
    if (slotState.spinCount >= 2) return;

    slotState.spinning = true;
    const btn = document.getElementById('slotSpinBtn');
    if (btn) { btn.disabled = true; btn.textContent = '🎰 돌리는 중...'; }

    // 랜덤 타겟 (미수집 번호 우선)
    const available = [];
    for (let i = 1; i <= 45; i++) {
        if (!gameCollected.includes(i)) available.push(i);
    }
    if (available.length < 3) {
        stopGame();
        if (slotState) slotState.spinning = false;
        const btn = document.getElementById('slotSpinBtn');
        if (btn) { btn.disabled = false; btn.textContent = '🎉 조합 완료!'; }
        return;
    }
    // 3개 랜덤 선택
    for (let i = available.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [available[i], available[j]] = [available[j], available[i]];
    }
    slotState.targetReels = available.slice(0, 3);
    slotState.reels = [0, 0, 0];
    slotState._startTime = performance.now();
    slotState._durations = [800 + Math.random() * 600, 1200 + Math.random() * 600, 1600 + Math.random() * 600];
    slotState._stopped = [false, false, false];

    function animateSpin(now) {
        const elapsed = now - slotState._startTime;
        let allStopped = true;

        for (let i = 0; i < 3; i++) {
            const reelEl = document.getElementById('slotReel' + i);
            if (slotState._stopped[i]) continue;
            if (elapsed >= slotState._durations[i]) {
                slotState.reels[i] = slotState.targetReels[i];
                slotState._stopped[i] = true;
                if (reelEl) { reelEl.classList.remove('spinning'); reelEl.classList.add('stopped'); }
                if (typeof playBeep === 'function') playBeep(600 + i * 200, 0.12);
                if (typeof vibrate === 'function') vibrate(20);
            } else {
                // 빠르게 회전하는 효과
                slotState.reels[i] = Math.floor(Math.random() * 45) + 1;
                if (reelEl) reelEl.classList.add('spinning');
                allStopped = false;
            }
        }
        renderSlotReels();

        if (allStopped) {
            slotState.spinning = false;
            slotState.spinCount++;
            slotState.targetReels.forEach(n => addCollected(n));
            const remaining = 2 - slotState.spinCount;

            // 아슬아슬 연출: 2개 이상 같은 색상대면 특별 효과
            const reelNums = slotState.targetReels;
            const reelColors = reelNums.map(n => typeof getBallClass === 'function' ? getBallClass(n) : '');
            const colorCount = {};
            reelColors.forEach(c => colorCount[c] = (colorCount[c]||0)+1);
            const hasNearMiss = Object.values(colorCount).some(c => c >= 2);

            const info = document.getElementById('slotInfo');
            if (info) {
                const colorNames = {yellow:'노랑',blue:'파랑',red:'빨강',gray:'회색',green:'초록'};
                const colors = reelColors.map(c => colorNames[c] || '기타');
                if (hasNearMiss && reelColors[0] === reelColors[1] && reelColors[1] === reelColors[2]) {
                    info.innerHTML = `🎯 당첨: <span style="color:var(--accent-gold);">${reelNums.join(', ')}</span> (${colors.join('/')}) <span style="font-size:1.2rem;">✨ 트리플!</span>`;
                } else if (hasNearMiss) {
                    info.innerHTML = `🎯 당첨: <span style="color:var(--accent-gold);">${reelNums.join(', ')}</span> (${colors.join('/')}) <span style="color:#ff6b35;">😱 아슬아슬!</span>`;
                } else {
                    info.innerHTML = `🎯 당첨: <span style="color:var(--accent-gold);">${reelNums.join(', ')}</span> (${colors.join('/')})`;
                }
            }

            if (hasNearMiss) {
                if (typeof vibrate === 'function') vibrate([30, 15, 30, 15, 50]);
                if (typeof playBeep === 'function') { playBeep(600, 0.1); setTimeout(() => playBeep(800, 0.12), 120); }
            }

            if (btn) {
                btn.disabled = false;
                if (slotState.spinCount >= 2) {
                    btn.textContent = '🎉 조합 완성!';
                    btn.classList.add('hidden');
                    showSlotResult();
                } else {
                    btn.textContent = `🎰 레버 당기기 (남은 횟수: ${remaining})`;
                }
            }
            return;
        }
        gameAnimId = requestAnimationFrame(animateSpin);
    }
    gameAnimId = requestAnimationFrame(animateSpin);
}

function renderSlotReels() {
    if (!slotState) return;
    for (let i = 0; i < 3; i++) {
        const reel = document.getElementById('slotReel' + i);
        if (!reel) continue;
        const num = slotState.reels[i];
        const cls = num > 0 && typeof getBallClass === 'function' ? getBallClass(num) : '';
        reel.innerHTML = num > 0
            ? `<div class="slot-item ball ${cls}" style="width:60px;height:60px;line-height:60px;font-size:1.2rem;margin:auto;">${num}</div>`
            : `<div class="slot-item">?</div>`;
    }
}

function showSlotResult() {
    if (!slotState) return;
    const resultEl = document.getElementById('slotResult');
    if (!resultEl) return;
    resultEl.classList.remove('hidden');
    // gameCollected는 이미 addCollected로 채워져 있음
    const nums = gameCollected.slice(0, GAME_TARGET);
    const analysis = typeof analyzeNumbers === 'function' ? analyzeNumbers(nums) : null;
    const score = analysis && typeof calculateQualityScore === 'function' ? calculateQualityScore(analysis) : null;
    resultEl.innerHTML = `
        <div class="race-result-box" style="border:2px solid #ffd700;">
            <h4 style="color:#ffd700;margin-bottom:12px;">🎰 슬롯 완료! 번호 공개</h4>
            <div class="balls-container" style="padding:8px 0;gap:8px;">
                ${nums.map((n,i) => `<span class="ball ${typeof getBallClass === 'function' ? getBallClass(n) : ''} reveal-ball" style="width:44px;height:44px;line-height:44px;font-size:1rem;animation-delay:${i*0.15}s;">${n}</span>`).join('')}
            </div>
            ${score ? `
            <div class="game-score-card">
                <div class="game-score-main">${score.totalScore}점</div>
                <div class="game-score-grade" style="color:${score.totalScore>=75?'var(--grade-excellent)':score.totalScore>=60?'var(--grade-good)':'var(--grade-normal)'}">${score.grade}</div>
                <div class="game-score-detail">합계 ${analysis.sum} · AC ${analysis.ac} · ${analysis.oddEvenRatio} · ${analysis.lowHighRatio}</div>
            </div>` : ''}
            <button class="btn btn-gold" onclick="resetGameBasket();initSlotGame()" style="margin-top:10px;padding:8px 16px;font-size:0.85rem;">🔄 다시하기</button>
        </div>
    `;
    updateGameBasket();
    if (typeof vibrate === 'function') vibrate([50,30,50,30,100]);
    if (typeof fireConfetti === 'function' && score && score.totalScore >= 70) fireConfetti();
}

// ========== 초기화 ==========
function initGameZone() {
    const raceContent = document.getElementById('gameContentRace');
    if (raceContent && !raceContent.querySelector('canvas')) {
        switchGameTab('race');
    }
}
