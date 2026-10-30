// DIMENSION SLASHER — Apps Script 배포 (구글 시트에 연결된 스크립트)
//  - doGet: 학생이 웹 앱 주소로 들어오면 게임을 보여 준다
//      NEW_URL 이 있으면 게임 대신 "새 주소로 이동" 안내를 보여 준다 (게임은 GitHub Pages 한 곳에서만 관리)
//      게임 파일은 구글 드라이브에서 찾는다: 이름에 GAME_FILE 이 들어간 HTML 중 가장 최근에 올린 것
//      → 새 버전은 드라이브에 같은 이름으로 올리기만 하면 된다 (재배포 필요 없음, 폰에서도 가능)
//      드라이브에 없으면 이 프로젝트의 game.html (붙여 넣기 방식)을 쓴다
//  - saveResult: 게임 안의 [결과 보내기]가 호출 → 결과 시트의 '결과' 탭에 한 줄 추가
//      결과 시트: RESULT_SHEET 에 넣은 시트, 비어 있으면 이 스크립트가 붙어 있는 시트(확장 프로그램으로 만든 경우)
//  - doPost: 파일로 연 게임(DS.REPORT_URL)에서 보내는 결과도 같은 시트에 받는다
//      kind: 'track' 이면 번외편 실시간 진행 기록 → '진행' 탭 (_tab 이 있으면 그 탭에 결과)
//  - doGet ?mode=… : 번외편 현황 페이지(GitHub Pages)가 읽는 자료 창구 (JSONP)
//      mode=ping  → 연결 확인 (학생 게임이 이걸로 전송을 켬)
//      mode=track → 진행 기록 (TEACHER_KEY 가 맞아야 함)
//    화면·집계는 모두 GitHub Pages 쪽(sets/dashboard.html)에 있어서, 이 파일은 한 번 붙여 넣고 배포하면 다시 고칠 일이 없다
// 자세한 설정 순서: docs/deploy-apps-script.md, 번외편 현황: docs/sets-dashboard.md

// 드라이브의 게임 파일 이름 (일부만 맞아도 됨). 파일 링크나 ID를 넣으면 그 파일만 쓴다.
const GAME_FILE = 'dimension-slasher-game';
// 결과를 받을 구글 시트의 링크나 ID. 시트의 [확장 프로그램 → Apps Script]로 만든 스크립트면 비워 둬도 된다.
const RESULT_SHEET = '';
const SHEET_NAME = '결과';
// 게임의 새 주소 (GitHub Pages). 비우면 예전처럼 드라이브의 게임 파일을 보여 준다.
const NEW_URL = 'https://garzondesne-dot.github.io/DIMENSION-SLASHER/';
// 번외편 현황 페이지 비밀번호 (선생님이 정함. 저장소에는 비워 둔다)
const TEACHER_KEY = '';
const TRACK_SHEET = '진행';
const TRACK_HEAD = ['시각', 't', '학년', '반', '번호', '기기', '사건', '몬스터', '노드', '정답', '카드', '자물쇠', '문제풀이', '버전'];
const API_VER = 2;

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.mode) return api_(p);
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
  const d = JSON.parse(e.postData.contents);
  if (d && d.kind === 'track') appendTrack_(d);
  else appendResult_(d);
  return ContentService.createTextOutput('ok');
}

// 현황 페이지·학생 게임이 읽는 창구. callback 이 있으면 JSONP (다른 주소에서도 읽힘)
function api_(p) {
  let out;
  try {
    if (p.mode === 'ping') out = { ok: true, ver: API_VER };
    else if (p.mode === 'track') {
      if (!TEACHER_KEY) out = { ok: false, error: 'nokey' };
      else if (String(p.key || '') !== String(TEACHER_KEY)) out = { ok: false, error: 'key' };
      else out = readTrack_(Number(p.since) || 1);
    } else out = { ok: false, error: 'mode' };
  } catch (err) {
    out = { ok: false, error: String(err) };
  }
  const json = JSON.stringify(out);
  if (p.callback && /^[\w.$]+$/.test(p.callback)) {
    return ContentService.createTextOutput(p.callback + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// 진행 기록: 학생 게임이 몇 초마다 모아서 보낸다 { kind, sid, who: { grade, cls, num }, ver, solve, events: [{ t, at, type, … }] }
function appendTrack_(d) {
  const ss = resultBook_();
  const sh = ss.getSheetByName(TRACK_SHEET) || ss.insertSheet(TRACK_SHEET);
  const w = d.who || {};
  const rows = (d.events || []).slice(0, 200).map(function (ev) {
    return [ev.at || '', ev.t || '', w.grade || '', w.cls || '', w.num || '', d.sid || '', ev.type || '', ev.monster || '',
      ev.node == null ? '' : ev.node, ev.ok == null ? '' : (ev.ok ? 1 : 0), ev.card || '', ev.lock || '', d.solve ? 1 : 0, d.ver || ''];
  });
  if (!rows.length) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (sh.getLastRow() === 0) sh.appendRow(TRACK_HEAD);
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, TRACK_HEAD.length).setValues(rows);
  } finally {
    lock.releaseLock();
  }
}

// since 행 다음부터 끝까지 (현황 페이지는 받은 데까지 기억했다가 새 줄만 받는다)
function readTrack_(since) {
  const ss = resultBook_();
  const sh = ss.getSheetByName(TRACK_SHEET);
  if (!sh) return { ok: true, last: 1, rows: [] };
  const last = sh.getLastRow();
  if (last <= since) return { ok: true, last: last, rows: [] };
  const rows = sh.getRange(since + 1, 1, last - since, TRACK_HEAD.length).getValues();
  return { ok: true, last: last, rows: rows };
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
  const tab = d._tab || SHEET_NAME; // 번외편 결과는 따로 ('번외편결과')
  delete d._tab;
  const sh = ss.getSheetByName(tab) || ss.insertSheet(tab);
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
