// games.js - 미니 게임존: 번호 경마, 번호 낚시터, 번호 블록 깨기, 행운 룰렛

// ========== 공통 ==========
let gameAnimId = null;
let gameCollected = []; // 수집된 번호 {1..45}
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
    if (basket) {
        basket.innerHTML = `
            <div class="game-complete">
                <h4 style="color:var(--accent-gold);">🎉 조합 완성!</h4>
                <div class="balls-container" style="padding:10px 0;gap:6px;">
                    ${nums.map(n => `<span class="ball ${typeof getBallClass === 'function' ? getBallClass(n) : ''}" style="width:42px;height:42px;line-height:42px;font-size:0.9rem;">${n}</span>`).join('')}
                </div>
                ${score ? `<p style="color:var(--text-secondary);font-size:0.85rem;">품질 점수: ${score.totalScore}점 (${score.grade})</p>` : ''}
                <button class="btn btn-gold" onclick="resetGameBasket()" style="margin-top:8px;padding:8px 20px;font-size:0.85rem;">🔄 다시하기</button>
            </div>
        `;
    }
    if (typeof vibrate === 'function') vibrate([50, 30, 50, 30, 100]);
    if (typeof playBeep === 'function') { playBeep(600, 0.1); setTimeout(() => playBeep(800, 0.15), 150); }
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
        basket.innerHTML = '<span style="color:var(--text-secondary);font-size:0.85rem;">번호를 모아보세요! (0/6)</span>';
        return;
    }
    basket.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;">
            <span style="color:var(--text-secondary);font-size:0.75rem;">모은 번호 (${gameCollected.length}/${GAME_TARGET}):</span>
            ${gameCollected.map(n => `<span class="ball ${typeof getBallClass === 'function' ? getBallClass(n) : ''}" style="width:32px;height:32px;line-height:32px;font-size:0.75rem;">${n}</span>`).join('')}
        </div>
    `;
}

// ========== 게임존 탭 전환 ==========
function switchGameTab(name) {
    stopGame();
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
// 1.  번호 경마
// ===================================================================
let raceState = null;

function initRaceGame() {
    stopGame();
    resetGameBasket();
    const el = document.getElementById('gameContentRace');
    if (!el) return;
    el.innerHTML = `
        <div class="game-info-box">🏇 8마리 번호 말 중 <strong>한 마리</strong>를 골라 응원하세요!</div>
        <canvas id="raceCanvas" class="game-canvas" width="520" height="380"></canvas>
        <div class="race-picks" id="racePicks"></div>
        <div id="raceResult" class="hidden"></div>
    `;
    const canvas = document.getElementById('raceCanvas');
    const ctx = canvas.getContext('2d');

    // 말 8마리: 랜덤 번호
    const pool = Array.from({length: 45}, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const horses = pool.slice(0, 8).map((num, i) => ({
        num, lane: i,
        x: 60, y: 55 + i * 40,
        speed: 0, baseSpeed: 1.2 + Math.random() * 1.8,
        color: ['#ffd700','#60a5fa','#f87171','#9ca3af','#34d399','#f97316','#a78bfa','#fbbf24'][i],
        finished: false, rank: 0
    }));

    // 선택 버튼
    const picksDiv = document.getElementById('racePicks');
    picksDiv.innerHTML = horses.map((h, i) => `
        <button class="race-pick-btn" data-idx="${i}" style="border-left:4px solid ${h.color};">
            <span class="ball ${typeof getBallClass === 'function' ? getBallClass(h.num) : ''}" style="width:28px;height:28px;line-height:28px;font-size:0.7rem;">${h.num}</span>
            <span style="color:var(--text-secondary);font-size:0.75rem;">${i+1}번마</span>
        </button>
    `).join('');

    let pickedIdx = -1;
    picksDiv.querySelectorAll('.race-pick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (raceState?.running) return;
            picksDiv.querySelectorAll('.race-pick-btn').forEach(b => b.classList.remove('picked'));
            btn.classList.add('picked');
            pickedIdx = parseInt(btn.dataset.idx);
            document.getElementById('raceStartBtn').disabled = false;
        });
    });

    const startBtn = document.createElement('button');
    startBtn.id = 'raceStartBtn';
    startBtn.className = 'btn btn-gold';
    startBtn.style.cssText = 'width:100%;margin-top:10px;justify-content:center;';
    startBtn.textContent = '🏁 경주 시작!';
    startBtn.disabled = true;
    startBtn.onclick = () => {
        if (pickedIdx < 0) return;
        startRace(horses, pickedIdx, canvas, ctx);
    };
    picksDiv.after(startBtn);

    // 초기 그리기
    drawRaceTrack(ctx, canvas.width, canvas.height, horses);
}

function drawRaceTrack(ctx, w, h, horses) {
    ctx.fillStyle = '#3a7d3a';
    ctx.fillRect(0, 0, w, h);
    // 트랙 라인
    for (let i = 0; i < 8; i++) {
        const y = 45 + i * 40;
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(30, y, w - 30, 32);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.strokeRect(30, y, w - 30, 32);
        // 레인 번호
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${i+1}`, 28, y + 20);
    }
    // 결승선
    const finishX = w - 60;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(finishX, 40, 3, h - 50);
    ctx.fillStyle = '#fff';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    for (let yy = 45; yy < h - 10; yy += 10) {
        ctx.fillStyle = (Math.floor(yy / 10) % 2 === 0) ? '#fff' : 'rgba(0,0,0,0.5)';
        ctx.fillRect(finishX - 3, yy, 6, 6);
    }
    // 말
    horses.forEach(h => {
        drawHorse(ctx, h);
    });
}

function drawHorse(ctx, horse) {
    const {x, y, color, num} = horse;
    // 말 이모지 대신 도형
    ctx.save();
    ctx.translate(x, y + 5);
    // 몸통
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(6, 0, 12, 7, 0, 0, Math.PI * 2); ctx.fill();
    // 머리
    ctx.beginPath(); ctx.arc(20, -4, 6, 0, Math.PI * 2); ctx.fill();
    // 다리
    ctx.fillStyle = '#333';
    ctx.fillRect(2, 6, 2, 8);
    ctx.fillRect(10, 6, 2, 8);
    // 번호
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(num, 6, 3);
    ctx.restore();
}

function startRace(horses, pickedIdx, canvas, ctx) {
    stopGame();
    const w = canvas.width, h = canvas.height;
    let startTime = performance.now();
    const finishX = w - 75;
    let rankings = [];
    let finishedCount = 0;
    let particles = [];
    const commentary = [];

    raceState = { running: true };

    function addCommentary(text) {
        commentary.push(text);
        if (commentary.length > 4) commentary.shift();
    }

    function spawnParticles(x, y) {
        for (let i = 0; i < 6; i++) {
            particles.push({
                x, y, vx: -Math.random() * 3 - 1, vy: (Math.random() - 0.5) * 3,
                life: 1, size: 1 + Math.random() * 2
            });
        }
    }

    function animate(now) {
        const elapsed = (now - startTime) / 1000;
        ctx.clearRect(0, 0, w, h);
        drawRaceTrack(ctx, w, h, horses);

        horses.forEach(h => {
            if (h.finished) return;
            // 변속: 랜덤 가속/감속
            const burst = Math.sin(elapsed * 3 + h.lane) * 0.6 + Math.random() * 0.8;
            h.speed = Math.max(0.6, Math.min(3.5, h.baseSpeed + burst));
            // 막판 스퍼트 (x가 finishX-100 넘으면)
            if (h.x > finishX - 120) {
                h.speed += Math.random() * 1.5;
            }
            // 지침 효과 (너무 빨리 달리면)
            if (h.x > finishX - 200 && h.x < finishX - 100 && Math.random() < 0.02) {
                h.speed *= 0.4; // 급격한 감속 → 긴장감
                spawnParticles(h.x + 18, h.y + 5);
                addCommentary(`${h.num}번 급격히 둔화!`);
            }
            h.x += h.speed;

            // 먼지 파티클
            if (Math.random() < 0.4) spawnParticles(h.x + 2, h.y + 12);

            if (h.x >= finishX && !h.finished) {
                h.finished = true;
                h.x = finishX;
                finishedCount++;
                h.rank = finishedCount;
                rankings.push(h);
                if (finishedCount <= 3) {
                    const place = ['🥇', '🥈', '🥉'][finishedCount - 1];
                    addCommentary(`${place} ${h.num}번 도착!`);
                    if (typeof playBeep === 'function') playBeep(400 + finishedCount * 200, 0.12);
                }
            }
        });

        // 파티클
        particles = particles.filter(p => p.life > 0);
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.life -= 0.04;
            ctx.fillStyle = `rgba(180,150,100,${p.life})`;
            ctx.fillRect(p.x, p.y, p.size, p.size);
        });

        // 실황 코멘터리
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(10, h - 65, 250, 55);
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 12px "Noto Sans KR"';
        ctx.textAlign = 'left';
        commentary.slice(-3).forEach((txt, i) => {
            ctx.fillText(txt, 16, h - 50 + i * 16);
        });

        if (finishedCount >= 8) {
            raceState.running = false;
            showRaceResult(horses, pickedIdx, rankings);
            return;
        }
        gameAnimId = requestAnimationFrame(animate);
    }

    addCommentary('🏁 경주 시작!');
    gameAnimId = requestAnimationFrame(animate);
}

function showRaceResult(horses, pickedIdx, rankings) {
    const resultEl = document.getElementById('raceResult');
    if (!resultEl) return;
    const pickedHorse = horses[pickedIdx];
    const isWin = pickedHorse.rank === 1;
    const isPlace = pickedHorse.rank <= 3;
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = `
        <div class="race-result-box" style="border:2px solid ${isWin ? '#ffd700' : 'var(--text-secondary)'};">
            <h4 style="color:${isWin ? '#ffd700' : isPlace ? '#60a5fa' : 'var(--text-secondary)'};margin-bottom:10px;">
                ${isWin ? '🎉 우승!' : isPlace ? '👏 입상!' : '😢 아쉽네요'}
            </h4>
            <p style="color:var(--text-primary);">응원마: <span class="ball ${typeof getBallClass === 'function' ? getBallClass(pickedHorse.num) : ''}" style="width:36px;height:36px;line-height:36px;">${pickedHorse.num}</span> → <strong>${pickedHorse.rank}위</strong></p>
            <div style="margin-top:10px;font-size:0.8rem;color:var(--text-secondary);">
                ${rankings.map(r => `${['🥇','🥈','🥉','4','5','6','7','8'][r.rank-1]} ${r.num}번`).join(' · ')}
            </div>
            ${isPlace ? `<button class="btn btn-gold" onclick="addCollected(${pickedHorse.num});document.getElementById('raceResult').classList.add('hidden');" style="margin-top:10px;padding:8px 16px;font-size:0.85rem;">🎱 ${pickedHorse.num}번 획득!</button>` : ''}
            <button class="btn btn-secondary" onclick="initRaceGame()" style="margin-top:6px;padding:6px 16px;font-size:0.8rem;">🔄 다시 경주</button>
        </div>
    `;
    if (isPlace) {
        addCollected(pickedHorse.num);
        if (typeof fireConfetti === 'function' && isWin) fireConfetti();
    }
}

// ===================================================================
// 2.  번호 낚시터
// ===================================================================
let fishList = [], fishBubbles = [];

function initFishingGame() {
    stopGame();
    resetGameBasket();
    const el = document.getElementById('gameContentFishing');
    if (!el) return;
    el.innerHTML = `
        <div class="game-info-box">🎣 번호 물고기를 터치해서 낚아보세요! <strong>6마리</strong>를 모으면 완성</div>
        <canvas id="fishCanvas" class="game-canvas" width="400" height="350"></canvas>
    `;
    const canvas = document.getElementById('fishCanvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;

    // 물고기 생성
    fishList = [];
    fishBubbles = [];
    const usedNums = new Set(gameCollected);
    const pool = [];
    for (let i = 1; i <= 45; i++) if (!usedNums.has(i)) pool.push(i);
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const candidates = pool.slice(0, 12);

    candidates.forEach(num => {
        fishList.push({
            num,
            x: 40 + Math.random() * (w - 80),
            y: 40 + Math.random() * (h - 80),
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.2,
            size: 14 + Math.random() * 8,
            color: ['#ffd700','#60a5fa','#f87171','#34d399','#f97316','#a78bfa'][Math.floor(Math.random() * 6)],
            angle: Math.random() * Math.PI * 2,
            caught: false
        });
    });

    canvas.onclick = (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (w / rect.width);
        const my = (e.clientY - rect.top) * (h / rect.height);
        // 가장 가까운 물고기 찾기
        let bestFish = null, bestDist = 35;
        fishList.forEach(f => {
            if (f.caught) return;
            const dist = Math.hypot(f.x - mx, f.y - my);
            if (dist < bestDist) { bestDist = dist; bestFish = f; }
        });
        if (bestFish) {
            bestFish.caught = true;
            // 낚시 효과 파티클
            for (let i = 0; i < 10; i++) {
                fishBubbles.push({
                    x: bestFish.x, y: bestFish.y,
                    vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 4 - 2,
                    life: 1, size: 2 + Math.random() * 3
                });
            }
            addCollected(bestFish.num);
            if (typeof playBeep === 'function') playBeep(500, 0.08);
            if (typeof vibrate === 'function') vibrate(20);
            // 새 물고기 추가
            if (gameCollected.length < GAME_TARGET && fishList.filter(f => !f.caught).length < 4) {
                const remaining = [];
                for (let i = 1; i <= 45; i++) {
                    const used = new Set([...gameCollected, ...fishList.map(f => f.num)]);
                    if (!used.has(i)) remaining.push(i);
                }
                if (remaining.length > 0) {
                    const newNum = remaining[Math.floor(Math.random() * remaining.length)];
                    fishList.push({
                        num: newNum,
                        x: 40 + Math.random() * (w - 80),
                        y: 40 + Math.random() * (h - 80),
                        vx: (Math.random() - 0.5) * 1.5,
                        vy: (Math.random() - 0.5) * 1.2,
                        size: 14 + Math.random() * 8,
                        color: ['#ffd700','#60a5fa','#f87171','#34d399','#f97316','#a78bfa'][Math.floor(Math.random() * 6)],
                        angle: Math.random() * Math.PI * 2,
                        caught: false
                    });
                }
            }
        }
    };

    function animate() {
        ctx.clearRect(0, 0, w, h);
        // 물 배경
        const waterGrad = ctx.createLinearGradient(0, 0, 0, h);
        waterGrad.addColorStop(0, '#0a3d62');
        waterGrad.addColorStop(1, '#0c5e8a');
        ctx.fillStyle = waterGrad;
        ctx.fillRect(0, 0, w, h);

        // 빛줄기
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        for (let i = 0; i < 5; i++) {
            ctx.fillRect(50 + i * 80, 0, 3, h);
            ctx.fillRect(30 + i * 80, 0, 1, h);
        }

        // 물고기
        fishList.forEach(f => {
            if (f.caught) return;
            f.x += f.vx;
            f.y += f.vy;
            f.angle += 0.02;
            if (f.x < 15 || f.x > w - 15) f.vx *= -1;
            if (f.y < 15 || f.y > h - 15) f.vy *= -1;
            // 약간의 궤적 변화
            f.vy += (Math.random() - 0.5) * 0.1;

            ctx.save();
            ctx.translate(f.x, f.y);
            ctx.rotate(f.angle * 0.3);

            // 꼬리
            ctx.fillStyle = f.color;
            ctx.beginPath();
            ctx.moveTo(-f.size, 0);
            ctx.lineTo(-f.size - 8, -6);
            ctx.lineTo(-f.size - 6, 0);
            ctx.lineTo(-f.size - 8, 6);
            ctx.closePath();
            ctx.fill();

            // 몸통
            ctx.fillStyle = f.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, f.size, f.size * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();

            // 눈
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(f.size * 0.4, -2, f.size * 0.25, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.arc(f.size * 0.5, -2, f.size * 0.12, 0, Math.PI * 2); ctx.fill();

            // 번호
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.max(9, f.size * 0.65)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(f.num, 0, 0);

            ctx.restore();

            // 간헐적 거품
            if (Math.random() < 0.02) {
                fishBubbles.push({
                    x: f.x + (Math.random() - 0.5) * 10,
                    y: f.y - 8,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: -0.3 - Math.random() * 0.6,
                    life: 1, size: 1 + Math.random() * 3
                });
            }
        });

        // 거품
        fishBubbles = fishBubbles.filter(b => b.life > 0);
        fishBubbles.forEach(b => {
            b.x += b.vx; b.y += b.vy;
            b.life -= 0.015;
            ctx.strokeStyle = `rgba(255,255,255,${b.life * 0.5})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2); ctx.stroke();
        });

        if (gameCollected.length >= GAME_TARGET) {
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 20px "Noto Sans KR"';
            ctx.textAlign = 'center';
            ctx.fillText('🎉 조합 완성!', w/2, h/2);
            return;
        }
        gameAnimId = requestAnimationFrame(animate);
    }
    gameAnimId = requestAnimationFrame(animate);
}

// ===================================================================
// 3.  번호 블록 깨기
// ===================================================================
let breakoutState = null;

function initBreakoutGame() {
    stopGame();
    resetGameBasket();
    const el = document.getElementById('gameContentBreakout');
    if (!el) return;
    el.innerHTML = `
        <div class="game-info-box">🧱 블록을 깨서 번호를 모으세요! 패들이 하단에서 움직입니다.</div>
        <canvas id="breakoutCanvas" class="game-canvas" width="400" height="420"></canvas>
    `;
    const canvas = document.getElementById('breakoutCanvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;

    // 패들
    const paddle = { x: w / 2 - 40, y: h - 30, w: 80, h: 12 };

    // 공
    const ball = { x: w / 2, y: h - 50, vx: 2.5, vy: -3, r: 6 };

    // 블록 9×5 = 45개
    const blocks = [];
    const blockW = (w - 40) / 9;
    const blockH = 22;
    for (let i = 0; i < 45; i++) {
        const row = Math.floor(i / 9);
        const col = i % 9;
        const num = i + 1;
        blocks.push({
            num,
            x: 15 + col * blockW + 2,
            y: 40 + row * blockH + 2,
            w: blockW - 4,
            h: blockH - 4,
            alive: true,
            color: ['#ffd700','#60a5fa','#f87171','#9ca3af','#34d399'][Math.floor(num / 10)]
        });
    }

    breakoutState = { paddle, ball, blocks, score: 0 };

    // 마우스/터치로 패들 이동
    function movePaddle(clientX) {
        const rect = canvas.getBoundingClientRect();
        const mx = (clientX - rect.left) * (w / rect.width);
        paddle.x = Math.max(0, Math.min(w - paddle.w, mx - paddle.w / 2));
    }
    canvas.addEventListener('mousemove', e => movePaddle(e.clientX));
    canvas.addEventListener('touchmove', e => { e.preventDefault(); movePaddle(e.touches[0].clientX); }, {passive: false});

    function animate() {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#0a0a2e';
        ctx.fillRect(0, 0, w, h);

        // 블록
        blocks.forEach(b => {
            if (!b.alive) return;
            ctx.fillStyle = b.color;
            ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(b.num, b.x + b.w / 2, b.y + b.h / 2);
        });

        // 패들
        ctx.fillStyle = '#00f5ff';
        ctx.beginPath();
        ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 6);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(paddle.x + 4, paddle.y + 2, paddle.w - 8, 3);

        // 공
        ball.x += ball.vx;
        ball.y += ball.vy;

        // 벽 충돌
        if (ball.x - ball.r < 0 || ball.x + ball.r > w) ball.vx *= -1;
        if (ball.y - ball.r < 0) ball.vy *= -1;
        if (ball.y + ball.r > h) {
            // 공 놓침 - 새 공
            ball.x = w / 2; ball.y = h - 50;
            ball.vx = 2.5 * (Math.random() > 0.5 ? 1 : -1);
            ball.vy = -3;
        }

        // 패들 충돌
        if (ball.y + ball.r >= paddle.y && ball.y - ball.r < paddle.y + paddle.h &&
            ball.x > paddle.x && ball.x < paddle.x + paddle.w) {
            ball.vy = -Math.abs(ball.vy);
            const hitPos = (ball.x - paddle.x) / paddle.w;
            ball.vx = (hitPos - 0.5) * 5;
            if (typeof vibrate === 'function') vibrate(10);
        }

        // 블록 충돌
        blocks.forEach(b => {
            if (!b.alive) return;
            if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w &&
                ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
                b.alive = false;
                ball.vy *= -1;
                breakoutState.score++;
                addCollected(b.num);
                if (typeof playBeep === 'function') playBeep(300 + b.num * 15, 0.06);
            }
        });

        // 공 그리기
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(ball.x - 2, ball.y - 2, 2, 0, Math.PI * 2); ctx.fill();

        // 점수
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 14px "Noto Sans KR"';
        ctx.textAlign = 'left';
        ctx.fillText(`깬 블록: ${breakoutState.score}`, 10, h - 10);

        if (gameCollected.length >= GAME_TARGET) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 20px "Noto Sans KR"';
            ctx.textAlign = 'center';
            ctx.fillText('🎉 6개 수집 완료!', w/2, h/2);
            return;
        }
        gameAnimId = requestAnimationFrame(animate);
    }
    gameAnimId = requestAnimationFrame(animate);
}

// ===================================================================
// 4.  행운 룰렛
// ===================================================================
let rouletteState = null;

function initRouletteGame() {
    stopGame();
    resetGameBasket();
    const el = document.getElementById('gameContentRoulette');
    if (!el) return;
    el.innerHTML = `
        <div class="game-info-box">🎡 룰렛을 돌려 번호를 뽑으세요! <strong>6개</strong>를 모으면 조합 완성</div>
        <canvas id="rouletteCanvas" class="game-canvas" width="400" height="400"></canvas>
        <button class="btn btn-gold" id="rouletteSpinBtn" onclick="spinRoulette()" style="width:100%;margin-top:10px;justify-content:center;">🎡 룰렛 돌리기</button>
    `;
    rouletteState = { spinning: false, angle: 0, targetAngle: 0, speed: 0, selectedNum: null };
    drawRoulette();
}

function drawRoulette() {
    const canvas = document.getElementById('rouletteCanvas');
    if (!canvas || !rouletteState) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const outerR = Math.min(w, h) / 2 - 25;
    const innerR = outerR * 0.55;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0a2e';
    ctx.fillRect(0, 0, w, h);

    // 45개 슬라이스
    const { angle } = rouletteState;
    const sliceAngle = (Math.PI * 2) / 45;

    for (let i = 0; i < 45; i++) {
        const startAngle = angle + i * sliceAngle;
        const endAngle = startAngle + sliceAngle;
        const num = i + 1;
        const cls = typeof getBallClass === 'function' ? getBallClass(num) : 'gray';
        const colors = { yellow: '#ffd700', blue: '#3b82f6', red: '#ef4444', gray: '#6b7280', green: '#10b981' };

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, outerR, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = colors[cls] || '#6b7280';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 번호
        const midAngle = startAngle + sliceAngle / 2;
        const textR = outerR * 0.78;
        ctx.save();
        ctx.translate(cx + Math.cos(midAngle) * textR, cy + Math.sin(midAngle) * textR);
        ctx.rotate(midAngle + Math.PI / 2);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(num, 0, 0);
        ctx.restore();
    }

    // 중심 원
    const centerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
    centerGrad.addColorStop(0, '#1a1a3a');
    centerGrad.addColorStop(1, '#0a0a1a');
    ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fillStyle = centerGrad;
    ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 포인터 (상단)
    ctx.fillStyle = '#ff006e';
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR - 5);
    ctx.lineTo(cx - 10, cy - outerR + 10);
    ctx.lineTo(cx + 10, cy - outerR + 10);
    ctx.closePath();
    ctx.fill();

    // 포인터 번호 표시
    if (rouletteState.selectedNum !== null) {
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 28px "Noto Sans KR"';
        ctx.textAlign = 'center';
        ctx.fillText(rouletteState.selectedNum, cx, cy + 8);
    }
}

function spinRoulette() {
    if (!rouletteState || rouletteState.spinning) return;
    rouletteState.spinning = true;
    document.getElementById('rouletteSpinBtn').disabled = true;
    document.getElementById('rouletteSpinBtn').textContent = '🎡 돌리는 중...';
    rouletteState.selectedNum = null;

    const sliceAngle = (Math.PI * 2) / 45;
    // 랜덤 타겟 번호 (아직 수집 안 된 것 우선)
    const available = [];
    for (let i = 1; i <= 45; i++) {
        if (!gameCollected.includes(i)) available.push(i);
    }
    if (available.length === 0) return;
    const targetNum = available[Math.floor(Math.random() * available.length)];
    // 타겟 각도: 포인터가 상단(0°)에 있으므로, targetNum 슬라이스의 중앙이 상단에 오려면
    const targetSliceCenter = (targetNum - 1) * sliceAngle + sliceAngle / 2;
    rouletteState.targetAngle = rouletteState.angle + Math.PI * 2 * 8 + (Math.PI * 2 - targetSliceCenter);
    rouletteState.speed = 0.3;
    rouletteState.targetNum = targetNum;

    function animate() {
        const delta = rouletteState.targetAngle - rouletteState.angle;
        if (Math.abs(delta) < 0.0005) {
            rouletteState.angle = rouletteState.targetAngle;
            rouletteState.spinning = false;
            rouletteState.selectedNum = rouletteState.targetNum;
            drawRoulette();
            addCollected(rouletteState.targetNum);
            if (typeof playBeep === 'function') playBeep(1000, 0.3);
            if (typeof vibrate === 'function') vibrate(80);
            document.getElementById('rouletteSpinBtn').disabled = gameCollected.length >= GAME_TARGET;
            document.getElementById('rouletteSpinBtn').textContent = gameCollected.length >= GAME_TARGET ? '🎉 완성!' : '🎡 룰렛 돌리기';
            return;
        }
        // 감속: 마지막에 더 천천히
        const remaining = Math.abs(delta);
        rouletteState.speed = Math.max(0.002, remaining * 0.06);
        rouletteState.angle += Math.sign(delta) * rouletteState.speed;
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
