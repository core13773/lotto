#!/usr/bin/env node
// backtest.js — 품질 점수 / 필터 체계의 교정도 검증 (개발자용 분석 도구)
//
// 검증 내용:
//   1) 실제 역대 당첨번호가 높은 품질 점수를 받는가?
//   2) 필터(합계/홀짝/연속쌍/구간/번호폭)를 실제 당첨번호가 잘 통과하는가?
//   3) 실제 당첨번호 평균 점수가 무작위 조합보다 유의하게 높은가?
//
// 실행: node backtest.js
const fs = require('fs');
const vm = require('vm');

const db = JSON.parse(fs.readFileSync('latest.json', 'utf8'));
// analysis.js 의 순수 함수(analyzeNumbers/calculateQualityScore/checkFilters)를
// vm 샌드박스로 로드 — lottoDb 의존 함수는 호출하지 않으므로 안전.
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('analysis.js', 'utf8'), sandbox);
const { analyzeNumbers, calculateQualityScore, checkFilters } = sandbox;

console.log(`\n역대 데이터: ${db.length}회차`);
console.log('='.repeat(50));

// 1) 실제 당첨번호 점수/필터 분포
let sum = 0, gradeCount = {}, filterAllPass = 0;
const buckets = { '미흡(<45)': 0, '주의(45-59)': 0, '보통(60-74)': 0, '양호(75-89)': 0, '최상(90+)': 0 };
for (const r of db) {
    if (!r.numbers || r.numbers.length !== 6) continue;
    const a = analyzeNumbers(r.numbers);
    const s = calculateQualityScore(a);
    sum += s.totalScore;
    gradeCount[s.grade] = (gradeCount[s.grade] || 0) + 1;
    if (s.totalScore < 45) buckets['미흡(<45)']++;
    else if (s.totalScore < 60) buckets['주의(45-59)']++;
    else if (s.totalScore < 75) buckets['보통(60-74)']++;
    else if (s.totalScore < 90) buckets['양호(75-89)']++;
    else buckets['최상(90+)']++;
    if (checkFilters(r.numbers).allPass) filterAllPass++;
}
const n = db.length;
const avgActual = sum / n;
console.log('\n[1] 실제 역대 당첨번호');
console.log(`  평균 품질 점수: ${avgActual.toFixed(1)} / 100`);
console.log('  등급 분포:', gradeCount);
console.log('  점수 구간:', buckets);
console.log(`  필터 전체 통과율: ${(filterAllPass / n * 100).toFixed(1)}% (${filterAllPass}/${n})`);

// 2) 무작위 조합 대조군
function rand6() {
    const p = Array.from({ length: 45 }, (_, i) => i + 1);
    for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    return p.slice(0, 6).sort((a, b) => a - b);
}
const R = 20000;
let rsum = 0, rpass = 0;
for (let i = 0; i < R; i++) {
    const c = rand6();
    rsum += calculateQualityScore(analyzeNumbers(c)).totalScore;
    if (checkFilters(c).allPass) rpass++;
}
const avgRandom = rsum / R;
console.log('\n[2] 무작위 조합 대조 (' + R + '개)');
console.log(`  평균 품질 점수: ${avgRandom.toFixed(1)} / 100`);
console.log(`  필터 전체 통과율: ${(rpass / R * 100).toFixed(1)}%`);

// 3) 결론
const diff = avgActual - avgRandom;
console.log('\n' + '='.repeat(50));
console.log('[결론]');
console.log(`  실제 당첨번호 평균(${avgActual.toFixed(1)}) − 무작위(${avgRandom.toFixed(1)}) = +${diff.toFixed(1)}점`);
if (diff >= 3) console.log('  → 점수 체계가 역대 당첨 패턴을 의미있게 반영하고 있음 ✓');
else if (diff >= 1) console.log('  → 약한 차이. 일부 가중치 재검토를 고려할 만함.');
else console.log('  → 차이가 거의 없음. 점수 가중치 재설계 권장.');
console.log(`  필터 통과율 차이: 실제 ${(filterAllPass/n*100).toFixed(1)}% vs 무작위 ${(rpass/R*100).toFixed(1)}% (실제가 더 높으면 필터가 유효)`);
