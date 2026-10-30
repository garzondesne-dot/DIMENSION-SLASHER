// 진행 기록: 연성·예제·공략·정답 같은 사건을 차례로 쌓아 둔다 (기기에 저장).
// 실시간 현황(교사용 화면)으로 보내는 부분은 2차에서 이 대기열을 그대로 전송한다.
window.DS = window.DS || {};

DS.Track = (function () {
  const KEY = 'dimension-slasher-sets-track';
  let q = [];
  try { q = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { q = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(q.slice(-500))); } catch (e) { /* 무시 */ } };
  const listeners = [];
  // type: start · craft · example · battle · step · answer · win · lose · unlock · solveMode · clear
  function log(type, data = {}) {
    const e = { t: Date.now(), type, ...data };
    q.push(e);
    save();
    listeners.forEach((f) => { try { f(e); } catch (err) { /* 무시 */ } });
    return e;
  }
  const onLog = (f) => listeners.push(f);
  const all = () => q.slice();
  function clear() { q = []; save(); }
  return { log, onLog, all, clear };
})();
