/**
 * 포털(네이버/다음/네이트) 로또 당첨번호 파서
 * - fetch-portal.js(워크플로우 fallback)와 fetch-all.js(전체 수집)에서 공용으로 사용
 * - 네이버/다음/네이트 검색 결과 HTML에서 6개 번호 + 보너스 번호를 추출
 */
const https = require('https');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

/**
 * URL을 fetch (리다이렉트 + 지수 백오프 재시도)
 */
function fetchUrl(url, retries = 3) {
    return new Promise((resolve) => {
        const doFetch = (target, retry) => {
            let u;
            try { u = new URL(target); } catch (e) { resolve(''); return; }
            const req = https.get(target, {
                headers: { 'User-Agent': UA, 'Referer': u.origin + '/' },
                timeout: 15000
            }, (res) => {
                // 리다이렉트 처리 (상대경로는 현재 오리진 기준, 재시도 횟수 감소)
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const loc = res.headers.location;
                    const redirectUrl = loc.startsWith('http') ? loc : u.origin + loc;
                    res.resume();
                    if (retry > 0) {
                        doFetch(redirectUrl, retry - 1);
                    } else {
                        resolve(''); // 리다이렉트 루프 방지
                    }
                    return;
                }
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve(body));
            });
            req.on('timeout', () => { req.destroy(); resolve(''); });
            req.on('error', () => {
                if (retry > 0) {
                    setTimeout(() => doFetch(target, retry - 1), (4 - retry) * 2000);
                } else {
                    resolve('');
                }
            });
        };
        doFetch(url, retries);
    });
}

/**
 * HTML 엔티티 디코딩 (&#39; → ', &quot; → ", &nbsp; → ' ' 등)
 */
function decodeEntities(s) {
    return s
        .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(parseInt(n, 10)))
        .replace(/&#x([0-9a-fA-F]+);/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, ' ')
        .replace(/&ndash;/g, '-')
        .replace(/&hellip;/g, '…');
}

/**
 * 포털 검색 HTML에서 특정 회차의 로또 당첨번호 + 보너스 추출
 * @param {string} html 검색 결과 HTML
 * @param {number|string} round 대상 회차 (예: 1235)
 * @returns {{numbers:number[], bonus:(number|null)}|null}
 */
function parseLottoNumbers(html, round) {
    if (!html) return null;

    // 태그 제거 → 엔티티 디코딩(먼저) → 남은 엔티티 정리 → 스마트따옴표 정규화 → 공백 정리
    const text = decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/&[^;]+;/g, ' ');
    const normalized = text
        .replace(/[\u2018\u2019\u201a\u201b\u2032\u2035`]/g, "'")
        .replace(/\s+/g, ' ');

    const roundPlain = String(round);
    // "1235회" 또는 "1,235회" 형태 모두 인식 (작은 회차에서 숫자 오탐 방지)
    const roundVariants = new Set([
        roundPlain + '회',
        roundPlain.replace(/(\d)(?=(\d{3})+$)/g, '$1,') + '회'
    ]);

    // 6개 숫자 패턴 후보 수집 (1~45, 중복 없음 검증)
    const num6Re = /(\d{1,2})\s*[,，]\s*(\d{1,2})\s*[,，]\s*(\d{1,2})\s*[,，]\s*(\d{1,2})\s*[,，]\s*(\d{1,2})\s*[,，]\s*(\d{1,2})/g;
    const candidates = [];
    let m;
    while ((m = num6Re.exec(normalized)) !== null) {
        const nums = m.slice(1, 7).map(Number);
        if (!nums.every(n => n >= 1 && n <= 45) || new Set(nums).size !== 6) continue;
        const start = Math.max(0, m.index - 200);
        const end = Math.min(normalized.length, m.index + m[0].length + 250);
        const ctx = normalized.slice(start, end);
        // 회차 표기와의 인접 거리 측정 (스니펫에 '1234회'가 남의 글에 끼어 있는 경우 방지)
        let minDist = Infinity;
        for (const v of roundVariants) {
            let from = 0;
            while (true) {
                const i = ctx.indexOf(v, from);
                if (i < 0) break;
                const abs = Math.abs((start + i) - m.index);
                if (abs < minDist) minDist = abs;
                from = i + v.length;
            }
        }
        let score = 0;
        if (minDist <= 40) score = 100;      // '제 1234회 로또 당첨번호 1등은...' (인접)
        else if (minDist <= 120) score = 50; // 근접
        else if (minDist <= 250) score = 15; // 느슨
        if (/당첨|보너스|1등/.test(ctx)) score += 10;
        candidates.push({ nums, score, minDist, index: m.index, len: m[0].length });
    }
    if (candidates.length === 0) return null;

    // 회차 인접도가 높은 후보 우선, 동점이면 먼저 나온 것
    candidates.sort((a, b) => (b.score - a.score) || (a.minDist - b.minDist) || (a.index - b.index));
    const best = candidates[0];
    // 회차 표기가 숫자로부터 120자 이내(score >= 50)일 때만 채택 → 오데이터 방지
    if (best.score < 50) return null;

    // 보너스 번호: 당첨번호 전후 문맥에서 검색
    const ctxStart = Math.max(0, best.index - 200);
    const ctxEnd = Math.min(normalized.length, best.index + best.len + 600);
    const ctx = normalized.slice(ctxStart, ctxEnd);

    const bPatterns = [
        /보너스\s*번호\s*는\s*['"]?(\d{1,2})['"]?/,
        /보너스\s*[:：]?\s*['"]?(\d{1,2})['"]?/,
        /볼너스\s*[:：]?\s*['"]?(\d{1,2})['"]?/,
        /bonus\s*[:：]?\s*['"]?(\d{1,2})['"]?/i,
        /plus\s*[:：]?\s*['"]?(\d{1,2})['"]?/i,
        /추가\s*[:：]?\s*['"]?(\d{1,2})['"]?/,
        /번\s*\+\s*(\d{1,2})\s*번/,
    ];
    let bonus = null;
    for (const bp of bPatterns) {
        const bm = ctx.match(bp);
        if (bm) {
            const bn = parseInt(bm[1], 10);
            if (bn >= 1 && bn <= 45 && !best.nums.includes(bn)) { bonus = bn; break; }
        }
    }

    return { numbers: best.nums.slice().sort((a, b) => a - b), bonus };
}

module.exports = { fetchUrl, parseLottoNumbers };
