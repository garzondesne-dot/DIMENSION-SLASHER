// DIMENSION SLASHER — Apps Script 배포 (구글 시트에 연결된 스크립트)
//  - doGet: 학생이 웹 앱 주소로 들어오면 게임을 보여 준다
//      게임 파일은 구글 드라이브에서 찾는다: 이름에 GAME_FILE 이 들어간 HTML 중 가장 최근에 올린 것
//      → 새 버전은 드라이브에 같은 이름으로 올리기만 하면 된다 (재배포 필요 없음, 폰에서도 가능)
//      드라이브에 없으면 이 프로젝트의 game.html (붙여 넣기 방식)을 쓴다
//  - saveResult: 게임 안의 [결과 보내기]가 호출 → '결과' 시트에 한 줄 추가
//  - doPost: 파일로 연 게임(DS.REPORT_URL)에서 보내는 결과도 같은 시트에 받는다
// 자세한 설정 순서: docs/deploy-apps-script.md

// 드라이브의 게임 파일 이름 (일부만 맞아도 됨). 파일 링크나 ID를 넣으면 그 파일만 쓴다.
const GAME_FILE = 'dimension-slasher-game';
const SHEET_NAME = '결과';

function doGet() {
  const html = loadGameHtml_();
  const out = html ? HtmlService.createHtmlOutput(html) : HtmlService.createHtmlOutput(setupHelp_());
  return out
    .setTitle('DIMENSION SLASHER')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover'); // 폰 화면 맞춤
}

function loadGameHtml_() {
  const id = String(GAME_FILE).match(/[-\w]{25,}/); // 링크나 ID를 넣은 경우
  if (id) return readHtml_(DriveApp.getFileById(id[0]));
  let best = null;
  const it = DriveApp.searchFiles("title contains '" + GAME_FILE.replace(/'/g, "\\'") + "' and trashed = false");
  while (it.hasNext()) {
    const f = it.next();
    if (!/\.html?$/i.test(f.getName()) && f.getMimeType() !== 'text/html') continue;
    if (!best || f.getLastUpdated() > best.getLastUpdated()) best = f;
  }
  if (best) return readHtml_(best);
  try {
    return HtmlService.createHtmlOutputFromFile('game').getContent();
  } catch (e) {
    return null;
  }
}

function readHtml_(file) {
  if (/^application\/vnd\.google-apps/.test(file.getMimeType())) {
    throw new Error('게임 파일이 구글 문서로 바뀌어 올라갔어요. HTML 파일 그대로 다시 올려 주세요: ' + file.getName());
  }
  return file.getBlob().getDataAsString('UTF-8');
}

function setupHelp_() {
  return '<div style="font-family:sans-serif;padding:24px;line-height:1.7">'
    + '<h2>게임 파일을 찾지 못했어요</h2>'
    + '<p>구글 드라이브에 <b>' + GAME_FILE + '</b> 이(가) 들어간 이름의 HTML 파일을 올려 주세요.</p>'
    + '<p>올린 뒤 이 페이지를 새로고침하면 게임이 열립니다.</p>'
    + '<p style="color:#666">파일이 구글 문서로 바뀌어 올라갔다면(PC 드라이브의 "업로드 파일 변환" 설정) 그 설정을 끄고 다시 올려 주세요.</p></div>';
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
