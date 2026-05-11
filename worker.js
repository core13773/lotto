self.onmessage = function(e) {
    const { targetNums, maxIterations } = e.data;
    const targetStr = targetNums.sort((a, b) => a - b).join(',');
    let attempts = 0, matchCount = 0;
    const predictions = [], startTime = Date.now();
    const POOL = Array.from({ length: 45 }, (_, i) => i + 1);

    function generateNumbers() {
        const nums = [], pool = [...POOL];
        for (let i = 0; i < 6; i++) {
            const idx = Math.floor(Math.random() * pool.length);
            nums.push(pool.splice(idx, 1)[0]);
        }
        return nums.sort((a, b) => a - b);
    }

    function runBatch() {
        const batchSize = 100000;
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
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = Math.round(attempts / elapsed);
        const progress = attempts / maxIterations;
        self.postMessage({ type: 'progress', data: { attempts, progress, speed, elapsed, matchCount } });
        if (attempts < maxIterations) setTimeout(runBatch, 0);
        else self.postMessage({ type: 'complete', data: { attempts, matchCount, elapsed, predictions } });
    }
    runBatch();
};
