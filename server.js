const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3456;
const CACHE = new Map(); // { round: { data, timestamp } }
const CACHE_TTL = 60 * 60 * 1000; // 1시간
const CACHE_MAX = 100; // 최대 캐시 항목 수
const RATE_LIMIT = new Map(); // { ip: { count, reset } }
const RATE_WINDOW = 10 * 1000; // 10초
const RATE_MAX = 10; // 10초당 최대 10회

function fetchHtml(url, redirectCount = 0) {
    if (redirectCount > 5) return Promise.reject(new Error('Too many redirects'));
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 10000
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const loc = res.headers.location;
                    const nextUrl = loc.startsWith('http') ? loc : 'https://search.naver.com' + loc;
                    fetchHtml(nextUrl, redirectCount + 1).then(resolve).catch(reject);
                    return;
                }
                resolve(body);
            });
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
        req.on('error', reject);
    });
}

function extractLottoNumbers(html) {
    // HTML 태그/엔티티/공백 정규화
    const text = html.replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ');
    // 다양한 따옴표 정규화
    const normalized = text.replace(/[\u2018\u2019\u201a\u201b\u2032\u2035`]/g, "'");

    // 1. 6개 번호 패턴 (쉼표 + 공백 변형 대응)
    const num6Pattern = /(\d{1,2})\s*[,，]\s*(\d{1,2})\s*[,，]\s*(\d{1,2})\s*[,，]\s*(\d{1,2})\s*[,，]\s*(\d{1,2})\s*[,，]\s*(\d{1,2})/;
    const num6Match = normalized.match(num6Pattern);

    if (!num6Match) return null;

    const nums = [parseInt(num6Match[1]), parseInt(num6Match[2]), parseInt(num6Match[3]),
                  parseInt(num6Match[4]), parseInt(num6Match[5]), parseInt(num6Match[6])];

    if (!nums.every(n => n >= 1 && n <= 45) || new Set(nums).size !== 6) return null;

    // 2. 볼너스 번호 찾기 (번호 뒤쪽 텍스트에서, 범위 확대)
    const afterNumbers = normalized.substring(num6Match.index + num6Match[0].length, num6Match.index + num6Match[0].length + 300);
    let bonus = null;
    const bonusPatterns = [
        /볼너스\s*[:：]?\s*'?"?(\d{1,2})'?"?/,
        /bonus\s*[:：]?\s*'?"?(\d{1,2})'?"?/i,
        /plus\s*[:：]?\s*'?"?(\d{1,2})'?"?/i,
        /추가\s*[:：]?\s*'?"?(\d{1,2})'?"?/,
    ];
    for (const bp of bonusPatterns) {
        const bm = afterNumbers.match(bp);
        if (bm) {
            const bn = parseInt(bm[1]);
            if (bn >= 1 && bn <= 45 && !nums.includes(bn)) {
                bonus = bn;
                break;
            }
        }
    }

    return { numbers: nums.sort((a, b) => a - b), bonus };
}

function extractLottoNumbersFromDaum(html) {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ');
    const normalized = text.replace(/[\u2018\u2019\u201a\u201b\u2032\u2035`]/g, "'");
    const num6Pattern = /(\d{1,2})\s*[,，]\s*(\d{1,2})\s*[,，]\s*(\d{1,2})\s*[,，]\s*(\d{1,2})\s*[,，]\s*(\d{1,2})\s*[,，]\s*(\d{1,2})/;
    const num6Match = normalized.match(num6Pattern);
    if (!num6Match) return null;
    const nums = [parseInt(num6Match[1]), parseInt(num6Match[2]), parseInt(num6Match[3]),
                  parseInt(num6Match[4]), parseInt(num6Match[5]), parseInt(num6Match[6])];
    if (!nums.every(n => n >= 1 && n <= 45) || new Set(nums).size !== 6) return null;
    const afterNumbers = normalized.substring(num6Match.index + num6Match[0].length, num6Match.index + num6Match[0].length + 300);
    let bonus = null;
    const bonusPatterns = [
        /번\s*\+\s*(\d{1,2})\s*번/,
        /볼너스\s*[:：]?\s*'?"?(\d{1,2})'?"?/,
        /bonus\s*[:：]?\s*'?"?(\d{1,2})'?"?/i,
        /plus\s*[:：]?\s*'?"?(\d{1,2})'?"?/i,
        /추가\s*[:：]?\s*'?"?(\d{1,2})'?"?/,
    ];
    for (const bp of bonusPatterns) {
        const bm = afterNumbers.match(bp);
        if (bm) {
            const bn = parseInt(bm[1]);
            if (bn >= 1 && bn <= 45 && !nums.includes(bn)) { bonus = bn; break; }
        }
    }
    return { numbers: nums.sort((a, b) => a - b), bonus };
}

async function fetchLottoNumbers(round) {
    // 캐시 확인
    const cached = CACHE.get(round);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    // 네이버 검색에서 가져오기
    const url = `https://search.naver.com/search.naver?where=nexearch&query=${round}%ED%9A%8C%20%EB%A1%9C%EB%98%90%20%EB%8B%B9%EC%B2%A8%EB%B2%88%ED%98%B8`;
    let html = await fetchHtml(url);
    let result = null;

    if (html) {
        result = extractLottoNumbers(html);
    }

    // 네이버 실패 시 다음 검색 fallback
    if (!result) {
        const daumUrl = `https://search.daum.net/search?w=tot&q=${round}%ED%9A%8C%EB%A1%9C%EB%98%90`;
        html = await fetchHtml(daumUrl);
        if (html) {
            result = extractLottoNumbersFromDaum(html);
        }
    }

    if (!result) {
        return { error: `${round}회차 당첨번호를 찾을 수 없습니다.` };
    }

    // 캐시 저장 (최대 크기 초과 시 가장 오래된 항목 삭제)
    if (CACHE.size >= CACHE_MAX) {
        let oldest = null;
        CACHE.forEach(function(v, k) {
            if (!oldest || v.timestamp < oldest.timestamp) oldest = { key: k, timestamp: v.timestamp };
        });
        if (oldest) CACHE.delete(oldest.key);
    }
    CACHE.set(round, { data: result, timestamp: Date.now() });
    return result;
}

const startTime = Date.now();

const server = http.createServer(async (req, res) => {
    // Rate limiting (X-Forwarded-For 지원)
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let rl = RATE_LIMIT.get(ip);
    if (!rl || now > rl.reset) {
        rl = { count: 0, reset: now + RATE_WINDOW };
        RATE_LIMIT.set(ip, rl);
    }
    rl.count++;
    if (rl.count > RATE_MAX) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }));
        return;
    }

    // CORS 헤더
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // URL 파싱 (배포 환경에서도 실제 호스트 사용)
    const host = req.headers.host || `localhost:${PORT}`;
    const url = new URL(req.url, `http://${host}`);
    const path = url.pathname;

    if (path === '/api/lotto' || path === '/api/lotto/') {
        const round = parseInt(url.searchParams.get('round')) || 0;
        if (!round || round < 1) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '올바른 회차(round)를 지정해주세요.' }));
            return;
        }

        try {
            const data = await fetchLottoNumbers(round);
            res.writeHead(data.error ? 404 : 200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '서버 오류: ' + e.message }));
        }
    } else if (path === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', cached: CACHE.size, uptime: Math.round((Date.now() - startTime) / 1000) }));
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

server.listen(PORT, () => {
    console.log(`🎰 로또 645 프록시 서버 실행 중: http://localhost:${PORT}`);
    console.log(`   API: http://localhost:${PORT}/api/lotto?round=1100`);
});

// 5분마다 만료된 rate limit 항목 정리
setInterval(function() {
    const now = Date.now();
    RATE_LIMIT.forEach(function(v, k) {
        if (now > v.reset) RATE_LIMIT.delete(k);
    });
}, 5 * 60 * 1000);
