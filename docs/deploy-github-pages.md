# GitHub Pages 배포 + 앱 설치 (PWA)

게임을 `https://garzondesne-dot.github.io/DIMENSION-SLASHER/` 주소로 열고, 크롬에서 **앱으로 설치**해 쓰는 방법.
설치한 앱은 인터넷이 없어도 열리고(오프라인 저장), [📨 결과 보내기]는 Apps Script 웹 앱 주소(`js/data.js`의 `DS.REPORT_URL`)로 결과를 보낸다.

## 1. 저장소 공개 여부

- GitHub **무료 계정**은 **공개(public) 저장소**에서만 Pages를 켤 수 있다 (비공개 저장소는 GitHub Pro 이상).
- 공개하면 게임 코드와 문서(기획·결정 기록)가 모두에게 보인다. 교과서 PDF는 저장소에 없다.
- `DS.REPORT_URL`(결과를 받는 Apps Script 주소)도 보이므로, 누구나 시트에 기록을 보낼 수 있다. 장난 기록이 많아지면 Apps Script에서 **새 배포**로 주소를 바꾸고 `DS.REPORT_URL`을 고친다.
- 공개 전환: 저장소 **Settings → General → 맨 아래 Danger Zone → Change repository visibility → Public**

## 2. Pages 켜기

1. 저장소 **Settings → Pages**
2. **Build and deployment → Source: Deploy from a branch**
3. **Branch**: 게임이 올라간 브랜치(지금은 `ccr-8f591712-uymct4`) / **(root)** → **Save**
4. 1~2분 뒤 위쪽에 주소가 뜬다: `https://garzondesne-dot.github.io/DIMENSION-SLASHER/`
- 나중에 기본 브랜치(main)로 합치면 Branch를 main으로 바꾼다.

## 3. 앱 설치

| 기기 | 방법 |
|---|---|
| 안드로이드 크롬 | 주소를 열고 타이틀의 **📲 앱으로 설치** 또는 크롬 메뉴 ⋮ → **앱 설치 / 홈 화면에 추가** |
| PC 크롬·엣지 | 주소창 오른쪽의 **설치 아이콘** 또는 타이틀의 **📲 앱으로 설치** |
| 아이폰·아이패드 (사파리) | 공유 버튼 → **홈 화면에 추가** (설치 버튼은 나오지 않음) |

- 설치하면 브라우저 주소창 없이 전체 화면 앱으로 열린다.
- 한 번 열어 두면 인터넷이 없어도 실행된다. 이때 결과 보내기는 실패 안내와 결과 코드가 나온다.

## 4. 새 버전 올리기

- 브랜치에 푸시하면 Pages가 자동으로 다시 배포한다 (1~2분).
- 앱은 인터넷이 될 때 최신 파일을 먼저 받는다(네트워크 우선). 새 버전을 낼 때 `sw.js`의 `CACHE` 이름을 `DS.VERSION`과 맞춘다 (`tests/game.test.js`가 확인).

## 5. 결과 보내기 확인

- 결과는 기존 Apps Script 웹 앱(`Code.gs`의 `doPost`)으로 들어가 결과 시트의 '결과' 탭에 쌓인다. 설정은 [deploy-apps-script.md](deploy-apps-script.md).
- 이 방식은 응답을 읽을 수 없어서(no-cors) 인터넷이 끊긴 경우만 실패로 표시한다. 처음 한 번은 시트에 실제로 줄이 생겼는지 확인한다.
