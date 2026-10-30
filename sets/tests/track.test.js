// 실시간 현황 검증: node sets/tests/track.test.js
// (1) Code.gs 를 가짜 스프레드시트로 실행: 진행 기록 받기(doPost) · 읽기(doGet ?mode=track, JSONP) · ping · 비밀번호 · 결과 탭 분리 · 본편 결과는 그대로
// (2) 현황 집계(DS.Dash.aggregate): 공략·대기·뒤처짐·오래 머묾·오답·신호 없음 판정
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let failures = 0;
function check(cond, msg) { if (!cond) { failures++; console.error('FAIL:', msg); } }

// ── 1. Code.gs ─────────────────────────────────────────
function fakeGoogle() {
  const sheets = {};
  const mkSheet = (name) => {
    const data = [];
    return {
      name, data,
      getLastRow: () => data.length,
      getLastColumn: () => (data[0] ? data[0].length : 0),
      appendRow: (r) => data.push(r.slice()),
      getRange: (row, col, nr, nc) => ({
        setValues: (vals) => { vals.forEach((v, k) => { data[row - 1 + k] = v.slice(); }); },
        getValues: () => data.slice(row - 1, row - 1 + nr).map((r) => { const o = r.slice(col - 1, col - 1 + nc); while (o.length < nc) o.push(''); return o; }),
      }),
    };
  };
  const book = { getSheetByName: (n) => sheets[n] || null, insertSheet: (n) => (sheets[n] = mkSheet(n)) };
  return {
    sheets,
    SpreadsheetApp: { openById: () => book, getActiveSpreadsheet: () => book },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: 'json', JAVASCRIPT: 'js' },
      createTextOutput: (t) => ({ text: t, mime: 'text', setMimeType(m) { this.mime = m; return this; } }),
    },
    HtmlService: { createHtmlOutput: (h) => ({ html: h, setTitle() { return this; }, addMetaTag() { return this; } }) },
    DriveApp: {},
  };
}
const src = fs.readFileSync(path.join(__dirname, '../../deploy/apps-script/Code.gs'), 'utf8');
check(/const TEACHER_KEY = '';/.test(src) && /const RESULT_SHEET = '';/.test(src), '저장소 Code.gs 에는 비밀번호·시트 ID 를 넣지 않음');
function loadGs(key) {
  const g = fakeGoogle();
  const ctx = vm.createContext({ ...g, JSON, String, Number, Object });
  vm.runInContext(src.replace("const TEACHER_KEY = '';", `const TEACHER_KEY = '${key}';`).replace(/^const /gm, 'var '), ctx);
  return { ctx, g };
}
{
  const { ctx, g } = loadGs('7788');
  const post = (d) => ctx.doPost({ postData: { contents: JSON.stringify(d) } });
  const get = (p) => ctx.doGet({ parameter: p });
  // ping (JSONP)
  const ping = get({ mode: 'ping', callback: 'cb1' });
  check(ping.mime === 'js' && ping.text === 'cb1({"ok":true,"ver":2})', `ping JSONP: ${ping.text}`);
  check(get({ mode: 'ping', callback: 'x);alert(1' }).mime === 'json', 'JSONP 콜백 이름 검사');
  check(!!get({}).html, '?mode 없으면 예전처럼 안내 페이지');
  // 진행 기록
  const who = { grade: '1', cls: '1', num: '7' };
  post({ kind: 'track', sid: 'ab12', who, ver: 'sets-v1.0', solve: false, events: [
    { t: 1000, at: '2026-11-03 10:00:00', type: 'battle', monster: 'belongSlime', node: 1 },
    { t: 2000, at: '2026-11-03 10:01:00', type: 'answer', monster: 'belongSlime', ok: false },
    { t: 3000, at: '2026-11-03 10:02:00', type: 'win', monster: 'belongSlime', node: 1 },
  ] });
  const sh = g.sheets['진행'];
  check(sh && sh.data.length === 4 && sh.data[0][0] === '시각' && sh.data[2][9] === 0 && sh.data[3][6] === 'win', `진행 탭 기록 ${JSON.stringify(sh && sh.data)}`);
  // 읽기: 비밀번호
  check(JSON.parse(get({ mode: 'track', key: 'nope' }).text).error === 'key', '틀린 비밀번호 거부');
  const r1 = JSON.parse(get({ mode: 'track', key: '7788', since: 1 }).text);
  check(r1.ok && r1.last === 4 && r1.rows.length === 3 && r1.rows[0][6] === 'battle', '진행 기록 읽기');
  post({ kind: 'track', sid: 'ab12', who, events: [{ t: 4000, at: '2026-11-03 10:03:00', type: 'wait', lock: 'm2' }] });
  const r2 = JSON.parse(get({ mode: 'track', key: '7788', since: r1.last }).text);
  check(r2.rows.length === 1 && r2.rows[0][11] === 'm2' && r2.last === 5, '새 줄만 읽기 (since)');
  check(JSON.parse(get({ mode: 'track', key: '7788', since: 99 }).text).rows.length === 0, '읽을 줄 없음');
  // 결과: 번외편은 다른 탭, 본편은 '결과' 그대로
  post({ 학년: '1', 반: '1', 번호: '7', 모드: '번외편', _tab: '번외편결과' });
  post({ 학년: '1', 반: '2', 번호: '3', 모드: '캠페인' });
  check(g.sheets['번외편결과'] && g.sheets['번외편결과'].data.length === 2 && !g.sheets['번외편결과'].data[0].includes('_tab'), '번외편 결과 탭 (_tab 열 없음)');
  check(g.sheets['결과'] && g.sheets['결과'].data[1][3] === '캠페인', '본편 결과는 결과 탭');
}
{
  const { ctx } = loadGs('');
  check(JSON.parse(ctx.doGet({ parameter: { mode: 'track', key: '' } }).text).error === 'nokey', '비밀번호를 안 정했으면 읽기 거부');
}

// ── 2. 현황 집계 ─────────────────────────────────────────
const ctx2 = vm.createContext({});
ctx2.window = ctx2;
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/dash.js'), 'utf8'), ctx2);
const D = ctx2.DS.Dash;
const T0 = Date.parse('2026-11-03T10:00:00');
const row = (num, min, type, extra = {}) => ['2026-11-03 10:' + String(min).padStart(2, '0') + ':00', T0 + min * 60000, '1', '1', String(num), 's' + num, type,
  extra.monster || '', extra.node == null ? '' : extra.node, extra.ok == null ? '' : extra.ok, extra.card || '', extra.lock || '', extra.solve || 0, 'sets-v1.0'];
const M = ['belongSlime', 'emptyGhost', 'unitGolem', 'includeKnight', 'mirrorTwins', 'collector', 'mixCrab', 'mixWisp', 'mixKnight', 'powerGuardian'];
const rows = [];
// 1번: 4마리 공략, 지금 5번째 대기 / 2번: 4마리 / 3번: 4마리 / 4번: 1마리, 거울… 아니 2번째 몬스터에서 오답 3번 · 8분째
for (const n of [1, 2, 3]) M.slice(0, 4).forEach((m, k) => { rows.push(row(n, k * 3, 'battle', { monster: m })); rows.push(row(n, k * 3 + 2, 'win', { monster: m })); });
rows.push(row(1, 13, 'wait', { lock: 'm5' }));
rows.push(row(2, 14, 'alive', { card: 'lock' }));
rows.push(row(3, 14, 'example', { card: 'equal', ok: 1 }));
rows.push(row(4, 1, 'battle', { monster: 'belongSlime' }));
rows.push(row(4, 2, 'win', { monster: 'belongSlime' }));
rows.push(row(4, 4, 'battle', { monster: 'emptyGhost' }));
[5, 6, 7].forEach((mm) => rows.push(row(4, mm, 'answer', { monster: 'emptyGhost', ok: 0 })));
rows.push(row(4, 12, 'alive', { card: 'battle', monster: 'emptyGhost' }));
rows.push(row(5, 0, 'start')); // 5번: 시작만 하고 신호 없음
rows.push(['2026-11-02 10:00:00', T0 - 864e5, '1', '1', '9', 'x', 'win', 'belongSlime', '', '', '', '', 0, '']); // 어제 기록
const A = D.aggregate(rows, { now: T0 + 14 * 60000, date: '2026-11-03', grade: '1', cls: '1', monsters: M, craftable: ['belong', 'equal'], name: (m) => m });
const st = (n) => A.students.find((s) => s.num === n);
check(A.students.length === 5 && !A.students.some((s) => s.num === 9), '날짜 필터 (어제 기록 제외)');
check(st(1).wins.size === 4 && st(1).waiting === 'm5' && st(1).flags.length === 0, '1번: 4마리, m5 대기, 경고 없음');
check(st(3).crafts.has('equal'), '예제 통과 = 연성');
const f4 = st(4).flags.map((f) => f.k).sort().join();
check(f4 === 'behind,stuck,wrong', `4번: 뒤처짐·오래 머묾·오답 (${f4})`);
check(st(5).flags.some((f) => f.k === 'idle') && st(5).flags.some((f) => f.k === 'behind'), '5번: 신호 없음·뒤처짐');
check(A.students[0].flags.length > 0 && A.students[A.students.length - 1].flags.length === 0, '도움이 필요한 학생이 위로');
check(A.flagged === 2 && A.clearBy.belongSlime === 4 && A.waiting.m5 === 1 && A.hardest[0][0] === 'emptyGhost', `요약 ${A.flagged} ${JSON.stringify(A.clearBy)} ${JSON.stringify(A.hardest)}`);
check(D.classes(rows, '2026-11-03').join() === '1-1', '반 목록');

if (failures) { console.error(`\n${failures}건 실패`); process.exit(1); }
console.log('OK: Code.gs 진행 기록 받기·읽기·JSONP·비밀번호·결과 탭 · 현황 집계(뒤처짐·오래 머묾·오답·신호 없음) 통과');
