// fun3.js - 번호 수집 도감 + 게임/시뮬레이션 연동

// ========== 번호 도감 ==========
function getCollection() {
    try { return JSON.parse(localStorage.getItem('lotto-collection') || '[]'); } catch (e) { return []; }
}

function addToCollection(num) {
    const coll = getCollection();
    if (coll.includes(num)) return false;
    coll.push(num);
    try { localStorage.setItem('lotto-collection', JSON.stringify(coll)); } catch (e) {}
    // 업적 체크
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

// ========== 게임/시뮬레이션 연동 ==========
// games.js의 addCollected를 감싸서 도감에도 추가
(function() {
    if (typeof addCollected === 'undefined') return;
    const origAddCollected = addCollected;
    addCollected = function(num) {
        if (addToCollection(num)) {
            // 새 번호 수집 시 토스트
            if (typeof showToast === 'function') {
                showToast(`📚 도감에 ${num}번 등록! (${getCollection().length}/45)`);
            }
        }
        if (typeof trackGamePlay === 'function') trackGamePlay();
        return origAddCollected(num);
    };
})();

// simulation.js 연동
(function() {
    if (typeof startSimulation === 'undefined') return;
    const origStartSim = startSimulation;
    startSimulation = function() {
        if (typeof trackSimRun === 'function') {
            const iters = parseInt(document.getElementById('iterationSelect')?.value || '0');
            trackSimRun(iters);
        }
        return origStartSim.apply(this, arguments);
    };

    const origShowPrediction = showPredictionResult;
    if (typeof showPredictionResult !== 'undefined') {
        showPredictionResult = function(prediction, attempts, elapsed, isRandom) {
            if (prediction && typeof trackMatchCount === 'function') {
                const matching = (prediction || []).filter(n => (currentWinningNumbers || []).includes(n));
                trackMatchCount(matching.length);
            }
            prediction.forEach(n => addToCollection(n));
            return origShowPrediction.apply(this, arguments);
        };
    }
})();

// 통계 탭 조회 연동
(function() {
    if (typeof switchStatsTab === 'undefined') return;
    const origSwitchStatsTab = switchStatsTab;
    switchStatsTab = function(tab) {
        if (typeof trackStatsTabView === 'function') trackStatsTabView(tab);
        return origSwitchStatsTab.apply(this, arguments);
    };
})();

// ========== HTML 추가 ==========
// "내번호" 탭 내용을 확장하여 도감 포함
(function() {
    if (typeof switchFun2Tab === 'undefined') return;
    const origSwitchFun2Tab = switchFun2Tab;
    switchFun2Tab = function(name) {
        const result = origSwitchFun2Tab.apply(this, arguments);
        if (name === 'history') {
            // 내번호 탭 하단에 도감 추가
            setTimeout(() => {
                const el = document.getElementById('historyContent');
                if (el && !document.getElementById('collectionSection')) {
                    const div = document.createElement('div');
                    div.id = 'collectionSection';
                    div.innerHTML = `
                        <div style="margin-top:20px;padding-top:15px;border-top:1px solid rgba(255,255,255,0.08);">
                            <h4 style="color:var(--accent-cyan);margin-bottom:10px;">📚 번호 수집 도감</h4>
                            <div id="collectionContent"></div>
                        </div>`;
                    el.appendChild(div);
                    renderCollection();
                }
            }, 300);
        }
        return result;
    };
})();

// ========== 체크인 시 번호 수집 ==========
(function() {
    if (typeof doCheckin === 'undefined') return;
    const origDoCheckin = doCheckin;
    doCheckin = function() {
        const result = origDoCheckin.apply(this, arguments);
        // 출석 시 랜덤 번호 1개 수집
        const coll = getCollection();
        if (coll.length < 45) {
            const available = [];
            for (let i = 1; i <= 45; i++) if (!coll.includes(i)) available.push(i);
            if (available.length > 0) {
                const newNum = available[Math.floor(Math.random() * available.length)];
                addToCollection(newNum);
                if (typeof showToast === 'function') {
                    setTimeout(() => showToast(`📚 출석 보너스! 도감에 ${newNum}번 등록!`), 1500);
                }
            }
        }
        return result;
    };
})();

// ========== HTML 추가: 데일리 미션 UI ==========
(function() {
    const injectMissions = () => {
        const el = document.getElementById('checkinContent');
        if (!el || document.getElementById('dailyMissionsSection')) return;
        const div = document.createElement('div');
        div.id = 'dailyMissionsSection';
        div.style.cssText = 'margin-top:15px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.08);';
        div.innerHTML = `
            <h4 style="color:var(--accent-cyan);margin-bottom:8px;font-size:0.9rem;">📋 오늘의 미션</h4>
            <div id="dailyMissionsContent"></div>`;
        el.appendChild(div);
        if (typeof renderDailyMissions === 'function') renderDailyMissions();
    };

    // renderCheckinUI가 이미 호출된 후라면 즉시 주입
    if (document.querySelector('#checkinContent .checkin-week')) {
        setTimeout(injectMissions, 100);
    }

    // 이후 호출 시에도 주입하도록 래핑
    if (typeof renderCheckinUI === 'function') {
        const orig = renderCheckinUI;
        renderCheckinUI = function() {
            orig.apply(this, arguments);
            setTimeout(injectMissions, 200);
        };
    }
})();
