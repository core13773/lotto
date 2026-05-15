// fun3.js - 번호 수집 도감 + 게임/시뮬레이션 연동
// 모든 연동은 _hook(name, args) 기반으로 동작합니다.

// ========== 번호 도감 ==========
function getCollection() {
    try { return JSON.parse(localStorage.getItem('lotto-collection') || '[]'); } catch (e) { return []; }
}

function addToCollection(num) {
    const coll = getCollection();
    if (coll.includes(num)) return false;
    coll.push(num);
    try { localStorage.setItem('lotto-collection', JSON.stringify(coll)); } catch (e) {}
    if (typeof unlockAchievement === 'function') {
        if (coll.length >= 20) unlockAchievement('collection_20');
        if (coll.length >= 45) unlockAchievement('collection_45');
    }
    return true;
}

function renderCollection() {
    const el = document.getElementById('collectionContent');
    if (!el) return;
    const coll = getCollection();
    const pct = Math.round(coll.length / 45 * 100);

    let gridHtml = '';
    for (let n = 1; n <= 45; n++) {
        const owned = coll.includes(n);
        const cls = typeof getBallClass === 'function' ? getBallClass(n) : '';
        gridHtml += `<div class="collection-cell ${owned ? 'owned' : 'locked'} ${cls}" title="${owned ? n + '번 보유' : '미수집'}">
            <span>${owned ? n : '?'}</span>
        </div>`;
    }

    el.innerHTML = `
        <div class="collection-progress">
            <div class="collection-bar-bg"><div class="collection-bar-fill" style="width:${pct}%"></div></div>
            <span class="collection-count">${coll.length} / 45 (${pct}%)</span>
        </div>
        <div class="collection-grid">${gridHtml}</div>
        ${coll.length >= 45 ? '<div class="collection-complete">🏆 도감 완성! 모든 번호를 수집했어요!</div>' : ''}
        <p class="text-xs-secondary text-center mt-10">게임존, 시뮬레이션, 출석체크로 번호를 수집하세요!</p>
    `;
}

// ========== 훅 핸들러: 크로스커팅 연동 ==========
function _hook(name, data) {
    switch (name) {
        case 'addCollected':
            // 게임에서 번호 수집 시 도감에도 등록
            if (addToCollection(data)) {
                if (typeof showToast === 'function') {
                    showToast(`📚 도감에 ${data}번 등록! (${getCollection().length}/45)`);
                }
            }
            if (typeof trackGamePlay === 'function') trackGamePlay();
            break;

        case 'startSimulation':
            // 시뮬레이션 시작 시 업적 추적
            if (typeof trackSimRun === 'function') trackSimRun(data);
            break;

        case 'showPredictionResult':
            // 예측 결과 표시 시 매치 카운트 + 도감 수집
            if (data && typeof trackMatchCount === 'function') {
                const matching = (data || []).filter(function(n) {
                    return (currentWinningNumbers || []).includes(n);
                });
                trackMatchCount(matching.length);
            }
            if (data) data.forEach(function(n) { addToCollection(n); });
            break;

        case 'switchStatsTab':
            // 통계 탭 조회 추적
            if (typeof trackStatsTabView === 'function') trackStatsTabView(data);
            break;

        case 'switchFun2Tab':
            // 내번호 탭에 도감 UI 주입
            if (data === 'history') {
                setTimeout(function() {
                    var el = document.getElementById('historyContent');
                    if (el && !document.getElementById('collectionSection')) {
                        var div = document.createElement('div');
                        div.id = 'collectionSection';
                        div.innerHTML = '<div style="margin-top:20px;padding-top:15px;border-top:1px solid rgba(255,255,255,0.08);"><h4 style="color:var(--accent-cyan);margin-bottom:10px;">📚 번호 수집 도감</h4><div id="collectionContent"></div></div>';
                        el.appendChild(div);
                        renderCollection();
                    }
                }, 300);
            }
            break;

        case 'doCheckin':
            // 출석 시 랜덤 번호 1개 수집
            {
                var coll = getCollection();
                if (coll.length < 45) {
                    var available = [];
                    for (var i = 1; i <= 45; i++) if (coll.indexOf(i) === -1) available.push(i);
                    if (available.length > 0) {
                        var newNum = available[Math.floor(Math.random() * available.length)];
                        addToCollection(newNum);
                        if (typeof showToast === 'function') {
                            setTimeout(function() { showToast('📚 출석 보너스! 도감에 ' + newNum + '번 등록!'); }, 1500);
                        }
                    }
                }
            }
            break;

        case 'renderCheckinUI':
            // 출석 UI 아래에 데일리 미션 주입
            setTimeout(function() {
                var el = document.getElementById('checkinContent');
                if (!el || document.getElementById('dailyMissionsSection')) return;
                var div = document.createElement('div');
                div.id = 'dailyMissionsSection';
                div.style.cssText = 'margin-top:15px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.08);';
                div.innerHTML = '<h4 style="color:var(--accent-cyan);margin-bottom:8px;font-size:0.9rem;">📋 오늘의 미션</h4><div id="dailyMissionsContent"></div>';
                el.appendChild(div);
                if (typeof renderDailyMissions === 'function') renderDailyMissions();
            }, 200);
            break;

        case 'handleMatch':
            // 시뮬레이션 매치 시 피드백
            if (typeof playBeep === 'function') playBeep(1000, 0.15);
            if (typeof vibrate === 'function') vibrate(50);
            if (data && data.matchCount === 1 && typeof fireConfetti === 'function') fireConfetti();
            break;

        case 'loadLatestJson':
            // DB 로드 완료 후 통계 대시보드 초기화
            if (lottoDb && lottoDb.length > 0 && typeof renderStatsDashboard === 'function') renderStatsDashboard();
            break;
    }
}
