#!/usr/bin/env node
/**
 * 동행복권 공식 결과 페이지(https://www.dhlottery.co.kr/lt645/result)의
 * AJAX 데이터 엔드포인트(selectPstLt645InfoNew.do)에서 특정 회차 당첨번호 조회
 * - 동행복권 공식 API(common.do?method=getLottoNumber)는 대기열 HTML을 반환하므로 사용하지 않음
 * - 결과 페이지가 실제로 사용하는 JSON 엔드포인트를 통해 정확한 번호 확보
 * - 사용법: node fetch-dhlottery.js <ROUND> [출력디렉토리]
 *   - 기본 출력: <출력디렉토리>/dhlottery.json  ({round, numbers, bonus})
 *   - 실패 시 exit 1 (워크플로우에서 소스 실패로 처리)
 */
const fs = require('fs');
const path = require('path');
const { fetchUrl } = require('./portal-parser.js');

const ROUND = parseInt(process.argv[2], 10);
const OUT_DIR = process.argv[3] || '/tmp';

if (!ROUND) {
    console.error('❌ 사용법: node fetch-dhlottery.js <ROUND> [출력디렉토리]');
    process.exit(1);
}

const ENDPOINT = 'https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do';

async function main() {
    console.log(`🔍 동행복권 공식 결과 페이지 조회: ${ROUND}회`);
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    const url = `${ENDPOINT}?srchDir=center&srchLtEpsd=${ROUND}`;
    const html = await fetchUrl(url, 3);

    if (!html || !html.trim()) {
        console.log('  ❌ 동행복권 응답 없음 (네트워크/차단)');
        process.exit(1);
    }

    let parsed;
    try {
        parsed = JSON.parse(html);
    } catch (e) {
        console.log('  ❌ JSON 파싱 실패 (HTML 대기열 페이지 반환 가능성)');
        process.exit(1);
    }

    const list = (parsed && parsed.data && Array.isArray(parsed.data.list)) ? parsed.data.list : [];
    // 응답은 최신 회차부터 여러 개 포함될 수 있으므로 대상 회차만 정확히 선택
    const found = list.find(r => Number(r.ltEpsd) === ROUND);

    if (!found) {
        console.log(`  ⚠️ 동행복권: ${ROUND}회 데이터 없음 (응답은 최신 회차 ${list.length}건)`);
        process.exit(1);
    }

    const nums = [found.tm1WnNo, found.tm2WnNo, found.tm3WnNo, found.tm4WnNo, found.tm5WnNo, found.tm6WnNo]
        .map(Number)
        .sort((a, b) => a - b);
    const bonus = Number(found.bnsWnNo);

    // 유효성 검증: 1~45 범위, 6개 중복 없음, 보너스 유효 및 번호와 미중복
    if (nums.length !== 6 || new Set(nums).size !== 6 ||
        nums.some(n => !(n >= 1 && n <= 45)) ||
        !(bonus >= 1 && bonus <= 45) || nums.includes(bonus)) {
        console.log(`  ❌ 동행복권 데이터 유효성 실패: ${nums.join(', ')} + 보너스 ${bonus}`);
        process.exit(1);
    }

    const data = { round: ROUND, numbers: nums, bonus };
    const outFile = path.join(OUT_DIR, 'dhlottery.json');
    fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
    console.log(`  ✅ 동행복권: ${nums.join(', ')} + 보너스 ${bonus}`);
    console.log(`  📄 저장: ${outFile}`);
}

main().catch(e => {
    console.error('❌ 치명적 오류:', e.message);
    process.exit(1);
});
