const fs = require('fs');
const { fetchUrl, parseLottoNumbers } = require('./portal-parser.js');

const LATEST_ROUND = (() => {
    // KST 21:00 = UTC 12:00 (로또 추첨 시간)
    const firstDraw = Date.UTC(2002, 11, 7, 12, 0, 0);
    const now = new Date();
    // KST = UTC+9 — getUTC*로 KST 필드를 읽으려면 epoch에 +9h만 더해야 함.
    // (이전의 getTimezoneOffset() 항은 KST 로컬 머신에서 +9h를 상쇄해 UTC 시각을 반환하는 버그)
    const kstNow = new Date(now.getTime() + 9 * 3600000);
    const dayOfWeek = kstNow.getUTCDay();
    const hours = kstNow.getUTCHours();
    let lastDraw;
    if (dayOfWeek === 6 && hours >= 21) {
        // 오늘(토요일) 오후 9시 이후 → 오늘 추첨이 최신 (UTC 12:00)
        lastDraw = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate(), 12, 0, 0);
    } else {
        const daysSinceSat = dayOfWeek === 6 ? 7 : dayOfWeek + 1;
        lastDraw = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() - daysSinceSat, 12, 0, 0);
    }
    return Math.floor((lastDraw - firstDraw) / (7 * 24 * 60 * 60 * 1000)) + 1;
})();

console.log(`전체 회차 수집 시작: 1회 ~ ${LATEST_ROUND}회`);
console.log(`예상 시간: 약 ${Math.ceil(LATEST_ROUND * 0.25 / 60)}분\n`);

async function fetchRound(round) {
    const url = `https://search.naver.com/search.naver?where=nexearch&query=${round}%ED%9A%8C%20%EB%A1%9C%EB%98%90%20%EB%8B%B9%EC%B2%A8%EB%B2%88%ED%98%B8`;
    try {
        const html = await fetchUrl(url);
        let result = parseLottoNumbers(html, round);
        if (!result) {
            // 네이버 실패 시 다음 검색 fallback
            const daumUrl = `https://search.daum.net/search?w=tot&q=${round}%ED%9A%8C%EB%A1%9C%EB%98%90`;
            const daumHtml = await fetchUrl(daumUrl);
            result = parseLottoNumbers(daumHtml, round);
        }
        if (!result) {
            // 다음도 실패 시 네이트 검색 fallback
            const nateUrl = `https://search.nate.com/search/all?q=${round}%ED%9A%8C+%EB%A1%9C%EB%98%90+%EB%8B%B9%EC%B2%A8%EB%B2%88%ED%98%B8`;
            const nateHtml = await fetchUrl(nateUrl);
            result = parseLottoNumbers(nateHtml, round);
        }
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
