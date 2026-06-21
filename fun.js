// fun.js - 재미있는 콘텐츠 기능 모음
// 출석 체크, 오늘의 행운 번호, 추첨 카운트다운, 사진→번호, 통계 스포트라이트,
// 업적/뱃지, 스핀 더 휠, 번호 성격 테스트, 꿈해몽, 사운드트랙

// ========== 1. 출석 체크 + 연속 보상 ==========
function getToday() { const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); return now.toISOString().slice(0, 10); }
function getYesterday(d) { const dt = new Date(d); dt.setDate(dt.getDate() - 1); dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset()); return dt.toISOString().slice(0, 10); }

function getCheckinData() {
    try { return JSON.parse(localStorage.getItem('lotto-checkin') || '{"lastDate":"","streak":0,"total":0,"coins":0,"history":[]}'); } catch (e) { return { lastDate: '', streak: 0, total: 0, coins: 0, history: [] }; }
}

function saveCheckinData(data) {
    try { localStorage.setItem('lotto-checkin', JSON.stringify(data)); } catch (e) {}
}

function doCheckin() {
    const data = getCheckinData();
    const today = getToday();
    if (data.lastDate === today) {
        showStatus('info', '✅ 오늘 이미 출석하셨어요! ' + data.streak + '일 연속 출석 중 🔥');
        renderCheckinUI();
        return;
    }
    const yesterday = getYesterday(today);
    if (data.lastDate === yesterday) {
        data.streak += 1;
    } else {
        data.streak = 1;
    }
    data.lastDate = today;
    data.total += 1;
    // 보상: 연속 일수에 따라 코인 지급
    let coinReward = 1;
    if (data.streak >= 30) coinReward = 10;
    else if (data.streak >= 14) coinReward = 7;
    else if (data.streak >= 7) coinReward = 5;
    else if (data.streak >= 3) coinReward = 3;
    data.coins += coinReward;
    data.history.push({ date: today, streak: data.streak, coins: coinReward });
    if (data.history.length > 365) data.history = data.history.slice(-365);
    saveCheckinData(data);

    // 보상 뱃지 체크
    if (data.streak === 7) unlockAchievement('checkin_7');
    if (data.streak === 30) unlockAchievement('checkin_30');
    if (data.streak === 100) unlockAchievement('checkin_100');
    if (data.total === 1) unlockAchievement('first_checkin');

    showStatus('success', `🎉 ${data.streak}일 연속 출석! 행운 코인 +${coinReward} (보유: ${data.coins}🪙)`);
    if (typeof trackMission === 'function') trackMission('checkin');
    fireConfetti();
    vibrate(100);
    playBeep(800, 0.15);
    renderCheckinUI();
    if (typeof _hook === 'function') _hook('doCheckin');
}

function renderCheckinUI() {
    const data = getCheckinData();
    const today = getToday();
    const checkedToday = data.lastDate === today;

    const el = document.getElementById('checkinContent');
    if (!el) return;

    // 주간 출석 달력
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);

    let weekHtml = '<div class="checkin-week">';
    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const ds = d.toISOString().slice(0, 10);
        const isChecked = data.history.some(h => h.date === ds);
        const isToday = ds === today;
        weekHtml += `<div class="checkin-day${isChecked ? ' checked' : ''}${isToday ? ' today' : ''}">
            <span class="checkin-day-label">${weekDays[i]}</span>
            <span class="checkin-day-icon">${isChecked ? '✅' : isToday && !checkedToday ? '🎯' : '○'}</span>
            <span class="checkin-day-date">${d.getDate()}</span>
        </div>`;
    }
    weekHtml += '</div>';

    el.innerHTML = `
        ${weekHtml}
        <div class="checkin-stats">
            <div class="checkin-stat"><span class="checkin-stat-val">🔥 ${data.streak}일</span><span class="checkin-stat-lbl">연속 출석</span></div>
            <div class="checkin-stat"><span class="checkin-stat-val">📅 ${data.total}일</span><span class="checkin-stat-lbl">전체 출석</span></div>
            <div class="checkin-stat"><span class="checkin-stat-val">🪙 ${data.coins}</span><span class="checkin-stat-lbl">행운 코인</span></div>
        </div>
        <button class="btn btn-gold" onclick="doCheckin()" ${checkedToday ? 'disabled' : ''} style="width:100%;justify-content:center;">
            ${checkedToday ? '✅ 오늘 출석 완료! (내일 또 만나요)' : '🎯 오늘 출석 체크!'}
        </button>
        ${data.streak >= 3 ? `<p class="text-xs-secondary text-center mt-10">🔥 ${data.streak}일 연속! ${data.streak >= 7 ? '대단해요!' : '내일도 출석하면 보너스 코인!'}</p>` : ''}
    `;
    if (typeof _hook === 'function') _hook('renderCheckinUI');
}

// ========== 오늘의 번호 팁 (자동 생성) ==========
function getDailyTips() {
    const today = getToday();
    const seed = today.split('-').reduce((a, b) => a + parseInt(b), 0);
    function rng(s) { let x = Math.sin(s * 9301 + 49297) * 49297; return x - Math.floor(x); }

    const tips = [
        { type: 'sum', title: '합계 팁', icon: '➕', desc: `합계 ${120 + Math.floor(rng(seed)*25)}~${145 + Math.floor(rng(seed+1)*25)} 사이 조합`, action: 'auto' },
        { type: 'odd_even', title: '홀짝 팁', icon: '⚖️', desc: `홀수 ${3+Math.floor(rng(seed+2)*2)}개 + 짝수 ${3-Math.floor(rng(seed+2)*2)}개 조합`, action: 'auto' },
        { type: 'color', title: '색깔 팁', icon: '🎨', desc: `${['노랑(1~10)','파랑(11~20)','빨강(21~30)','회색(31~40)','초록(41~45)'][Math.floor(rng(seed+3)*5)]} 구간 3개 이상 포함`, action: 'auto' },
        { type: 'no_consec', title: '연속 금지 팁', icon: '🚫', desc: '연속 번호가 없는 조합 만들기', action: 'auto' },
        { type: 'high_low', title: '고저 팁', icon: '📊', desc: `저번호(1~22) ${2+Math.floor(rng(seed+4)*3)}개 + 고번호 나머지`, action: 'auto' },
    ];
    const t1 = tips[Math.floor(rng(seed + 5) * tips.length)];
    let t2 = tips[Math.floor(rng(seed + 6) * tips.length)];
    while (t2.type === t1.type) t2 = tips[Math.floor(rng(seed + 7) * tips.length)];
    return [t1, t2];
}

function generateTipNumbers(type, params) {
    const nums = [];
    let attempts = 0;
    while (nums.length < 6 && attempts < 5000) {
        attempts++;
        const n = Math.floor(Math.random() * 45) + 1;
        if (nums.includes(n)) continue;
        nums.push(n);
        nums.sort((a, b) => a - b);
        if (nums.length < 6) continue;

        let ok = true;
        const sum = nums.reduce((s, v) => s + v, 0);
        const odd = nums.filter(v => v % 2 === 1).length;
        const low = nums.filter(v => v <= 22).length;
        const hasConsec = nums.some((v, i) => i > 0 && v === nums[i - 1] + 1);

        switch (type) {
            case 'sum': ok = sum >= (params?.min || 120) && sum <= (params?.max || 150); break;
            case 'odd_even': ok = odd === (params?.odd || 3); break;
            case 'color': {
                const ranges = { yellow: [1,10], blue: [11,20], red: [21,30], gray: [31,40], green: [41,45] };
                const r = ranges[params?.color] || [1,10];
                ok = nums.filter(v => v >= r[0] && v <= r[1]).length >= 3;
                break;
            }
            case 'no_consec': ok = !hasConsec; break;
            case 'high_low': ok = low === (params?.low || 3); break;
        }
        if (!ok) nums.length = 0;
    }
    while (nums.length < 6) {
        const n = Math.floor(Math.random() * 45) + 1;
        if (!nums.includes(n)) { nums.push(n); nums.sort((a, b) => a - b); }
    }
    return nums;
}

function applyTipNumbers(idx, numbers) {
    completeMission(idx);
    const el = document.getElementById('tipResult' + idx);
    if (el) {
        el.innerHTML = `
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:8px;">
                ${numbers.map(n => `<span class="ball ${typeof getBallClass === 'function' ? getBallClass(n) : ''}" style="width:36px;height:36px;line-height:36px;font-size:0.85rem;">${n}</span>`).join('')}
            </div>
            <div style="display:flex;gap:8px;justify-content:center;margin-top:10px;">
                <button class="btn btn-primary" onclick="_applyFunNumbers([${numbers}],'🎯 오늘의 팁 번호','🎯 팁 번호로 분석 완료!')" style="padding:6px 14px;font-size:0.8rem;">📊 분석하기</button>
                <button class="btn btn-secondary" onclick="showTipResult(${idx})" style="padding:6px 14px;font-size:0.8rem;">🔄 다시</button>
            </div>
        `;
    }
}

function showTipResult(idx) {
    const tips = getDailyTips();
    const t = tips[idx];
    let params = {};
    const today = getToday();
    const seed = today.split('-').reduce((a, b) => a + parseInt(b), 0);
    function rng(s) { let x = Math.sin(s * 9301 + 49297) * 49297; return x - Math.floor(x); }
    if (t.type === 'sum') { params = { min: 120 + Math.floor(rng(seed)*25), max: 145 + Math.floor(rng(seed+1)*25) }; }
    else if (t.type === 'odd_even') { params = { odd: 3 + Math.floor(rng(seed+2)*2) }; }
    else if (t.type === 'color') {
        const colors = ['yellow','blue','red','gray','green'];
        params = { color: colors[Math.floor(rng(seed+3)*5)] };
    }
    else if (t.type === 'high_low') { params = { low: 2 + Math.floor(rng(seed+4)*3) }; }
    const nums = generateTipNumbers(t.type, params);
    applyTipNumbers(idx, nums);
}

function getDailyMissionData() {
    try { return JSON.parse(localStorage.getItem('lotto-daily-missions') || '{"date":"","done":[]}'); } catch (e) { return { date: '', done: [] }; }
}

function completeMission(idx) {
    const data = getDailyMissionData();
    if (data.done.includes(idx)) return;
    data.done.push(idx);
    try { localStorage.setItem('lotto-daily-missions', JSON.stringify(data)); } catch (e) {}
    const checkin = getCheckinData();
    checkin.coins += 3;
    saveCheckinData(checkin);
    trackMissionDone();
    showStatus('success', `✅ 팁 완료! +3코인 (보유: ${checkin.coins}🪙)`);
    playBeep(800, 0.12); vibrate(50);
    renderDailyMissions();
}

function renderDailyMissions() {
    const el = document.getElementById('dailyMissionsContent');
    if (!el) return;
    const today = getToday();
    const data = getDailyMissionData();
    if (data.date !== today) { data.date = today; data.done = []; try { localStorage.setItem('lotto-daily-missions', JSON.stringify(data)); } catch (e) {} }
    const tips = getDailyTips();
    el.innerHTML = `<p class="text-xs-secondary text-center mb-15">🎯 아래 팁을 확인하고 <strong>번호를 받아보세요!</strong></p>` + tips.map((t, i) => {
        const done = data.done.includes(i);
        return `<div class="daily-mission-item ${done ? 'done' : ''}" style="cursor:default;">
            <span class="daily-mission-icon">${t.icon}</span>
            <div class="daily-mission-info">
                <span class="daily-mission-title">${t.title}</span>
                <span class="daily-mission-desc">${t.desc}</span>
            </div>
            <span class="daily-mission-reward">${done ? '✅' : '+3🪙'}</span>
        </div>
        <div style="text-align:center;margin-bottom:12px;">
            <button class="btn btn-gold" onclick="showTipResult(${i})" style="padding:6px 16px;font-size:0.85rem;" ${done ? 'disabled' : ''}>🎲 이 조건으로 번호 받기</button>
            <div id="tipResult${i}"></div>
        </div>`;
    }).join('');
}

// ========== 2. 오늘의 행운 번호 (개선) ==========
function getDailyLuckyNumber() {
    const today = getToday();
    const seed = today.split('-').reduce((a, b) => a + parseInt(b), 0);
    // 결정적 랜덤
    function seededRandom(s) {
        let x = Math.sin(s * 9301 + 49297) * 49297;
        return x - Math.floor(x);
    }
    const nums = new Set();
    let s = seed;
    while (nums.size < 6) {
        const n = Math.floor(seededRandom(s) * 45) + 1;
        nums.add(n);
        s++;
    }
    return [...nums].sort((a, b) => a - b);
}

function renderDailyLuckyNumber() {
    const el = document.getElementById('dailyLuckyContent');
    if (!el) return;
    const nums = getDailyLuckyNumber();
    const today = getToday();

    // 번호별 운세 키워드
    const keywords = [
        '행운', '사랑', '건강', '재물', '명예', '지혜',
        '모험', '평화', '성공', '우정', '기쁨', '희망',
        '용기', '인내', '창의', '열정', '신뢰', '감사'
    ];

    const ballsHtml = nums.map((n, i) => {
        const cls = getBallClass(n);
        const kw = keywords[n % keywords.length];
        return `<div class="daily-lucky-ball-wrapper">
            <span class="ball ${cls}">${n}</span>
            <span class="daily-ball-kw">${kw}</span>
        </div>`;
    }).join('');

    // 품질 점수 계산
    let scoreHtml = '';
    if (typeof analyzeNumbers === 'function' && typeof calculateQualityScore === 'function') {
        const analysis = analyzeNumbers(nums);
        const score = calculateQualityScore(analysis);
        scoreHtml = `<div class="game-score-card" style="margin-top:10px;">
            <div style="font-size:1.2rem;color:var(--accent-gold);">🌟 ${score.totalScore}점 (${score.grade})</div>
            <div class="game-score-detail">합계 ${analysis.sum} · AC ${analysis.ac} · ${analysis.oddEvenRatio}</div>
        </div>`;
    }

    el.innerHTML = `
        <div class="daily-lucky-date">📅 ${today}</div>
        <div class="balls-container" style="flex-wrap:wrap;gap:8px;">${ballsHtml}</div>
        <p class="text-xs-secondary text-center">오늘의 행운 키워드와 함께하는 번호입니다.</p>
        ${scoreHtml}
        <button class="btn btn-primary" onclick="useDailyLuckyNumbers()" style="width:100%;margin-top:10px;justify-content:center;">🎱 이 번호로 예측 분석하기</button>
    `;
}

// ========== 공통: Fun Zone 번호 분석 적용 ==========
function _applyFunNumbers(numbers, meta, successMsg) {
    if (!currentWinningNumbers) {
        if (lottoDb && lottoDb.length > 0) {
            const latest = lottoDb[lottoDb.length - 1];
            setWinningNumbers(latest.numbers, latest.bonus, latest.round, '내장 DB');
        } else {
            showStatus('warning', '⚠️ 먼저 당첨번호를 조회해주세요.');
            return;
        }
    }
    const analysis = analyzeNumbers(numbers);
    const score = calculateQualityScore(analysis);
    const filterResult = checkFilters(numbers);
    const percentileRank = calculatePercentileRank(numbers);
    const gradeResult = determineGrade(filterResult, percentileRank);
    renderBalls(numbers, 'predictionBalls');
    document.getElementById('predictionMeta').textContent = meta;
    displayScoreCard('prediction', score, analysis, filterResult, gradeResult);
    document.getElementById('predictionAnalysisContent').innerHTML = renderDetailedAnalysis(analysis);
    document.getElementById('predictionResult').classList.remove('hidden');
    document.getElementById('matchingSection').classList.add('hidden');
    showStatus('success', successMsg);
}

function useDailyLuckyNumbers() {
    _applyFunNumbers(getDailyLuckyNumber(), `오늘의 행운 번호 | ${getToday()}`, '🍀 오늘의 행운 번호가 적용되었습니다!');
}

// ========== 3. 추첨 카운트다운 ==========
let countdownInterval = null;

function getNextDrawTime() {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 3600000);
    const day = kst.getUTCDay();
    const hours = kst.getUTCHours();
    const minutes = kst.getUTCMinutes();

    const drawTime = new Date(kst);
    if (day === 6 && hours < 20) {
        // 오늘 토요일, 20:45 이전
        drawTime.setUTCHours(20, 45, 0, 0);
    } else if (day === 6 && hours >= 20 && minutes >= 45) {
        // 토요일 20:45 이후 → 다음 주
        drawTime.setUTCDate(drawTime.getUTCDate() + 7);
        drawTime.setUTCHours(20, 45, 0, 0);
    } else {
        const daysUntil = day === 6 ? 0 : (6 - day + 7) % 7;
        if (daysUntil === 0 && hours >= 20 && minutes >= 45) {
            drawTime.setUTCDate(drawTime.getUTCDate() + 7);
            drawTime.setUTCHours(20, 45, 0, 0);
        } else if (daysUntil === 0) {
            drawTime.setUTCHours(20, 45, 0, 0);
        } else {
            drawTime.setUTCDate(drawTime.getUTCDate() + daysUntil);
            drawTime.setUTCHours(20, 45, 0, 0);
        }
    }

    const diff = drawTime.getTime() - kst.getTime();
    return Math.max(0, diff);
}

function formatCountdown(ms) {
    if (ms <= 0) return { d: 0, h: 0, m: 0, s: 0, live: true };
    const totalSec = Math.floor(ms / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return { d, h, m, s, live: false };
}

function updateCountdown() {
    const el = document.getElementById('countdownDisplay');
    if (!el) return;
    const remaining = getNextDrawTime();
    const cd = formatCountdown(remaining);

    if (cd.live) {
        el.innerHTML = '<div class="countdown-live">🔴 지금 추첨 생방송 중!</div>';
        return;
    }

    const pad = n => String(n).padStart(2, '0');
    let previewHtml = '';
    // 추첨 1시간 이내 → 미리보기 번호 생성
    if (remaining <= 3600000 && remaining > 0 && typeof getDailyLuckyNumber === 'function') {
        const previewNums = getDailyLuckyNumber();
        previewHtml = `
            <div class="countdown-preview" style="margin-top:15px;background:rgba(255,215,0,0.08);border-radius:12px;padding:14px;border:1px solid rgba(255,215,0,0.2);">
                <p style="color:var(--accent-gold);font-size:0.85rem;margin-bottom:8px;">🔮 추첨 전 미리보기 번호</p>
                <div class="balls-container" style="padding:6px 0;gap:6px;">
                    ${previewNums.map(n => `<span class="ball ${getBallClass(n)}" style="width:36px;height:36px;line-height:36px;font-size:0.8rem;">${n}</span>`).join('')}
                </div>
                <p style="color:var(--text-secondary);font-size:0.7rem;margin-top:6px;">오늘의 행운 번호입니다. 참고만 하세요!</p>
            </div>`;
    }
    el.innerHTML = `
        <div class="countdown-timer">
            <div class="countdown-unit"><span class="countdown-val">${cd.d}</span><span class="countdown-lbl">일</span></div>
            <div class="countdown-sep">:</div>
            <div class="countdown-unit"><span class="countdown-val">${pad(cd.h)}</span><span class="countdown-lbl">시</span></div>
            <div class="countdown-sep">:</div>
            <div class="countdown-unit"><span class="countdown-val">${pad(cd.m)}</span><span class="countdown-lbl">분</span></div>
            <div class="countdown-sep">:</div>
            <div class="countdown-unit"><span class="countdown-val">${pad(cd.s)}</span><span class="countdown-lbl">초</span></div>
        </div>
        ${previewHtml}
        <p class="text-xs-secondary text-center mt-10">매주 토요일 오후 8:45 MBC 추첨</p>
    `;
}

function initCountdown() {
    updateCountdown();
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(updateCountdown, 1000);
}

// ========== 4. 사진 → 번호 변환 (9×5=45 그리드, 번호당 1셀) ==========
function openPhotoToNumbers() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const img = new Image();
        img.onload = () => {
            const gridCols = 9, gridRows = 5; // 9×5 = 45 = 로또 번호 개수
            const size = 630; // 9의 배수로 떨어지게
            const cellW = size / gridCols, cellH = size / gridRows;

            // ── 분석 Canvas ──
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            // 사진을 canvas 크기에 맞춰 그림 (비율 유지, 중앙 크롭)
            const scale = Math.max(size / img.width, size / img.height);
            const sw = img.width * scale, sh = img.height * scale;
            const sx = (size - sw) / 2, sy = (size - sh) / 2;
            ctx.drawImage(img, sx, sy, sw, sh);
            const imageData = ctx.getImageData(0, 0, size, size);
            const pixels = imageData.data;

            // ── 45개 셀 분석 (각 셀 = 해당 번호의 "서식지") ──
            const cells = [];
            for (let row = 0; row < gridRows; row++) {
                for (let col = 0; col < gridCols; col++) {
                    let r = 0, g = 0, b = 0, count = 0;
                    const x0 = Math.floor(col * cellW), y0 = Math.floor(row * cellH);
                    const x1 = Math.floor((col + 1) * cellW), y1 = Math.floor((row + 1) * cellH);
                    for (let y = y0; y < y1; y++) {
                        for (let x = x0; x < x1; x++) {
                            const idx = (y * size + x) * 4;
                            r += pixels[idx]; g += pixels[idx + 1]; b += pixels[idx + 2];
                            count++;
                        }
                    }
                    r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
                    const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
                    const saturation = maxC === 0 ? 0 : (maxC - minC) / maxC;
                    const brightness = (r + g + b) / 3 / 255;
                    // 번호 = 그리드 위치 (1~45 순차)
                    const num = row * gridCols + col + 1;
                    // 시각적 중요도: 이 영역이 얼마나 "눈에 띄는가" (채도 70% + 밝기 30%)
                    const importance = saturation * 0.7 + brightness * 0.3;
                    cells.push({ row, col, r, g, b, saturation, brightness, importance, num });
                }
            }

            // ── 시각적 중요도 상위 6개 셀 선택 ──
            const sorted = [...cells].sort((a, b) => b.importance - a.importance);
            const top6 = sorted.slice(0, 6);
            const numbers = top6.map(c => c.num).sort((a, b) => a - b);
            const selectedSet = new Set(top6.map(c => `${c.row},${c.col}`));

            // ── 오버레이 Canvas ──
            const overlay = document.createElement('canvas');
            overlay.width = size;
            overlay.height = size;
            const ovCtx = overlay.getContext('2d');
            ovCtx.drawImage(img, sx, sy, sw, sh);

            // 모든 셀에 옅은 번호 + 격자
            cells.forEach(c => {
                const cx = c.col * cellW, cy = c.row * cellH;
                const isSelected = selectedSet.has(`${c.row},${c.col}`);
                ovCtx.strokeStyle = 'rgba(255,255,255,0.15)';
                ovCtx.lineWidth = 0.5;
                ovCtx.strokeRect(cx, cy, cellW, cellH);
                if (!isSelected) {
                    ovCtx.fillStyle = 'rgba(255,255,255,0.18)';
                    ovCtx.font = '10px "Noto Sans KR", sans-serif';
                    ovCtx.textAlign = 'center';
                    ovCtx.textBaseline = 'middle';
                    ovCtx.fillText(c.num, cx + cellW / 2, cy + cellH / 2);
                }
            });

            // 선택된 셀 강조
            top6.forEach((c, i) => {
                const cx = c.col * cellW, cy = c.row * cellH;
                ovCtx.fillStyle = 'rgba(255,215,0,0.35)';
                ovCtx.fillRect(cx + 1, cy + 1, cellW - 2, cellH - 2);
                ovCtx.strokeStyle = '#ffd700';
                ovCtx.lineWidth = 3;
                ovCtx.strokeRect(cx + 1, cy + 1, cellW - 2, cellH - 2);
                ovCtx.fillStyle = '#ffd700';
                ovCtx.font = 'bold 22px "Noto Sans KR", sans-serif';
                ovCtx.textAlign = 'center';
                ovCtx.textBaseline = 'middle';
                ovCtx.shadowColor = 'rgba(0,0,0,0.9)';
                ovCtx.shadowBlur = 8;
                ovCtx.fillText(c.num, cx + cellW / 2, cy + cellH / 2);
                ovCtx.shadowBlur = 0;
            });

            // ── 결과 렌더링 ──
            const content = document.getElementById('photoContent');
            const previewUrl = overlay.toDataURL('image/jpeg', 0.7);

            content.innerHTML = `
                <div style="text-align:center;">
                    <div class="photo-result-grid">
                        <div class="photo-preview-wrap">
                            <img src="${previewUrl}" alt="9×5 그리드 분석 결과" class="photo-preview-img">
                            <p class="text-xs-secondary" style="margin-top:6px;">9×5 = 45 영역 분석 — <span style="color:#ffd700;">■</span> 선명한 6곳 선택</p>
                        </div>
                        <div class="photo-analysis-detail">
                            <div class="photo-section-title">🎨 가장 선명한 6개 영역</div>
                            <div class="photo-color-mappings">
                                ${top6.map((c, i) => `
                                    <div class="photo-mapping-row">
                                        <span class="photo-rank">#${i + 1}</span>
                                        <span class="photo-swatch" style="background:rgb(${c.r},${c.g},${c.b});${c.brightness < 0.3 ? 'border:2px solid rgba(255,255,255,0.3);' : ''}"></span>
                                        <span class="photo-cell-info">영역 ${c.num}번 <span style="color:var(--text-secondary);">RGB(${c.r},${c.g},${c.b})</span></span>
                                        <span class="ball ${getBallClass(c.num)}" style="width:36px;height:36px;line-height:36px;font-size:0.8rem;flex-shrink:0;">${c.num}</span>
                                    </div>
                                `).join('')}
                            </div>
                            <p class="text-xs-secondary" style="margin-top:10px;line-height:1.5;">
                                🔬 <strong>원리</strong>: 사진을 <strong style="color:var(--accent-cyan);">9×5=45개 영역</strong>으로 나누면<br>
                                각 영역이 로또 번호 1~45에 하나씩 대응됩니다.<br>
                                그중 채도와 밝기가 가장 높은<br>
                                <strong style="color:var(--accent-gold);">"눈에 띄는" 6곳</strong>을 선택합니다.
                            </p>
                        </div>
                    </div>
                    <div class="balls-container" style="margin-top:15px;">
                        ${numbers.map(n => `<span class="ball ${getBallClass(n)}">${n}</span>`).join('')}
                    </div>
                    <div style="display:flex;gap:10px;justify-content:center;margin-top:10px;flex-wrap:wrap;">
                        <button class="btn btn-primary" onclick="usePhotoNumbers([${numbers}])">🎱 예측 분석하기</button>
                        <button class="btn btn-secondary" onclick="openPhotoToNumbers()">📷 다른 사진으로</button>
                    </div>
                </div>
            `;
            if (typeof trackPhotoUse === 'function') trackPhotoUse();
            showStatus('success', `📷 45개 영역 분석 완료! ${numbers.join(', ')} 선택됨`);
            playBeep(600, 0.1);
        };
        img.src = URL.createObjectURL(file);
    };
    input.click();
}

function usePhotoNumbers(numbers) {
    _applyFunNumbers(numbers, '📷 사진에서 추출한 번호', '📷 사진 번호로 분석 완료!');
}

// ========== 5. 통계 스포트라이트 ==========
function renderStatsSpotlight() {
    const el = document.getElementById('spotlightContent');
    if (!el) return;
    if (!lottoDb || lottoDb.length < 10) {
        el.innerHTML = '<p class="text-secondary text-center">📊 DB 데이터 로딩 후 확인할 수 있어요.</p>';
        return;
    }

    const latest = lottoDb[lottoDb.length - 1];
    const sorted = [...lottoDb].sort((a, b) => b.round - a.round);

    // 최근 10주 핫 번호
    const recent10 = sorted.slice(0, 10);
    const freq10 = {};
    for (let i = 1; i <= 45; i++) freq10[i] = 0;
    recent10.forEach(r => { if (r.numbers) r.numbers.forEach(n => freq10[n]++); });
    const hotNow = Object.entries(freq10).filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]);
    const coldNow = Object.entries(freq10).filter(([, c]) => c === 0).sort((a, b) => a[0] - b[0]);

    // 현재 최장 미출현
    let maxGap = 0, maxGapNum = 0;
    for (let n = 1; n <= 45; n++) {
        let gap = 0;
        for (let i = 0; i < sorted.length; i++) {
            if (sorted[i].numbers && sorted[i].numbers.includes(n)) break;
            gap++;
        }
        if (gap > maxGap) { maxGap = gap; maxGapNum = n; }
    }

    // 이번 주 번호 합계
    const latestSum = latest.numbers ? latest.numbers.reduce((a, b) => a + b, 0) : 0;
    const avgSum = 136; // 이론적 평균
    const sumComment = latestSum > avgSum + 20 ? '고합계 (번호가 전반적으로 높음)' : latestSum < avgSum - 20 ? '저합계 (번호가 전반적으로 낮음)' : '평균 합계';

    const hotBalls = hotNow.slice(0, 3).map(([n]) => `<span class="ball ${getBallClass(parseInt(n))}" style="width:36px;height:36px;line-height:36px;font-size:0.85rem;">${n}</span>`).join('') || '<span class="text-xs-secondary">없음</span>';

    el.innerHTML = `
        <div class="spotlight-grid">
            <div class="spotlight-card hot">
                <div class="spotlight-title">🔥 최근 10주 핫 번호</div>
                <div class="spotlight-balls">${hotBalls}</div>
                <div class="spotlight-desc">${hotNow.length > 0 ? `${hotNow[0][1]}회 출현으로 가장 뜨거워요!` : '3회 이상 출현한 번호가 없습니다.'}</div>
            </div>
            <div class="spotlight-card cold">
                <div class="spotlight-title">❄️ 최근 10주 미출현</div>
                <div class="spotlight-desc">${coldNow.length}개 번호가 10주 동안 안 나왔어요</div>
                <div class="spotlight-nums">${coldNow.slice(0, 5).map(([n]) => `<span class="spotlight-num">${n}</span>`).join(' ')}</div>
            </div>
            <div class="spotlight-card dormant">
                <div class="spotlight-title">⏰ 최장 미출현</div>
                <div class="spotlight-big-num">${maxGapNum}</div>
                <div class="spotlight-desc">무려 <strong>${maxGap}주</strong> 연속 안 나왔어요</div>
            </div>
            <div class="spotlight-card sum">
                <div class="spotlight-title">📊 제 ${latest.round}회 번호 합계</div>
                <div class="spotlight-big-num">${latestSum}</div>
                <div class="spotlight-desc">${sumComment}</div>
            </div>
        </div>
    `;
}

// ========== 6. 업적/뱃지 시스템 ==========
const ACHIEVEMENTS = {
    first_checkin: { icon: '🌟', title: '첫 출석', desc: '처음으로 출석 체크했어요' },
    checkin_7: { icon: '🔥', title: '7일 연속 출석', desc: '일주일 내내 출석했어요' },
    checkin_30: { icon: '💎', title: '30일 연속 출석', desc: '한 달 내내 출석했어요' },
    checkin_100: { icon: '👑', title: '100일 연속 출석', desc: '진정한 로또 매니아!' },
    first_prediction: { icon: '🎱', title: '첫 예측', desc: '첫 번째 AI 예측을 실행했어요' },
    prediction_10: { icon: '🔮', title: '예측 마스터', desc: '10회 이상 예측을 실행했어요' },
    all_themes: { icon: '🎨', title: '테마 탐험가', desc: '모든 테마를 사용해봤어요' },
    all_fonts: { icon: '✍️', title: '글꼴 수집가', desc: '5개 이상 글꼴을 사용해봤어요' },
    retro_used: { icon: '⏪', title: '타임머신', desc: '당첨 회고 기능을 사용했어요' },
    photo_numbers: { icon: '📷', title: '사진술사', desc: '사진으로 번호를 만들어봤어요' },
    wheel_spin_10: { icon: '🎡', title: '휠 마스터', desc: '행운의 휠을 10회 돌렸어요' },
    dream_used: { icon: '💭', title: '꿈 해몽가', desc: '꿈으로 번호를 만들어봤어요' },
    personality_done: { icon: '🧩', title: '자기 발견', desc: '번호 성격 테스트를 완료했어요' },
    simulation_10: { icon: '🖥️', title: '시뮬레이터 마스터', desc: '시뮬레이션 10회 실행' },
    simulation_big: { icon: '💻', title: '슈퍼컴퓨터', desc: '1억회 이상 시뮬레이션 실행' },
    match_3plus: { icon: '🎯', title: '저격수', desc: '예측 번호 3개 이상 일치' },
    game_10: { icon: '🎮', title: '게임왕', desc: '미니게임 10회 플레이' },
    game_50: { icon: '🕹️', title: '게임 중독자', desc: '미니게임 50회 플레이' },
    daily_mission_5: { icon: '📋', title: '미션 클리어러', desc: '데일리 미션 5회 달성' },
    collection_20: { icon: '📚', title: '번호 수집가', desc: '번호 도감 20개 수집' },
    collection_45: { icon: '🏆', title: '도감 완성', desc: '번호 도감 45개 전부 수집' },
    stats_all_tabs: { icon: '📊', title: '데이터 분석가', desc: '통계 대시보드 모든 탭 열람' },
};

function getAchievements() {
    try { return JSON.parse(localStorage.getItem('lotto-achievements') || '[]'); } catch (e) { return []; }
}

function unlockAchievement(key) {
    const ach = getAchievements();
    if (ach.includes(key)) return;
    ach.push(key);
    try { localStorage.setItem('lotto-achievements', JSON.stringify(ach)); } catch (e) {}
    const info = ACHIEVEMENTS[key];
    if (info) {
        showToast(`${info.icon} 업적 달성: ${info.title}!`);
        fireConfetti();
        playBeep(1000, 0.2);
    }
}

// 업적 트래킹 함수들
function trackPrediction() {
    const stats = getStats();
    stats.predictions += 1;
    saveStats(stats);
    unlockAchievement('first_prediction');
    if (stats.predictions >= 10) unlockAchievement('prediction_10');
}

function trackThemeUse() {
    const stats = getStats();
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    if (!stats.themes_used.includes(current)) {
        stats.themes_used.push(current);
        saveStats(stats);
        if (stats.themes_used.length >= THEMES.length) unlockAchievement('all_themes');
    }
}

function trackFontUse() {
    const stats = getStats();
    let fontName;
    try { fontName = localStorage.getItem('lotto-font'); } catch (e) {}
    if (fontName && !stats.fonts_used.includes(fontName)) {
        stats.fonts_used.push(fontName);
        saveStats(stats);
        if (stats.fonts_used.length >= 5) unlockAchievement('all_fonts');
    }
}

function trackRetroUse() { unlockAchievement('retro_used'); }
function trackPhotoUse() { unlockAchievement('photo_numbers'); }
function trackWheelSpin() {
    let spins = 0;
    try { spins = parseInt(localStorage.getItem('lotto-wheel-spins') || '0'); } catch (e) {}
    spins++;
    try { localStorage.setItem('lotto-wheel-spins', spins); } catch (e) {}
    if (spins >= 10) unlockAchievement('wheel_spin_10');
}
function trackDreamUse() { unlockAchievement('dream_used'); }
function trackPersonalityDone() { unlockAchievement('personality_done'); }

function getStats() {
    try { return JSON.parse(localStorage.getItem('lotto-stats') || '{"predictions":0,"themes_used":[],"fonts_used":[],"games_played":0,"sim_count":0,"missions_done":0,"tabs_viewed":[],"match3_count":0}'); } catch (e) { return { predictions: 0, themes_used: [], fonts_used: [], games_played: 0, sim_count: 0, missions_done: 0, tabs_viewed: [], match3_count: 0 }; }
}

function saveStats(stats) {
    try { localStorage.setItem('lotto-stats', JSON.stringify(stats)); } catch (e) {}
}

function trackGamePlay() {
    const stats = getStats();
    stats.games_played = (stats.games_played || 0) + 1;
    saveStats(stats);
    if (stats.games_played >= 10) unlockAchievement('game_10');
    if (stats.games_played >= 50) unlockAchievement('game_50');
}

function trackSimRun(iterations) {
    const stats = getStats();
    stats.sim_count = (stats.sim_count || 0) + 1;
    saveStats(stats);
    if (stats.sim_count >= 10) unlockAchievement('simulation_10');
    if (iterations >= 100000000) unlockAchievement('simulation_big');
}

function trackMatchCount(count) {
    if (count < 3) return;
    const stats = getStats();
    stats.match3_count = (stats.match3_count || 0) + 1;
    saveStats(stats);
    if (stats.match3_count >= 1) unlockAchievement('match_3plus');
}

function trackStatsTabView(tab) {
    const stats = getStats();
    if (!stats.tabs_viewed) stats.tabs_viewed = [];
    if (!stats.tabs_viewed.includes(tab)) {
        stats.tabs_viewed.push(tab);
        saveStats(stats);
        if (stats.tabs_viewed.length >= 6) unlockAchievement('stats_all_tabs');
    }
}

function trackMissionDone() {
    const stats = getStats();
    stats.missions_done = (stats.missions_done || 0) + 1;
    saveStats(stats);
    if (stats.missions_done >= 5) unlockAchievement('daily_mission_5');
}

function getUsedThemes() {
    const stats = getStats();
    return new Set(stats.themes_used || []);
}

function getUsedFonts() {
    const stats = getStats();
    return new Set(stats.fonts_used || []);
}

function renderAchievements() {
    const el = document.getElementById('achievementsContent');
    if (!el) return;
    const unlocked = getAchievements();
    const total = Object.keys(ACHIEVEMENTS).length;
    const unlockedCount = unlocked.length;

    const items = Object.entries(ACHIEVEMENTS).map(([key, info]) => {
        const isUnlocked = unlocked.includes(key);
        return `<div class="achievement-item ${isUnlocked ? 'unlocked' : 'locked'}">
            <span class="achievement-icon">${isUnlocked ? info.icon : '🔒'}</span>
            <div class="achievement-info">
                <span class="achievement-title">${info.title}</span>
                <span class="achievement-desc">${info.desc}</span>
            </div>
        </div>`;
    }).join('');

    el.innerHTML = `
        <div class="achievement-progress">
            <div class="achievement-bar-bg"><div class="achievement-bar-fill" style="width:${(unlockedCount/total*100).toFixed(0)}%"></div></div>
            <span class="achievement-count">${unlockedCount} / ${total} 달성</span>
        </div>
        <div class="achievement-grid">${items}</div>
    `;
}

// ========== 7. 스핀 더 휠 ==========
function canSpinWheel() {
    let lastSpin = null;
    try { lastSpin = localStorage.getItem('lotto-last-wheel-spin'); } catch (e) {}
    if (!lastSpin) return true;
    return lastSpin !== getToday();
}

function spinWheel() {
    if (!canSpinWheel()) {
        showStatus('info', '🎡 오늘 이미 휠을 돌리셨어요! 내일 또 돌려보세요.');
        return;
    }

    const el = document.getElementById('wheelResult');
    const prizes = [
        { label: '🪙 1코인', coins: 1, color: '#ffd700' },
        { label: '🪙 3코인', coins: 3, color: '#00f5ff' },
        { label: '🪙 5코인', coins: 5, color: '#ff006e' },
        { label: '🪙 10코인', coins: 10, color: '#8b5cf6' },
        { label: '🎱 보너스 번호', coins: 0, bonus: true, color: '#10b981' },
        { label: '💫 꽝', coins: 0, color: '#666' },
        { label: '🪙 2코인', coins: 2, color: '#f97316' },
        { label: '🪙 7코인', coins: 7, color: '#3b82f6' },
    ];

    const targetIdx = Math.floor(Math.random() * prizes.length);
    const prize = prizes[targetIdx];

    // 스핀 애니메이션
    const wheelEl = document.getElementById('wheelCanvas');
    if (wheelEl) {
        const totalRotation = 1800 + targetIdx * (360 / prizes.length) + Math.floor(Math.random() * 30);
        wheelEl.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
        wheelEl.style.transform = `rotate(${totalRotation}deg)`;
    }

    // 결과 저장
    try { localStorage.setItem('lotto-last-wheel-spin', getToday()); } catch (e) {}
    trackWheelSpin();

    if (prize.coins > 0) {
        const data = getCheckinData();
        data.coins += prize.coins;
        saveCheckinData(data);
    }

    setTimeout(() => {
        el.innerHTML = `
            <div class="wheel-result-show">
                <div style="font-size:2rem;">${prize.label}</div>
                <p class="text-secondary">${prize.coins > 0 ? `행운 코인 +${prize.coins}원 적립!` : prize.bonus ? '보너스 번호가 예측에 추가돼요!' : '다음 기회에...'}</p>
                ${prize.bonus ? `<button class="btn btn-primary" onclick="applyBonusNumbers()" style="margin-top:10px;">🎱 보너스 번호 받기</button>` : ''}
                <p class="text-xs-secondary mt-10">내일 다시 돌릴 수 있어요!</p>
            </div>
        `;
        if (prize.coins > 0) playBeep(800, 0.2);
    }, 4200);

    el.innerHTML = '<div style="text-align:center;color:var(--accent-gold);font-size:1.2rem;">🎡 휠이 돌아가고 있어요...</div>';
}

function applyBonusNumbers() {
    if (!currentWinningNumbers) {
        if (lottoDb && lottoDb.length > 0) {
            const latest = lottoDb[lottoDb.length - 1];
            setWinningNumbers(latest.numbers, latest.bonus, latest.round, '내장 DB');
        } else {
            showStatus('warning', '⚠️ 먼저 당첨번호를 조회해주세요.');
            return;
        }
    }
    // 보너스 번호 기반 추천 실행
    runSmartRecommend();
    showStatus('success', '🎱 보너스 번호가 적용된 스마트 추천을 실행합니다!');
}

function renderWheel() {
    const el = document.getElementById('wheelContent');
    if (!el) return;

    const segments = ['🪙', '💎', '🎱', '💫', '💰', '🍀', '⭐', '🏆'];
    const colors = ['#ffd700', '#00f5ff', '#10b981', '#666', '#f97316', '#3b82f6', '#ff006e', '#8b5cf6'];

    const segAngle = 360 / segments.length;
    let gradient = 'conic-gradient(';
    segments.forEach((_, i) => {
        const start = i * segAngle;
        gradient += `${colors[i]} ${start}deg ${start + segAngle}deg`;
        if (i < segments.length - 1) gradient += ', ';
    });
    gradient += ')';

    el.innerHTML = `
        <div class="wheel-container">
            <div class="wheel-pointer">▼</div>
            <div class="wheel-canvas" id="wheelCanvas" style="background:${gradient};">
                ${segments.map((s, i) => `<span class="wheel-seg" style="transform:rotate(${i * segAngle + segAngle/2}deg) translateY(-55px);">${s}</span>`).join('')}
            </div>
        </div>
        <button class="btn btn-gold" onclick="spinWheel()" ${!canSpinWheel() ? 'disabled' : ''} style="width:100%;justify-content:center;margin-top:15px;">
            ${canSpinWheel() ? '🎡 오늘의 행운 휠 돌리기!' : '✅ 오늘 휠 사용 완료'}
        </button>
        <div id="wheelResult" style="margin-top:15px;text-align:center;"></div>
    `;
}

// ========== 8. 번호 성격 테스트 ==========
function startPersonalityQuiz() {
    const el = document.getElementById('personalityContent');
    if (!el) return;

    const questions = [
        { q: '로또 번호를 고를 때 당신은?', options: ['직감적으로 찍는다', '통계를 분석한다', '생일/기념일을 활용한다', '그냥 자동으로 돌린다'] },
        { q: '당첨되면 가장 먼저 할 일은?', options: ['가족에게 알린다', '조용히 은행부터 간다', 'SNS에 자랑한다', '일단 아무 말도 안 한다'] },
        { q: '당신의 투자 성향은?', options: ['공격적 (한 방을 노린다)', '안정적 (꾸준히 산다)', '즉흥적 (기분 따라 산다)', '전략적 (데이터 기반)'] },
        { q: '로또를 사는 주된 이유는?', options: ['인생 역전의 꿈', '작은 즐거움/취미', '친구/가족 따라', '습관적으로'] },
        { q: '매주 로또에 얼마나 투자하나요?', options: ['5,000원 (1게임)', '10,000원 (2게임)', '20,000원 이상', '기분 따라 다르게'] },
        { q: '당신의 행운의 색깔은?', options: ['빨강 (열정)', '파랑 (냉철)', '노랑 (희망)', '초록 (안정)'] },
    ];

    let qi = 0;
    const answers = [];

    // 이전 호출의 리스너를 제거 후 재바인딩 — 재시작 시 stale 클로저(과거 qi/answers)를 잡지 않도록
    if (el._quizHandler) el.removeEventListener('click', el._quizHandler);
    el._quizHandler = function(e) {
        const btn = e.target.closest('.quiz-option');
        if (!btn) return;
        const aIdx = parseInt(btn.getAttribute('data-aidx'));
        if (isNaN(aIdx)) return;
        answers.push(aIdx);
        qi++;
        if (typeof playBeep === 'function') playBeep(500, 0.05);
        showQuestion();
    };
    el.addEventListener('click', el._quizHandler);

    function showQuestion() {
        if (qi >= questions.length) {
            showResult();
            return;
        }
        const q = questions[qi];
        el.innerHTML = `
            <div class="quiz-card" style="animation:answerReveal 0.3s ease-out;">
                <div class="quiz-progress">질문 ${qi + 1} / ${questions.length}</div>
                <h3 class="quiz-question">${q.q}</h3>
                <div class="quiz-options">
                    ${q.options.map((o, i) => `
                        <button class="quiz-option" data-aidx="${i}">${o}</button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function showResult() {
        const score = answers.reduce((a, b) => a + b, 0);
        const profiles = [
            { type: '직감형 플레이어', emoji: '🎯', desc: '당신은 촉을 믿는 타입! 번호 선택은 그냥 느낌대로. 가끔은 그 직감이 기적을 만들기도 해요.', rec: '인기 번호보다는 나만의 의미 있는 번호를 선택하세요.', color: '#ff6b35' },
            { type: '분석형 플레이어', emoji: '🧠', desc: '데이터와 통계를 사랑하는 이성파. 몬테카를로 시뮬레이션과 찰떡궁합!', rec: 'AI 예측 + 스마트 추천 조합이 당신에게 딱이에요.', color: '#60a5fa' },
            { type: '낭만형 플레이어', emoji: '🌙', desc: '로또를 꿈과 희망으로 생각하는 낭만주의자. 당첨 상상을 즐기는 것만으로도 행복한 타입!', rec: '오늘의 행운 번호와 사진 번호 변환을 추천드려요.', color: '#a78bfa' },
            { type: '소셜형 플레이어', emoji: '🤝', desc: '주변 사람들과 함께하는 걸 좋아하는 사교적 타입. 함께 당첨되는 상상을 자주 해요.', rec: '친구들과 번호를 공유하고 함께 분석해보세요.', color: '#10b981' },
        ];
        const profile = profiles[score % profiles.length];
        const luckyNums = Array.from({ length: 6 }, () => Math.floor(Math.random() * 45) + 1).sort((a, b) => a - b);

        el.innerHTML = `
            <div class="quiz-result-card" style="animation:answerReveal 0.6s ease-out;">
                <div class="quiz-result-emoji" style="font-size:4rem;">${profile.emoji}</div>
                <h3 class="quiz-result-type" style="color:${profile.color};" id="typewriterTarget">${profile.type}</h3>
                <p class="quiz-result-desc">${profile.desc}</p>
                <div class="quiz-result-rec" style="background:rgba(139,92,246,0.1);border-radius:10px;padding:12px;margin:10px 0;">💡 추천: ${profile.rec}</div>
                <div style="margin-top:15px;">
                    <p class="text-xs-secondary">당신을 위한 추천 번호</p>
                    <div class="balls-container">${luckyNums.map(n => `<span class="ball ${getBallClass(n)}" style="animation:revealPop 0.3s ease-out backwards;animation-delay:${n%6*0.1}s;">${n}</span>`).join('')}</div>
                    <button class="btn btn-primary" onclick="usePersonalityNumbers([${luckyNums}])" style="margin-top:10px;">🎱 이 번호로 분석하기</button>
                    <button class="btn btn-secondary" onclick="startPersonalityQuiz()" style="margin-top:5px;">🔄 다시 테스트</button>
                </div>
            </div>
        `;
        trackPersonalityDone();
        if (typeof playBeep === 'function') playBeep(600, 0.1);
        if (typeof fireConfetti === 'function') fireConfetti();
    }

    showQuestion();
}

function usePersonalityNumbers(numbers) {
    _applyFunNumbers(numbers, '🧩 성격 테스트 추천 번호', '🧩 성격 테스트 번호로 분석 완료!');
}

// ========== 9. 꿈해몽 → 번호 ==========
const DREAM_KEYWORDS = {
    '물': [1, 6, 11, 21], '물고기': [2, 12, 22, 32], '돈': [3, 13, 23, 33],
    '똥': [4, 14, 24, 34], '죽음': [5, 15, 25, 35], '결혼': [7, 17, 27, 37],
    '아기': [8, 18, 28, 38], '개': [9, 19, 29, 39], '고양이': [10, 20, 30, 40],
    '뱀': [1, 14, 27, 40], '비': [2, 15, 28, 41], '불': [3, 16, 29, 42],
    '산': [4, 17, 30, 43], '바다': [5, 18, 31, 44], '하늘': [6, 19, 32, 45],
    '꽃': [7, 20, 33, 1], '나무': [8, 21, 34, 11], '새': [9, 22, 35, 21],
    '차': [10, 23, 36, 31], '집': [11, 24, 37, 41], '학교': [12, 25, 38, 2],
    '시험': [13, 26, 39, 22], '여행': [14, 27, 40, 32], '음식': [15, 28, 41, 42],
    '이빨': [16, 29, 42, 3], '머리': [17, 30, 43, 13], '신발': [18, 31, 44, 23],
    '거울': [19, 32, 45, 33], '별': [20, 33, 1, 43], '달': [21, 34, 11, 4],
    '해': [22, 35, 21, 14], '구름': [23, 36, 31, 24], '무지개': [24, 37, 41, 34],
    '로또': [25, 38, 2, 45], '당첨': [26, 39, 22, 6], '숫자': [27, 40, 32, 16],
    '가족': [28, 41, 42, 7], '친구': [29, 42, 3, 17], '연인': [30, 43, 13, 27],
    '감옥': [31, 44, 23, 8], '병원': [32, 45, 33, 18], '의사': [33, 1, 43, 28],
    '선생님': [34, 11, 4, 38], '경찰': [35, 21, 14, 9], '군인': [36, 31, 24, 19],
    '비행기': [37, 41, 34, 29], '배': [38, 2, 44, 39], '기차': [39, 22, 5, 10],
    '편지': [40, 32, 15, 20], '전화': [41, 42, 25, 30], '사진': [42, 3, 35, 40],
    '책': [43, 13, 6, 11], '시계': [44, 23, 16, 21], '열쇠': [45, 33, 26, 31],
    '황금': [5, 25, 45, 15], '보석': [10, 30, 20, 40], '피': [8, 18, 28, 38],
    '울다': [6, 16, 26, 36], '웃다': [7, 17, 27, 37], '날다': [9, 19, 29, 39],
    '달리다': [12, 22, 32, 42],
};

function interpretDream() {
    const el = document.getElementById('dreamContent');
    if (!el) return;

    el.innerHTML = `
        <div class="dream-input-area">
            <p class="text-secondary mb-15">꿈에서 본 것을 자유롭게 적어주세요. 키워드를 추출해서 행운 번호를 만들어드려요!</p>
            <textarea id="dreamText" class="dream-textarea" placeholder="예: 큰 물고기가 바다에서 뛰어오르는 꿈을 꿨어요. 그리고 황금빛 해가 떠오르고 있었어요..." rows="4"></textarea>
            <button class="btn btn-primary" onclick="generateDreamNumbers()" style="width:100%;margin-top:10px;justify-content:center;">💭 꿈 해몽 번호 생성</button>
        </div>
        <div id="dreamResult" style="margin-top:15px;"></div>
    `;
}

function generateDreamNumbers() {
    const text = document.getElementById('dreamText').value.trim();
    if (!text) {
        showStatus('warning', '⚠️ 꿈 내용을 입력해주세요.');
        return;
    }

    const resultEl = document.getElementById('dreamResult');
    const foundNums = new Set();

    // 키워드 매칭
    for (const [keyword, nums] of Object.entries(DREAM_KEYWORDS)) {
        if (text.includes(keyword)) {
            nums.forEach(n => foundNums.add(n));
        }
    }

    // 발음/유사어 기반 추가 번호
    const chars = text.replace(/\s/g, '');
    for (let i = 0; i < chars.length; i++) {
        const code = chars.charCodeAt(i);
        const num = (code % 45) + 1;
        foundNums.add(num);
    }

    // 최소 6개 확보
    const pool = [...foundNums];
    while (pool.length < 6) {
        const n = Math.floor(Math.random() * 45) + 1;
        if (!pool.includes(n)) pool.push(n);
    }

    // 랜덤하게 6개 선택
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const numbers = shuffled.slice(0, 6).sort((a, b) => a - b);

    // 발견된 키워드
    const foundKeywords = Object.keys(DREAM_KEYWORDS).filter(k => text.includes(k));

    resultEl.innerHTML = `
        <div class="dream-result-box">
            <p class="text-xs-secondary">🔍 발견된 키워드: ${foundKeywords.length > 0 ? foundKeywords.slice(0, 8).map(k => `<span class="dream-keyword-tag">${k}</span>`).join(' ') : '일반 단어 기반 생성'}</p>
            <div class="balls-container">${numbers.map(n => `<span class="ball ${getBallClass(n)}">${n}</span>`).join('')}</div>
            <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                <button class="btn btn-primary" onclick="useDreamNumbers([${numbers}])">🎱 예측 분석하기</button>
                <button class="btn btn-secondary" onclick="interpretDream()">💭 다른 꿈으로</button>
            </div>
        </div>
    `;
    trackDreamUse();
    playBeep(600, 0.1);
}

function useDreamNumbers(numbers) {
    _applyFunNumbers(numbers, '💭 꿈해몽 추출 번호', '💭 꿈해몽 번호로 분석 완료!');
}

// ========== (사운드트랙 제거됨 — 효과음 설정은 설정 패널에서 관리) ==========
function switchFunTab(tabName) {
    document.querySelectorAll('.fun-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.fun-tab-content').forEach(c => c.classList.remove('active'));

    const tabEl = document.querySelector(`.fun-tab[data-fun="${tabName}"]`);
    const contentEl = document.getElementById(`funContent${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);

    if (tabEl) tabEl.classList.add('active');
    if (contentEl) contentEl.classList.add('active');

    // 탭 전환 시 콘텐츠 새로고침
    switch (tabName) {
        case 'checkin': renderCheckinUI(); break;
        case 'lucky': renderDailyLuckyNumber(); break;
        case 'countdown': updateCountdown(); break;
        case 'spotlight': renderStatsSpotlight(); break;
        case 'achievements': renderAchievements(); break;
        case 'wheel': renderWheel(); break;
    }
}

// ========== 초기화 ==========
function initAllFunFeatures() {
    initCountdown();
    // DOM이 로드된 후 각 섹션 초기화
    document.addEventListener('DOMContentLoaded', () => {
        renderCheckinUI();
        renderDailyLuckyNumber();
        renderStatsSpotlight();
        renderAchievements();
        renderWheel();
        renderDailyMissions();
        const bookQ = document.getElementById('bookQuestion');
        if (bookQ) bookQ.addEventListener('input', updateBookCharCount);
    }, { once: true });
}

// 자동 초기화
initAllFunFeatures();

// ========== 11. 답변의 책 ==========
const BOOK_ANSWERS = [
    // 긍정 / 격려 (실용적 조언)
    { text: '지금이 바로 그때입니다. 망설이지 마세요.', icon: '✨', type: 'positive' },
    { text: '당신의 선택은 옳은 방향으로 흐르고 있어요.', icon: '🧭', type: 'positive' },
    { text: '좋은 결과가 기다리고 있습니다. 자신감을 가지세요.', icon: '🌟', type: 'positive' },
    { text: '문이 열리고 있어요. 한 걸음 내딛으면 길이 보일 거예요.', icon: '🚪', type: 'positive' },
    { text: '생각보다 훨씬 잘 풀릴 거예요. 너무 걱정하지 마세요.', icon: '🎈', type: 'positive' },
    { text: '기회는 준비된 사람에게 옵니다. 당신은 준비되어 있어요.', icon: '🎯', type: 'positive' },
    { text: '그 길로 가도 괜찮습니다. 모든 경험은 당신을 성장시킬 거예요.', icon: '🛤️', type: 'positive' },
    { text: '지금 내리는 결정이 앞으로의 큰 변화를 가져올 거예요.', icon: '🦋', type: 'positive' },
    { text: '당신의 직감을 믿으세요. 이미 답은 마음속에 있습니다.', icon: '💫', type: 'positive' },
    { text: '주변의 도움이 곧 찾아올 거예요. 혼자가 아니에요.', icon: '🤝', type: 'positive' },
    { text: '작은 행운이 쌓여 큰 기쁨이 될 거예요.', icon: '🍀', type: 'positive' },
    { text: '도전해볼 만한 가치가 있어요. 실패보다 후회가 더 아프니까요.', icon: '💪', type: 'positive' },
    { text: '지금은 조금 힘들어도, 곧 빛이 보일 거예요. 포기하지 마세요.', icon: '🌤️', type: 'positive' },
    { text: '기대해도 좋아요. 곧 반가운 소식이 찾아올 거예요.', icon: '📬', type: 'positive' },
    { text: '당신의 노력은 헛되지 않았어요. 곧 결실을 맺을 거예요.', icon: '🌾', type: 'positive' },
    { text: '확신을 가지고 나아가세요. 우주가 당신을 응원하고 있어요.', icon: '🌌', type: 'positive' },
    { text: '이 순간의 선택이 최선입니다. 뒤돌아보지 마세요.', icon: '🏃', type: 'positive' },
    { text: '곧 명확한 답이 나타날 거예요. 조금만 더 기다려보세요.', icon: '🔮', type: 'positive' },
    { text: '누군가에게 도움을 청해보세요. 뜻밖의 조언을 얻게 될 거예요.', icon: '💡', type: 'positive' },
    { text: '당신이 걱정하는 일은 생각보다 잘 풀릴 거예요.', icon: '☮️', type: 'positive' },

    // 신중 / 대기 (실용적)
    { text: '지금은 때가 아니에요. 조금만 더 기다렸다 결정하세요.', icon: '⏳', type: 'neutral' },
    { text: '아직 모든 정보가 모이지 않았어요. 섣부른 판단은 금물.', icon: '📋', type: 'neutral' },
    { text: '한 걸음 물러서서 다시 바라보세요. 새로운 시야가 열릴 거예요.', icon: '🔭', type: 'neutral' },
    { text: '결정을 서두르지 마세요. 시간이 당신 편이에요.', icon: '🕰️', type: 'neutral' },
    { text: '이 질문은 조금 더 고민이 필요해 보여요. 내일 다시 물어봐 주세요.', icon: '📝', type: 'neutral' },
    { text: '아니요, 지금은 움직이지 않는 편이 좋겠어요.', icon: '🛑', type: 'neutral' },
    { text: '당장의 답보다 과정을 즐기는 게 중요해 보여요.', icon: '🌿', type: 'neutral' },
    { text: '이 결정은 당신 혼자 하기엔 무거워요. 신뢰하는 사람과 상의하세요.', icon: '💬', type: 'neutral' },
    { text: '확실해질 때까지 기다리세요. 의심이 있다면 아직 준비가 안 된 거예요.', icon: '⚖️', type: 'neutral' },
    { text: '보이는 것만 믿지 마세요. 숨겨진 정보가 있을 수 있어요.', icon: '👁️', type: 'neutral' },
    { text: '다른 방향을 고려해보는 건 어떨까요?', icon: '🔄', type: 'neutral' },
    { text: '조금 더 시간을 두고 지켜보세요. 상황이 더 명확해질 거예요.', icon: '☕', type: 'neutral' },
    { text: '욕심을 내려놓으면 오히려 길이 보일 거예요.', icon: '🎈', type: 'neutral' },
    { text: '모든 질문에 답이 있는 건 아니에요. 때로는 흘러가는 대로 두는 것도 방법.', icon: '🍃', type: 'neutral' },
    { text: '아직은 확신할 수 없어요. 다음 주에 다시 물어봐 주세요.', icon: '📅', type: 'neutral' },

    // 신비로운 운세형
    { text: '별들이 당신의 길을 부드럽게 비추고 있습니다.', icon: '⭐', type: 'mystic' },
    { text: '달이 차오를 무렵, 당신이 원하는 답이 찾아올 거예요.', icon: '🌙', type: 'mystic' },
    { text: '바람이 당신의 등 뒤에서 밀어주고 있어요. 순항할 거예요.', icon: '🌬️', type: 'mystic' },
    { text: '우주가 당신에게 보내는 신호를 놓치지 마세요.', icon: '🌠', type: 'mystic' },
    { text: '오래된 나무 아래에 답이 숨어 있어요. 자연 속에서 영감을 얻으세요.', icon: '🌳', type: 'mystic' },
    { text: '태양이 떠오르는 방향으로 나아가세요. 거기에 길이 있습니다.', icon: '☀️', type: 'mystic' },
    { text: '파도가 밀려왔다 밀려가듯, 모든 것은 제때 찾아옵니다.', icon: '🌊', type: 'mystic' },
    { text: '당신의 수호별이 특별히 빛나는 밤이에요. 소원을 빌어보세요.', icon: '💫', type: 'mystic' },
    { text: '나비가 날개를 펼치듯, 당신의 운도 펼쳐지고 있어요.', icon: '🦋', type: 'mystic' },
    { text: '무지개 끝자락에 숨겨진 행운이 당신을 기다리고 있어요.', icon: '🌈', type: 'mystic' },
    { text: '우연한 만남이 당신의 인생을 바꿀 거예요. 눈을 크게 뜨고 다니세요.', icon: '👀', type: 'mystic' },
    { text: '네잎클로버가 당신 주변에 피어나고 있어요. 행운이 가까이 왔습니다.', icon: '🍀', type: 'mystic' },
    { text: '과거의 당신이 지금의 당신에게 보내는 메시지: "잘하고 있어요."', icon: '💌', type: 'mystic' },
    { text: '밤하늘의 가장 밝은 별이 당신의 이름을 부르고 있어요.', icon: '🌟', type: 'mystic' },
    { text: '시간의 강은 항상 흘러요. 지금의 고민도 언젠가 추억이 될 거예요.', icon: '⏳', type: 'mystic' },
    { text: '책 속에 적힌 오래된 지혜가 당신을 인도할 거예요.', icon: '📜', type: 'mystic' },
    { text: '새벽 안개 속에서 길이 보일 거예요. 잠시 멈춰 서서 주위를 둘러보세요.', icon: '🌫️', type: 'mystic' },
    { text: '우주는 당신이 생각하는 것보다 훨씬 더 큰 그림을 그리고 있어요.', icon: '🎨', type: 'mystic' },
    { text: '당신이 놓친 작은 행운이 곧 되돌아올 거예요. 받을 준비를 하세요.', icon: '🪃', type: 'mystic' },
    { text: '고요한 호수처럼 마음을 가라앉히면, 그 안에 답이 비칠 거예요.', icon: '🪷', type: 'mystic' },
];

function updateBookCharCount() {
    const textarea = document.getElementById('bookQuestion');
    const counter = document.getElementById('bookCharCount');
    if (textarea && counter) {
        const len = textarea.value.length;
        counter.textContent = `${len} / 120자`;
    }
}

function openBookOfAnswers() {
    const question = document.getElementById('bookQuestion').value.trim();
    if (!question) {
        if (typeof showStatus === 'function') showStatus('warning', '📖 질문을 입력하고 책을 열어주세요.');
        return;
    }

    const bookVisual = document.getElementById('bookVisual');
    const openBtn = document.getElementById('openBookBtn');
    const answerEl = document.getElementById('bookAnswer');
    const answerText = document.getElementById('bookAnswerText');
    const answerSub = document.getElementById('bookAnswerSub');
    const answerIcon = document.getElementById('bookAnswerIcon');
    const textarea = document.getElementById('bookQuestion');

    // 책 펼쳐지는 연출
    if (bookVisual) bookVisual.classList.add('opened');
    if (openBtn) openBtn.classList.add('hidden');
    if (textarea) textarea.disabled = true;

    // 랜덤 답변 선택 (질문 길이 기반 시드 살짝 가미)
    const seed = question.length;
    const idx = (seed * 7 + Math.floor(Math.random() * BOOK_ANSWERS.length)) % BOOK_ANSWERS.length;
    const answer = BOOK_ANSWERS[idx];

    // 답변 표시 (약간의 지연 후 — 책 넘기는 느낌)
    setTimeout(() => {
        answerIcon.textContent = answer.icon;
        answerText.textContent = answer.text;
        // 타입별 서브 메시지
        const subs = {
            positive: '— 답변의 책이 당신에게 건네는 따뜻한 한 마디',
            neutral: '— 때로는 기다림도 지혜입니다',
            mystic: '— 우주가 당신에게 속삭이는 비밀',
        };
        answerSub.textContent = subs[answer.type] || subs.positive;
        answerEl.classList.remove('hidden');

        if (typeof playBeep === 'function') playBeep(800, 0.15);
        if (typeof vibrate === 'function') vibrate(30);

        // 통계 추적
        if (typeof trackStatsView === 'function') trackStatsView();
    }, 400);
}

function resetBookOfAnswers() {
    const bookVisual = document.getElementById('bookVisual');
    const openBtn = document.getElementById('openBookBtn');
    const answerEl = document.getElementById('bookAnswer');
    const textarea = document.getElementById('bookQuestion');
    const answerText = document.getElementById('bookAnswerText');

    if (bookVisual) bookVisual.classList.remove('opened');
    if (openBtn) openBtn.classList.remove('hidden');
    if (answerEl) answerEl.classList.add('hidden');
    if (textarea) { textarea.disabled = false; textarea.value = ''; textarea.focus(); }
    if (answerText) answerText.textContent = '';
    updateBookCharCount();

    if (typeof playBeep === 'function') playBeep(500, 0.05);
}
