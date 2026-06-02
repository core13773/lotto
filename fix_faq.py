with open('faq.html','r',encoding='utf-8') as f:
    content = f.read()

old = '''    <div class="card">
        <h2>함께 볼 수 있는 글</h2>
        <ul>
            <li><a href="guide.html" style="color:var(--accent-cyan);">로또 완전정복 가이드</a> — FAQ에서 다룬 내용을 더 깊이 있게</li>
            <li><a href="strategy.html" style="color:var(--accent-cyan);">로또 번호 선택 전략</a> — FAQ로 기본을 익혔다면 전략으로 한 걸음 더</li>
            <li><a href="terms.html" style="color:var(--accent-cyan);">로또 용어 사전</a> — FAQ에서 접한 용어들의 상세 해설</li>
        </ul>
    </div>'''
new = '''    <div class="card">
        <h2>번호 선택 및 전략 관련</h2>

        <details>
            <summary>Q17. 생일 번호(1~31)만 선택하면 안 되나요?</summary>
            <div class="answer">생일 번호만 선택해도 당첨 확률은 동일합니다. 하지만 1등에 당첨되었을 때 <strong>당첨자가 많아져 1인당 상금이 줄어드는 단점</strong>이 있습니다. 많은 사람들이 생일 번호를 선택하기 때문에, 1~31 범위의 낮은 번호가 집중 출현하면 당첨자가 20명 이상 나오는 경우도 있습니다. 고번호(32~45)를 1~2개 포함하면 상대적으로 당첨자가 적어 상금을 더 많이 받을 가능성이 있습니다.</div>
        </details>

        <details>
            <summary>Q18. 같은 번호를 매주 사면 당첨 확률이 높아지나요?</summary>
            <div class="answer">아니요. 로또는 <strong>매 회차 완전히 독립적인 확률 게임</strong>입니다. 매주 같은 번호를 사든, 매번 다른 번호를 사든, 10년 동안 사든 1주일만 사든 1등 당첨 확률은 정확히 1/8,145,060으로 동일합니다. 과거에 어떤 번호를 샀는지가 미래 당첨 확률에 전혀 영향을 주지 않습니다.</div>
        </details>

        <details>
            <summary>Q19. 사설 로또 분석 프로그램은 믿을 수 있나요?</summary>
            <div class="answer"><strong>절대 믿지 마세요.</strong> 로또 당첨 번호를 확실하게 예측할 수 있는 프로그램은 존재할 수 없습니다. 사설 분석 프로그램은 대부분 과거 데이터의 단순한 통계를 보여주며, 이는 이미 여러 사이트에서 무료로 제공하는 정보와 동일합니다. 유료로 판매되는 "당첨 예측 프로그램"은 모두 사기일 가능성이 높습니다.</div>
        </details>

        <details>
            <summary>Q20. 로또 1등 당첨금은 어떻게 결정되나요?</summary>
            <div class="answer">1등 당첨금은 <strong>해당 회차 총 판매액의 50%</strong>를 당첨금 풀로 적립한 후, 4등(50,000원)과 5등(5,000원) 고정 당첨금을 제외한 나머지 금액의 75%를 1등 당첨자들이 균등 분할합니다. 따라서 판매액이 많고 1등 당첨자가 적을수록 1인당 당첨금이 커집니다. 1등이 여러 주 연속 나오지 않으면 당첨금이 이월되어 다음 회차에서 더 큰 당첨금이 형성됩니다.</div>
        </details>
    </div>

    <div class="card">
        <h2>함께 볼 수 있는 글</h2>
        <ul>
            <li><a href="guide.html" style="color:var(--accent-cyan);">로또 완전정복 가이드</a> — FAQ에서 다룬 내용을 더 깊이 있게</li>
            <li><a href="strategy.html" style="color:var(--accent-cyan);">로또 번호 선택 전략</a> — FAQ로 기본을 익혔다면 전략으로 한 걸음 더</li>
            <li><a href="terms.html" style="color:var(--accent-cyan);">로또 용어 사전</a> — FAQ에서 접한 용어들의 상세 해설</li>
        </ul>
    </div>'''
content = content.replace(old, new)

with open('faq.html','w',encoding='utf-8') as f:
    f.write(content)

print('faq.html updated successfully')
