// worker.js - Web Worker: 몬테카를로 시뮬레이션 (TypedArray 최적화)
self.onmessage = function(e) {
    const { targetNums, maxIterations } = e.data;
    const targetStr = targetNums.sort((a, b) => a - b).join(',');
    let attempts = 0, matchCount = 0;
    const predictions = [], startTime = Date.now();

    // Uint8Array로 1-45 숫자 풀 관리
    const POOL = new Uint8Array(45);
    for (let i = 0; i < 45; i++) POOL[i] = i + 1;
    const CANDIDATE = new Uint8Array(6);

    function generateNumbers() {
        // Fisher-Yates 셔플 with crypto.getRandomValues
        const rand = new Uint32Array(6);
        crypto.getRandomValues(rand);

        // POOL 복사 후 셔플 (swap & swap-back 제거, 매번 복사)
        const pool = new Uint8Array(POOL);

        for (let i = 0; i < 6; i++) {
            const j = i + (rand[i] % (45 - i));
            const tmp = pool[i];
            pool[i] = pool[j];
            pool[j] = tmp;
        }

        // 결과 복사 및 정렬
        for (let i = 0; i < 6; i++) CANDIDATE[i] = pool[i];
        return CANDIDATE.sort((a, b) => a - b).join(',');
    }

    let batchSize = 50000;
    let lastProgressPost = 0;
    let lastProgressPct = 0;
    const PROGRESS_INTERVAL = 50;

    function runBatch() {
        const batchStart = performance.now();
        const batchEnd = Math.min(attempts + batchSize, maxIterations);
        while (attempts < batchEnd) {
            const current = generateNumbers();
            attempts++;
            if (current === targetStr) {
                matchCount++;
                // 다음 번호 생성 (6개만 추출)
                const nextPool = new Uint8Array(POOL);
                const nextRand = new Uint32Array(6);
                crypto.getRandomValues(nextRand);
                for (let i = 0; i < 6; i++) {
                    const j = i + (nextRand[i] % (45 - i));
                    const tmp = nextPool[i];
                    nextPool[i] = nextPool[j];
                    nextPool[j] = tmp;
                }
                const nextNums = [];
                for (let i = 0; i < 6; i++) nextNums.push(nextPool[i]);
                nextNums.sort((a, b) => a - b);

                const elapsed = (Date.now() - startTime) / 1000;
                predictions.push({ matchNum: matchCount, attempt: attempts, time: elapsed, prediction: nextNums });
                self.postMessage({ type: 'match', data: { matchCount, attempts, elapsed, prediction: nextNums } });
            }
        }

        // 동적 배치 크기 조정 (점진적 증가)
        const batchTime = performance.now() - batchStart;
        if (batchTime < 30) batchSize = Math.min(Math.floor(batchSize * 1.5), 200000);
        else if (batchTime > 300) batchSize = Math.max(Math.floor(batchSize / 2), 10000);

        const elapsed = (Date.now() - startTime) / 1000;
        const progress = attempts / maxIterations;
        const progressPct = Math.floor(progress * 100);
        if (progressPct > lastProgressPct || performance.now() - lastProgressPost > PROGRESS_INTERVAL) {
            const speed = Math.round(attempts / elapsed);
            self.postMessage({ type: 'progress', data: { attempts, progress, speed, elapsed, matchCount } });
            lastProgressPost = performance.now();
            lastProgressPct = progressPct;
        }

        if (attempts < maxIterations) {
            // requestAnimationFrame 대신 setTimeout(0) 유지 (Worker 환경)
            setTimeout(runBatch, 0);
        } else {
            self.postMessage({ type: 'complete', data: { attempts, matchCount, elapsed, predictions } });
        }
    }
    runBatch();
};
