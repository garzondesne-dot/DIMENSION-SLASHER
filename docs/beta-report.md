# 결과 보내기 설정 (베타 테스트)

학생이 [📨 결과 보내기]를 누르면 플레이 기록과 설문이 선생님의 구글 시트에 한 줄씩 쌓인다. 게임에는 서버가 없으므로 구글 Apps Script 웹 앱을 받는 곳으로 쓴다.

## 1. 구글 시트 준비 (약 5분)

1. 구글 시트를 새로 만든다 (예: 디멘션 슬래셔 베타 결과).
2. **확장 프로그램 → Apps Script**에서 기존 코드를 지우고 아래 코드를 붙여 넣은 뒤 저장한다.
3. **배포 → 새 배포 → 유형 선택: 웹 앱**
   - 다음 사용자 인증 정보로 실행: **나**
   - 액세스 권한이 있는 사용자: **모든 사용자**
4. 배포 → 권한 승인. "확인되지 않은 앱" 경고가 나오면 **고급 → (프로젝트 이름)(으)로 이동**.
5. 나오는 **웹 앱 URL**(`https://script.google.com/macros/s/…/exec`)을 `js/data.js`의 `DS.REPORT_URL`에 넣는다.

```js
function doPost(e) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const d = JSON.parse(e.postData.contents);
  if (sh.getLastRow() === 0) sh.appendRow(Object.keys(d));
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.appendRow(head.map((k) => (d[k] === undefined ? '' : d[k])));
  return ContentService.createTextOutput('ok');
}
```

첫 전송 때 1행에 열 이름이 자동으로 만들어진다: 전송시각, 학년, 반, 번호, 버전, 모드, 최고도달, 해결몬스터, 되감기, 푼문제, 정답, 정답률, 해결단계, 맞지않는도구, 긴급연성, 연성성공, 연성실패, 조합법열람, 플레이분, 재미, 수학느낌, 한줄평.

## 2. 유의 사항

- 받는 개인정보는 학년·반·번호뿐이다. 이름은 받지 않는다.
- 웹 앱 주소가 들어간 파일을 가진 사람은 누구나 시트에 기록을 보낼 수 있다. 베타 테스트가 끝나면 Apps Script에서 배포를 보관 처리(중지)한다.
- 학교 방화벽이 `script.google.com`을 막으면 전송이 실패한다. 이때 학생 화면에 결과 코드가 나오므로 사진이나 복사로 받는다. 수업 전에 학교 PC에서 한 번 시험 전송해 볼 것.
- 응답을 읽을 수 없는 방식(no-cors)으로 보내므로, 게임은 네트워크 오류만 실패로 판단한다. 주소가 틀려도 "전송했어요"가 나올 수 있으니 첫 시험 전송 후 시트에 줄이 생겼는지 확인한다.
