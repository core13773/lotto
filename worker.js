self.onmessage = function(e) {
    const { targetNums, maxIterations } = e.data;
    const targetStr = targetNums.sort((a, b) => a - b).join(',');
    let attempts = 0, matchCount = 0;
    const predictions = [], startTime = Date.now();
    const POOL = Array.from({ length: 45 }, (_, i) => i + 1);

    function generateNumbers() {
        const pool = POOL.slice();
        // Fisher-Yates shuffle with crypto.getRandomValues
        for (let i = pool.length - 1; i > 0; i--) {
            const rand = new Uint32Array(1);
            crypto.getRandomValues(rand);
            const j = rand[0] % (i + 1);
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        return pool.slice(0, 6).sort((a, b) => a - b);
    }

    // 기기 성능에 따라 배치 크기 동적 조정
    let batchSize = 50000;

    function runBatch() {
        const batchStart = performance.now();
        const batchEnd = Math.min(attempts + batchSize, maxIterations);
        while (attempts < batchEnd) {
            const current = generateNumbers();
            attempts++;
            if (current.join(',') === targetStr) {
                matchCount++;
                const nextNums = generateNumbers();
                const elapsed = (Date.now() - startTime) / 1000;
                predictions.push({ matchNum: matchCount, attempt: attempts, time: elapsed, prediction: nextNums });
                self.postMessage({ type: 'match', data: { matchCount, attempts, elapsed, prediction: nextNums } });
            }
        }
        const batchTime = performance.now() - batchStart;
        // 배치 처리 시간에 따라 크기 조정 (목표: 50ms~200ms per batch)
        if (batchTime < 30) batchSize = Math.min(batchSize * 2, 500000);
        else if (batchTime > 300) batchSize = Math.max(batchSize / 2, 10000);

        const elapsed = (Date.now() - startTime) / 1000;
        const speed = Math.round(attempts / elapsed);
        const progress = attempts / maxIterations;
        self.postMessage({ type: 'progress', data: { attempts, progress, speed, elapsed, matchCount } });
        if (attempts < maxIterations) setTimeout(runBatch, 0);
        else self.postMessage({ type: 'complete', data: { attempts, matchCount, elapsed, predictions } });
    }
    runBatch();
};
