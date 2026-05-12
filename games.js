// games.js - 미니 게임존: 번호 경마, 번호 낚시터, 번호 블록 깨기, 행운 룰렛
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
    gameCollected.push(num);
    gameCollected.sort((a, b) => a - b);
    updateGameBasket();
    if (gameCollected.length >= GAME_TARGET) onGameComplete();
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
        case 'breakout': initBreakoutGame(); break;
        case 'roulette': initRouletteGame(); break;
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
        <canvas id="raceCanvas" class="game-canvas" width="520" height="520"></canvas>
        <div id="raceResult" class="hidden"></div>
        <button class="btn btn-gold" id="raceStartBtn" onclick="startRace()" style="width:100%;margin-top:8px;justify-content:center;">🏁 경주 시작!</button>
    `;
    initRaceCanvas();
}

function initRaceCanvas() {
    const canvas = document.getElementById('raceCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;

    // 12마리 말 (1~45 중 랜덤)
    const pool = Array.from({length: 45}, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const horses = pool.slice(0, 12).map((num, i) => ({
        num, lane: i,
        x: 50, y: 42 + i * 38,
        speed: 0, baseSpeed: 1.0 + Math.random() * 2.2,
        color: ['#ffd700','#60a5fa','#f87171','#9ca3af','#34d399','#f97316','#a78bfa','#fbbf24','#f472b6','#818cf8','#fb923c','#4ade80'][i],
        finished: false, rank: 0
    }));

    raceState = { horses, running: false, finished: [], particles: [], startTime: 0 };

    function draw() {
        ctx.clearRect(0, 0, w, h);
        // 잔디
        ctx.fillStyle = '#2d5a1e';
        ctx.fillRect(0, 0, w, h);

        // 트랙 레인
        const horses = raceState.horses;
        for (let i = 0; i < 12; i++) {
            const y = 34 + i * 38;
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            ctx.fillRect(25, y, w - 40, 30);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.strokeRect(25, y, w - 40, 30);
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`${i+1}`, 23, y + 18);
        }

        // 결승선
        const finishX = w - 55;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(finishX, 30, 3, h - 40);
        for (let yy = 34; yy < h - 10; yy += 8) {
            ctx.fillStyle = (Math.floor(yy / 8) % 2 === 0) ? '#fff' : '#333';
            ctx.fillRect(finishX - 2, yy, 5, 5);
        }

        // 말 그리기
        horses.forEach(h => {
            drawHorseSprite(ctx, h);
        });

        // 파티클
        raceState.particles = raceState.particles.filter(p => p.life > 0);
        raceState.particles.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.life -= 0.03;
            ctx.fillStyle = `rgba(180,150,100,${p.life})`;
            ctx.fillRect(p.x, p.y, p.size, p.size);
        });

        // 완주자 표시
        if (raceState.finished.length > 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(w - 70, 10, 65, raceState.finished.length * 22 + 10);
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('도착', w - 38, 28);
            raceState.finished.forEach((h, i) => {
                ctx.fillStyle = h.color;
                ctx.font = 'bold 10px sans-serif';
                ctx.fillText(`${i+1}위`, w - 38, 46 + i * 20);
            });
        }

        // 출발 전
        if (!raceState.running && raceState.finished.length === 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 22px "Noto Sans KR"';
            ctx.textAlign = 'center';
            ctx.fillText('🏁 경주 시작! 버튼을 누르세요', w/2, h/2);
        }
    }
    draw();
}

function drawHorseSprite(ctx, h) {
    const {x, y, color} = h;
    ctx.save();
    ctx.translate(x, y + 3);
    // 몸통
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(6, 0, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
    // 머리
    ctx.beginPath(); ctx.arc(18, -3, 5, 0, Math.PI * 2); ctx.fill();
    // 다리
    ctx.fillStyle = '#222';
    ctx.fillRect(1, 5, 2, 7); ctx.fillRect(9, 5, 2, 7);
    // ? 표시 (완주 전)
    if (!h.finished) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('?', 6, 2);
    } else {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(h.num, 6, 2);
    }
    ctx.restore();
}

function startRace() {
    const canvas = document.getElementById('raceCanvas');
    const btn = document.getElementById('raceStartBtn');
    if (!canvas || !btn || !raceState || raceState.running) return;
    stopGame();

    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const finishX = w - 70;

    raceState.running = true;
    raceState.finished = [];
    raceState.particles = [];
    raceState.startTime = performance.now();
    raceState.horses.forEach(h => { h.x = 50; h.finished = false; h.rank = 0; h.speed = 0; });
    btn.disabled = true;
    btn.textContent = '🏇 경주 중...';

    function spawnParticles(x, y) {
        for (let i = 0; i < 4; i++) {
            raceState.particles.push({
                x, y, vx: -Math.random() * 2 - 0.5, vy: (Math.random() - 0.5) * 2,
                life: 1, size: 1 + Math.random() * 2
            });
        }
    }

    function animate(now) {
        const elapsed = (now - raceState.startTime) / 1000;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#2d5a1e';
        ctx.fillRect(0, 0, w, h);

        // 트랙
        for (let i = 0; i < 12; i++) {
            const y = 34 + i * 38;
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            ctx.fillRect(25, y, w - 40, 30);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.strokeRect(25, y, w - 40, 30);
        }

        // 결승선
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(finishX, 30, 3, h - 40);
        for (let yy = 34; yy < h - 10; yy += 8) {
            ctx.fillStyle = (Math.floor(yy / 8) % 2 === 0) ? '#fff' : '#333';
            ctx.fillRect(finishX - 2, yy, 5, 5);
        }

        // 말 이동 + 그리기
        raceState.horses.forEach(h => {
            if (h.finished) { drawHorseSprite(ctx, h); return; }

            const burst = Math.sin(elapsed * 2.7 + h.lane * 0.8) * 0.5 + Math.random() * 0.7;
            h.speed = Math.max(0.4, Math.min(3.8, h.baseSpeed + burst));
            // 막판 스퍼트
            if (h.x > finishX - 130) h.speed += Math.random() * 1.6;
            // 긴장감: 갑작스런 둔화
            if (h.x > finishX - 220 && h.x < finishX - 100 && Math.random() < 0.015) {
                h.speed *= 0.3; spawnParticles(h.x + 15, h.y + 8);
            }
            h.x += h.speed;
            if (Math.random() < 0.35) spawnParticles(h.x + 1, h.y + 10);

            if (h.x >= finishX && !h.finished) {
                h.finished = true; h.x = finishX;
                h.rank = raceState.finished.length + 1;
                raceState.finished.push(h);
                if (typeof playBeep === 'function') playBeep(350 + h.rank * 70, 0.1);
            }
            drawHorseSprite(ctx, h);
        });

        // 파티클
        raceState.particles = raceState.particles.filter(p => p.life > 0);
        raceState.particles.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.life -= 0.03;
            ctx.fillStyle = `rgba(180,150,100,${p.life})`;
            ctx.fillRect(p.x, p.y, p.size, p.size);
        });

        // 완주 순위판
        if (raceState.finished.length > 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(w - 75, 8, 72, Math.min(raceState.finished.length, 12) * 22 + 12);
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('순위', w - 38, 26);
            raceState.finished.forEach((h, i) => {
                ctx.fillStyle = i < 6 ? '#ffd700' : '#888';
                ctx.font = `bold ${i < 6 ? 11 : 9}px sans-serif`;
                const label = i < 6 ? `${['🥇','🥈','🥉','4','5','6'][i]} ${h.num}` : `${i+1}위`;
                ctx.fillText(label, w - 38, 44 + i * 20);
            });
        }

        if (raceState.finished.length >= 12) {
            raceState.running = false;
            btn.disabled = false;
            btn.textContent = '🔄 다시 경주';
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
        <div class="game-info-box">🎣 물고기를 터치해서 낚으세요! <strong>6마리</strong>를 낚으면 번호가 공개됩니다 (총 45마리)</div>
        <canvas id="fishCanvas" class="game-canvas" width="400" height="380"></canvas>
    `;
    const canvas = document.getElementById('fishCanvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;

    // 45마리 물고기
    fishList = [];
    fishBubbles = [];
    for (let num = 1; num <= 45; num++) {
        fishList.push({
            num,
            x: 25 + Math.random() * (w - 50),
            y: 25 + Math.random() * (h - 50),
            vx: (Math.random() - 0.5) * 1.3,
            vy: (Math.random() - 0.5) * 1.0,
            size: 10 + Math.random() * 5,
            color: ['#ffd700','#60a5fa','#f87171','#34d399','#f97316','#a78bfa'][Math.floor(Math.random() * 6)],
            angle: Math.random() * Math.PI * 2,
            caught: false
        });
    }

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
            for (let i = 0; i < 12; i++) {
                fishBubbles.push({
                    x: bestFish.x, y: bestFish.y,
                    vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 5 - 3,
                    life: 1, size: 2 + Math.random() * 4
                });
            }
            addCollected(bestFish.num);
            if (typeof playBeep === 'function') playBeep(500, 0.08);
            if (typeof vibrate === 'function') vibrate(20);
        }
    };

    function animate() {
        ctx.clearRect(0, 0, w, h);
        const waterGrad = ctx.createLinearGradient(0, 0, 0, h);
        waterGrad.addColorStop(0, '#0a3d62');
        waterGrad.addColorStop(1, '#0c5e8a');
        ctx.fillStyle = waterGrad;
        ctx.fillRect(0, 0, w, h);

        // 빛줄기
        ctx.fillStyle = 'rgba(255,255,255,0.025)';
        for (let i = 0; i < 6; i++) ctx.fillRect(40 + i * 70, 0, 2, h);

        // 물고기
        fishList.forEach(f => {
            if (f.caught) return;
            f.x += f.vx; f.y += f.vy; f.angle += 0.02;
            if (f.x < 12 || f.x > w - 12) f.vx *= -1;
            if (f.y < 12 || f.y > h - 12) f.vy *= -1;
            f.vy += (Math.random() - 0.5) * 0.08;

            ctx.save();
            ctx.translate(f.x, f.y);
            ctx.rotate(f.angle * 0.25);

            // 꼬리
            ctx.fillStyle = f.color;
            ctx.beginPath();
            ctx.moveTo(-f.size, 0);
            ctx.lineTo(-f.size - 7, -5);
            ctx.lineTo(-f.size - 5, 0);
            ctx.lineTo(-f.size - 7, 5);
            ctx.closePath(); ctx.fill();

            // 몸통
            ctx.beginPath();
            ctx.ellipse(0, 0, f.size, f.size * 0.55, 0, 0, Math.PI * 2);
            ctx.fill();

            // 눈
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(f.size * 0.4, -1.5, f.size * 0.22, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.arc(f.size * 0.5, -1.5, f.size * 0.1, 0, Math.PI * 2); ctx.fill();

            // ? 표시
            ctx.fillStyle = '#fff';
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
                    life: 1, size: 1 + Math.random()*3
                });
            }
        });

        // 거품
        fishBubbles = fishBubbles.filter(b => b.life > 0);
        fishBubbles.forEach(b => {
            b.x += b.vx; b.y += b.vy; b.life -= 0.012;
            ctx.strokeStyle = `rgba(255,255,255,${b.life*0.5})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI*2); ctx.stroke();
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
        // 카운터
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(w - 95, h - 35, 88, 28);
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 13px "Noto Sans KR"';
        ctx.textAlign = 'center';
        ctx.fillText(`🐟 ${Math.min(gameCollected.length, GAME_TARGET)}/${GAME_TARGET}`, w - 50, h - 14);

        gameAnimId = requestAnimationFrame(animate);
    }
    gameAnimId = requestAnimationFrame(animate);
}

// ===================================================================
// 3. 🧱 번호 블록 깨기 — 45개 ? 블록, 랜덤 배치, 클리어 축하
// ===================================================================
let breakoutState = null;
let breakoutCleared = false;
let breakoutMouseHandler = null;
let breakoutTouchHandler = null;

function initBreakoutGame() {
    stopGame();
    resetGameBasket();
    breakoutCleared = false;
    const el = document.getElementById('gameContentBreakout');
    if (!el) return;
    el.innerHTML = `
        <div class="game-info-box">🧱 모든 블록을 깨면 번호가 공개됩니다! (마우스/터치로 패들 조작)</div>
        <canvas id="breakoutCanvas" class="game-canvas" width="400" height="440"></canvas>
    `;
    const canvas = document.getElementById('breakoutCanvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;

    const paddle = { x: w/2 - 42, y: h - 28, w: 84, h: 12 };
    const ball = { x: w/2, y: h - 55, vx: 2.8, vy: -3.3, r: 6 };

    // 45개 번호 랜덤 배치
    const nums = Array.from({length: 45}, (_, i) => i + 1);
    for (let i = nums.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [nums[i], nums[j]] = [nums[j], nums[i]];
    }
    const blocks = [];
    const blockW = (w - 36) / 9;
    const blockH = 20;
    for (let i = 0; i < 45; i++) {
        const row = Math.floor(i / 9);
        const col = i % 9;
        blocks.push({
            num: nums[i],
            x: 14 + col * blockW + 1,
            y: 38 + row * blockH + 1,
            w: blockW - 2, h: blockH - 2,
            alive: true,
            color: ['#ffd700','#60a5fa','#f87171','#9ca3af','#34d399'][Math.floor(nums[i] / 10)]
        });
    }

    breakoutState = { paddle, ball, blocks, aliveCount: 45 };

    function movePaddle(clientX) {
        const rect = canvas.getBoundingClientRect();
        const mx = (clientX - rect.left) * (w / rect.width);
        paddle.x = Math.max(0, Math.min(w - paddle.w, mx - paddle.w/2));
    }
    // 이전 리스너 제거 후 재등록 (중복 방지)
    if (breakoutMouseHandler) canvas.removeEventListener('mousemove', breakoutMouseHandler);
    if (breakoutTouchHandler) canvas.removeEventListener('touchmove', breakoutTouchHandler);
    breakoutMouseHandler = e => movePaddle(e.clientX);
    breakoutTouchHandler = e => { e.preventDefault(); movePaddle(e.touches[0].clientX); };
    canvas.addEventListener('mousemove', breakoutMouseHandler);
    canvas.addEventListener('touchmove', breakoutTouchHandler, {passive: false});

    function animate() {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#0a0a2e';
        ctx.fillRect(0, 0, w, h);

        // 블록
        blocks.forEach(b => {
            if (!b.alive) {
                // 깨진 블록 자리에 반짝임
                if (Math.random() < 0.3) {
                    ctx.fillStyle = 'rgba(255,255,255,0.05)';
                    ctx.fillRect(b.x, b.y, b.w, b.h);
                }
                return;
            }
            ctx.fillStyle = b.color;
            ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, 3);
            // ?
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', b.x + b.w/2, b.y + b.h/2);
        });

        // 패들
        const paddleGrad = ctx.createLinearGradient(0, paddle.y, 0, paddle.y + paddle.h);
        paddleGrad.addColorStop(0, '#00f5ff'); paddleGrad.addColorStop(1, '#0088cc');
        ctx.fillStyle = paddleGrad;
        ctx.beginPath(); ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 6); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(paddle.x + 4, paddle.y + 2, paddle.w - 8, 3);

        // 공
        ball.x += ball.vx; ball.y += ball.vy;
        if (ball.x - ball.r < 0 || ball.x + ball.r > w) ball.vx *= -1;
        if (ball.y - ball.r < 0) ball.vy *= -1;
        if (ball.y + ball.r > h) {
            ball.x = w/2; ball.y = h - 55;
            ball.vx = 2.8 * (Math.random() > 0.5 ? 1 : -1);
            ball.vy = -3.3;
        }

        // 패들 충돌
        if (ball.y + ball.r >= paddle.y && ball.y - ball.r < paddle.y + paddle.h &&
            ball.x > paddle.x && ball.x < paddle.x + paddle.w) {
            ball.vy = -Math.abs(ball.vy);
            ball.vx = ((ball.x - paddle.x) / paddle.w - 0.5) * 5.5;
            if (typeof vibrate === 'function') vibrate(8);
        }

        // 블록 충돌
        blocks.forEach(b => {
            if (!b.alive) return;
            if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w &&
                ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
                b.alive = false;
                breakoutState.aliveCount--;
                ball.vy *= -1;
                if (typeof playBeep === 'function') playBeep(300 + (45 - breakoutState.aliveCount) * 8, 0.05);
                if (typeof vibrate === 'function') vibrate(12);
            }
        });

        // 공 그리기
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.arc(ball.x - 2, ball.y - 2, 2, 0, Math.PI*2); ctx.fill();

        // 카운터
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(w - 90, h - 32, 82, 25);
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 12px "Noto Sans KR"';
        ctx.textAlign = 'center';
        ctx.fillText(`🧱 ${breakoutState.aliveCount}/45`, w - 48, h - 14);

        // 전부 클리어!
        if (breakoutState.aliveCount === 0 && !breakoutCleared) {
            breakoutCleared = true;
            // 축하 애니메이션
            showBreakoutClear(blocks, w, h);
            return;
        }

        if (breakoutCleared) return;
        gameAnimId = requestAnimationFrame(animate);
    }
    gameAnimId = requestAnimationFrame(animate);
}

function showBreakoutClear(blocks, w, h) {
    // 모든 블록 번호 수집 → 추천 번호 6개 선택
    const allNums = blocks.map(b => b.num);
    // 점수 기반 정렬 (DB 통계 활용)
    let ranked = allNums;
    if (typeof computeNumberScores === 'function') {
        const scores = computeNumberScores();
        if (scores) {
            ranked = allNums.sort((a, b) => (scores[a]?.recScore || 99) - (scores[b]?.recScore || 99));
        }
    }
    gameCollected = ranked.slice(0, GAME_TARGET).sort((a, b) => a - b);

    const canvas = document.getElementById('breakoutCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animT = 0;

    function clearAnim() {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#0a0a2e';
        ctx.fillRect(0, 0, w, h);

        // 반짝이는 축하 효과
        for (let i = 0; i < 30; i++) {
            const px = (Math.sin(animT * 0.05 + i * 0.7) * 0.5 + 0.5) * w;
            const py = (Math.cos(animT * 0.04 + i * 0.9) * 0.5 + 0.5) * h;
            const hue = (animT * 2 + i * 8) % 360;
            ctx.fillStyle = `hsla(${hue}, 80%, 60%, ${0.3 + Math.sin(animT*0.1+i)*0.3})`;
            ctx.beginPath(); ctx.arc(px, py, 4 + Math.random()*3, 0, Math.PI*2); ctx.fill();
        }

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 24px "Noto Sans KR"';
        ctx.textAlign = 'center';
        const scale = 1 + Math.sin(animT * 0.08) * 0.1;
        ctx.save();
        ctx.translate(w/2, h/2 - 40);
        ctx.scale(scale, scale);
        ctx.fillText('🎉 ALL CLEAR!', 0, 0);
        ctx.restore();

        ctx.fillStyle = '#fff';
        ctx.font = '16px "Noto Sans KR"';
        ctx.fillText('추천 번호를 확인하세요!', w/2, h/2 + 20);

        // 6개 번호 공개
        gameCollected.forEach((n, i) => {
            const bx = w/2 - 110 + i * 40;
            const by = h/2 + 50;
            const cls = typeof getBallClass === 'function' ? getBallClass(n) : 'gray';
            const colors = { yellow: '#ffd700', blue: '#60a5fa', red: '#f87171', gray: '#9ca3af', green: '#34d399' };
            ctx.fillStyle = colors[cls] || '#9ca3af';
            ctx.beginPath(); ctx.arc(bx + 16, by + 16, 16, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(n, bx + 16, by + 16);
        });

        animT++;
        if (animT < 120) {
            gameAnimId = requestAnimationFrame(clearAnim);
        } else {
            updateGameBasket();
            onGameComplete();
        }
    }
    gameAnimId = requestAnimationFrame(clearAnim);
}

// ===================================================================
// 4. 🎡 행운 룰렛 — ? 슬롯, 스핀 후 번호 공개
// ===================================================================
let rouletteState = null;

function initRouletteGame() {
    stopGame();
    resetGameBasket();
    const el = document.getElementById('gameContentRoulette');
    if (!el) return;
    el.innerHTML = `
        <div class="game-info-box">🎡 룰렛을 돌려 번호를 뽑으세요! <strong>6개</strong>를 모으면 완성</div>
        <canvas id="rouletteCanvas" class="game-canvas" width="400" height="420"></canvas>
    `;
    rouletteState = { spinning: false, angle: 0, targetAngle: 0, speed: 0, targetNum: null, revealedNums: [] };
    drawRoulette();

    // 버튼 추가 (중복 생성 방지)
    let btnContainer = document.getElementById('rouletteBtnContainer');
    if (!btnContainer) {
        const canvas = document.getElementById('rouletteCanvas');
        btnContainer = document.createElement('div');
        btnContainer.id = 'rouletteBtnContainer';
        btnContainer.style.cssText = 'display:flex;gap:8px;margin-top:8px;';
        btnContainer.innerHTML = `
            <button class="btn btn-gold" id="rouletteSpinBtn" onclick="spinRoulette()" style="flex:1;justify-content:center;">🎡 룰렛 돌리기</button>
        `;
        canvas.after(btnContainer);
    } else {
        const btn = document.getElementById('rouletteSpinBtn');
        if (btn) { btn.disabled = false; btn.textContent = gameCollected.length >= GAME_TARGET ? '🎉 완성!' : '🎡 룰렛 돌리기'; }
    }
}

function drawRoulette() {
    const canvas = document.getElementById('rouletteCanvas');
    if (!canvas || !rouletteState) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w/2, cy = h/2 + 10;
    const outerR = Math.min(w, h)/2 - 30;
    const innerR = outerR * 0.5;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0a2e';
    ctx.fillRect(0, 0, w, h);

    // 외부 장식 링
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, outerR + 8, 0, Math.PI*2); ctx.stroke();

    const { angle } = rouletteState;
    const sliceAngle = (Math.PI * 2) / 45;

    for (let i = 0; i < 45; i++) {
        const startAngle = angle + i * sliceAngle;
        const endAngle = startAngle + sliceAngle;
        const num = i + 1;
        const cls = typeof getBallClass === 'function' ? getBallClass(num) : 'gray';
        const colors = { yellow: '#e6b800', blue: '#2563eb', red: '#dc2626', gray: '#4b5563', green: '#059669' };

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, outerR, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = colors[cls] || '#4b5563';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // ? 표시
        const midAngle = startAngle + sliceAngle / 2;
        const textR = outerR * 0.72;
        ctx.save();
        ctx.translate(cx + Math.cos(midAngle) * textR, cy + Math.sin(midAngle) * textR);
        ctx.rotate(midAngle + Math.PI/2);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', 0, 0);
        ctx.restore();
    }

    // 중심 원
    const centerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
    centerGrad.addColorStop(0, '#1a1a3a');
    centerGrad.addColorStop(1, '#0a0a1a');
    ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, Math.PI*2);
    ctx.fillStyle = centerGrad; ctx.fill();
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3; ctx.stroke();

    // 포인터 (상단)
    ctx.fillStyle = '#ff006e';
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR - 6);
    ctx.lineTo(cx - 12, cy - outerR + 12);
    ctx.lineTo(cx + 12, cy - outerR + 12);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();

    // 중앙 번호
    if (rouletteState.targetNum !== null && !rouletteState.spinning) {
        const cls = typeof getBallClass === 'function' ? getBallClass(rouletteState.targetNum) : 'gray';
        const ballColors = { yellow: '#ffd700', blue: '#60a5fa', red: '#f87171', gray: '#9ca3af', green: '#34d399' };
        ctx.fillStyle = ballColors[cls] || '#9ca3af';
        ctx.beginPath(); ctx.arc(cx, cy, innerR * 0.65, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rouletteState.targetNum, cx, cy);
    } else if (rouletteState.spinning) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // 회전 중 애니메이션
        const dots = ['.', '..', '...'][Math.floor(Date.now() / 300) % 3];
        ctx.fillText(dots, cx, cy);
    } else {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', cx, cy);
    }

    // 게이지 표시줄
    if (!rouletteState.spinning && rouletteState.targetNum === null) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(w/2 - 60, h - 35, 120, 22);
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 13px "Noto Sans KR"';
        ctx.textAlign = 'center';
        ctx.fillText('🎯 START', w/2, h - 20);
    }
}

function spinRoulette() {
    if (!rouletteState || rouletteState.spinning) return;
    if (gameCollected.length >= GAME_TARGET) return;

    rouletteState.spinning = true;
    rouletteState.targetNum = null;
    const btn = document.getElementById('rouletteSpinBtn');
    if (btn) { btn.disabled = true; btn.textContent = '🎡 돌리는 중...'; }

    // 랜덤 타겟 (미수집 번호 우선)
    const available = [];
    for (let i = 1; i <= 45; i++) {
        if (!gameCollected.includes(i)) available.push(i);
    }
    if (available.length === 0) return;
    const targetNum = available[Math.floor(Math.random() * available.length)];

    const sliceAngle = (Math.PI * 2) / 45;
    const targetSliceCenter = (targetNum - 1) * sliceAngle + sliceAngle / 2;
    // 여러 바퀴 회전 + 타겟 위치까지
    const spins = 6 + Math.floor(Math.random() * 5); // 6~10바퀴
    rouletteState.targetAngle = rouletteState.angle + Math.PI * 2 * spins + (Math.PI * 2 - ((rouletteState.angle + targetSliceCenter) % (Math.PI * 2)));
    // 타겟이 포인터에 오게: 포인터는 상단(angle=0 기준). 슬라이스 중앙이 상단에 오려면 angle + targetSliceCenter ≡ 0 (mod 2π)
    const currentMod = ((rouletteState.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const needed = (Math.PI * 2 - ((currentMod + targetSliceCenter) % (Math.PI * 2))) % (Math.PI * 2);
    rouletteState.targetAngle = rouletteState.angle + Math.PI * 2 * spins + needed;
    rouletteState.speed = 0.25;
    rouletteState.targetNum = targetNum;

    function animate() {
        const delta = rouletteState.targetAngle - rouletteState.angle;
        const absDelta = Math.abs(delta);

        if (absDelta < 0.0008) {
            rouletteState.angle = rouletteState.targetAngle;
            rouletteState.spinning = false;
            drawRoulette();
            addCollected(rouletteState.targetNum);
            if (typeof playBeep === 'function') playBeep(1000, 0.3);
            if (typeof vibrate === 'function') vibrate(80);
            const btn = document.getElementById('rouletteSpinBtn');
            if (btn) {
                btn.disabled = false;
                btn.textContent = gameCollected.length >= GAME_TARGET ? '🎉 완성!' : '🎡 룰렛 돌리기';
            }
            return;
        }

        // 감속 곡선: 빠르게 → 천천히
        const progress = absDelta / (Math.PI * 2 * spins);
        rouletteState.speed = 0.02 + progress * 0.28;
        rouletteState.angle += Math.sign(delta) * rouletteState.speed;
        // 각도 정규화
        rouletteState.angle = rouletteState.angle % (Math.PI * 2 * 100);

        drawRoulette();
        gameAnimId = requestAnimationFrame(animate);
    }
    gameAnimId = requestAnimationFrame(animate);
}

// ========== 초기화 ==========
function initGameZone() {
    const raceContent = document.getElementById('gameContentRace');
    if (raceContent && !raceContent.querySelector('canvas')) {
        switchGameTab('race');
    }
}
