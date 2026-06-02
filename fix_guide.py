with open('guide.html','r',encoding='utf-8') as f:
    content = f.read()

old = '''    <div class="card">
        <h2>함께 볼 수 있는 글</h2>
        <ul>
            <li><a href="strategy.html" style="color:var(--accent-cyan);">로또 번호 선택 전략</a> — 자동 vs 수동, 통계 기반 접근법, 구매 심리학</li>
            <li><a href="terms.html" style="color:var(--accent-cyan);">로또 용어 사전</a> — 50여 개 핵심 용어를 카테고리별로 완벽 정리</li>
            <li><a href="faq.html" style="color:var(--accent-cyan);">자주 묻는 질문 (FAQ)</a> — 구매·당첨·세금 관련 16가지 질문과 답변</li>
        </ul>
    </div>'''
new = '''    <div class="card">
        <h2>8. 로또의 역사와 변천</h2>
        <p>로또 6/45는 2002년 12월 7일 제1회 추첨을 시작으로 현재까지 이어지고 있습니다. 첫 회차의 1등 당첨금은 약 20억 원이었으며, 초기에는 온라인 구매가 없었고 전국 복권방과 편의점에서만 구매할 수 있었습니다.</p>
        <h3>주요 변천 사항</h3>
        <ul>
            <li><strong>2002년:</strong> 로또 6/45 도입, 1회차 추첨 시작</li>
            <li><strong>2004년:</strong> 온라인 구매 시범 도입, 이후 정식 서비스로 확대</li>
            <li><strong>2011년:</strong> 1인당 온라인 구매 한도 도입(1회 5,000원)</li>
            <li><strong>2015년:</strong> 모바일 앱 출시, QR코드 당첨 확인 도입</li>
            <li><strong>2020년:</strong> 코로나19 팬데믹으로 온라인 구매 비중 급증</li>
        </ul>
        <p>현재 로또는 연간 약 5조 원 이상의 판매액을 기록하며, 복권기금을 통해 저소득층 주거 안정, 문화예술 진흥, 장학 사업 등 다양한 공익 목적에 사용되고 있습니다.</p>
    </div>

    <div class="card">
        <h2>9. 온라인 vs 오프라인 구매 상세 비교</h2>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr><th>구분</th><th>오프라인(판매점)</th><th>온라인(동행복권)</th></tr>
                </thead>
                <tbody>
                    <tr><td>구매 방법</td><td>용지 마킹 또는 자동 선택</td><td>웹/앱에서 번호 선택 또는 자동</td></tr>
                    <tr><td>결제 수단</td><td>현금 또는 카드</td><td>본인 명의 계좌 이체</td></tr>
                    <tr><td>1회 구매 한도</td><td>제한 없음</td><td>최대 5,000원(5게임)</td></tr>
                    <tr><td>당첨 확인</td><td>판매점 방문 또는 QR 스캔</td><td>앱 푸시 알림, 자동 입금(5등)</td></tr>
                    <tr><td>당첨금 수령</td><td>판매점 또는 은행 방문</td><td>5등은 자동 입금, 그 외는 동일</td></tr>
                    <tr><td>티켓 분실 위험</td><td>높음(실물 티켓)</td><td>없음(온라인 기록)</td></tr>
                </tbody>
            </table>
        </div>
        <div class="highlight-box info">
            <strong>팁:</strong> 5등(5,000원) 당첨은 온라인 구매 시 추첨 다음 날 자동으로 입금됩니다. 오프라인은 판매점 방문이 필요합니다.
        </div>
    </div>

    <div class="card">
        <h2>10. 로또 구매 시 주의사항 및 사기 예방</h2>
        <h3>불법 사설 로또 사이트 주의</h3>
        <p>동행복권 공식 웹사이트(dhlottery.co.kr)와 모바일 앱을 제외한 모든 온라인 로또 판매는 불법입니다. 사설 사이트는 당첨금을 지급하지 않거나 개인정보를 유출하는 위험이 높습니다.</p>
        <h3>구매 시 체크리스트</h3>
        <ul>
            <li>✅ 구매처가 동행복권 공식 판매점인지 확인</li>
            <li>✅ 온라인 구매 시 dhlottery.co.kr 도메인인지 확인</li>
            <li>✅ 티켓 구매 후 즉시 번호와 추첨일 확인</li>
            <li>✅ 고액 당첨 시 신분증과 티켓을 안전하게 보관</li>
        </ul>
        <h3>당첨금 수령 실전 팁</h3>
        <p>1~3등 당첨금은 농협은행 본점(서울 중구)에서만 수령 가능합니다. 방문 전 전화 예약을 하면 대기 시간을 줄일 수 있으며, 신분증 외에도 당첨 티켓을 반드시 지참해야 합니다. 당첨금 지급 기한은 추첨일 다음 날부터 <strong>1년</strong>이므로 기한 내에 반드시 수령하세요.</p>
    </div>

    <div class="card">
        <h2>함께 볼 수 있는 글</h2>
        <ul>
            <li><a href="strategy.html" style="color:var(--accent-cyan);">로또 번호 선택 전략</a> — 자동 vs 수동, 통계 기반 접근법, 구매 심리학</li>
            <li><a href="terms.html" style="color:var(--accent-cyan);">로또 용어 사전</a> — 50여 개 핵심 용어를 카테고리별로 완벽 정리</li>
            <li><a href="faq.html" style="color:var(--accent-cyan);">자주 묻는 질문 (FAQ)</a> — 구매·당첨·세금 관련 16가지 질문과 답변</li>
        </ul>
    </div>'''
content = content.replace(old, new)

with open('guide.html','w',encoding='utf-8') as f:
    f.write(content)

print('guide.html updated successfully')
