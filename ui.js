// ui.js - 테마, 글꼴, 토스트, 설정, 공유, 알림

// ========== 테마 전환 ==========
// ========== 테마 변경 (다중 스타일) ==========
const THEMES = ['dark', 'light', 'ocean', 'forest', 'sunset', 'neon', 'coffee'];
const THEME_ICONS = { dark: '🌑', light: '☀️', ocean: '🌊', forest: '🌿', sunset: '🌅', neon: '⚡', coffee: '☕' };
const THEME_LABELS = { dark: '다크', light: '라이트', ocean: '오션', forest: '포레스트', sunset: '선셋', neon: '네온', coffee: '커피' };

function cycleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const idx = THEMES.indexOf(current);
    const next = THEMES[(idx + 1) % THEMES.length];
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('lotto-theme', next); } catch (e) {}
    updateThemeBtn(next);
    showToast(`${THEME_ICONS[next]} ${THEME_LABELS[next]} 테마`);
    if (typeof trackThemeUse === 'function') trackThemeUse();
}

function updateThemeBtn(theme) {
    const btn = document.getElementById('themeBtn');
    if (btn) btn.textContent = THEME_ICONS[theme] || '🌑';
    // theme-color 메타 태그 업데이트 (모바일 브라우저 UI 색상)
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        const colors = { dark: '#0a0a1a', light: '#f0f2f5', ocean: '#0a1628', forest: '#0a1a0f', sunset: '#1a0f0a', neon: '#050505', coffee: '#1c1410' };
        meta.content = colors[theme] || '#0a0a1a';
    }
}

function loadTheme() {
    let saved;
    try { saved = localStorage.getItem('lotto-theme'); } catch (e) { saved = null; }
    if (!saved || !THEMES.includes(saved)) {
        saved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeBtn(saved);
}

// ========== 글꼴 변경 ==========
const FONT_OPTIONS = {
    'Noto Sans KR': "'Noto Sans KR', sans-serif",
    'Noto Serif KR': "'Noto Serif KR', serif",
    'Nanum Gothic': "'Nanum Gothic', sans-serif",
    'Nanum Myeongjo': "'Nanum Myeongjo', serif",
    'IBM Plex Sans KR': "'IBM Plex Sans KR', sans-serif",
    'Gothic A1': "'Gothic A1', sans-serif",
    'Dongle': "'Dongle', sans-serif",
    'Sunflower': "'Sunflower', sans-serif",
    'Do Hyeon': "'Do Hyeon', sans-serif",
    'Jua': "'Jua', sans-serif",
    'Nanum Pen Script': "'Nanum Pen Script', cursive",
    'Hi Melody': "'Hi Melody', cursive",
    'Yeon Sung': "'Yeon Sung', cursive",
    'Black Han Sans': "'Black Han Sans', sans-serif",
    'Gowun Dodum': "'Gowun Dodum', sans-serif"
};
const FONT_ORDER = [
    'Noto Sans KR', 'Noto Serif KR', 'Nanum Gothic', 'Nanum Myeongjo',
    'IBM Plex Sans KR', 'Gothic A1', 'Dongle', 'Sunflower',
    'Do Hyeon', 'Jua', 'Nanum Pen Script', 'Hi Melody', 'Yeon Sung',
    'Black Han Sans', 'Gowun Dodum'
];
const FONT_LABELS = {
    'Noto Sans KR': 'Noto Sans KR (기본 산세리프)',
    'Noto Serif KR': 'Noto Serif KR (세리프)',
    'Nanum Gothic': '나눔고딕',
    'Nanum Myeongjo': '나눔명조',
    'IBM Plex Sans KR': 'IBM Plex Sans KR (모던)',
    'Gothic A1': '고딕 A1 (깔끔)',
    'Dongle': '동글 (캐주얼)',
    'Sunflower': '해바라기 (우아함)',
    'Do Hyeon': '도현 (강렬)',
    'Jua': '주아 (부드러움)',
    'Nanum Pen Script': '나눔손글씨',
    'Hi Melody': 'Hi Melody (러블리)',
    'Yeon Sung': '연성 (전통)',
    'Black Han Sans': '검은고딕 (임팩트)',
    'Gowun Dodum': '고운돋움 (산뜻)'
};

const FONT_WEIGHTS = {
    'Noto Sans KR': 'wght@300;400;500;700;900',
    'Noto Serif KR': 'wght@400;500;700;900',
    'Nanum Gothic': 'wght@400;700;800',
    'Nanum Myeongjo': 'wght@400;700;800',
    'IBM Plex Sans KR': 'wght@400;500;700',
    'Gothic A1': 'wght@400;500;700;900',
    'Dongle': 'wght@300;400;700',
    'Sunflower': 'wght@300;500;700'
};
const LOADED_FONTS = new Set(['Noto Sans KR', 'Noto Serif KR']);

function loadGoogleFont(fontName) {
    if (LOADED_FONTS.has(fontName)) return;
    LOADED_FONTS.add(fontName);
    const family = fontName.replace(/ /g, '+');
    const weights = FONT_WEIGHTS[fontName] || '';
    const href = `https://fonts.googleapis.com/css2?family=${family}${weights ? ':' + weights : ''}&display=swap`;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
}

function changeFont(fontName) {
    loadGoogleFont(fontName);
    const fontStack = FONT_OPTIONS[fontName] || FONT_OPTIONS['Noto Sans KR'];
    document.body.style.fontFamily = fontStack;
    try { localStorage.setItem('lotto-font', fontName); } catch (e) {}
    if (typeof trackFontUse === 'function') trackFontUse();
}

function getCurrentFontName() {
    let name;
    try { name = localStorage.getItem('lotto-font'); } catch (e) { name = null; }
    return name && FONT_OPTIONS[name] ? name : 'Noto Sans KR';
}

function toggleFontMenu(e) {
    e.stopPropagation();
    let popup = document.getElementById('fontPopup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'fontPopup';
        popup.className = 'font-popup';
        document.getElementById('fontBtn').parentElement.appendChild(popup);
        buildFontPopupItems(popup);
    }
    const isOpen = popup.classList.toggle('open');
    const fontBtn = document.getElementById('fontBtn');
    if (fontBtn) fontBtn.setAttribute('aria-expanded', String(isOpen));
    // 중복 등록 방지: 먼저 기존 리스너 제거 후 조건적으로 추가
    document.removeEventListener('click', closeFontMenu);
    document.removeEventListener('keydown', fontMenuKeyHandler);
    if (isOpen) {
        buildFontPopupItems(popup);
        document.addEventListener('click', closeFontMenu);
        document.addEventListener('keydown', fontMenuKeyHandler);
    }
}

function fontMenuKeyHandler(e) {
    if (e.key === 'Escape') {
        const popup = document.getElementById('fontPopup');
        const btn = document.getElementById('fontBtn');
        if (popup) popup.classList.remove('open');
        if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
        document.removeEventListener('click', closeFontMenu);
        document.removeEventListener('keydown', fontMenuKeyHandler);
    }
}

function closeFontMenu(e) {
    const popup = document.getElementById('fontPopup');
    const btn = document.getElementById('fontBtn');
    if (popup && !popup.contains(e.target) && e.target !== btn) {
        popup.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        document.removeEventListener('click', closeFontMenu);
        document.removeEventListener('keydown', fontMenuKeyHandler);
        btn.focus();
    }
}

function buildFontPopupItems(popup) {
    const current = getCurrentFontName();
    popup.innerHTML = FONT_ORDER.map(f => {
        const active = f === current ? ' active' : '';
        const fontStack = FONT_OPTIONS[f];
        return `<button class="font-popup-item${active}" style="font-family:${fontStack}" onclick="event.stopPropagation();selectFont('${f}')">${FONT_LABELS[f] || f}<span class="font-preview" style="font-family:${fontStack}">1234567890 가나다ABC</span></button>`;
    }).join('');
}

function selectFont(fontName) {
    changeFont(fontName);
    const popup = document.getElementById('fontPopup');
    const btn = document.getElementById('fontBtn');
    if (popup) popup.classList.remove('open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', closeFontMenu);
    document.removeEventListener('keydown', fontMenuKeyHandler);
    if (btn) btn.focus();
    showToast(`🔤 ${FONT_LABELS[fontName] || fontName}`);
}

function loadFontSetting() {
    const fontName = getCurrentFontName();
    loadGoogleFont(fontName);
    document.body.style.fontFamily = FONT_OPTIONS[fontName];
}

function showToast(message) {
    const container = document.getElementById('toastContainer');
    // 최대 3개로 제한, 초과 시 오래된 것부터 제거
    while (container.children.length >= 3) {
        container.firstChild.remove();
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3000);
}

// ========== 상태 표시 ==========
function showStatus(type, message) { const container = document.getElementById('fetchStatus'); container.className = `status ${type}`; container.textContent = message; container.classList.remove('hidden'); }

// ========== 오늘의 미션 시스템 ==========
const DAILY_MISSIONS = [
    { id: 'view_winning', label: '당첨번호 1회 조회', icon: '🔍', reward: 1, desc: '회차를 조회해보세요' },
    { id: 'run_simulation', label: 'AI 시뮬레이션 1회 실행', icon: '🎲', reward: 3, desc: '몬테카를로 분석을 돌려보세요' },
    { id: 'save_prediction', label: '예측 번호 저장', icon: '💾', reward: 2, desc: '마음에 드는 번호를 저장하세요' },
    { id: 'checkin', label: '오늘 출석 체크', icon: '✅', reward: 2, desc: '출석하고 코인 받기' },
    { id: 'view_stats', label: '통계 탭 3개 이상 열람', icon: '📊', reward: 2, desc: '빈도·차트·바코드를 확인하세요' },
    { id: 'play_game', label: '미니 게임 1회 플레이', icon: '🎮', reward: 1, desc: '경마·낚시·슬롯을 즐겨보세요' }
];

function getMissionData() {
    try { return JSON.parse(localStorage.getItem('lotto-missions') || '{"date":"","missions":{},"coins":0,"totalCoins":0,"allDone":false}'); } catch (e) { return { date: '', missions: {}, coins: 0, totalCoins: 0, allDone: false }; }
}

function saveMissionData(data) { try { localStorage.setItem('lotto-missions', JSON.stringify(data)); } catch (e) {} }

function trackMission(missionId) {
    const data = getMissionData();
    const today = new Date().toISOString().slice(0, 10);
    if (data.date !== today) {
        data.date = today;
        data.missions = {};
        data.coins = 0;
        data.allDone = false;
    }
    if (data.missions[missionId]) return;
    data.missions[missionId] = true;
    const mission = DAILY_MISSIONS.find(m => m.id === missionId);
    if (mission) {
        data.coins += mission.reward;
        data.totalCoins = (data.totalCoins || 0) + mission.reward;
        showToast(`${mission.icon} 미션 달성! +${mission.reward} 코인 — ${mission.label}`);
        playBeep(1000, 0.08);
        vibrate(50);
    }
    const allDone = DAILY_MISSIONS.every(m => data.missions[m.id]);
    if (allDone && !data.allDone) {
        data.allDone = true;
        data.coins += 5;
        data.totalCoins += 5;
        fireConfetti();
        setTimeout(() => showToast('🏆 오늘의 로또 마스터! 전 미션 달성 +5 보너스 코인!'), 500);
    }
    saveMissionData(data);
    renderMissions();
}

function renderMissions() {
    const data = getMissionData();
    const today = new Date().toISOString().slice(0, 10);
    const isToday = data.date === today;
    const el = document.getElementById('missionsContent');
    if (!el) return;
    const doneCount = isToday ? Object.keys(data.missions).length : 0;
    const totalMissions = DAILY_MISSIONS.length;
    const pct = Math.round(doneCount / totalMissions * 100);

    el.innerHTML = `
        <div class="missions-header">
            <div class="missions-title">🎯 오늘의 미션</div>
            <div class="missions-coin">🪙 ${data.totalCoins || 0} 코인</div>
        </div>
        <div class="missions-progress">
            <div class="missions-bar-bg"><div class="missions-bar-fill" style="width:${pct}%"></div></div>
            <div class="missions-progress-text">${doneCount}/${totalMissions} 완료${data.allDone ? ' — 🏆 마스터 달성!' : ''}</div>
        </div>
        <div class="missions-list">
            ${DAILY_MISSIONS.map(m => {
                const done = isToday && data.missions[m.id];
                return `<div class="mission-item${done ? ' done' : ''}">
                    <span class="mission-icon">${done ? '✅' : m.icon}</span>
                    <span class="mission-label">${m.label}</span>
                    <span class="mission-reward">+${m.reward}🪙</span>
                </div>`;
            }).join('')}
        </div>
        ${data.allDone ? '<p class="text-xs-secondary text-center mt-10">🎉 모든 미션을 달성했어요! 내일 새로운 미션이 열립니다.</p>' : '<p class="text-xs-secondary text-center mt-10">미션을 완료할 때마다 코인이 적립됩니다.</p>'}
    `;
}

function trackStatsView() {
    if (!trackStatsView._count) trackStatsView._count = 0;
    trackStatsView._count++;
    if (trackStatsView._count >= 3 && typeof trackMission === 'function') trackMission('view_stats');
}

// ========== 접기/펼치기 ==========
function toggleCollapsible(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('open');
    const header = el.querySelector('.collapsible-header');
    if (header) {
        const isOpen = el.classList.contains('open');
        header.setAttribute('aria-expanded', String(isOpen));
    }
}

// ========== 숫자 포맷 ==========
function formatNumber(num) { if (num >= 100000000) return (num / 100000000).toFixed(1) + '억'; if (num >= 10000) return (num / 10000).toFixed(0) + '만'; return num.toLocaleString(); }

// ========== 클립보드 복사 ==========
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {}
    // 폴백: textarea + execCommand
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text; textarea.style.position = 'fixed'; textarea.style.opacity = '0';
        document.body.appendChild(textarea); textarea.select();
        document.execCommand('copy'); document.body.removeChild(textarea);
        return true;
    } catch (e) { return false; }
}

// ========== UI/UX 고급화 ==========
let uxSettings = { vibration: true, sound: false, animation: true };

function loadUxSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem('lotto-ux-settings'));
        if (saved) uxSettings = { ...uxSettings, ...saved };
    } catch (e) {}
    document.querySelectorAll('.ux-toggle').forEach(toggle => {
        const key = toggle.dataset.key;
        if (uxSettings[key] !== undefined) toggle.checked = uxSettings[key];
    });
}

function toggleSettings() {
    const overlay = document.getElementById('settingsOverlay');
    const settingsBtn = document.getElementById('settingsBtn');
    const isOpen = overlay.classList.toggle('open');
    if (settingsBtn) settingsBtn.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) {
        overlay.addEventListener('keydown', settingsKeyHandler);
        const first = overlay.querySelector('input, select, button');
        if (first) first.focus();
    } else {
        overlay.removeEventListener('keydown', settingsKeyHandler);
        settingsBtn?.focus();
    }
}

function settingsKeyHandler(e) {
    if (e.key === 'Escape') { toggleSettings(); return; }
    if (e.key === 'Tab') {
        const overlay = document.getElementById('settingsOverlay');
        const focusable = overlay.querySelectorAll('input, select, button, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
}

function toggleUxSetting(key, checked) {
    uxSettings[key] = checked;
    try { localStorage.setItem('lotto-ux-settings', JSON.stringify(uxSettings)); } catch (e) {}
    if (checked && key === 'sound') playBeep(800, 0.05); // 확인 비프
    if (checked && key === 'vibration') vibrate(30);
    showStatus('info', `⚙️ ${key === 'vibration' ? '진동' : key === 'sound' ? '사운드' : '애니메이션'} ${checked ? 'ON' : 'OFF'}`);
}

function vibrate(ms) {
    if (uxSettings.vibration && navigator.vibrate) {
        try { navigator.vibrate(ms); } catch (e) {}
    }
}

let audioCtx = null;
function getAudioCtx() {
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    return audioCtx;
}

function playBeep(freq = 800, duration = 0.1) {
    if (!uxSettings.sound) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
}

function fireConfetti() {
    if (!uxSettings.animation) return;
    const container = document.getElementById('confettiContainer');
    const batch = document.createElement('div');
    batch.className = 'confetti-batch';
    const colors = ['#ffd700', '#00f5ff', '#ff006e', '#8b5cf6', '#10b981', '#f97316', '#ef4444', '#3b82f6'];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 60; i++) {
        const particle = document.createElement('div');
        particle.className = 'confetti-particle';
        const size = 6 + Math.random() * 8;
        particle.style.cssText = `
            position:absolute;
            width:${size}px;height:${size * (0.5 + Math.random())}px;
            background:${colors[Math.floor(Math.random() * colors.length)]};
            left:${Math.random() * 100}%;
            top:-20px;
            border-radius:2px;
            animation:confettiFall ${2 + Math.random() * 3}s ease-out forwards;
            animation-delay:${Math.random() * 0.5}s;
            opacity:${0.7 + Math.random() * 0.3};
        `;
        frag.appendChild(particle);
    }
    batch.appendChild(frag);
    container.appendChild(batch);
    setTimeout(() => { batch.remove(); }, 4000);
}

// 민감정보 분해 보관 (스크래핑 방지)
var _ACCOUNT_PARTS = ['110', '496', '114465'];
var _BANK_NAME = '신한은행';
var _HOLDER_PARTS = ['강', '재', '영'];
function _fullAccount() { return _ACCOUNT_PARTS.join('-'); }
function _fullAccountNoDash() { return _ACCOUNT_PARTS.join(''); }
function _fullHolder() { return _HOLDER_PARTS.join(''); }

async function copyEmail() {
    var parts = ['core13773', 'gmail.com'];
    var email = parts.join('@');
    await copyToClipboard(email);
    showStatus('success', '📋 이메일이 복사되었습니다');
}

function copyAccount() {
    var text = _BANK_NAME + ' ' + _fullAccount() + ' ' + _fullHolder();
    copyToClipboard(text);
    showToast('📋 계좌정보가 복사되었습니다! ' + text);
}

function openTossPay() {
    var isAndroid = /android/i.test(navigator.userAgent);
    var accountNoDash = _fullAccountNoDash();
    var bank = _BANK_NAME;

    if (isAndroid) {
        var fallback = encodeURIComponent('https://toss.im/download');
        window.location.href = 'intent://send?amount=1500&bank=' + encodeURIComponent(bank) + '&account=' + accountNoDash + '#Intent;scheme=supertoss;package=viva.republica.toss;S.browser_fallback_url=' + fallback + ';end;';
    } else {
        window.location.href = 'supertoss://send?amount=1500&bank=' + encodeURIComponent(bank) + '&account=' + accountNoDash;
    }

    // 토스 앱이 없거나 실패할 경우 계좌번호 복사
    setTimeout(function() {
        copyAccount();
        showStatus('info', '💙 토스앱이 없으면 복사된 계좌번호로 송금해주세요');
    }, 3000);
}

// ========== 카카오톡 공유 ==========
async function shareToKakao(text) {
    // Web Share API 우선 시도 (모바일에서 카카오톡 선택 가능)
    if (navigator.share) {
        try {
            await navigator.share({ title: '로또 645 번호', text });
            return true;
        } catch (e) {}
    }
    return false;
}

async function sharePrediction() {
    const balls = document.getElementById('predictionBalls');
    if (!balls || balls.children.length === 0) return;
    const numbers = [...balls.querySelectorAll('.ball')].map(b => b.textContent).join(', ');
    const score = document.getElementById('predictionScore')?.textContent || '-';
    const text = `🎱 로또 645 예측 번호\n${numbers}\n품질 점수: ${score}점\n기준: 제 ${currentRound || '-'}회\nhttps://123lotto.co.kr`;

    const shared = await shareToKakao(text);
    if (!shared) {
        await copyToClipboard(text);
        showStatus('success', '📋 공유 텍스트가 복사되었습니다!');
    }
}

async function shareSmartPrediction(numbers, score) {
    const nums = numbers.join(', ');
    const text = `🎱 로또 645 스마트 추천\n${nums}\n품질 점수: ${score}점\nhttps://123lotto.co.kr`;

    const shared = await shareToKakao(text);
    if (!shared) {
        await copyToClipboard(text);
        showStatus('success', '📋 공유 텍스트가 복사되었습니다!');
    }
}

async function shareAllCombos(combos) {
    if (!combos || combos.length === 0) return;
    let text = `🎱 로또 645 AI 예측 결과\n━━━━━━━━━━━━━━\n`;
    combos.forEach((c, i) => {
        const nums = Array.isArray(c.numbers) ? c.numbers : (Array.isArray(c) ? c : []);
        const numsStr = nums.join(', ');
        let scoreStr = '';
        if (c.score !== undefined) {
            scoreStr = ` (${typeof c.score === 'number' ? c.score.toFixed(0) : c.score}점)`;
        }
        text += `#${i + 1} ${numsStr}${scoreStr}\n`;
    });
    text += `━━━━━━━━━━━━━━\n🔗 https://123lotto.co.kr`;

    const shared = await shareToKakao(text);
    if (!shared) {
        await copyToClipboard(text);
        showStatus('success', '📋 전체 조합이 복사되었습니다!');
    }
}

async function shareSite() {
    const text = `🎰 로또 645 AI 예측 시스템\n몬테카를로 시뮬레이션 + 통계 분석 + 스마트 추천\nhttps://123lotto.co.kr`;

    if (navigator.share) {
        try {
            await navigator.share({ title: '로또 645 AI 예측', text, url: 'https://123lotto.co.kr' });
            return;
        } catch (e) {}
    }
    await copyToClipboard(text);
    showStatus('success', '📋 사이트 주소가 복사됐습니다! 카톡/문자에 붙여넣기 하세요.');
}

// ========== PWA 알림 ==========
let notificationEnabled = false, notifyTimeout = null;

async function toggleNotifications() {
    if (!('Notification' in window)) {
        showStatus('warning', '⚠️ 이 브라우저는 알림을 지원하지 않습니다.');
        return;
    }

    if (Notification.permission === 'granted') {
        notificationEnabled = !notificationEnabled;
        updateNotifyBtn();
        if (notificationEnabled) {
            scheduleNotification();
            showStatus('success', '🔔 토요일 추첨 알림이 켜졌습니다!');
        } else {
            showStatus('info', '🔕 알림이 꺼졌습니다.');
        }
    } else if (Notification.permission === 'denied') {
        showStatus('warning', '⚠️ 알림 권한이 거부되어 있습니다. 브라우저 설정에서 허용해주세요.');
    } else {
        const result = await Notification.requestPermission();
        if (result === 'granted') {
            notificationEnabled = true;
            updateNotifyBtn();
            scheduleNotification();
            showStatus('success', '🔔 알림이 활성화되었습니다!');
            playBeep(800, 0.1);
        } else {
            showStatus('info', '알림이 거부되었습니다.');
        }
    }
    try { localStorage.setItem('lotto-notify', notificationEnabled); } catch (e) {}
}

function updateNotifyBtn() {
    const btn = document.getElementById('notifyBtn');
    if (btn) btn.textContent = notificationEnabled ? '🔔' : '🔕';
}

function scheduleNotification() {
    if (!notificationEnabled || Notification.permission !== 'granted') return;
    if (notifyTimeout) clearTimeout(notifyTimeout);

    // 다음 토요일 20:50 KST 계산
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 3600000);
    const day = kst.getUTCDay();
    const hours = kst.getUTCHours();
    const minutes = kst.getUTCMinutes();

    let nextSat = new Date(kst);
    if (day === 6 && (hours < 20 || (hours === 20 && minutes < 50))) {
        // 오늘 토요일이고 20:50 이전
        nextSat.setUTCHours(20, 50, 0, 0);
    } else if (day === 6 && hours >= 20 && minutes >= 50) {
        // 오늘 토요일이고 이미 20:50 이후 → 다음주
        nextSat.setUTCDate(nextSat.getUTCDate() + 7);
        nextSat.setUTCHours(20, 50, 0, 0);
    } else {
        // 평일 → 다음 토요일
        const daysUntil = day === 6 ? 0 : 6 - day;
        nextSat.setUTCDate(nextSat.getUTCDate() + (daysUntil === 0 ? 7 : daysUntil));
        nextSat.setUTCHours(20, 50, 0, 0);
    }

    const delay = nextSat.getTime() - kst.getTime();
    if (delay > 0) {
        notifyTimeout = setTimeout(() => {
            if (notificationEnabled) {
                new Notification('🎰 로또 645 추첨 10분 전!', {
                    body: '곧 로또 추첨이 시작됩니다. 로또645 앱에서 번호 확인하세요!',
                    vibrate: [200, 100, 200],
                    requireInteraction: true
                });
                // 7일 후 다시 스케줄
                setTimeout(scheduleNotification, 7 * 24 * 3600000);
            }
        }, delay);
    }
}

// ========== 첫 방문 온보딩 ==========
function initOnboarding() {
    try {
        try {
            if (localStorage.getItem('lotto-onboarding-seen') === 'true') return;
        } catch (e) { return; }
    } catch (e) { return; }
    const overlay = document.getElementById('onboardingOverlay');
    if (!overlay) return;
    overlay.classList.add('open');
    overlay.addEventListener('keydown', function handler(e) {
        if (e.key === 'Escape') { closeOnboarding(); overlay.removeEventListener('keydown', handler); }
    });
}

function closeOnboarding() {
    const overlay = document.getElementById('onboardingOverlay');
    if (overlay) overlay.classList.remove('open');
    try { localStorage.setItem('lotto-onboarding-seen', 'true'); } catch (e) {}
    playBeep(800, 0.08);
}

// ========== 스크롤-투-탑 버튼 ==========
function initScrollTopBtn() {
    const btn = document.getElementById('scrollTopBtn');
    if (!btn) return;
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                btn.classList.toggle('visible', window.scrollY > 400);
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });
}

// ========== data-action 이벤트 위임 ==========
document.addEventListener('click', function(e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var action = el.getAttribute('data-action');
    var arg = el.getAttribute('data-arg');
    switch (action) {
        case 'closeOnboarding': closeOnboarding(); break;
        case 'scrollToTop': window.scrollTo({top:0,behavior:'smooth'}); break;
        case 'closeQRScannerIfTarget': if (e.target === el) closeQRScanner(); break;
        case 'closeQRScanner': closeQRScanner(); break;
        case 'shareSite': shareSite(); break;
        case 'openQRScanner': openQRScanner(); break;
        case 'openStoreFinder': openStoreFinder(); break;
        case 'toggleFontMenu': toggleFontMenu(e); break;
        case 'toggleNotifications': toggleNotifications(); break;
        case 'toggleSettings': toggleSettings(); break;
        case 'toggleSettingsIfTarget': if (e.target === el) toggleSettings(); break;
        case 'cycleTheme': cycleTheme(); break;
        case 'fetchWinningNumbers': fetchWinningNumbers(); break;
        case 'applyManualNumbers': applyManualNumbers(); break;
        case 'startSimulation': startSimulation(); break;
        case 'stopSimulation': stopSimulation(); break;
        case 'runSmartRecommend': runSmartRecommend(); break;
        case 'clearExcludes': clearExcludes(); break;
        case 'quickExclude': quickExclude(); break;
        case 'clearFixed': clearFixed(); break;
        case 'quickFix': quickFix(); break;
        case 'generateCustomCombos': generateCustomCombos(); break;
        case 'exportPrediction': exportPrediction(); break;
        case 'sharePrediction': sharePrediction(); break;
        case 'savePrediction': savePrediction(); break;
        case 'compareRounds': compareRounds(); break;
        case 'runRetrospective': runRetrospective(); break;
        case 'applyRetroNumbers': applyRetroNumbers(); break;
        case 'calculateTax': calculateTax(); break;
        case 'clearSavedPredictions': clearSavedPredictions(); break;
        case 'generateDynamicExcel': generateDynamicExcel(); break;
        case 'copyAccount': copyAccount(); break;
        case 'openTossPay': openTossPay(); break;
        case 'copyEmail': copyEmail(); break;
        case 'openPhotoToNumbers': openPhotoToNumbers(); break;
        case 'startPersonalityQuiz': startPersonalityQuiz(); break;
        case 'interpretDream': interpretDream(); break;
        case 'startLottoQuiz': startLottoQuiz(); break;
        case 'openBookOfAnswers': openBookOfAnswers(); break;
        case 'resetBookOfAnswers': resetBookOfAnswers(); break;
        case 'setStatsPeriod': if (arg) setStatsPeriod(arg); break;
        case 'toggleCollapsible': if (arg) toggleCollapsible(arg); break;
        case 'switchAiMode': if (arg) switchAiMode(arg); break;
        case 'switchStatsTab': if (arg) switchStatsTab(arg); break;
        case 'switchFunTab': if (arg) switchFunTab(arg); break;
        case 'switchFun2Tab': if (arg) switchFun2Tab(arg); break;
        case 'switchGameTab': if (arg) switchGameTab(arg); break;
        case 'switchDiceTab': if (arg && typeof switchDiceTab === 'function') switchDiceTab(arg); break;
    }
});

// ========== 키보드 접근성: data-action 요소 Enter/Space ==========
document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var el = e.target.closest('[data-action]');
    if (!el) return;
    // 버튼/인풋 등 기본 인터랙티브 요소는 브라우저 기본 동작 사용
    if (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') return;
    e.preventDefault();
    el.click();
});

// ========== ux-toggle change 이벤트 위임 ==========
document.addEventListener('change', function(e) {
    if (e.target.classList.contains('ux-toggle')) {
        toggleUxSetting(e.target.dataset.key, e.target.checked);
    }
});
