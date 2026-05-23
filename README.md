# 로또 645 AI 예측 시스템

몬테카를로 시뮬레이션 기반 로또 번호 분석

## GitHub Pages

https://core13773.github.io/lotto 에서 바로 사용 가능합니다.

- 내장 DB(`latest.json`)에서 과거 당첨번호를 빠르게 조회합니다.
- DB에 없는 회차는 **수동 입력** 탭에서 직접 번호를 입력하세요.
- GitHub Actions가 매주 토요일 자동으로 최신 당첨번호를 DB에 추가합니다.

## 로컬 실행

```bash
# 1. 프록시 서버 실행 (선택사항 - 실시간 네이버 검색 조회)
node server.js

# 2. 웹 서버 실행
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000` 접속

로컬에서는 프록시 서버(`server.js`)를 통해 네이버에서 실시간으로 모든 회차를 조회할 수 있습니다.

## 파일
- `index.html` / `style.css` / `script.js` - 프론트엔드
- `worker.js` - Web Worker (몬테카를로 시뮬레이션)
- `server.js` - 로컬 프록시 서버 (네이버 검색)
- `fetch-all.js` - 전체 회차 DB 수집 스크립트
- `latest.json` - 내장 당첨번호 DB
- `sw.js` / `manifest.json` - PWA
