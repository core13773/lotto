import urllib.request
import re
import json
import time
import sys
import random

# Windows 콘솔 UTF-8 출력 보장
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass


def fetch_from_dhlottery(round_no):
    """동행복권 공식 API — 가장 신뢰도 높고 빠른 소스"""
    url = f'https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo={round_no}'
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/javascript, */*',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.dhlottery.co.kr/gameResult.do?method=byWin',
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as f:
            data = json.loads(f.read().decode('utf-8'))
    except Exception:
        return None

    if data.get('returnValue') != 'success':
        return None

    numbers = sorted([int(data[f'drwtNo{i}']) for i in range(1, 7)])
    if not all(1 <= n <= 45 for n in numbers) or len(set(numbers)) != 6:
        return None

    bonus = data.get('bnusNo')
    if bonus is not None:
        bonus = int(bonus)
        if not (1 <= bonus <= 45) or bonus in numbers:
            bonus = None

    return {'round': round_no, 'numbers': numbers, 'bonus': bonus}


def _parse_html_lotto(text, round_no):
    """네이버/다음 등 검색 결과 HTML에서 로또 번호와 볼너스를 추출"""
    # 1. 네이버 스타일: <span class="ball typeX">N</span>
    balls = re.findall(r'<span[^>]*class="ball[^"]*"[^>]*>(\d+)</span>', text)
    if len(balls) >= 7:
        try:
            nums = [int(b) for b in balls[:6]]
            bonus = int(balls[6])
            if all(1 <= n <= 45 for n in nums) and len(set(nums)) == 6:
                if 1 <= bonus <= 45 and bonus not in nums:
                    return {'round': round_no, 'numbers': sorted(nums), 'bonus': bonus}
                return {'round': round_no, 'numbers': sorted(nums), 'bonus': None}
        except ValueError:
            pass

    # 2. 별도 bonus_number 영역이 있는 경우 (네이버)
    bonus_m = re.search(r'<div[^>]*class="bonus_number"[^>]*>.*?<span[^>]*class="ball[^"]*"[^>]*>(\d+)</span>', text, re.DOTALL)
    bonus = int(bonus_m.group(1)) if bonus_m else None

    # 3. 텍스트 기반 범용 파싱
    clean = re.sub(r'<[^>]+>', ' ', text)
    clean = re.sub(r'&\w+;', ' ', clean)
    clean = re.sub(r'\s+', ' ', clean)
    clean = clean.replace('\u2018', "'").replace('\u2019', "'")

    m = re.search(r'(\d{1,2})\s*[,，]\s*(\d{1,2})\s*[,，]\s*(\d{1,2})\s*[,，]\s*(\d{1,2})\s*[,，]\s*(\d{1,2})\s*[,，]\s*(\d{1,2})', clean)
    if not m:
        return None
    nums = [int(m.group(i)) for i in range(1, 7)]
    if not all(1 <= n <= 45 for n in nums) or len(set(nums)) != 6:
        return None

    # 볼너스가 아직 없으면 텍스트에서 추가 검색
    if bonus is None or not (1 <= bonus <= 45) or bonus in nums:
        after = clean[m.end():m.end() + 600]
        candidates = []
        for pattern in [
            r'번\s*\+\s*(\d{1,2})\s*번',
            r'볼너스\s*[:：]?\s*\'"?(\d{1,2})\'"?',
            r'bonus\s*[:：]?\s*\'"?(\d{1,2})\'"?',
            r'plus\s*[:：]?\s*\'"?(\d{1,2})\'"?',
            r'추가\s*번호?\s*[:：]?\s*\'"?(\d{1,2})\'"?',
            r'bnus\s*No\s*[:：]?\s*\'"?(\d{1,2})\'"?',
            r'추가\s*[:：]?\s*\'"?(\d{1,2})\'"?',
            r'\+\s*(\d{1,2})\s*번',
        ]:
            bm = re.search(pattern, after, re.IGNORECASE)
            if bm:
                candidates.append(int(bm.group(1)))
        # 전체 텍스트에서도 한 번 더
        for pattern in [
            r'볼너스\s*[:：]?\s*\'"?(\d{1,2})\'"?',
            r'bonus\s*[:：]?\s*\'"?(\d{1,2})\'"?',
            r'bnus\s*No\s*[:：]?\s*\'"?(\d{1,2})\'"?',
        ]:
            bm = re.search(pattern, clean, re.IGNORECASE)
            if bm:
                candidates.append(int(bm.group(1)))
        for bn in candidates:
            if 1 <= bn <= 45 and bn not in nums:
                bonus = bn
                break

    return {'round': round_no, 'numbers': sorted(nums), 'bonus': bonus}


def extract_from_naver(round_no):
    """네이버 검색"""
    url = f'https://search.naver.com/search.naver?where=nexearch&query={round_no}%ED%9A%8C%20%EB%A1%9C%EB%98%90%20%EB%8B%B9%EC%B2%A8%EB%B2%88%ED%98%B8'
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as f:
            text = f.read().decode('utf-8', errors='replace')
    except Exception:
        return None
    return _parse_html_lotto(text, round_no)


def extract_from_daum(round_no):
    """다음(카카오) 검색"""
    url = f'https://search.daum.net/search?w=tot&q={round_no}%ED%9A%8C%EB%A1%9C%EB%98%90'
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9',
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as f:
            text = f.read().decode('utf-8', errors='replace')
    except Exception:
        return None
    return _parse_html_lotto(text, round_no)


def fetch_round(round_no):
    """여러 소스에서 순차적으로 시도, 보너스 누락 시 보충, 번호 일치 여부로 검증"""
    sources = []

    # 1순위: 동행복권 공식 API
    api = fetch_from_dhlottery(round_no)
    if api:
        sources.append(api)
        if api['bonus'] is not None:
            return api

    # 2순위: 네이버 검색
    naver = extract_from_naver(round_no)
    if naver:
        sources.append(naver)

    # 3순위: 다음 검색
    daum = extract_from_daum(round_no)
    if daum:
        sources.append(daum)

    if not sources:
        return None

    # 당첨번호(numbers)가 일치하는 소스끼리 보너스 보충
    best = sources[0]
    for src in sources[1:]:
        if src['numbers'] == best['numbers']:
            if best['bonus'] is None and src['bonus'] is not None:
                best['bonus'] = src['bonus']
            elif src['bonus'] is not None and best['bonus'] != src['bonus']:
                print(f'  [!] {round_no}회 볼너스 불일치: {best["bonus"]} vs {src["bonus"]}')
        else:
            print(f'  [!] {round_no}회 번호 불일치: {best["numbers"]} vs {src["numbers"]}')

    return best


# 최신 회차 동적 계산
from datetime import datetime, timedelta, timezone
first_draw = datetime(2002, 12, 7, 21, 0, 0)  # KST
now = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=9)))   # KST
dow = now.weekday()  # 0=월, 6=일
hours = now.hour
if dow == 5 and hours >= 21:  # 토요일 21시 이후
    last_draw = now.replace(hour=21, minute=0, second=0, microsecond=0)
else:
    days_since_sat = (dow + 2) % 7
    if days_since_sat == 0:
        days_since_sat = 7
    last_draw = now - timedelta(days=days_since_sat)
    last_draw = last_draw.replace(hour=21, minute=0, second=0, microsecond=0)
latest_round = int((last_draw - first_draw).days / 7) + 1

# Load existing data
existing = []
try:
    with open('latest.json', 'r', encoding='utf-8') as f:
        existing = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    pass
existing_map = {r['round']: r for r in existing}

# 누락 회차 + 보너스 번호가 null인 최신 10개 회차도 재검증
missing = [i for i in range(1, latest_round + 1) if i not in existing_map]
reverify = [r['round'] for r in existing[-10:] if r.get('bonus') is None and r['round'] not in missing]
if reverify:
    print(f'보너스 누락 재검증: {len(reverify)}개 ({reverify})\n')

tasks = missing + reverify
tasks.sort()

print(f'누락: {len(missing)}개')
print(f'예상 시간: 약 {len(tasks) * 0.6 / 60:.1f}분\n')

results = list(existing)
results_map = {r['round']: i for i, r in enumerate(results)}
added = 0
updated = 0
failed = 0
consecutive_fails = 0

for idx, round_no in enumerate(tasks):
    data = fetch_round(round_no)
    if data:
        if round_no in results_map:
            old = results[results_map[round_no]]
            changed = False
            if old.get('bonus') is None and data.get('bonus') is not None:
                old['bonus'] = data['bonus']
                changed = True
            if old['numbers'] != data['numbers']:
                old['numbers'] = data['numbers']
                changed = True
            if changed:
                updated += 1
                print(f'  [>] {round_no}회 업데이트됨')
        else:
            results.append(data)
            results_map[round_no] = len(results) - 1
            added += 1
        consecutive_fails = 0
    else:
        failed += 1
        consecutive_fails += 1
        if consecutive_fails > 10:
            print(f'\n[!] 연속 실패 {consecutive_fails}회 - 60초 대기...')
            time.sleep(60)
            consecutive_fails = 0

    if idx % 100 == 99 or idx == len(tasks) - 1:
        pct = (idx + 1) / len(tasks) * 100
        print(f'\r진행: {pct:.1f}% ({idx + 1}/{len(tasks)}) | 추가: {added} | 업데이트: {updated} | 실패: {failed}', end='')
        sys.stdout.flush()

    # 완전한 데이터(API+보너스)면 짧게, 검색엔진 폴백이면 기존 딜레이
    if data and data.get('bonus') is not None:
        time.sleep(0.15 + random.random() * 0.1)
    else:
        time.sleep(0.4 + random.random() * 0.2)

results.sort(key=lambda x: x['round'])
with open('latest.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False)

print(f'\n\n완료! 총 {len(results)}개 회차 저장됨 (추가 {added}, 업데이트 {updated}, 실패 {failed})')
