self.onmessage = function(e) {
    const { targetNums, maxIterations } = e.data;
    const targetStr = targetNums.sort((a, b) => a - b).join(',');
    let attempts = 0, matchCount = 0;
    const predictions = [], startTime = Date.now();
    const POOL = Array.from({ length: 45 }, (_, i) => i + 1);

    function generateNumbers() {
        const rand = new Uint32Array(6);
        crypto.getRandomValues(rand);
        const swaps = [];

        for (let i = 0; i < 6; i++) {
            const j = i + (rand[i] % (45 - i));
            swaps.push(i, j, POOL[i], POOL[j]);
            const tmp = POOL[i];
            POOL[i] = POOL[j];
            POOL[j] = tmp;
        }

        const result = [POOL[0], POOL[1], POOL[2], POOL[3], POOL[4], POOL[5]];

        for (let k = swaps.length - 4; k >= 0; k -= 4) {
            POOL[swaps[k]] = swaps[k + 2];
            POOL[swaps[k + 1]] = swaps[k + 3];
        }

        return result.sort((a, b) => a - b);
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
            if (current.join(',') === targetStr) {
                matchCount++;
                const nextNums = generateNumbers();
                const elapsed = (Date.now() - startTime) / 1000;
                predictions.push({ matchNum: matchCount, attempt: attempts, time: elapsed, prediction: nextNums });
                self.postMessage({ type: 'match', data: { matchCount, attempts, elapsed, prediction: nextNums } });
            }
        }
        const batchTime = performance.now() - batchStart;
        if (batchTime < 30) batchSize = Math.min(batchSize * 2, 500000);
        else if (batchTime > 300) batchSize = Math.max(batchSize / 2, 10000);

        const elapsed = (Date.now() - startTime) / 1000;
        const progress = attempts / maxIterations;
        const progressPct = Math.floor(progress * 100);
        if (progressPct > lastProgressPct || performance.now() - lastProgressPost > PROGRESS_INTERVAL) {
            const speed = Math.round(attempts / elapsed);
            self.postMessage({ type: 'progress', data: { attempts, progress, speed, elapsed, matchCount } });
            lastProgressPost = performance.now();
            lastProgressPct = progressPct;
        }
        if (attempts < maxIterations) setTimeout(runBatch, 0);
        else self.postMessage({ type: 'complete', data: { attempts, matchCount, elapsed, predictions } });
    }
    runBatch();
};
