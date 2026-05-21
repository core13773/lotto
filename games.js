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
        } else {
            // 불일치 — 잠시 보여주고 뒤집기
            memoryState.locked = true;
            renderMemoryCards();
            if (typeof vibrate === 'function') vibrate([10, 30]);
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
        <button class="btn btn-gold" id="slotSpinBtn" onclick="spinSlot()" style="width:100%;margin-top:12px;justify-content:center;">🎰 레버 당기기 (남은 횟수: 2)</button>
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
    if (available.length < 3) { stopGame(); return; }
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
            if (slotState._stopped[i]) continue;
            if (elapsed >= slotState._durations[i]) {
                slotState.reels[i] = slotState.targetReels[i];
                slotState._stopped[i] = true;
                if (typeof playBeep === 'function') playBeep(600 + i * 200, 0.12);
                if (typeof vibrate === 'function') vibrate(20);
            } else {
                // 빠르게 회전하는 효과
                slotState.reels[i] = Math.floor(Math.random() * 45) + 1;
                allStopped = false;
            }
        }
        renderSlotReels();

        if (allStopped) {
            slotState.spinning = false;
            slotState.spinCount++;
            // 번호 수집
            slotState.targetReels.forEach(n => addCollected(n));
            const remaining = 2 - slotState.spinCount;

            const info = document.getElementById('slotInfo');
            if (info) {
                const colors = slotState.targetReels.map(n => {
                    const c = typeof getBallClass === 'function' ? getBallClass(n) : '';
                    const names = {yellow:'노랑',blue:'파랑',red:'빨강',gray:'회색',green:'초록'};
                    return names[c] || '기타';
                });
                info.innerHTML = `🎯 당첨: <span style="color:var(--accent-gold);">${slotState.targetReels.join(', ')}</span> (${colors.join('/')})`;
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
