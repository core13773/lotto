#!/usr/bin/env node
/**
 * 포털 3사(네이버/다음/네이트)에서 특정 회차 로또 당첨번호 조회
 * - GitHub Actions 워크플로우에서 GitHub 3소스가 모두 실패했을 때 fallback으로 사용
 * - 사용법: node fetch-portal.js <ROUND> [출력디렉토리]
 *   - 기본 출력: /tmp/portal_{naver,daum,nate}.json + /tmp/portal_summary.json
 *   - 각 소스별 결과 파일은 {round, numbers, bonus} 형식
 */
const fs = require('fs');
const path = require('path');
const { fetchUrl, parseLottoNumbers } = require('./portal-parser.js');

const ROUND = parseInt(process.argv[2], 10);
const OUT_DIR = process.argv[3] || '/tmp';

if (!ROUND) {
    console.error('❌ 사용법: node fetch-portal.js <ROUND> [출력디렉토리]');
    process.exit(1);
}

const PORTALS = [
    {
        name: 'naver',
        label: '네이버',
        url: `https://search.naver.com/search.naver?where=nexearch&query=${ROUND}%ED%9A%8C%20%EB%A1%9C%EB%98%90%20%EB%8B%B9%EC%B2%A8%EB%B2%88%ED%98%B8`,
    },
    {
        name: 'daum',
        label: '다음',
        url: `https://search.daum.net/search?w=tot&q=${ROUND}%ED%9A%8C%20%EB%A1%9C%EB%98%90%20%EB%8B%B9%EC%B2%A8%EB%B2%88%ED%98%B8`,
    },
    {
        name: 'nate',
        label: '네이트',
        url: `https://search.nate.com/search/all?q=${ROUND}%ED%9A%8C+%EB%A1%9C%EB%98%90+%EB%8B%B9%EC%B2%A8%EB%B2%88%ED%98%B8`,
    },
];

async function main() {
    console.log(`🔍 포털 3사 조회 시작: ${ROUND}회`);
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    const summary = [];
    for (const portal of PORTALS) {
        const outFile = path.join(OUT_DIR, `portal_${portal.name}.json`);
        try {
            const html = await fetchUrl(portal.url, 3);
            const parsed = parseLottoNumbers(html, ROUND);
            // 실제 로또 결과에는 항상 보너스 번호가 있으므로, 보너스 없이 파싱된 결과는
            // (예: 존재하지 않는 회차의 검색 위젯 최신 번호) 신뢰 불가 → 실패 처리
            if (parsed && parsed.numbers && parsed.bonus != null) {
                const data = { round: ROUND, numbers: parsed.numbers, bonus: parsed.bonus };
                fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
                summary.push({ portal: portal.name, label: portal.label, ok: true, numbers: parsed.numbers, bonus: parsed.bonus });
                console.log(`  ✅ ${portal.label}: ${parsed.numbers.join(', ')} + 보너스 ${parsed.bonus}`);
            } else {
                // 파일 제거 (이전 실행 잔재 방지)
                if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
                const reason = parsed && parsed.numbers && parsed.bonus == null
                    ? '보너스 번호 미추출 (신뢰 불가)'
                    : '회차 데이터 파싱 실패';
                summary.push({ portal: portal.name, label: portal.label, ok: false, reason });
                console.log(`  ❌ ${portal.label}: ${reason}`);
            }
        } catch (e) {
            if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
            summary.push({ portal: portal.name, label: portal.label, ok: false });
            console.log(`  ❌ ${portal.label}: 조회 오류 - ${e.message}`);
        }
        // 포털 부하 방지용 짧은 대기
        await new Promise(r => setTimeout(r, 1000));
    }

    // 요약 파일 저장 (워크플로우 검증 스크립트가 사용)
    fs.writeFileSync(path.join(OUT_DIR, 'portal_summary.json'), JSON.stringify(summary, null, 2));

    const okCount = summary.filter(s => s.ok).length;
    console.log(`\n📊 포털 결과: ${okCount}/3 성공`);
    if (okCount === 0) {
        console.log('❌ 모든 포털에서 데이터를 가져오지 못했습니다.');
        process.exit(1);
    }
}

main().catch(e => {
    console.error('❌ 치명적 오류:', e.message);
    process.exit(1);
});
