# DIMENSION-SLASHER

공통수학2 「도형의 방정식」을 카드 덱빌딩 로그라이크로 배우는 교육용 웹 게임. **몬스터 하나가 곧 문제 하나**이고, 대장간에서 벼린 공식 카드로 풀이를 한 단계씩 해내야 쓰러뜨릴 수 있다.

## 실행

빌드가 필요 없습니다. `index.html`을 브라우저로 열면 됩니다. 폰트는 CDN에서 받아 오므로 인터넷 연결이 필요하고, 연결이 없으면 기본 글꼴로 표시됩니다.

- **캠페인 (1~4층):** 캠프(대장간·덱 구성) → 잡몹 → 캠프 → 보스. 문제는 스캔 카드로 조각씩 밝힌다
- **최종보스 체험판:** 교과서 41쪽 11번, 풀이 6단계 · 3페이즈 · 5초 QTE
- **베타 테스트:** 타이틀에서 학년·반·번호를 입력하고 시작. 첫 캠프에서 연성 튜토리얼, 📨 결과 보내기 (설정: [docs/beta-report.md](docs/beta-report.md))
- **웹 배포 + 앱 설치:** GitHub Pages에서 열고 크롬에서 앱으로 설치 (오프라인 실행) — [docs/deploy-github-pages.md](docs/deploy-github-pages.md)
- **결과 수집:** 구글 시트 + Apps Script 웹 앱(예전 주소는 새 주소 안내만 보여 줌) — [docs/deploy-apps-script.md](docs/deploy-apps-script.md)
- **🧪 v1.0 테스트판 (`v1/`):** Ⅰ·Ⅱ·Ⅲ 전 단원 10층, 갈림길·보물상자·유물·조준·숄더뷰·치트 모드 — https://garzondesne-dot.github.io/DIMENSION-SLASHER/v1/ · [docs/v1-test.md](docs/v1-test.md) (테스트: `node v1/tests/mathgen.test.js`, `node v1/tests/game.test.js`)
- **🧩 번외편 「포함의 결계」 (`sets/`):** 집합 사이의 포함 관계 50분 수업용 (11/3 공개수업) — https://garzondesne-dot.github.io/DIMENSION-SLASHER/sets/ · 교사용 해금 코드 `sets/teacher.html` · [docs/sets.md](docs/sets.md) (테스트: `node sets/tests/game.test.js`)
- **세이브:** 캠페인은 캠프마다 자동 저장, 타이틀의 [이어하기]로 계속 (같은 PC·같은 브라우저)
- PC: 문제 창에서 숫자 1~4로 선택, Enter로 계속, E로 턴 종료
- 모바일: 터치로 플레이, 대장간 재료와 연산은 끌어다 놓거나 탭해서 배치

## 테스트

```bash
node tests/mathgen.test.js   # 문제 생성기 정답 검증
node tests/game.test.js      # 연성 규칙, 카드 수치·덱 규칙, 몬스터 문제, 보스 정답 독립 검산, 세이브 왕복
```

## 문서

- 기획과 구현 현황: [docs/HANDOVER.md](docs/HANDOVER.md)
- 결정 목록 (확정·보류·폐기와 이유): [docs/DECISIONS.md](docs/DECISIONS.md)
- 폰트: [Galmuri](https://github.com/quiple/galmuri) (SIL OFL 1.1)
