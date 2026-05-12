// features.js - QR 스캔, 판매점 찾기, 세금 계산기, 동적 엑셀, i18n, 보너스번호 그리드
// ========== QR 코드 스캐너 ==========
let qrStream = null;

async function openQRScanner() {
    const overlay = document.getElementById('qrOverlay');
    if (!overlay) return;

    if (!('BarcodeDetector' in window)) {
        showStatus('warning', '⚠️ 이 브라우저는 QR 스캔을 지원하지 않습니다. Chrome/Edge 최신 버전을 사용해주세요.');
        return;
    }

    overlay.style.display = 'flex';
    document.getElementById('qrResult').textContent = '카메라를 QR코드에 비춰주세요';

    try {
        qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const video = document.getElementById('qrVideo');
        video.srcObject = qrStream;

        const barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
        const scanLoop = async () => {
            if (!qrStream) return;
            try {
                const barcodes = await barcodeDetector.detect(video);
                if (barcodes.length > 0) {
                    const rawValue = barcodes[0].rawValue;
                    document.getElementById('qrResult').textContent = `감지됨: ${rawValue}`;
                    // 로또 QR에서 회차 번호 추출 시도
                    const roundMatch = rawValue.match(/(\d{3,5})/);
                    if (roundMatch) {
                        const roundNo = parseInt(roundMatch[1]);
                        document.getElementById('roundInput').value = roundNo;
                        closeQRScanner();
                        fetchWinningNumbers();
                        return;
                    }
                }
            } catch (e) {}
            if (qrStream) requestAnimationFrame(scanLoop);
        };
        scanLoop();
    } catch (e) {
        document.getElementById('qrResult').textContent = '카메라 접근이 거부되었습니다.';
        showStatus('error', '❌ 카메라 권한을 허용해주세요.');
    }
}

function closeQRScanner() {
    if (qrStream) {
        qrStream.getTracks().forEach(t => t.stop());
        qrStream = null;
    }
    const overlay = document.getElementById('qrOverlay');
    if (overlay) overlay.style.display = 'none';
}

// ========== 판매점 찾기 ==========
function openStoreFinder() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                window.open(`https://m.map.naver.com/search2/search.naver?query=로또판매점&sm=hty&style=v5#/map/${lng},${lat},15`, '_blank');
            },
            () => {
                window.open('https://m.map.naver.com/search2/search.naver?query=로또판매점', '_blank');
            }
        );
    } else {
        window.open('https://m.map.naver.com/search2/search.naver?query=로또판매점', '_blank');
    }
    showStatus('info', '📍 네이버 지도에서 판매점을 검색합니다.');
}

// ========== 세금 계산기 ==========
function calculateTax() {
    const prizeInput = document.getElementById('prizeInput');
    const prize = parseInt(prizeInput.value);
    if (!prize || prize < 1000) {
        showStatus('error', '올바른 당첨금을 입력해주세요.');
        return;
    }

    let taxRate, taxAmount, netAmount;
    if (prize <= 300000000) {
        taxRate = 0.22; // 22% (소득세 20% + 주민세 2%)
    } else {
        taxRate = 0.33; // 33% (소득세 30% + 주민세 3%)
    }
    taxAmount = Math.floor(prize * taxRate);
    netAmount = prize - taxAmount;

    const result = document.getElementById('taxBreakdown');
    result.innerHTML = `
        <div style="font-size:1.1rem;color:var(--accent-gold);margin-bottom:15px;">💰 당첨금 계산 결과</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:400px;margin:0 auto;">
            <div style="background:rgba(0,0,0,0.2);padding:12px;border-radius:8px;">
                <div style="font-size:0.75rem;color:var(--text-secondary);">당첨금</div>
                <div style="font-size:1.2rem;color:var(--accent-gold);">${prize.toLocaleString()}원</div>
            </div>
            <div style="background:rgba(239,68,68,0.15);padding:12px;border-radius:8px;">
                <div style="font-size:0.75rem;color:var(--text-secondary);">세금 (${(taxRate*100).toFixed(0)}%)</div>
                <div style="font-size:1.2rem;color:#ef4444;">-${taxAmount.toLocaleString()}원</div>
            </div>
        </div>
        <div style="margin-top:15px;background:rgba(16,185,129,0.15);padding:15px;border-radius:10px;font-size:1.4rem;color:#10b981;">
            실수령액: <strong>${netAmount.toLocaleString()}원</strong>
        </div>
    `;
    document.getElementById('taxResult').classList.remove('hidden');
    playBeep(600, 0.1);
}

// ========== 동적 엑셀 생성 ==========
function generateDynamicExcel() {
    if (typeof XLSX === 'undefined') {
        showStatus('warning', '⚠️ 엑셀 라이브러리 로딩 중... 잠시 후 다시 시도해주세요.');
        return;
    }
    if (!lottoDb || lottoDb.length === 0) {
        showStatus('warning', '⚠️ DB 데이터가 없습니다. 먼저 페이지를 새로고침해주세요.');
        return;
    }

    const wb = XLSX.utils.book_new();

    // 통계_종합 시트
    const summaryHeaders = ['회차', '번호1', '번호2', '번호3', '번호4', '번호5', '번호6', '보너스', '합계', '홀수', '짝수', 'AC값', '저번호', '고번호', '구간수'];
    const summaryRows = [summaryHeaders];
    lottoDb.forEach(entry => {
        if (!entry.numbers) return;
        const s = entry.numbers;
        const sum = s.reduce((a, b) => a + b, 0);
        const odd = s.filter(n => n % 2 === 1).length;
        const diffs = new Set();
        for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) diffs.add(s[j] - s[i]);
        const ac = diffs.size - 5;
        const low = s.filter(n => n <= 22).length;
        const high = s.filter(n => n > 22).length;
        const sections = new Set(s.map(n => n <= 10 ? 1 : n <= 20 ? 2 : n <= 30 ? 3 : n <= 40 ? 4 : 5));
        summaryRows.push([entry.round, ...s, entry.bonus || '', sum, odd, 6 - odd, ac, low, high, sections.size]);
    });
    const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
    ws1['!cols'] = summaryHeaders.map(() => ({ wch: 8 }));
    XLSX.utils.book_append_sheet(wb, ws1, '통계_종합');

    // 번호_생성기 시트
    const genHeaders = ['번호', '출현횟수', '최근10회', '최근20회', '최근50회', '평균갭', '현재갭', 'Z점수', '추세', '추천점수', '제외점수'];
    const genRows = [genHeaders];
    const numScores = computeNumberScores();
    if (numScores) {
        for (let n = 1; n <= 45; n++) {
            const ns = numScores[n];
            genRows.push([n, ns.appearances, ns.recent10, ns.recent20, ns.recent50, ns.avgGap, ns.currentGap, ns.zScore, ns.trend, ns.recScore, ns.exclScore]);
        }
    }
    const ws2 = XLSX.utils.aoa_to_sheet(genRows);
    ws2['!cols'] = genHeaders.map(() => ({ wch: 10 }));
    XLSX.utils.book_append_sheet(wb, ws2, '번호_생성기');

    XLSX.writeFile(wb, 'lotto645_통계.xlsx');
    showStatus('success', '📊 현재 DB 기준 엑셀 파일이 생성되었습니다!');
    playBeep(600, 0.1);
}

// ========== 보너스 번호 그리드 초기화 ==========
function initBonusGrid() {
    const grid = document.getElementById('bonusNumberGrid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 1; i <= 45; i++) {
        const btn = document.createElement('button');
        btn.className = `number-btn bonus-btn ${getBallClass(i)}`;
        btn.textContent = i;
        btn.setAttribute('data-num', i);
        btn.onclick = () => selectBonusNumber(i, btn);
        grid.appendChild(btn);
    }
}

// ========== i18n 간단 영어 지원 ==========
const I18N = {
    ko: {
        title: '🎰 로또 645 AI 예측 시스템',
        roundSearch: '회차 입력',
        search: '🔍 조회',
        manualInput: '✋ 수동으로 번호 입력 (조회 실패 시 사용)',
        bonusNumber: '⭐ 보너스 번호 선택 (선택사항)',
        aiPredict: 'AI 예측 분석',
        stats: '전체 통계 분석',
        compare: '회차 비교 분석',
        retro: '당첨 회고 (What-If)',
        saved: '저장된 예측 결과',
        tax: '세금 계산기',
        excel: '엑셀 사용자용',
        sponsor: '커피 한잔 후원',
        feedback: '피드백 / 문의'
    },
    en: {
        title: '🎰 Lotto 645 AI Predictor',
        roundSearch: 'Enter Round',
        search: '🔍 Search',
        manualInput: '✋ Manual Input (if search fails)',
        bonusNumber: '⭐ Select Bonus Number (optional)',
        aiPredict: 'AI Prediction Analysis',
        stats: 'Statistics Dashboard',
        compare: 'Round Comparison',
        retro: 'What-If Retrospective',
        saved: 'Saved Predictions',
        tax: 'Tax Calculator',
        excel: 'For Excel Users',
        sponsor: 'Support Developer',
        feedback: 'Feedback / Contact'
    }
};
let currentLang = 'ko';

function toggleLanguage() {
    currentLang = currentLang === 'ko' ? 'en' : 'ko';
    document.documentElement.lang = currentLang;
    applyTranslations();
    try { localStorage.setItem('lotto-lang', currentLang); } catch (e) {}
    showToast(currentLang === 'ko' ? '🇰🇷 한국어' : '🇺🇸 English');
}

function applyTranslations() {
    const t = I18N[currentLang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });
    // Update title
    document.title = t.title;
}

function loadLanguage() {
    let lang;
    try { lang = localStorage.getItem('lotto-lang'); } catch (e) {}
    if (lang && I18N[lang]) {
        currentLang = lang;
        document.documentElement.lang = lang;
        applyTranslations();
    }
}

// ========== 초기화 ==========
document.addEventListener('DOMContentLoaded', () => {
    initBonusGrid();
    loadLanguage();

    // 언어 전환 버튼 추가
    const controls = document.querySelector('.header-controls');
    if (controls && !document.getElementById('langBtn')) {
        const langBtn = document.createElement('button');
        langBtn.id = 'langBtn';
        langBtn.className = 'settings-btn';
        langBtn.textContent = '🌐';
        langBtn.setAttribute('aria-label', '언어 변경');
        langBtn.setAttribute('title', '언어 변경');
        langBtn.onclick = toggleLanguage;
        controls.insertBefore(langBtn, controls.querySelector('#fontBtn'));
    }

    // 테마/글꼴은 ui.js/script.js에서 초기화하므로 여기서는 언어만
    loadLanguage();
    loadUxSettings();
});
