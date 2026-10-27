// DIMENSION SLASHER — Apps Script 배포 (구글 시트에 연결된 스크립트)
//  - doGet: 학생이 웹 앱 주소로 들어오면 게임(game.html)을 보여 준다
//  - saveResult: 게임 안의 [결과 보내기]가 호출 → '결과' 시트에 한 줄 추가
//  - doPost: 파일로 연 게임(DS.REPORT_URL)에서 보내는 결과도 같은 시트에 받는다
// 자세한 설정 순서: docs/deploy-apps-script.md

const SHEET_NAME = '결과';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('game')
    .setTitle('DIMENSION SLASHER')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover'); // 폰 화면 맞춤
}

function saveResult(d) {
  appendResult_(d);
  return 'ok';
}

function doPost(e) {
  appendResult_(JSON.parse(e.postData.contents));
  return ContentService.createTextOutput('ok');
}

// 1행 = 열 이름(처음 받은 기록의 키 순서). 새 항목이 생기면 오른쪽에 열을 추가한다.
// 반 전체가 동시에 보내도 줄이 섞이지 않게 잠금을 건다.
function appendResult_(d) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (sh.getLastRow() === 0) sh.appendRow(Object.keys(d));
    const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const extra = Object.keys(d).filter((k) => head.indexOf(k) < 0);
    if (extra.length) {
      sh.getRange(1, head.length + 1, 1, extra.length).setValues([extra]);
      head.push.apply(head, extra);
    }
    sh.appendRow(head.map((k) => (d[k] === undefined ? '' : d[k])));
  } finally {
    lock.releaseLock();
  }
}
