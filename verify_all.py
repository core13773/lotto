import urllib.request
import re
import json
import time
import sys
import random

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass


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


def verify_from_naver(round_no):
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


def verify_from_daum(round_no):
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


# Load data
with open('latest.json', 'r', encoding='utf-8') as f:
    existing = json.load(f)

existing_map = {r['round']: r for r in existing}
total = len(existing)
mismatch_nums = []
mismatch_bonus = []
updated_bonus = []
network_fail = []

print(f'전체 {total}개 회차 검증 시작...\n')

for idx, rec in enumerate(existing):
    round_no = rec['round']
    # 네이버로만 검증 (속도 우선)
    fetched = verify_from_naver(round_no)

    if fetched is None:
        network_fail.append(round_no)
        print(f'  [X] {round_no}회 - 네트워크 실패')
    else:
        if fetched['numbers'] != rec['numbers']:
            mismatch_nums.append({
                'round': round_no,
                'old': rec['numbers'],
                'new': fetched['numbers'],
                'source': 'naver'
            })
            old_nums = rec['numbers']
            rec['numbers'] = fetched['numbers']
            new_nums = fetched.get('numbers')
            print(f'  [!] {round_no}회 번호 불일치 -> 수정: {old_nums} -> {new_nums}')

        if fetched['bonus'] != rec.get('bonus'):
            if rec.get('bonus') is None and fetched['bonus'] is not None:
                updated_bonus.append(round_no)
                rec['bonus'] = fetched['bonus']
                fb = fetched.get('bonus')
                print(f'  [>] {round_no}회 볼너스 보충: {fb}')
            elif fetched['bonus'] is not None:
                mismatch_bonus.append({
                    'round': round_no,
                    'old': rec.get('bonus'),
                    'new': fetched['bonus'],
                    'source': 'naver'
                })
                old_bonus = rec.get('bonus')
                rec['bonus'] = fetched['bonus']
                fb2 = fetched.get('bonus')
                print(f'  [!] {round_no}회 볼너스 불일치 -> 수정: {old_bonus} -> {fb2}')

    if (idx + 1) % 50 == 0 or idx == total - 1:
        pct = (idx + 1) / total * 100
        print(f'\r진행: {pct:.1f}% ({idx + 1}/{total}) | 번호불일치:{len(mismatch_nums)} | 볼너스보충:{len(updated_bonus)} | 볼너스불일치:{len(mismatch_bonus)} | 실패:{len(network_fail)}', end='')
        sys.stdout.flush()

    time.sleep(0.1 + random.random() * 0.05)

print('\n\n--- 검증 완료 ---')
print(f'번호 불일치: {len(mismatch_nums)}개')
for m in mismatch_nums:
    mr = m.get('round'); mo = m.get('old'); mn = m.get('new'); ms = m.get('source')
    print(f'  {mr}회: {mo} -> {mn} ({ms})')

print(f'\n볼너스 보충: {len(updated_bonus)}개')
if updated_bonus:
    print(f'  {updated_bonus}')

print(f'\n볼너스 불일치(수정): {len(mismatch_bonus)}개')
for m in mismatch_bonus:
    mr = m.get('round'); mo = m.get('old'); mn = m.get('new'); ms = m.get('source')
    print(f'  {mr}회: {mo} -> {mn} ({ms})')

print(f'\n네트워크 실패: {len(network_fail)}개')
if network_fail:
    print(f'  {network_fail}')

# Save if any changes
if mismatch_nums or updated_bonus or mismatch_bonus:
    with open('latest.json', 'w', encoding='utf-8') as f:
        json.dump(existing, f, ensure_ascii=False)
    print('\n변경사항 저장 완료!')
else:
    print('\n변경사항 없음.')
