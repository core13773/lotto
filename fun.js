// fun.js - 재미있는 콘텐츠 기능 모음
// 출석 체크, 오늘의 행운 번호, 추첨 카운트다운, 사진→번호, 통계 스포트라이트,
// 업적/뱃지, 스핀 더 휠, 번호 성격 테스트, 꿈해몽, 사운드트랙

// ========== 1. 출석 체크 + 연속 보상 ==========
function getToday() { return new Date().toISOString().slice(0, 10); }
function getYesterday(d) { const dt = new Date(d); dt.setDate(dt.getDate() - 1); return dt.toISOString().slice(0, 10); }

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

// ========== 데일리 미션 ==========
function getDailyMissions() {
    const today = getToday();
    const seed = today.split('-').reduce((a, b) => a + parseInt(b), 0);
    function rng(s) { let x = Math.sin(s * 9301 + 49297) * 49297; return x - Math.floor(x); }

    const missions = [
        { type: 'sum', title: '합계 도전', icon: '➕', desc: `합계가 ${110 + Math.floor(rng(seed)*30)}~${130 + Math.floor(rng(seed+1)*30)} 사이인 번호 6개 찾기`, reward: 2 },
        { type: 'odd_even', title: '홀짝 밸런스', icon: '⚖️', desc: `홀수 ${2+Math.floor(rng(seed+2)*3)}개 + 짝수 나머지로 조합 만들기`, reward: 2 },
        { type: 'color', title: '색깔 도전', icon: '🎨', desc: `${['노랑(1~10)','파랑(11~20)','빨강(21~30)','회색(31~40)','초록(41~45)'][Math.floor(rng(seed+3)*5)]} 구간 번호를 3개 이상 포함`, reward: 3 },
        { type: 'no_consec', title: '연속번호 금지', icon: '🚫', desc: '연속된 번호가 하나도 없는 조합 만들기', reward: 2 },
        { type: 'high_low', title: '고저 믹스', icon: '📊', desc: `저번호(1~22) ${2+Math.floor(rng(seed+4)*3)}개 + 고번호(23~45) 나머지로 구성`, reward: 2 },
        { type: 'game', title: '게임 도전', icon: '🎮', desc: '미니 게임존에서 번호 3개 모으기', reward: 3 },
        { type: 'sim', title: '시뮬레이션 도전', icon: '🖥️', desc: '시뮬레이션 1회 실행하기', reward: 2 },
    ];

    // 오늘의 미션 2개 선택
    const m1 = missions[Math.floor(rng(seed + 5) * missions.length)];
    let m2 = missions[Math.floor(rng(seed + 6) * missions.length)];
    while (m2.type === m1.type) m2 = missions[Math.floor(rng(seed + 7) * missions.length)];

    return [m1, m2];
}

function getMissionData() {
    try { return JSON.parse(localStorage.getItem('lotto-daily-missions') || '{"date":"","done":[]}'); } catch (e) { return { date: '', done: [] }; }
}

function completeMission(idx) {
    const data = getMissionData();
    if (data.done.includes(idx)) return;
    data.done.push(idx);
    try { localStorage.setItem('lotto-daily-missions', JSON.stringify(data)); } catch (e) {}
    const missions = getDailyMissions();
    const m = missions[idx];
    const checkin = getCheckinData();
    checkin.coins += m.reward;
    saveCheckinData(checkin);
    trackMissionDone();
    showStatus('success', `✅ 미션 완료! +${m.reward}코인 (보유: ${checkin.coins}🪙)`);
    playBeep(800, 0.12); vibrate(50);
    renderDailyMissions();
}

function renderDailyMissions() {
    const el = document.getElementById('dailyMissionsContent');
    if (!el) return;
    const today = getToday();
    const data = getMissionData();
    if (data.date !== today) { data.date = today; data.done = []; try { localStorage.setItem('lotto-daily-missions', JSON.stringify(data)); } catch (e) {} }
    const missions = getDailyMissions();
    el.innerHTML = missions.map((m, i) => {
        const done = data.done.includes(i);
        return `<div class="daily-mission-item ${done ? 'done' : ''}" onclick="${done ? '' : `completeMission(${i})`}">
            <span class="daily-mission-icon">${m.icon}</span>
            <div class="daily-mission-info">
                <span class="daily-mission-title">${m.title}</span>
                <span class="daily-mission-desc">${m.desc}</span>
            </div>
            <span class="daily-mission-reward">${done ? '✅' : '+' + m.reward + '🪙'}</span>
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
        // 오늘 토요일, 20:00 이전
        drawTime.setUTCHours(20, 45 - minutes, 0, 0);
    } else if (day === 6 && hours >= 20 && minutes >= 45) {
        // 토요일 20:45 이후 → 다음 주
        drawTime.setUTCDate(drawTime.getUTCDate() + 7);
        drawTime.setUTCHours(20, 45 - minutes, 0, 0);
    } else {
        const daysUntil = day === 6 ? 0 : (6 - day + 7) % 7;
        if (daysUntil === 0 && hours >= 20 && minutes >= 45) {
            drawTime.setUTCDate(drawTime.getUTCDate() + 7);
        } else if (daysUntil === 0) {
            drawTime.setUTCHours(20, 45 - minutes, 0, 0);
        } else {
            drawTime.setUTCDate(drawTime.getUTCDate() + daysUntil);
            drawTime.setUTCHours(20, 45 - minutes, 0, 0);
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
    const spins = (parseInt(localStorage.getItem('lotto-wheel-spins') || '0')) + 1;
    localStorage.setItem('lotto-wheel-spins', spins);
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
    const lastSpin = localStorage.getItem('lotto-last-wheel-spin');
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
    localStorage.setItem('lotto-last-wheel-spin', getToday());
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
    ];

    let qi = 0;
    const answers = [];

    function showQuestion() {
        if (qi >= questions.length) {
            showResult();
            return;
        }
        const q = questions[qi];
        el.innerHTML = `
            <div class="quiz-card">
                <div class="quiz-progress">질문 ${qi + 1} / ${questions.length}</div>
                <h3 class="quiz-question">${q.q}</h3>
                <div class="quiz-options">
                    ${q.options.map((o, i) => `
                        <button class="quiz-option" onclick="answerQuiz(${qi}, ${i})">${o}</button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    window.answerQuiz = function(qIdx, aIdx) {
        answers.push(aIdx);
        qi++;
        showQuestion();
    };

    function showResult() {
        const score = answers.reduce((a, b) => a + b, 0);
        const profiles = [
            { type: '직감형 플레이어', emoji: '🎯', desc: '당신은 촉을 믿는 타입! 번호 선택은 그냥 느낌대로. 가끔은 그 직감이 기적을 만들기도 해요.', rec: '인기 번호보다는 나만의 의미 있는 번호를 선택하세요.' },
            { type: '분석형 플레이어', emoji: '🧠', desc: '데이터와 통계를 사랑하는 이성파. 몬테카를로 시뮬레이션과 찰떡궁합!', rec: 'AI 예측 + 스마트 추천 조합이 당신에게 딱이에요.' },
            { type: '낭만형 플레이어', emoji: '🌙', desc: '로또를 꿈과 희망으로 생각하는 낭만주의자. 당첨 상상을 즐기는 것만으로도 행복한 타입!', rec: '오늘의 행운 번호와 사진 번호 변환을 추천드려요.' },
            { type: '소셜형 플레이어', emoji: '🤝', desc: '주변 사람들과 함께하는 걸 좋아하는 사교적 타입. 함께 당첨되는 상상을 자주 해요.', rec: '친구들과 번호를 공유하고 함께 분석해보세요.' },
        ];
        const profile = profiles[score % profiles.length];
        const luckyNums = Array.from({ length: 6 }, () => Math.floor(Math.random() * 45) + 1).sort((a, b) => a - b);

        el.innerHTML = `
            <div class="quiz-result-card">
                <div class="quiz-result-emoji">${profile.emoji}</div>
                <h3 class="quiz-result-type">${profile.type}</h3>
                <p class="quiz-result-desc">${profile.desc}</p>
                <div class="quiz-result-rec">💡 추천: ${profile.rec}</div>
                <div style="margin-top:15px;">
                    <p class="text-xs-secondary">당신을 위한 추천 번호</p>
                    <div class="balls-container">${luckyNums.map(n => `<span class="ball ${getBallClass(n)}">${n}</span>`).join('')}</div>
                    <button class="btn btn-primary" onclick="usePersonalityNumbers([${luckyNums}])" style="margin-top:10px;">🎱 이 번호로 분석하기</button>
                    <button class="btn btn-secondary" onclick="startPersonalityQuiz()" style="margin-top:5px;">🔄 다시 테스트</button>
                </div>
            </div>
        `;
        trackPersonalityDone();
        playBeep(600, 0.1);
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

// ========== 10. 사운드트랙 모드 (Web Audio API) ==========
let soundtrackCtx = null;
let soundtrackNodes = [];
let soundtrackType = null;

const SOUNDTRACKS = [
    { type: 'lofi', title: '로파이 힙합', icon: '🎧', desc: '부드러운 베이스 + 드리프트 패드 + 로파이 비트' },
    { type: 'jazz', title: '재즈 카페', icon: '☕', desc: '따뜻한 재즈 코드 + 더블베이스 + 브러시 드럼' },
    { type: 'piano', title: '클래식 피아노', icon: '🎹', desc: '잔잔한 아르페지오 + 공명 패드' },
    { type: 'nature', title: '자연의 소리', icon: '🌿', desc: '빗소리 + 파도 + 바람 소리' },
];

function openSoundtrack() {
    const el = document.getElementById('soundtrackContent');
    if (!el) return;

    el.innerHTML = `
        <div class="soundtrack-grid">
            ${SOUNDTRACKS.map((s, i) => `
                <div class="soundtrack-card" onclick="playSoundtrack(${i})">
                    <span class="soundtrack-icon">${s.icon}</span>
                    <span class="soundtrack-title">${s.title}</span>
                    <span class="soundtrack-desc">${s.desc}</span>
                </div>
            `).join('')}
        </div>
        <div id="soundtrackPlayer" class="hidden" style="margin-top:15px;"></div>
    `;
}

function ensureAudioCtx() {
    if (!soundtrackCtx) {
        soundtrackCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (soundtrackCtx.state === 'suspended') {
        soundtrackCtx.resume();
    }
    return soundtrackCtx;
}

function stopSoundtrack() {
    soundtrackNodes.forEach(n => {
        try {
            if (typeof n.stop === 'function') n.stop();
        } catch (e) {}
        try {
            if (typeof n.disconnect === 'function') n.disconnect();
        } catch (e) {}
    });
    soundtrackNodes = [];
    soundtrackType = null;

    const player = document.getElementById('soundtrackPlayer');
    if (player) { player.classList.add('hidden'); player.innerHTML = ''; }
}

function playSoundtrack(idx) {
    stopSoundtrack();
    const s = SOUNDTRACKS[idx];
    const ctx = ensureAudioCtx();
    soundtrackType = s.type;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.3;
    masterGain.connect(ctx.destination);
    soundtrackNodes.push(masterGain);

    switch (s.type) {
        case 'nature': buildNatureSoundscape(ctx, masterGain); break;
        case 'lofi': buildLofiSoundscape(ctx, masterGain); break;
        case 'jazz': buildJazzSoundscape(ctx, masterGain); break;
        case 'piano': buildPianoSoundscape(ctx, masterGain); break;
    }

    const player = document.getElementById('soundtrackPlayer');
    player.classList.remove('hidden');
    player.innerHTML = `
        <div style="text-align:center;margin-bottom:10px;color:var(--accent-gold);">${s.icon} 현재 재생: ${s.title}</div>
        <div style="display:flex;align-items:center;gap:6px;justify-content:center;margin-bottom:10px;">
            ${[...Array(5)].map(() => `<span class="soundwave-bar"></span>`).join('')}
        </div>
        <button class="btn btn-secondary" onclick="stopSoundtrack()" style="width:100%;justify-content:center;">⏹️ 음악 중지</button>
    `;
    showStatus('success', `🎵 ${s.title} 재생 중...`);
}

// ── 공통: GainNode 생성 헬퍼 (항상 track하고, 0 아닌 값으로 시작) ──
function createTrackedGain(ctx, value, dest) {
    const g = ctx.createGain();
    g.gain.value = value;
    g.connect(dest);
    soundtrackNodes.push(g);
    return g;
}

// ── 자연의 소리 (빗소리 + 파도 + 바람) ──
function buildNatureSoundscape(ctx, master) {
    // 빗소리 (밴드패스 노이즈)
    const rainGain = createTrackedGain(ctx, 0.22, master);
    const rainNode = createNoiseNode(ctx, 4);
    const rainF = ctx.createBiquadFilter();
    rainF.type = 'bandpass'; rainF.frequency.value = 900; rainF.Q.value = 0.3;
    rainNode.connect(rainF); rainF.connect(rainGain);
    soundtrackNodes.push(rainNode, rainF);

    const rainLow = createNoiseNode(ctx, 3);
    const rainLowF = ctx.createBiquadFilter();
    rainLowF.type = 'lowpass'; rainLowF.frequency.value = 500;
    rainLow.connect(rainLowF); rainLowF.connect(rainGain);
    soundtrackNodes.push(rainLow, rainLowF);

    // 빗소리 약한 강도 변화 (LFO가 깊게 깎지 않게)
    const rLfo = ctx.createOscillator();
    rLfo.type = 'sine'; rLfo.frequency.value = 0.12;
    const rLfoG = ctx.createGain();
    rLfoG.gain.value = 0.06; // 작은 변조 — 0.22±0.06 = 0.16~0.28
    rLfo.connect(rLfoG); rLfoG.connect(rainGain.gain);
    rLfo.start();
    soundtrackNodes.push(rLfo, rLfoG);

    // 파도 (저역 노이즈)
    const waveGain = createTrackedGain(ctx, 0.12, master);
    const waveNode = createNoiseNode(ctx, 5);
    const waveF = ctx.createBiquadFilter();
    waveF.type = 'lowpass'; waveF.frequency.value = 180;
    waveNode.connect(waveF); waveF.connect(waveGain);
    soundtrackNodes.push(waveNode, waveF);

    const wLfo = ctx.createOscillator();
    wLfo.type = 'sine'; wLfo.frequency.value = 0.05;
    const wLfoG = ctx.createGain();
    wLfoG.gain.value = 0.04;
    wLfo.connect(wLfoG); wLfoG.connect(waveGain.gain);
    wLfo.start();
    soundtrackNodes.push(wLfo, wLfoG);

    // 바람 (저역 노이즈, 느린 변조)
    const windGain = createTrackedGain(ctx, 0.06, master);
    const windNode = createNoiseNode(ctx, 6);
    const windF = ctx.createBiquadFilter();
    windF.type = 'lowpass'; windF.frequency.value = 120; windF.Q.value = 0.5;
    windNode.connect(windF); windF.connect(windGain);
    soundtrackNodes.push(windNode, windF);

    const wdLfo = ctx.createOscillator();
    wdLfo.type = 'triangle'; wdLfo.frequency.value = 0.04;
    const wdLfoG = ctx.createGain();
    wdLfoG.gain.value = 0.02;
    wdLfo.connect(wdLfoG); wdLfoG.connect(windGain.gain);
    wdLfo.start();
    soundtrackNodes.push(wdLfo, wdLfoG);
}

// ── 로파이 힙합 ──
function buildLofiSoundscape(ctx, master) {
    const chordFreqs = [130.81, 164.81, 196.00, 246.94];
    chordFreqs.forEach(f => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle'; osc.frequency.value = f;
        osc.detune.value = Math.random() * 10 - 5;
        const g = createTrackedGain(ctx, 0.05, master);
        osc.connect(g); osc.start();
        soundtrackNodes.push(osc);

        const lfo = ctx.createOscillator();
        lfo.type = 'sine'; lfo.frequency.value = 0.1 + Math.random() * 0.2;
        const lfoG = ctx.createGain();
        lfoG.gain.value = 0.015;
        lfo.connect(lfoG); lfoG.connect(g.gain);
        lfo.start();
        soundtrackNodes.push(lfo, lfoG);
    });

    const bass = ctx.createOscillator();
    bass.type = 'sine'; bass.frequency.value = 65.41;
    const bassG = createTrackedGain(ctx, 0.08, master);
    bass.connect(bassG); bass.start();
    soundtrackNodes.push(bass);

    const beatInterval = setInterval(() => {
        if (soundtrackType !== 'lofi') { clearInterval(beatInterval); return; }
        playNoiseClick(ctx, master, 60, 0.06, 0.08);
        setTimeout(() => {
            if (soundtrackType !== 'lofi') return;
            playNoiseClick(ctx, master, 1500, 0.15, 0.05);
        }, 400);
    }, 1200);
    soundtrackNodes.push({ stop: () => clearInterval(beatInterval), disconnect: () => {} });
}

// ── 재즈 카페 ──
function buildJazzSoundscape(ctx, master) {
    const jazzChords = [146.83, 174.61, 220.00, 261.63];
    jazzChords.forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine'; osc.frequency.value = f;
        osc.detune.value = (i % 2 === 0 ? -5 : 5);
        const g = createTrackedGain(ctx, 0.06, master);
        osc.connect(g); osc.start();
        soundtrackNodes.push(osc);

        const lfo = ctx.createOscillator();
        lfo.type = 'sine'; lfo.frequency.value = 0.3 + i * 0.1;
        const lfoG = ctx.createGain();
        lfoG.gain.value = 0.015;
        lfo.connect(lfoG); lfoG.connect(g.gain);
        lfo.start();
        soundtrackNodes.push(lfo, lfoG);
    });

    const dbass = ctx.createOscillator();
    dbass.type = 'triangle'; dbass.frequency.value = 73.42;
    const dbassG = createTrackedGain(ctx, 0.1, master);
    dbass.connect(dbassG); dbass.start();
    soundtrackNodes.push(dbass);

    const brushInterval = setInterval(() => {
        if (soundtrackType !== 'jazz') { clearInterval(brushInterval); return; }
        playNoiseClick(ctx, master, 3000, 0.04, 0.025);
        setTimeout(() => playNoiseClick(ctx, master, 4000, 0.03, 0.02), 200);
        setTimeout(() => playNoiseClick(ctx, master, 3500, 0.03, 0.02), 500);
        setTimeout(() => playNoiseClick(ctx, master, 4500, 0.03, 0.02), 700);
    }, 1000);
    soundtrackNodes.push({ stop: () => clearInterval(brushInterval), disconnect: () => {} });
}

// ── 클래식 피아노 ──
function buildPianoSoundscape(ctx, master) {
    const scaleFreqs = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63];
    let noteIdx = 0;

    function playNextNote() {
        if (soundtrackType !== 'piano') return;
        const freq = scaleFreqs[noteIdx % scaleFreqs.length];
        noteIdx++;

        const osc = ctx.createOscillator();
        osc.type = 'sine'; osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.15, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
        osc.connect(g); g.connect(master);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 1.8);
        soundtrackNodes.push(osc, g);

        const overtone = ctx.createOscillator();
        overtone.type = 'sine'; overtone.frequency.value = freq * 2.01;
        const og = ctx.createGain();
        og.gain.setValueAtTime(0.04, ctx.currentTime);
        og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        overtone.connect(og); og.connect(master);
        overtone.start(ctx.currentTime); overtone.stop(ctx.currentTime + 1.0);
        soundtrackNodes.push(overtone, og);

        setTimeout(playNextNote, 1500);
    }
    playNextNote();

    const padOsc = ctx.createOscillator();
    padOsc.type = 'sine'; padOsc.frequency.value = 130.81;
    const padGain = createTrackedGain(ctx, 0.03, master);
    padOsc.connect(padGain); padOsc.start();
    soundtrackNodes.push(padOsc);

    const padLfo = ctx.createOscillator();
    padLfo.type = 'sine'; padLfo.frequency.value = 0.15;
    const padLfoG = ctx.createGain();
    padLfoG.gain.value = 0.01;
    padLfo.connect(padLfoG); padLfoG.connect(padGain.gain);
    padLfo.start();
    soundtrackNodes.push(padLfo, padLfoG);
}

// ── 유틸: 노이즈 노드 생성 ──
function createNoiseNode(ctx, bufferCount = 4) {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        let sample = 0;
        for (let j = 0; j < bufferCount; j++) { sample += Math.random() * 2 - 1; }
        data[i] = sample / bufferCount;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.start();
    return source;
}

// ── 유틸: 짧은 노이즈 클릭 (퍼커션) ──
function playNoiseClick(ctx, master, freq, duration, vol) {
    if (soundtrackNodes.length === 0) return;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = freq; filter.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = vol;
    source.connect(filter); filter.connect(g); g.connect(master);
    source.start();
    source.stop(ctx.currentTime + duration + 0.01);
}

// ── 탭 전환 시 사운드트랙 정리 ──
const origSwitchFunTab = switchFunTab;
switchFunTab = function(tabName) {
    if (tabName !== 'soundtrack' && soundtrackType) {
        stopSoundtrack();
    }
    origSwitchFunTab(tabName);
};

// ========== 탭 전환 ==========
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
    }, { once: true });
}

// 자동 초기화
initAllFunFeatures();
