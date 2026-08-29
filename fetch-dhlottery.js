#!/usr/bin/env node
/**
 * 동행복권 공식 결과 페이지(https://www.dhlottery.co.kr/lt645/result)의
 * AJAX 데이터 엔드포인트(selectPstLt645InfoNew.do)에서 특정 회차 당첨번호 조회
 * - 동행복권 공식 API(common.do?method=getLottoNumber)는 대기열 HTML을 반환하므로 사용하지 않음
 * - 결과 페이지가 실제로 사용하는 JSON 엔드포인트를 통해 정확한 번호 확보
 * - 사용법: node fetch-dhlottery.js <ROUND> [출력디렉토리]
 *   - 기본 출력: <출력디렉토리>/dhlottery.json  ({round, numbers, bonus})
 *   - 실패 시 exit 1 (워크플로우에서 소스 실패로 처리)
 *
 * 재시도 전략: 최대 3회, 지수 백오프 (2초 → 4초 → 8초)
 */
const fs = require('fs');
const path = require('path');
const { fetchUrl } = require('./portal-parser.js');

const ROUND = parseInt(process.argv[2], 10);
const OUT_DIR = process.argv[3] || '/tmp';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000]; // 지수 백오프 (ms)

if (!ROUND) {
    console.error('❌ 사용법: node fetch-dhlottery.js <ROUND> [출력디렉토리]');
    process.exit(1);
}

const ENDPOINT = 'https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do';

/**
 * 단일 조회 시도
 * @returns {{round:number, numbers:number[], bonus:number}|null} 성공 시 데이터, 실패 시 null
 */
async function fetchOnce(attempt) {
    const url = `${ENDPOINT}?srchDir=center&srchLtEpsd=${ROUND}`;
    console.log(`  📡 시도 ${attempt}/${MAX_RETRIES}: ${url}`);

    const html = await fetchUrl(url, 2);

    if (!html || !html.trim()) {
        console.log(`  ⚠️ 시도 ${attempt}: 응답 없음 (네트워크/차단/타임아웃)`);
        return null;
    }

    let parsed;
    try {
        parsed = JSON.parse(html);
    } catch (e) {
        // HTML 대기열 페이지 반환 가능성 — 로그에 일부 내용 출력하여 디버깅 지원
        const preview = html.substring(0, 200).replace(/\n/g, ' ');
        console.log(`  ⚠️ 시도 ${attempt}: JSON 파싱 실패 — 응답 미리보기: "${preview}..."`);
        return null;
    }

    const list = (parsed && parsed.data && Array.isArray(parsed.data.list)) ? parsed.data.list : [];
    // 응답은 최신 회차부터 여러 개 포함될 수 있으므로 대상 회차만 정확히 선택
    const found = list.find(r => Number(r.ltEpsd) === ROUND);

    if (!found) {
        const latestRound = list.length > 0 ? Number(list[0].ltEpsd) : '알수없음';
        console.log(`  ⚠️ 시도 ${attempt}: ${ROUND}회 데이터 없음 (응답 최신 회차: ${latestRound}, 총 ${list.length}건)`);
        return null;
    }

    const nums = [found.tm1WnNo, found.tm2WnNo, found.tm3WnNo, found.tm4WnNo, found.tm5WnNo, found.tm6WnNo]
        .map(Number)
        .sort((a, b) => a - b);
    const bonus = Number(found.bnsWnNo);

    // 유효성 검증: 1~45 범위, 6개 중복 없음, 보너스 유효 및 번호와 미중복
    if (nums.length !== 6 || new Set(nums).size !== 6 ||
        nums.some(n => !(n >= 1 && n <= 45)) ||
        !(bonus >= 1 && bonus <= 45) || nums.includes(bonus)) {
        console.log(`  ❌ 시도 ${attempt}: 데이터 유효성 실패 — ${nums.join(', ')} + 보너스 ${bonus}`);
        return null;
    }

    return { round: ROUND, numbers: nums, bonus };
}

async function main() {
    console.log(`🔍 동행복권 공식 결과 페이지 조회: ${ROUND}회`);
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const result = await fetchOnce(attempt);
            if (result) {
                const outFile = path.join(OUT_DIR, 'dhlottery.json');
                fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
                console.log(`  ✅ 동행복권: ${result.numbers.join(', ')} + 보너스 ${result.bonus}`);
                console.log(`  📄 저장: ${outFile}`);
                return; // 성공
            }
            lastError = `시도 ${attempt}: 데이터 없음`;
        } catch (e) {
            lastError = `시도 ${attempt}: ${e.message}`;
            console.log(`  ❌ ${lastError}`);
        }

        // 마지막 시도가 아니면 대기 후 재시도
        if (attempt < MAX_RETRIES) {
            const delay = RETRY_DELAYS[attempt - 1] || 5000;
            console.log(`  ⏳ ${delay / 1000}초 후 재시도...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }

    // 모든 시도 실패
    console.log(`  ❌ 동행복권 조회 최종 실패 (${MAX_RETRIES}회 시도): ${lastError}`);
    process.exit(1);
}

main().catch(e => {
    console.error('❌ 치명적 오류:', e.message);
    process.exit(1);
});
