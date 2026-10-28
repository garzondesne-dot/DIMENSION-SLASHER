// DIMENSION SLASHER — Apps Script 배포 (구글 시트에 연결된 스크립트)
//  - doGet: 학생이 웹 앱 주소로 들어오면 게임을 보여 준다
//      NEW_URL 이 있으면 게임 대신 "새 주소로 이동" 안내를 보여 준다 (게임은 GitHub Pages 한 곳에서만 관리)
//      게임 파일은 구글 드라이브에서 찾는다: 이름에 GAME_FILE 이 들어간 HTML 중 가장 최근에 올린 것
//      → 새 버전은 드라이브에 같은 이름으로 올리기만 하면 된다 (재배포 필요 없음, 폰에서도 가능)
//      드라이브에 없으면 이 프로젝트의 game.html (붙여 넣기 방식)을 쓴다
//  - saveResult: 게임 안의 [결과 보내기]가 호출 → 결과 시트의 '결과' 탭에 한 줄 추가
//      결과 시트: RESULT_SHEET 에 넣은 시트, 비어 있으면 이 스크립트가 붙어 있는 시트(확장 프로그램으로 만든 경우)
//  - doPost: 파일로 연 게임(DS.REPORT_URL)에서 보내는 결과도 같은 시트에 받는다
// 자세한 설정 순서: docs/deploy-apps-script.md

// 드라이브의 게임 파일 이름 (일부만 맞아도 됨). 파일 링크나 ID를 넣으면 그 파일만 쓴다.
const GAME_FILE = 'dimension-slasher-game';
// 결과를 받을 구글 시트의 링크나 ID. 시트의 [확장 프로그램 → Apps Script]로 만든 스크립트면 비워 둬도 된다.
const RESULT_SHEET = '';
const SHEET_NAME = '결과';
// 게임의 새 주소 (GitHub Pages). 비우면 예전처럼 드라이브의 게임 파일을 보여 준다.
const NEW_URL = 'https://garzondesne-dot.github.io/DIMENSION-SLASHER/';

function doGet() {
  if (NEW_URL) {
    return HtmlService.createHtmlOutput(movedPage_())
      .setTitle('DIMENSION SLASHER')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
  }
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

// 새 주소 안내: Apps Script 화면은 틀(iframe) 안이라, 버튼을 눌러야(target=_top) 바깥 주소로 넘어간다
function movedPage_() {
  return '<div style="font-family:sans-serif;padding:32px 20px;line-height:1.7;text-align:center;background:#0b0a12;color:#ece9f7;min-height:100vh">'
    + '<h2 style="color:#4cc9ff;margin:0 0 6px">DIMENSION SLASHER</h2>'
    + '<p style="margin:0 0 20px">게임이 <b>새 주소</b>로 이사했어요. 아래 버튼을 눌러 주세요.</p>'
    + '<a href="' + NEW_URL + '" target="_top" style="display:inline-block;padding:14px 28px;background:#173a55;border:2px solid #4cc9ff;color:#fff;text-decoration:none;font-size:18px;border-radius:6px">▶ 새 주소에서 게임하기</a>'
    + '<p style="margin-top:20px;font-size:13px;color:#9a95c0">새 주소에서는 크롬 메뉴의 <b>앱 설치</b>로 앱처럼 쓸 수 있어요.<br>'
    + '예전 주소에서 하던 저장은 새 주소로 옮겨지지 않아요.<br>' + NEW_URL + '</p></div>';
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

function resultBook_() {
  const id = String(RESULT_SHEET).match(/[-\w]{25,}/);
  if (id) return SpreadsheetApp.openById(id[0]);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('결과 시트가 연결되지 않았어요. Code.gs 맨 위 RESULT_SHEET 에 시트 링크를 넣어 주세요.');
  return ss;
}

// 1행 = 열 이름(처음 받은 기록의 키 순서). 새 항목이 생기면 오른쪽에 열을 추가한다.
// 반 전체가 동시에 보내도 줄이 섞이지 않게 잠금을 건다.
function appendResult_(d) {
  const ss = resultBook_();
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
