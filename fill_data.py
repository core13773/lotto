import urllib.request
import re
import json
import time
import sys
import random

def fetch_round(round_no):
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

    text = re.sub('<[^>]+>', ' ', text)
    text = text.replace('&nbsp;', ' ').replace('&gt;', '>').replace('&lt;', '<')
    m = re.search(r'(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})', text)
    if not m:
        return None
    nums = [int(m.group(i)) for i in range(1, 7)]
    if not all(1 <= n <= 45 for n in nums) or len(set(nums)) != 6:
        return None

    bonus = None
    after = text[m.end():m.end() + 200]
    bm = re.search(r'보너스[^0-9]*(\d{1,2})', after)
    if bm:
        bn = int(bm.group(1))
        if 1 <= bn <= 45 and bn not in nums:
            bonus = bn
    return {'round': round_no, 'numbers': sorted(nums), 'bonus': bonus}

# Load existing data
with open('latest.json', 'r') as f:
    existing = json.load(f)
existing_map = {r['round']: r for r in existing}

missing = [i for i in range(1, 1224) if i not in existing_map]
print(f'누락: {len(missing)}개')
print(f'예상 시간: 약 {len(missing) * 0.6 / 60:.1f}분\n')

results = list(existing)
added = 0
failed = 0
consecutive_fails = 0

for idx, round_no in enumerate(missing):
    data = fetch_round(round_no)
    if data:
        results.append(data)
        added += 1
        consecutive_fails = 0
    else:
        failed += 1
        consecutive_fails += 1
        if consecutive_fails > 30:
            print(f'\n⚠️ 연속 실패 {consecutive_fails}회 - 60초 대기...')
            time.sleep(60)
            consecutive_fails = 0

    if idx % 100 == 99 or idx == len(missing) - 1:
        pct = (idx + 1) / len(missing) * 100
        print(f'\r진행: {pct:.1f}% ({idx + 1}/{len(missing)}) | 추가: {added} | 실패: {failed}', end='')
        sys.stdout.flush()

    # 0.4-0.6s random delay
    time.sleep(0.4 + random.random() * 0.2)

results.sort(key=lambda x: x['round'])
with open('latest.json', 'w') as f:
    json.dump(results, f, ensure_ascii=False)

print(f'\n\n완료! 총 {len(results)}개 회차 저장됨')
