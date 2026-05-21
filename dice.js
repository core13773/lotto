// dice.js — 주사위 존: 요트, 듀얼, 보드게임, 점괘, 번호생성기, 복불복 챌린지
let currentDiceTab = 'yacht';
let diceCollected = [];
const DICE_TARGET = 6;
let boardTimeoutHandle = null;

function stopDice() {
    if (boardTimeoutHandle) { clearTimeout(boardTimeoutHandle); boardTimeoutHandle = null; }
}

function getAvailable(existing) {
    const avail = [];
    for (let i = 1; i <= 45; i++) { if (!existing.includes(i)) avail.push(i); }
    return avail;
}

function addDiceCollected(num) {
    if (diceCollected.length >= DICE_TARGET) return;
    if (diceCollected.includes(num)) return;
    diceCollected.push(num);
    diceCollected.sort((a, b) => a - b);
    updateDiceBasket();
    if (diceCollected.length >= DICE_TARGET) onDiceComplete();
    if (typeof _hook === 'function') _hook('addCollected', num);
}

function resetDiceBasket() {
    diceCollected = [];
    updateDiceBasket();
    stopDice();
}

function updateDiceBasket() {
    const basket = document.getElementById('diceBasket');
    if (!basket) return;
    if (diceCollected.length === 0) {
        basket.innerHTML = '<span style="color:var(--text-secondary);font-size:0.85rem;">🎲 아직 모은 번호가 없습니다 (0/6)</span>';
        return;
    }
    const showAll = diceCollected.length >= DICE_TARGET;
    basket.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;">
            <span style="color:var(--text-secondary);font-size:0.75rem;">모은 번호:</span>
            ${diceCollected.map((n, i) => {
                const show = showAll || i === diceCollected.length - 1;
                if (show) return `<span class="ball ${typeof getBallClass === 'function' ? getBallClass(n) : ''}" style="width:30px;height:30px;line-height:30px;font-size:0.7rem;">${n}</span>`;
                return `<span class="ball hidden-ball" style="width:30px;height:30px;line-height:30px;font-size:0.7rem;">?</span>`;
            }).join('')}
            <span style="color:var(--text-secondary);font-size:0.7rem;">(${Math.min(diceCollected.length, DICE_TARGET)}/${DICE_TARGET})</span>
        </div>
    `;
}

function onDiceComplete() {
    stopDice();
    const nums = diceCollected.slice(0, DICE_TARGET);
    const analysis = typeof analyzeNumbers === 'function' ? analyzeNumbers(nums) : null;
    const score = analysis && typeof calculateQualityScore === 'function' ? calculateQualityScore(analysis) : null;
    const basket = document.getElementById('diceBasket');
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
                    <div class="game-score-main">${score.totalScore}点</div>
                    <div class="game-score-grade" style="color:${score.totalScore>=75?'var(--grade-excellent)':score.totalScore>=60?'var(--grade-good)':'var(--grade-normal)'}">${score.grade}</div>
                    <div class="game-score-detail">합계 ${analysis.sum} · AC ${analysis.ac} · ${analysis.oddEvenRatio} · ${analysis.lowHighRatio}</div>
                </div>` : ''}
            </div>
            <button class="btn btn-gold" onclick="resetDiceBasket();switchDiceTab(currentDiceTab)" style="margin-top:10px;padding:8px 20px;font-size:0.85rem;">🔄 다시하기</button>
        </div>
    `;
    if (typeof vibrate === 'function') vibrate([50, 30, 50, 30, 100]);
    if (typeof playBeep === 'function') { playBeep(600, 0.1); setTimeout(() => playBeep(800, 0.15), 150); setTimeout(() => playBeep(1000, 0.2), 300); }
    if (typeof fireConfetti === 'function' && score && score.totalScore >= 75) fireConfetti();
    if (typeof trackMission === 'function') trackMission('play_game');
}

function switchDiceTab(name) {
    stopDice();
    resetDiceBasket();
    currentDiceTab = name;
    document.querySelectorAll('.dice-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.dice-content').forEach(c => c.classList.remove('active'));
    const tab = document.querySelector(`.dice-tab[data-dice="${name}"]`);
    const content = document.getElementById('diceContent' + name.charAt(0).toUpperCase() + name.slice(1));
    if (tab) tab.classList.add('active');
    if (content) content.classList.add('active');
    switch (name) {
        case 'yacht': initYacht(); break;
        case 'battle': initBattle(); break;
        case 'board': initBoard(); break;
        case 'fortune': initFortune(); break;
        case 'generator': initGenerator(); break;
        case 'challenge': initChallenge(); break;
    }
}

// ========== 유틸: 주사위 면 그리기 ==========
function drawDieFace(ctx, x, y, size, value, held) {
    const r = size / 2 - 2;
    ctx.fillStyle = held ? '#ffd700' : '#fff';
    ctx.shadowColor = held ? 'rgba(255,215,0,0.6)' : 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = held ? 8 : 4;
    ctx.beginPath();
    ctx.roundRect(x - r, y - r, size, size, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = held ? '#ffd700' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = held ? 2.5 : 1;
    ctx.stroke();

    if (held) {
        ctx.fillStyle = 'rgba(255,215,0,0.2)';
        ctx.beginPath();
        ctx.roundRect(x - r, y - r, size, size, 6);
        ctx.fill();
    }

    const dotR = size * 0.08;
    ctx.fillStyle = '#1a1a2e';
    const dots = {
        1: [[0, 0]],
        2: [[-1, -1], [1, 1]],
        3: [[-1, -1], [0, 0], [1, 1]],
        4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
        5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
        6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]
    };
    (dots[value] || []).forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.arc(x + dx * size * 0.25, y + dy * size * 0.25, dotR, 0, Math.PI * 2);
        ctx.fill();
    });
}

// ===================================================================
// 1. 🎲 주사위 요트 (Dice Yacht)
// ===================================================================
// 족보 카테고리 (renderYachtScorecard + scoreYacht 공유)
const YACHT_CATS = [
    { key: 'aces', label: 'Aces (1)', icon: '⚀', calc: d => d.filter(v => v === 1).length * 1 },
    { key: 'deuces', label: 'Deuces (2)', icon: '⚁', calc: d => d.filter(v => v === 2).length * 2 },
    { key: 'threes', label: 'Threes (3)', icon: '⚂', calc: d => d.filter(v => v === 3).length * 3 },
    { key: 'fours', label: 'Fours (4)', icon: '⚃', calc: d => d.filter(v => v === 4).length * 4 },
    { key: 'fives', label: 'Fives (5)', icon: '⚄', calc: d => d.filter(v => v === 5).length * 5 },
    { key: 'sixes', label: 'Sixes (6)', icon: '⚅', calc: d => d.filter(v => v === 6).length * 6 },
    { key: 'choice', label: 'Choice', icon: '🎯', calc: d => d.reduce((a, b) => a + b, 0) },
    { key: 'fourKind', label: '4 of a Kind', icon: '💎', calc: d => { const cnt = {}; d.forEach(v => cnt[v] = (cnt[v]||0)+1); return Object.values(cnt).some(c => c >= 4) ? d.reduce((a,b)=>a+b,0) : 0; }},
    { key: 'fullHouse', label: 'Full House', icon: '🏠', calc: d => { const cnt = {}; d.forEach(v => cnt[v] = (cnt[v]||0)+1); const vals = Object.values(cnt); return (vals.includes(3) && vals.includes(2)) ? 25 : 0; }},
    { key: 'sStraight', label: 'S. Straight', icon: '📈', calc: d => { const s = [...new Set(d)].sort((a,b)=>a-b); for(let i=0;i<=s.length-4;i++) if(s[i+3]-s[i]===3) return 30; return 0; }},
    { key: 'lStraight', label: 'L. Straight', icon: '🚀', calc: d => { const s = [...new Set(d)].sort((a,b)=>a-b); return s.length===5 && (s[4]-s[0]===4) ? 40 : 0; }},
    { key: 'yacht', label: 'YACHT!', icon: '👑', calc: d => new Set(d).size === 1 ? 50 : 0 },
];
const YACHT_CATS_MAP = {};
YACHT_CATS.forEach(c => { YACHT_CATS_MAP[c.key] = c.calc; });

let yachtState = null;

function initYacht() {
    stopDice();
    resetDiceBasket();
    const el = document.getElementById('diceContentYacht');
    if (!el) return;
    el.innerHTML = `
        <div class="game-info-box">🎲 주사위 5개를 최대 <strong>3회</strong> 굴려 족보를 완성하세요! 족보 점수를 합산해 번호를 받습니다.</div>
        <canvas id="yachtCanvas" width="440" height="130"></canvas>
        <div id="yachtRollInfo" style="text-align:center;color:var(--text-secondary);font-size:0.85rem;margin:5px 0;">남은 굴림: 3회</div>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:8px 0;" id="yachtControls">
            <button class="btn btn-gold" onclick="rollYachtDice()" id="yachtRollBtn" style="padding:8px 24px;">🎲 주사위 굴리기</button>
        </div>
        <div class="yacht-scorecard" id="yachtScorecard"></div>
    `;
    yachtState = { dice: [1,1,1,1,1], held: [false,false,false,false,false], rollsLeft: 3, scores: {}, turn: 0 };

    // 캔버스 클릭 → 홀드 (탭 전환 시 이전 리스너는 innerHTML 교체로 자연 소멸)
    const canvas = document.getElementById('yachtCanvas');
    if (canvas) {
        canvas.onclick = function(e) {
            if (!yachtState || yachtState.rollsLeft >= 3) return;
            const rect = canvas.getBoundingClientRect();
            // CSS max-width:100% 축소 보정
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const mx = (e.clientX - rect.left) * scaleX;
            const my = (e.clientY - rect.top) * scaleY;
            const rects = canvas._diceRects;
            if (!rects) return;
            rects.forEach(r => {
                if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
                    yachtState.held[r.idx] = !yachtState.held[r.idx];
                    renderYachtDice();
                    renderYachtScorecard();
                    if (typeof playBeep === 'function') playBeep(500, 0.05);
                }
            });
        };
    }
    renderYachtDice();
    renderYachtScorecard();
}

function renderYachtDice() {
    const canvas = document.getElementById('yachtCanvas');
    if (!canvas || !yachtState) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.roundRect(5, 5, w - 10, h - 10, 12); ctx.fill();

    const dieSize = 62, spacing = 78, startX = 55, y = h / 2;
    yachtState.dice.forEach((v, i) => {
        const x = startX + i * spacing;
        drawDieFace(ctx, x, y, dieSize, v, yachtState.held[i]);
    });

    canvas._diceRects = yachtState.dice.map((_, i) => {
        const x = startX + i * spacing;
        return { x: x - dieSize/2, y: y - dieSize/2, w: dieSize, h: dieSize, idx: i };
    });
}

function rollYachtDice() {
    if (!yachtState || yachtState.rollsLeft <= 0) return;
    yachtState.dice = yachtState.dice.map((v, i) => yachtState.held[i] ? v : Math.floor(Math.random() * 6) + 1);
    yachtState.rollsLeft--;
    const infoEl = document.getElementById('yachtRollInfo');
    if (infoEl) infoEl.textContent = `남은 굴림: ${yachtState.rollsLeft}회`;
    renderYachtDice();
    if (typeof playBeep === 'function') playBeep(400 + Math.random() * 200, 0.08);
    if (yachtState.rollsLeft <= 0) {
        const btn = document.getElementById('yachtRollBtn');
        if (btn) btn.textContent = '📋 점수 기록하기';
    }
}

function renderYachtScorecard() {
    const el = document.getElementById('yachtScorecard');
    if (!el || !yachtState) return;

    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:4px;margin-top:10px;">';
    YACHT_CATS.forEach(c => {
        const used = yachtState.scores[c.key] !== undefined;
        const score = used ? yachtState.scores[c.key] : (yachtState.rollsLeft < 3 ? c.calc(yachtState.dice) : '-');
        const canUse = !used && yachtState.rollsLeft < 3;
        html += `<div class="yacht-cat ${used ? 'used' : ''} ${canUse ? 'clickable' : ''}"
            ${canUse ? `onclick="scoreYacht('${c.key}')"` : ''}
            style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:rgba(0,0,0,0.2);border-radius:8px;font-size:0.8rem;${canUse?'cursor:pointer;border:1px solid rgba(255,215,0,0.3);':''}${used?'opacity:0.5;':''}">
            <span>${c.icon} ${c.label}</span>
            <span style="font-weight:700;color:${used?'var(--text-secondary)':'var(--accent-gold)'};">${used ? score : (canUse ? score : '-')}</span>
        </div>`;
    });
    html += '</div>';
    el.innerHTML = html;
}

function scoreYacht(key) {
    if (!yachtState || yachtState.scores[key] !== undefined) return;
    const calcFn = YACHT_CATS_MAP[key];
    if (!calcFn) return;

    yachtState.scores[key] = calcFn(yachtState.dice);
    yachtState.turn++;

    const scoreVal = yachtState.scores[key];
    let num;
    if (scoreVal >= 40) num = Math.floor(Math.random() * 6) + 35;
    else if (scoreVal >= 20) num = Math.floor(Math.random() * 10) + 21;
    else if (scoreVal >= 10) num = Math.floor(Math.random() * 10) + 11;
    else num = Math.floor(Math.random() * 10) + 1;

    const avail = getAvailable(diceCollected);
    if (avail.length > 0) {
        num = avail.reduce((a, b) => Math.abs(b - num) < Math.abs(a - num) ? b : a);
    }
    addDiceCollected(num);

    yachtState.dice = [1,1,1,1,1];
    yachtState.held = [false,false,false,false,false];
    yachtState.rollsLeft = 3;
    const infoEl = document.getElementById('yachtRollInfo');
    const btn = document.getElementById('yachtRollBtn');
    if (infoEl) infoEl.textContent = '남은 굴림: 3회';
    if (btn) btn.textContent = '🎲 주사위 굴리기';
    renderYachtDice();
    renderYachtScorecard();

    if (typeof playBeep === 'function') playBeep(800, 0.12);
    if (typeof vibrate === 'function') vibrate(30);

    if (Object.keys(yachtState.scores).length >= YACHT_CATS.length) {
        if (btn) { btn.disabled = true; btn.textContent = '게임 완료!'; }
    }
}

// ===================================================================
// 2. ⚔️ 주사위 듀얼 (Dice Battle)
// ===================================================================
let battleState = null;

function initBattle() {
    stopDice();
    resetDiceBasket();
    const el = document.getElementById('diceContentBattle');
    if (!el) return;
    el.innerHTML = `
        <div class="game-info-box">⚔️ AI와 주사위 대결! <strong>3판 2선승제</strong>로 승리할 때마다 번호를 획득합니다.</div>
        <div id="battleArena" style="display:grid;grid-template-columns:1fr auto 1fr;gap:15px;align-items:center;text-align:center;margin:15px 0;">
            <div id="playerSide">
                <h4 style="color:var(--accent-cyan);">🙋 당신</h4>
                <canvas id="playerDiceCanvas" width="280" height="70"></canvas>
                <div id="playerHandLabel" style="font-size:0.8rem;color:var(--text-secondary);">-</div>
                <div style="font-size:0.85rem;color:var(--accent-gold);" id="playerScore">0승</div>
            </div>
            <div style="font-size:2rem;font-weight:900;color:var(--accent-pink);">VS</div>
            <div id="cpuSide">
                <h4 style="color:var(--accent-pink);">🤖 AI</h4>
                <canvas id="cpuDiceCanvas" width="280" height="70"></canvas>
                <div id="cpuHandLabel" style="font-size:0.8rem;color:var(--text-secondary);">-</div>
                <div style="font-size:0.85rem;color:var(--accent-gold);" id="cpuScore">0승</div>
            </div>
        </div>
        <div id="battleResult" style="text-align:center;min-height:40px;"></div>
        <button class="btn btn-gold" onclick="startBattleRound()" id="battleBtn" style="width:100%;">⚔️ 대결 시작!</button>
    `;
    battleState = { playerWins: 0, cpuWins: 0, round: 0 };
}

function rollBattleDice() {
    return Array.from({length: 5}, () => Math.floor(Math.random() * 6) + 1);
}

function evalHand(dice) {
    const cnt = {}; dice.forEach(v => cnt[v] = (cnt[v]||0)+1);
    const vals = Object.values(cnt);
    const uniq = [...new Set(dice)].sort((a,b)=>a-b);
    if (new Set(dice).size === 1) return { name: 'YACHT!', rank: 9 };
    if (uniq.length === 5 && uniq[4]-uniq[0] === 4) return { name: 'Large Straight', rank: 8 };
    if (vals.includes(4)) return { name: 'Four of a Kind', rank: 7 };
    if (vals.includes(3) && vals.includes(2)) return { name: 'Full House', rank: 6 };
    for (let i=0;i<=uniq.length-4;i++) if (uniq[i+3]-uniq[i]===3) return { name: 'S. Straight', rank: 5 };
    if (vals.includes(3)) return { name: 'Three of a Kind', rank: 4 };
    if (vals.filter(v=>v===2).length === 2) return { name: 'Two Pair', rank: 3 };
    if (vals.includes(2)) return { name: 'One Pair', rank: 2 };
    return { name: 'High Card', rank: 1 };
}

function renderBattleDice(canvasId, dice) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dieSize = 44, spacing = 52, startX = 30, y = 35;
    dice.forEach((v, i) => {
        drawDieFace(ctx, startX + i * spacing, y, dieSize, v, false);
    });
}

function startBattleRound() {
    if (!battleState) return;
    if (battleState.playerWins >= 2 || battleState.cpuWins >= 2) {
        battleState.playerWins = 0; battleState.cpuWins = 0;
        const ps = document.getElementById('playerScore'); if (ps) ps.textContent = '0승';
        const cs = document.getElementById('cpuScore'); if (cs) cs.textContent = '0승';
    }
    battleState.round++;
    const btn = document.getElementById('battleBtn');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = '🎲 굴리는 중...';

    const playerDice = rollBattleDice();
    const cpuDice = rollBattleDice();
    renderBattleDice('playerDiceCanvas', playerDice);
    renderBattleDice('cpuDiceCanvas', cpuDice);

    const playerHand = evalHand(playerDice);
    const cpuHand = evalHand(cpuDice);
    const plEl = document.getElementById('playerHandLabel'); if (plEl) plEl.textContent = playerHand.name;
    const clEl = document.getElementById('cpuHandLabel'); if (clEl) clEl.textContent = cpuHand.name;

    let resultText, winner;
    if (playerHand.rank > cpuHand.rank) {
        battleState.playerWins++; winner = 'player';
        resultText = `🎉 승리! (${playerHand.name} vs ${cpuHand.name})`;
    } else if (cpuHand.rank > playerHand.rank) {
        battleState.cpuWins++; winner = 'cpu';
        resultText = `😞 패배... (${playerHand.name} vs ${cpuHand.name})`;
    } else {
        const pSum = playerDice.reduce((a,b)=>a+b,0);
        const cSum = cpuDice.reduce((a,b)=>a+b,0);
        if (pSum > cSum) { battleState.playerWins++; winner = 'player'; resultText = `🎉 합계 승리! (${pSum} vs ${cSum})`; }
        else if (cSum > pSum) { battleState.cpuWins++; winner = 'cpu'; resultText = `😞 합계 패배... (${pSum} vs ${cSum})`; }
        else { resultText = `🤝 무승부! (${pSum} vs ${cSum})`; winner = 'draw'; }
    }

    const ps = document.getElementById('playerScore'); if (ps) ps.textContent = battleState.playerWins + '승';
    const cs = document.getElementById('cpuScore'); if (cs) cs.textContent = battleState.cpuWins + '승';
    const br = document.getElementById('battleResult');
    if (br) br.innerHTML = `<div style="color:${winner==='player'?'var(--grade-excellent)':winner==='cpu'?'var(--grade-caution)':'var(--text-secondary)'};font-weight:700;">${resultText}</div>`;

    if (winner === 'player') {
        const avail = getAvailable(diceCollected);
        const num = avail.length > 0 ? avail[Math.floor(Math.random() * avail.length)] : Math.floor(Math.random()*45)+1;
        addDiceCollected(num);
        if (typeof vibrate === 'function') vibrate(50);
    }

    const finalWinner = battleState.playerWins >= 2 ? 'player' : battleState.cpuWins >= 2 ? 'cpu' : null;
    if (finalWinner) {
        setTimeout(() => {
            const br2 = document.getElementById('battleResult');
            if (br2) br2.innerHTML += `
                <div style="margin-top:8px;font-size:1.2rem;color:${finalWinner==='player'?'var(--accent-gold)':'var(--text-secondary)'};">
                    ${finalWinner==='player' ? '🏆 최종 승리! 번호를 모두 획득하세요!' : '💪 다음 기회에... 다시 도전하세요!'}
                </div>`;
            if (btn) { btn.disabled = false; btn.textContent = '🔄 다시 대결!'; }
            if (finalWinner === 'player' && typeof fireConfetti === 'function') fireConfetti();
        }, 600);
    } else {
        setTimeout(() => {
            if (btn) { btn.disabled = false; btn.textContent = `⚔️ ${battleState.round}라운드 대결!`; }
        }, 600);
    }
}

// ===================================================================
// 3. 🏃 주사위 보드게임 (Dice Board Game)
// ===================================================================
let boardState = null;
// 보드 셀 지오메트리 캐시 (한 번만 계산)
let _cachedBoardCells = null;

function getBoardCells() {
    if (_cachedBoardCells) return _cachedBoardCells;
    const cells = [];
    const cx = 220, cy = 200, outerR = 170, innerR = 120;
    for (let i = 0; i < 45; i++) {
        const angle = (i / 45) * Math.PI * 2 - Math.PI / 2;
        const midR = (outerR + innerR) / 2;
        cells.push({
            num: i + 1,
            x: cx + Math.cos(angle) * midR,
            y: cy + Math.sin(angle) * midR,
            angle,
        });
    }
    _cachedBoardCells = cells;
    return cells;
}

function initBoard() {
    stopDice();
    resetDiceBasket();
    const el = document.getElementById('diceContentBoard');
    if (!el) return;
    el.innerHTML = `
        <div class="game-info-box">🏃 주사위를 굴려 말을 이동시키고 도착한 칸의 번호를 모으세요! <strong>6개</strong> 모으면 완료!</div>
        <canvas id="boardCanvas" width="440" height="380"></canvas>
        <div id="boardInfo" style="text-align:center;color:var(--text-secondary);font-size:0.85rem;margin:5px 0;">주사위를 굴려보세요!</div>
        <button class="btn btn-gold" onclick="rollBoardDice()" id="boardRollBtn" style="width:100%;">🎲 주사위 굴리기</button>
        <div id="boardLog" style="margin-top:8px;max-height:80px;overflow-y:auto;font-size:0.75rem;color:var(--text-secondary);"></div>
    `;

    const specialCells = {};
    const specialIndices = [3, 9, 15, 21, 27, 33, 39, 44, 7, 18, 30, 41];
    const specialTypes = ['double', 'skip', 'swap', 'bonus', 'double', 'skip', 'swap', 'bonus', 'double', 'skip', 'swap', 'bonus'];
    specialIndices.forEach((si, i) => { specialCells[si] = specialTypes[i]; });

    boardState = { pos: 0, specialCells };
    renderBoard();
}

function renderBoard() {
    const canvas = document.getElementById('boardCanvas');
    if (!canvas || !boardState) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = 220, cy = 200, outerR = 170, innerR = 120;
    const cells = getBoardCells();

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1a2a1a';
    ctx.beginPath(); ctx.roundRect(5, 5, w - 10, h - 10, 16); ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, Math.PI * 2); ctx.fill();

    cells.forEach((cell, i) => {
        const angle = cell.angle;
        const isCollected = diceCollected.includes(cell.num);
        const isSpecial = boardState.specialCells[i] !== undefined;
        const isCurrent = boardState.pos === i;

        const or2 = outerR - 1, ir2 = innerR + 1;
        const a1 = angle - Math.PI / 50, a2 = angle + Math.PI / 50;
        ctx.beginPath();
        ctx.arc(cx, cy, or2, a1, a2);
        ctx.arc(cx, cy, ir2, a2, a1, true);
        ctx.closePath();
        ctx.fillStyle = isCurrent ? 'rgba(255,215,0,0.4)' : isCollected ? 'rgba(16,185,129,0.2)' : isSpecial ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)';
        ctx.fill();
        ctx.strokeStyle = isCurrent ? '#ffd700' : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = isCurrent ? 2 : 0.5;
        ctx.stroke();

        ctx.fillStyle = isCollected ? '#10b981' : '#fff';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cell.num, cell.x, cell.y);

        if (isSpecial) {
            const icons = { double: '×2', skip: '⏭️', swap: '🔄', bonus: '🎁' };
            ctx.fillText(icons[boardState.specialCells[i]] || '?', cell.x, cell.y - 10);
        }
    });

    // 말
    const posCell = cells[boardState.pos];
    ctx.beginPath();
    ctx.arc(posCell.x, posCell.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ME', posCell.x, posCell.y);

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.arc(cx, cy, innerR - 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 13px "Noto Sans KR"';
    ctx.fillText(`${Math.min(diceCollected.length, DICE_TARGET)}/6`, cx, cy - 5);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'var(--text-secondary)';
    ctx.font = '9px sans-serif';
    ctx.fillText('수집', cx, cy + 15);
}

function rollBoardDice() {
    if (!boardState || diceCollected.length >= DICE_TARGET) return;
    const btn = document.getElementById('boardRollBtn');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = '🎲 이동 중...';

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const roll = d1 + d2;
    const infoEl = document.getElementById('boardInfo');
    if (infoEl) infoEl.textContent = `🎲 ${d1}+${d2}=${roll} 칸 전진!`;

    let steps = roll;
    let stepCount = 0;
    boardTimeoutHandle = null;

    function addLog(el, msg) {
        el.innerHTML = `<div>${msg}</div>` + el.innerHTML;
        const lines = el.querySelectorAll('div');
        if (lines.length > 4) lines[lines.length - 1].remove();
    }

    function stepAnim() {
        // 완료되었거나 중단된 경우
        if (!boardState || diceCollected.length >= DICE_TARGET) {
            boardTimeoutHandle = null;
            if (btn) { btn.disabled = false; btn.textContent = '🎉 완료!'; }
            return;
        }

        if (stepCount >= steps) {
            const cells = getBoardCells();
            const cell = cells[boardState.pos];
            const specType = boardState.specialCells[boardState.pos];
            let logMsg = `${cell.num}번 도착!`;

            if (specType === 'double') {
                const avail = getAvailable(diceCollected);
                if (avail.length > 0) {
                    const bonusNum = avail[Math.floor(Math.random() * avail.length)];
                    addDiceCollected(bonusNum);
                    logMsg += ` ✨ 더블찬스! 보너스 ${bonusNum}번 추가!`;
                }
            } else if (specType === 'skip') {
                boardState.pos = (boardState.pos + 3) % 45;
                logMsg += ` ⏭️ 점프! 3칸 추가 이동 → ${cells[boardState.pos].num}번`;
                renderBoard();
            } else if (specType === 'swap' && diceCollected.length > 0) {
                const removed = diceCollected.pop();
                const avail = getAvailable(diceCollected);
                if (avail.length > 0) {
                    const newNum = avail[Math.floor(Math.random() * avail.length)];
                    addDiceCollected(newNum);
                    logMsg += ` 🔄 교환! ${removed}번 → ${newNum}번`;
                }
            } else if (specType === 'bonus') {
                steps += 1;
                logMsg += ` 🎁 보너스! 추가 1칸 전진`;
                // bonus는 도착 처리 후 추가 이동 (stepCount < steps 유지)
                stepCount++;
                boardState.pos = (boardState.pos + 1) % 45;
                renderBoard();
                const logEl = document.getElementById('boardLog');
                if (logEl) addLog(logEl, logMsg);
                boardTimeoutHandle = setTimeout(stepAnim, 120);
                return;
            }

            // 일반 칸 번호 수집 (이미 addDiceCollected 내부에서 중복 체크함)
            addDiceCollected(cell.num);

            const logEl = document.getElementById('boardLog');
            if (logEl) addLog(logEl, logMsg);
            renderBoard();

            const complete = diceCollected.length >= DICE_TARGET;
            btn.disabled = false;
            btn.textContent = complete ? '🎉 완료!' : '🎲 주사위 굴리기';
            if (infoEl) infoEl.textContent = complete ? '🎉 6개 모두 모았습니다!' : `현재 칸: ${cells[boardState.pos].num}번`;
            if (typeof playBeep === 'function') playBeep(600, 0.1);
            boardTimeoutHandle = null;
            return;
        }
        boardState.pos = (boardState.pos + 1) % 45;
        stepCount++;
        renderBoard();
        boardTimeoutHandle = setTimeout(stepAnim, 120);
    }
    boardTimeoutHandle = setTimeout(stepAnim, 120);
}

// ===================================================================
// 4. 🔮 주사위 점괘 (Dice Fortune)
// ===================================================================
function initFortune() {
    stopDice();
    const el = document.getElementById('diceContentFortune');
    if (!el) return;

    const today = new Date().toISOString().slice(0, 10);
    const lastFortune = localStorage.getItem('dice-fortune-date');
    const usedToday = lastFortune === today;

    el.innerHTML = `
        <div class="game-info-box">🔮 주사위 3개를 굴려 오늘의 운세를 확인하세요! <strong>하루 1회</strong> 무료입니다.</div>
        <canvas id="fortuneCanvas" width="300" height="120"></canvas>
        <div id="fortuneResult" style="text-align:center;min-height:60px;"></div>
        <button class="btn btn-gold" onclick="rollFortune()" id="fortuneBtn" style="width:100%;" ${usedToday?'disabled':''}>
            ${usedToday ? '✅ 오늘 점괘 완료 (내일 다시!)' : '🎲 주사위 굴려 운세 보기'}
        </button>
    `;

    const canvas = document.getElementById('fortuneCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.roundRect(5, 5, 290, 110, 12); ctx.fill();
        [1, 2, 3].forEach((v, i) => drawDieFace(ctx, 75 + i * 80, 60, 50, v, false));
    }
}

function rollFortune() {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem('dice-fortune-date') === today) return;

    localStorage.setItem('dice-fortune-date', today);
    const btn = document.getElementById('fortuneBtn');
    if (btn) { btn.disabled = true; btn.textContent = '🎲 굴리는 중...'; }

    const dice = [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1];
    const total = dice.reduce((a,b)=>a+b, 0);

    const fortunes = {
        3: { text: '대길! 새로운 시작의 기운이 가득합니다.', icon: '🌟', level: '최상', nums: [3,7,11,21,33,42] },
        4: { text: '안정된 기운이 감돌고 있어요. 차분히 준비하세요.', icon: '🌿', level: '양호', nums: [4,8,12,22,34,40] },
        5: { text: '변화의 바람이 붑니다. 유연하게 대처하세요.', icon: '🌬️', level: '보통', nums: [5,9,15,25,35,41] },
        6: { text: '조화로운 날! 주변과의 관계가 빛날 거예요.', icon: '☯️', level: '양호', nums: [6,10,16,23,31,44] },
        7: { text: '행운이 당신을 찾아오고 있어요!', icon: '🍀', level: '대길', nums: [7,13,17,27,37,45] },
        8: { text: '재물운이 상승 중입니다. 기회를 잡으세요.', icon: '💰', level: '대길', nums: [8,14,18,28,38,43] },
        9: { text: '창의적인 아이디어가 샘솟는 날!', icon: '💡', level: '양호', nums: [9,1,19,29,39,32] },
        10: { text: '평온한 하루. 여유를 가지고 행동하세요.', icon: '☕', level: '보통', nums: [10,2,11,20,30,36] },
        11: { text: '의외의 곳에서 행운이 찾아올 거예요.', icon: '🎁', level: '대길', nums: [11,3,21,31,41,5] },
        12: { text: '노력이 결실을 맺는 시기입니다.', icon: '🌾', level: '양호', nums: [12,4,13,22,32,38] },
        13: { text: '주의가 필요한 날. 신중하게 결정하세요.', icon: '⚠️', level: '주의', nums: [13,5,14,23,33,39] },
        14: { text: '인연이 깊어지는 날! 소중한 만남이 있을 거예요.', icon: '💕', level: '양호', nums: [14,6,15,24,34,40] },
        15: { text: '건강운 최고! 활력이 넘치는 하루입니다.', icon: '💪', level: '대길', nums: [15,7,25,35,45,1] },
        16: { text: '작은 행운들이 모여 큰 기쁨이 될 거예요.', icon: '✨', level: '양호', nums: [16,8,17,26,36,42] },
        17: { text: '승부운이 강한 날! 도전해보세요.', icon: '⚡', level: '대길', nums: [17,9,18,27,37,43] },
        18: { text: '지혜로운 선택이 필요한 순간입니다.', icon: '🦉', level: '보통', nums: [18,10,19,28,38,44] },
    };

    const f = fortunes[total] || fortunes[10];
    const luckNums = f.nums;

    setTimeout(() => {
        const canvas = document.getElementById('fortuneCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath(); ctx.roundRect(5, 5, 290, 110, 12); ctx.fill();
            dice.forEach((v, i) => drawDieFace(ctx, 75 + i * 80, 60, 50, v, false));
        }

        const resultEl = document.getElementById('fortuneResult');
        if (resultEl) resultEl.innerHTML = `
            <div style="background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(255,215,0,0.1));border-radius:14px;padding:18px;margin-top:10px;border:1px solid rgba(139,92,246,0.3);animation:answerReveal 0.6s ease-out;">
                <div style="font-size:2.5rem;">${f.icon}</div>
                <div style="color:var(--accent-gold);font-weight:700;font-size:1.1rem;">합계 ${total} — ${f.level}운!</div>
                <p style="color:var(--text-primary);margin:8px 0;">${f.text}</p>
                <div class="balls-container" style="padding:8px 0;gap:6px;">
                    ${luckNums.map(n => `<span class="ball ${typeof getBallClass==='function'?getBallClass(n):''}" style="width:36px;height:36px;line-height:36px;font-size:0.85rem;">${n}</span>`).join('')}
                </div>
                <button class="btn btn-primary" onclick="useFortuneNumbers([${luckNums}])" style="margin-top:8px;">🎱 이 번호로 분석하기</button>
            </div>
        `;
        if (btn) btn.textContent = '✅ 오늘 점괘 완료 (내일 다시!)';
        if (typeof playBeep === 'function') playBeep(800, 0.15);
        if (typeof vibrate === 'function') vibrate(50);
        if (total >= 11 && typeof fireConfetti === 'function') fireConfetti();
    }, 400);
}

function useFortuneNumbers(numbers) {
    if (typeof _applyFunNumbers === 'function') {
        _applyFunNumbers(numbers, '🔮 주사위 점괘 추천 번호', '🔮 점괘 번호로 분석 완료!');
    }
}

// ===================================================================
// 5. 🎱 주사위 번호 생성기 (Dice Number Generator)
// ===================================================================
function initGenerator() {
    stopDice();
    const el = document.getElementById('diceContentGenerator');
    if (!el) return;

    el.innerHTML = `
        <div class="game-info-box">🎱 TRPG 스타일! 다양한 주사위를 조합해 <strong>1~45</strong> 로또 번호를 생성합니다.</div>
        <div class="dice-generator-panel">
            <div class="gen-methods" id="genMethods">
                <div class="gen-method active" onclick="selectGenMethod('d20')">
                    <span>🎯 d20 메인</span><span style="font-size:0.7rem;">d20+d12+d8+d6-1</span>
                </div>
                <div class="gen-method" onclick="selectGenMethod('dnd')">
                    <span>⚔️ D&D 스탯</span><span style="font-size:0.7rem;">4d6 최고3 합산 변환</span>
                </div>
                <div class="gen-method" onclick="selectGenMethod('multiply')">
                    <span>✖️ 곱셈 모드</span><span style="font-size:0.7rem;">d10×d6으로 범위 생성</span>
                </div>
                <div class="gen-method" onclick="selectGenMethod('percentile')">
                    <span>💯 백분위</span><span style="font-size:0.7rem;">2d10 백분위 → 1~45 매핑</span>
                </div>
            </div>
            <canvas id="genDiceCanvas" width="440" height="100"></canvas>
            <div id="genResult" style="text-align:center;min-height:40px;margin:10px 0;"></div>
            <button class="btn btn-gold" onclick="rollGenerator()" id="genRollBtn" style="width:100%;">🎲 주사위 굴리기</button>
            <div id="genHistory" style="margin-top:12px;max-height:120px;overflow-y:auto;font-size:0.75rem;color:var(--text-secondary);"></div>
        </div>
    `;
    window._genMethod = 'd20';
    window._genNumbers = [];
    renderGenDice();
}

function selectGenMethod(method) {
    window._genMethod = method;
    document.querySelectorAll('.gen-method').forEach(m => m.classList.remove('active'));
    document.querySelector(`.gen-method[onclick="selectGenMethod('${method}')"]`)?.classList.add('active');
    renderGenDice();
}

function renderGenDice() {
    const canvas = document.getElementById('genDiceCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.roundRect(5, 5, 430, 90, 12); ctx.fill();

    const method = window._genMethod || 'd20';
    const configs = {
        d20: [{ label: 'd20', x: 80 }, { label: 'd12', x: 165 }, { label: 'd8', x: 240 }, { label: 'd6', x: 305 }],
        dnd: [{ label: '4d6', x: 100 }, { label: 'best3', x: 220 }, { label: '×2.5', x: 340 }],
        multiply: [{ label: 'd10', x: 120 }, { label: '×', x: 210 }, { label: 'd6', x: 280 }],
        percentile: [{ label: 'd10', x: 110 }, { label: 'd10', x: 190 }, { label: '→1~45', x: 290 }],
    };
    const config = configs[method] || configs.d20;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    config.forEach(c => ctx.fillText(c.label, c.x, 50));
}

function rollGenerator() {
    const method = window._genMethod || 'd20';
    const numbers = [];
    const avail = getAvailable(numbers);

    while (numbers.length < 6 && avail.length > 0) {
        let n;
        switch (method) {
            case 'd20':
                n = Math.floor(Math.random()*20) + Math.floor(Math.random()*12) + Math.floor(Math.random()*8) + Math.floor(Math.random()*6) + 3;
                break;
            case 'dnd': {
                const rolls = Array.from({length:4}, () => Math.floor(Math.random()*6)+1).sort((a,b)=>b-a);
                n = Math.round((rolls[0] + rolls[1] + rolls[2]) * 2.5);
                break;
            }
            case 'multiply': {
                n = (Math.floor(Math.random()*10)+1) * (Math.floor(Math.random()*6)+1);
                if (n > 45) n = Math.floor(n * 0.75);
                break;
            }
            case 'percentile': {
                const pct = Math.floor(Math.random()*10)*10 + Math.floor(Math.random()*10) + 1;
                n = Math.ceil((pct / 100) * 45);
                break;
            }
            default: n = Math.floor(Math.random()*45)+1;
        }
        n = Math.max(1, Math.min(45, n));
        if (!numbers.includes(n)) numbers.push(n);
    }

    // 부족한 번호 채우기
    while (numbers.length < 6) {
        const n = Math.floor(Math.random()*45)+1;
        if (!numbers.includes(n)) numbers.push(n);
    }

    numbers.sort((a, b) => a - b);
    window._genNumbers = numbers;

    const resultEl = document.getElementById('genResult');
    if (resultEl) resultEl.innerHTML = `
        <div style="background:rgba(0,0,0,0.2);border-radius:12px;padding:15px;animation:answerReveal 0.5s ease-out;">
            <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:10px;">🎲 ${method} 방식 생성 결과</div>
            <div class="balls-container" style="gap:8px;">
                ${numbers.map(n => `<span class="ball ${typeof getBallClass==='function'?getBallClass(n):''}" style="width:44px;height:44px;line-height:44px;font-size:1rem;">${n}</span>`).join('')}
            </div>
            <div style="margin-top:10px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                <button class="btn btn-primary" onclick="useGenNumbers([${numbers}])">🎱 분석하기</button>
                <button class="btn btn-secondary" onclick="rollGenerator()">🔄 다시 굴리기</button>
            </div>
        </div>
    `;

    const histEl = document.getElementById('genHistory');
    if (histEl) {
        const balls = numbers.map(n => `<span class="ball ${typeof getBallClass==='function'?getBallClass(n):''}" style="width:24px;height:24px;line-height:24px;font-size:0.6rem;">${n}</span>`).join('');
        histEl.innerHTML = `<div style="margin-bottom:4px;">🕐 ${new Date().toLocaleTimeString('ko-KR')} [${method}] ${balls}</div>` + histEl.innerHTML;
        const lines = histEl.querySelectorAll('div');
        if (lines.length > 8) lines[lines.length - 1].remove();
    }

    if (typeof playBeep === 'function') playBeep(700, 0.1);
    if (typeof vibrate === 'function') vibrate(30);
}

function useGenNumbers(numbers) {
    if (typeof _applyFunNumbers === 'function') {
        _applyFunNumbers(numbers, `🎱 주사위 생성기 (${window._genMethod || 'd20'})`, '🎱 주사위 번호로 분석 완료!');
    }
}

// ===================================================================
// 6. 🍀 복불복 주사위 챌린지 (Dice Lucky Challenge)
// ===================================================================
let _challengeHistoryCache = null;

function getChallengeHistory() {
    if (_challengeHistoryCache) return _challengeHistoryCache;
    try { _challengeHistoryCache = JSON.parse(localStorage.getItem('dice-challenge-history') || '[]'); } catch(e) { _challengeHistoryCache = []; }
    return _challengeHistoryCache;
}

function initChallenge() {
    stopDice();
    const el = document.getElementById('diceContentChallenge');
    if (!el) return;

    const today = new Date().toISOString().slice(0, 10);
    const usedToday = localStorage.getItem('dice-challenge-date') === today;
    const history = getChallengeHistory();

    el.innerHTML = `
        <div class="game-info-box">🍀 하루 한 번! 주사위를 굴려 <strong>코인, 번호, 도감 등록</strong> 등 다양한 보상을 받으세요!</div>
        <canvas id="challengeCanvas" width="200" height="120"></canvas>
        <div id="challengeResult" style="text-align:center;min-height:60px;"></div>
        <button class="btn btn-gold" onclick="rollChallenge()" id="challengeBtn" style="width:100%;" ${usedToday?'disabled':''}>
            ${usedToday ? '✅ 오늘 챌린지 완료! (내일 다시)' : '🎲 주사위 던지기!'}
        </button>
        ${history.length > 0 ? `
            <div style="margin-top:12px;font-size:0.75rem;color:var(--text-secondary);">
                최근: ${history.slice(-5).reverse().map(h => `<span style="margin:0 4px;">${h}</span>`).join('')}
            </div>
        ` : ''}
    `;

    const canvas = document.getElementById('challengeCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.roundRect(5, 5, 190, 110, 12); ctx.fill();
        drawDieFace(ctx, 100, 60, 70, 1, false);
    }
}

function rollChallenge() {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem('dice-challenge-date') === today) return;

    localStorage.setItem('dice-challenge-date', today);
    const btn = document.getElementById('challengeBtn');
    if (btn) { btn.disabled = true; btn.textContent = '🎲 굴리는 중...'; }

    const roll = Math.floor(Math.random() * 6) + 1;

    const rewards = {
        1: { icon: '🪙', text: '기본 코인!', reward: '+2 🪙', coins: 2, color: 'var(--text-secondary)' },
        2: { icon: '📚', text: '도감 등록!', reward: '랜덤 번호 도감', coins: 1, color: 'var(--accent-cyan)', collection: true },
        3: { icon: '🪙', text: '코인 획득!', reward: '+4 🪙', coins: 4, color: 'var(--accent-gold)' },
        4: { icon: '🔍', text: '번호 공개!', reward: '행운 번호 1개', coins: 1, color: 'var(--accent-cyan)', number: true },
        5: { icon: '🎁', text: '럭키 보너스!', reward: '+3 🪙 + 도감', coins: 3, color: 'var(--accent-gold)', collection: true },
        6: { icon: '👑', text: '잭팟!', reward: '+7 🪙 + 번호 2개', coins: 7, color: '#ffd700', number: true, collection: true },
    };

    const r = rewards[roll];

    if (r.coins > 0 && typeof getCheckinData === 'function' && typeof saveCheckinData === 'function') {
        const checkin = getCheckinData();
        checkin.coins = (checkin.coins || 0) + r.coins;
        saveCheckinData(checkin);
    }
    let extraHtml = '';
    if (r.collection && typeof addToCollection === 'function' && typeof getCollection === 'function') {
        const coll = getCollection();
        const avail = getAvailable(coll);
        if (avail.length > 0) {
            const newNum = avail[Math.floor(Math.random() * avail.length)];
            addToCollection(newNum);
            extraHtml += `<p style="font-size:0.8rem;color:var(--accent-cyan);margin-top:5px;">📚 도감에 ${newNum}번 등록!</p>`;
        }
    }
    if (r.number) {
        const avail = getAvailable(typeof getCollection === 'function' ? getCollection() : []);
        const num = avail.length > 0 ? avail[Math.floor(Math.random() * avail.length)] : Math.floor(Math.random()*45)+1;
        extraHtml += `<p style="font-size:0.8rem;color:var(--accent-gold);margin-top:3px;">🎱 행운 번호: <span class="ball ${typeof getBallClass==='function'?getBallClass(num):''}" style="width:32px;height:32px;line-height:32px;font-size:0.8rem;">${num}</span></p>`;
    }

    _challengeHistoryCache = null; // 캐시 무효화
    const history = getChallengeHistory();
    history.push(`${r.icon}${roll}`);
    if (history.length > 30) history.shift();
    try { localStorage.setItem('dice-challenge-history', JSON.stringify(history)); } catch(e) {}

    setTimeout(() => {
        const canvas = document.getElementById('challengeCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath(); ctx.roundRect(5, 5, 190, 110, 12); ctx.fill();
            drawDieFace(ctx, 100, 60, 70, roll, false);
        }

        const resultEl = document.getElementById('challengeResult');
        if (resultEl) resultEl.innerHTML = `
            <div style="background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(255,215,0,0.1));border-radius:14px;padding:18px;border:1px solid ${r.color};animation:answerReveal 0.6s ease-out;">
                <div style="font-size:3rem;">${r.icon}</div>
                <div style="color:${r.color};font-weight:700;font-size:1.1rem;">${r.text}</div>
                <p style="color:var(--text-primary);font-size:1.2rem;font-weight:700;">${r.reward}</p>
                ${extraHtml}
            </div>
        `;
        if (btn) btn.textContent = '✅ 오늘 챌린지 완료! (내일 다시)';
        if (typeof playBeep === 'function') playBeep(roll >= 5 ? 1000 : 600, 0.15);
        if (typeof vibrate === 'function') vibrate(roll >= 5 ? 100 : 40);
        if (roll === 6 && typeof fireConfetti === 'function') fireConfetti();
        if (typeof renderCheckinUI === 'function') setTimeout(renderCheckinUI, 500);
    }, 500);
}

function initDiceZone() {
    const yachtContent = document.getElementById('diceContentYacht');
    if (yachtContent && !yachtContent.querySelector('canvas')) {
        switchDiceTab('yacht');
    }
}
