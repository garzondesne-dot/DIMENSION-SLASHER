// 진행 기록: 연성·예제·공략·정답 같은 사건을 차례로 쌓아 두고(기기에 저장), 선생님 시트로 몇 초마다 보낸다.
//  - 전송 주소: DS.TRACK_URL (Apps Script 웹 앱). 먼저 ?mode=ping 으로 새 Code.gs 가 배포됐는지 확인한 뒤에만 보낸다
//    (예전 Code.gs 에 보내면 결과 탭이 지저분해지므로)
//  - 보내기: fetch(no-cors) 로 묶어서. 네트워크가 끊기면 남겨 뒀다가 다시. 화면을 닫을 때는 sendBeacon
//  - 교사 현황 페이지(sets/dashboard.html)가 시트의 '진행' 탭을 읽어 학생 × 몬스터 표로 보여 준다
window.DS = window.DS || {};

DS.Track = (function () {
  const KEY = 'dimension-slasher-sets-track', SENT = 'dimension-slasher-sets-track-sent', SID = 'dimension-slasher-sets-sid';
  let q = [], sent = 0, sid = '';
  try {
    q = JSON.parse(localStorage.getItem(KEY)) || [];
    sent = Number(localStorage.getItem(SENT)) || 0;
    sid = localStorage.getItem(SID) || '';
  } catch (e) { q = []; }
  if (!sid) { sid = Math.random().toString(36).slice(2, 8); try { localStorage.setItem(SID, sid); } catch (e) { /* 무시 */ } }
  if (sent > q.length) sent = q.length;
  const save = () => {
    // 오래된 기록은 보낸 것만 지운다
    if (q.length > 600 && sent > 300) { const cut = sent - 100; q = q.slice(cut); sent -= cut; }
    try { localStorage.setItem(KEY, JSON.stringify(q)); localStorage.setItem(SENT, String(sent)); } catch (e) { /* 무시 */ }
  };
  const listeners = [];
  const pad = (n) => String(n).padStart(2, '0');
  const at = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  // type: start · craft · example · battle · step · answer · wrongTool · win · lose · wait · unlock · solveMode · clear · alive
  function log(type, data = {}) {
    const d = new Date();
    const e = { t: d.getTime(), at: at(d), type, ...data };
    q.push(e);
    save();
    listeners.forEach((f) => { try { f(e); } catch (err) { /* 무시 */ } });
    return e;
  }
  const onLog = (f) => listeners.push(f);
  const all = () => q.slice();
  function clear() { q = []; sent = 0; save(); }

  // ── 시트로 보내기 ───────────────────────────────────────
  let enabled = false, busy = false, extra = () => ({});
  const url = () => DS.TRACK_URL || '';
  function batch() {
    const who = DS.Report && DS.Report.student ? DS.Report.student() : {};
    return { kind: 'track', sid, who, ver: DS.VERSION, ...extra(), events: q.slice(sent, sent + 60) };
  }
  async function flush() {
    if (!enabled || busy || sent >= q.length || !url()) return;
    const who = DS.Report.student();
    if (!who.grade || !who.num) return;
    busy = true;
    const b = batch(), n = b.events.length;
    try {
      await fetch(url(), { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(b) });
      sent += n;
      save();
    } catch (e) { /* 끊김: 다음에 다시 */ }
    busy = false;
  }
  // 화면을 닫거나 다른 앱으로 갈 때: 남은 기록을 한 번에
  function beacon() {
    if (!enabled || sent >= q.length || !url() || !navigator.sendBeacon) return;
    const b = batch();
    try {
      if (navigator.sendBeacon(url(), new Blob([JSON.stringify(b)], { type: 'text/plain;charset=utf-8' }))) { sent += b.events.length; save(); }
    } catch (e) { /* 무시 */ }
  }
  // 새 Code.gs 가 배포됐는지 JSONP 로 확인 (예전 Code.gs 는 HTML 을 돌려줘서 콜백이 불리지 않음)
  function ping() {
    return new Promise((res) => {
      if (!url() || typeof document === 'undefined') { res(false); return; }
      const cb = `__dsPing${Date.now()}`;
      const s = document.createElement('script');
      const done = (v) => { delete window[cb]; s.remove(); clearTimeout(timer); res(v); };
      window[cb] = (d) => done(!!(d && d.ok && d.ver >= 2));
      s.onerror = () => done(false);
      const timer = setTimeout(() => done(false), 8000);
      s.src = `${url()}?mode=ping&callback=${cb}`;
      document.head.appendChild(s);
    });
  }
  async function start(getExtra) {
    if (getExtra) extra = getExtra;
    for (let k = 0; k < 3 && !enabled; k++) {
      enabled = await ping();
      if (!enabled) await new Promise((r) => setTimeout(r, 15000));
    }
    status = enabled ? 'on' : 'off';
    if (!enabled) return;
    setInterval(flush, 4000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) beacon(); });
    window.addEventListener('pagehide', beacon);
    flush();
  }
  let status = 'checking';
  return { log, onLog, all, clear, start, flush, sid: () => sid, status: () => status, pending: () => q.length - sent };
})();
