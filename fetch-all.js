const https = require('https');
const fs = require('fs');

const LATEST_ROUND = (() => {
    const firstDraw = new Date(2002, 11, 7, 21, 0, 0);
    const now = new Date();
    // KST = UTC+9
    const kstNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 9 * 3600000);
    const dayOfWeek = kstNow.getUTCDay();
    const hours = kstNow.getUTCHours();
    let lastDraw;
    if (dayOfWeek === 6 && hours >= 21) {
        // 오늘(토요일) 오후 9시 이후 → 오늘 추첨이 최신
        lastDraw = new Date(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate(), 21, 0, 0);
    } else {
        const daysSinceSat = dayOfWeek === 6 ? 7 : dayOfWeek + 1;
        lastDraw = new Date(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() - daysSinceSat, 21, 0, 0);
    }
    return Math.floor((lastDraw - firstDraw) / (7 * 24 * 60 * 60 * 1000)) + 1;
})();

console.log(`전체 회차 수집 시작: 1회 ~ ${LATEST_ROUND}회`);
console.log(`예상 시간: 약 ${Math.ceil(LATEST_ROUND * 0.25 / 60)}분\n`);

function fetchUrl(url, retries = 3) {
    return new Promise((resolve) => {
        const req = https.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 15000
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const loc = res.headers.location;
                    const redirectUrl = loc.startsWith('http') ? loc : 'https://search.naver.com' + loc;
                    fetchUrl(redirectUrl, retries).then(resolve);
                    return;
                }
                resolve(body);
            });
        });
        req.on('timeout', () => { req.destroy(); resolve(''); });
        req.on('error', () => {
            if (retries > 0) {
                // 지수 백오프 재시도
                setTimeout(() => fetchUrl(url, retries - 1).then(resolve), (4 - retries) * 2000);
            } else {
                resolve('');
            }
        });
    });
}

function extractLottoNumbers(html) {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ');
    const normalized = text.replace(/[''']/g, "'");
    const num6Match = normalized.match(/(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})/);
    if (!num6Match) return null;
    const nums = [parseInt(num6Match[1]), parseInt(num6Match[2]), parseInt(num6Match[3]),
                  parseInt(num6Match[4]), parseInt(num6Match[5]), parseInt(num6Match[6])];
    if (!nums.every(n => n >= 1 && n <= 45) || new Set(nums).size !== 6) return null;
    const after = normalized.substring(num6Match.index + num6Match[0].length, num6Match.index + num6Match[0].length + 200);
    let bonus = null;
    const bm = after.match(/보너스[^0-9]*['"]?(\d{1,2})/);
    if (bm) {
        const bn = parseInt(bm[1]);
        if (bn >= 1 && bn <= 45 && !nums.includes(bn)) bonus = bn;
    }
    return { numbers: nums.sort((a, b) => a - b), bonus };
}

async function fetchRound(round) {
    const url = `https://search.naver.com/search.naver?where=nexearch&query=${round}%ED%9A%8C%20%EB%A1%9C%EB%98%90%20%EB%8B%B9%EC%B2%A8%EB%B2%88%ED%98%B8`;
    try {
        const html = await fetchUrl(url);
        const result = extractLottoNumbers(html);
        if (result) result.round = round;
        return result;
    } catch (e) {
        return null;
    }
}

async function main() {
    let existing = [];
    if (fs.existsSync('latest.json')) {
        try { existing = JSON.parse(fs.readFileSync('latest.json', 'utf8')); } catch (e) {}
    }
    const existingMap = new Map(existing.map(r => [r.round, r]));

    const results = [];
    let success = 0, fail = 0;
    const CONCURRENT = 3;
    const BATCH_DELAY = 3000; // 100회마다 3초 대기

    for (let i = 0; i < LATEST_ROUND; i += 100) {
        const batchEnd = Math.min(i + 100, LATEST_ROUND);

        for (let j = i; j < batchEnd; j += CONCURRENT) {
            const batch = [];
            for (let k = 0; k < CONCURRENT && j + k < batchEnd; k++) {
                const round = j + k + 1;
                if (existingMap.has(round)) {
                    results.push(existingMap.get(round));
                    success++;
                    continue;
                }
                batch.push(fetchRound(round));
            }

            if (batch.length > 0) {
                const batchResults = await Promise.all(batch);
                for (const data of batchResults) {
                    if (data) { results.push(data); success++; }
                    else { fail++; }
                }
            }

            const done = Math.min(j + CONCURRENT, batchEnd);
            const pct = (done / LATEST_ROUND * 100).toFixed(1);
            process.stdout.write(`\r진행률: ${pct}% | 성공: ${success} | 실패: ${fail} | ${done}/${LATEST_ROUND}`);
        }

        if (batchEnd < LATEST_ROUND) {
            process.stdout.write(`\n⏳ ${BATCH_DELAY/1000}초 대기 중...`);
            await new Promise(r => setTimeout(r, BATCH_DELAY));
            process.stdout.write(`\n`);
        }
    }

    results.sort((a, b) => a.round - b.round);
    fs.writeFileSync('latest.json', JSON.stringify(results, null, 2));
    console.log(`\n\n완료! ${results.length}개 회차 저장됨 → latest.json`);
}

main().catch(console.error);
