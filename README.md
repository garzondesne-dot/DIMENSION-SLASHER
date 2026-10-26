# DIMENSION-SLASHER

공통수학2 「도형의 방정식」을 카드 덱빌딩 로그라이크로 배우는 교육용 웹 게임.

## 실행

빌드가 필요 없습니다. `index.html`을 브라우저로 열면 됩니다. 폰트는 CDN에서 받아 오므로 인터넷 연결이 필요하고, 연결이 없으면 기본 글꼴로 표시됩니다.

- PC: 문제 창에서 숫자 1~4로 선택, Enter로 계속, E로 턴 종료
- 모바일: 터치로 플레이, 대장간 부품은 끌어다 놓거나 탭해서 배치

## 테스트

```bash
node tests/mathgen.test.js   # 문제 생성기 7종 × 3000회 정답 검증
```

## 문서

- 기획 인수인계서와 구현 현황: [docs/HANDOVER.md](docs/HANDOVER.md)
- 폰트: [Galmuri](https://github.com/quiple/galmuri) (SIL OFL 1.1)
