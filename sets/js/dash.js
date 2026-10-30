// 교사용 실시간 현황: 시트 '진행' 탭의 줄 → 학생별 진행 상태 · 못 따라오는 학생 표시 (집계는 화면과 분리, 테스트로 검증)
// 줄 = [시각, t, 학년, 반, 번호, 기기, 사건, 몬스터, 노드, 정답, 카드, 자물쇠, 문제풀이, 버전]  (Code.gs 의 TRACK_HEAD)
window.DS = window.DS || {};

DS.Dash = (function () {
  const COL = { at: 0, t: 1, grade: 2, cls: 3, num: 4, sid: 5, type: 6, monster: 7, node: 8, ok: 9, card: 10, lock: 11, solve: 12, ver: 13 };
  // 판정 기준 (분·개수)
  const RULE = { behind: 2, stuckMin: 5, wrong: 3, idleMin: 3 };
  const median = (a) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const dayOf = (r) => String(r[COL.at]).slice(0, 10);

  function aggregate(rows, opt = {}) {
    const now = opt.now || Date.now();
    const monsters = opt.monsters || []; // 진행 순서대로 몬스터 이름(id)
    const craftable = opt.craftable || [];
    const by = new Map();
    for (const r of rows) {
      if (opt.date && dayOf(r) !== opt.date) continue;
      if (opt.grade && String(r[COL.grade]) !== String(opt.grade)) continue;
      if (opt.cls && String(r[COL.cls]) !== String(opt.cls)) continue;
      const id = `${r[COL.grade]}-${r[COL.cls]}-${r[COL.num]}`;
      if (!by.has(id)) {
        by.set(id, { id, grade: r[COL.grade], cls: r[COL.cls], num: Number(r[COL.num]), wins: new Set(), crafts: new Set(), exampleFails: 0,
          asked: 0, correct: 0, wrongBy: {}, cur: '', curSince: 0, waiting: '', last: 0, first: Infinity, solve: false, cleared: false, node: 0, screen: '' });
      }
      const s = by.get(id), t = Number(r[COL.t]) || 0, type = r[COL.type], m = r[COL.monster];
      s.last = Math.max(s.last, t);
      s.first = Math.min(s.first, t);
      if (String(r[COL.solve]) === '1') s.solve = true;
      if (r[COL.node] !== '' && r[COL.node] != null) s.node = Number(r[COL.node]);
      const ok = String(r[COL.ok]) === '1';
      if (type === 'win' && m) { s.wins.add(m); if (s.cur === m) { s.cur = ''; s.curSince = 0; } }
      else if (type === 'battle' && m) { if (s.cur !== m) { s.cur = m; s.curSince = t; } s.waiting = ''; }
      else if (type === 'wait') { s.waiting = r[COL.lock]; s.cur = ''; }
      else if (type === 'unlock') s.waiting = '';
      else if (type === 'answer') { s.asked++; if (ok) s.correct++; else if (m) s.wrongBy[m] = (s.wrongBy[m] || 0) + 1; }
      else if (type === 'wrongTool' && m) s.wrongBy[m] = (s.wrongBy[m] || 0) + 1;
      else if (type === 'example') { if (ok && r[COL.card]) s.crafts.add(r[COL.card]); else if (!ok) s.exampleFails++; }
      else if (type === 'craft' && ok && craftable.includes(r[COL.card])) s.crafts.add(r[COL.card]);
      else if (type === 'solveMode') { s.solve = true; craftable.forEach((c) => s.crafts.add(c)); }
      else if (type === 'clear') s.cleared = true;
      if (type === 'alive') s.screen = r[COL.card];
    }
    const list = [...by.values()];
    const med = median(list.map((s) => s.wins.size));
    for (const s of list) {
      const flags = [];
      const mins = (ms) => Math.floor(ms / 60000);
      if (!s.cleared && s.wins.size <= med - RULE.behind) flags.push({ k: 'behind', text: `진도 ${med - s.wins.size}마리 뒤처짐` });
      if (s.cur && s.curSince && now - s.curSince > RULE.stuckMin * 60000) flags.push({ k: 'stuck', text: `${opt.name ? opt.name(s.cur) : s.cur} ${mins(now - s.curSince)}분째` });
      if (s.cur && (s.wrongBy[s.cur] || 0) >= RULE.wrong) flags.push({ k: 'wrong', text: `같은 몬스터에서 오답 ${s.wrongBy[s.cur]}번` });
      if (!s.cleared && s.last && now - s.last > RULE.idleMin * 60000) flags.push({ k: 'idle', text: `${mins(now - s.last)}분 동안 신호 없음` });
      s.flags = flags;
      s.rate = s.asked ? Math.round((100 * s.correct) / s.asked) : null;
    }
    // 못 따라오는 학생이 위로, 그다음 진도가 느린 순
    list.sort((a, b) => (b.flags.length > 0) - (a.flags.length > 0) || a.wins.size - b.wins.size || a.num - b.num);
    const clearBy = Object.fromEntries(monsters.map((m) => [m, list.filter((s) => s.wins.has(m)).length]));
    const wrongTotal = {};
    list.forEach((s) => Object.entries(s.wrongBy).forEach(([m, n]) => { wrongTotal[m] = (wrongTotal[m] || 0) + n; }));
    const hardest = Object.entries(wrongTotal).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const waiting = {};
    list.forEach((s) => { if (s.waiting) waiting[s.waiting] = (waiting[s.waiting] || 0) + 1; });
    return {
      students: list, median: med, clearBy, hardest, waiting,
      avgWins: list.length ? list.reduce((a, s) => a + s.wins.size, 0) / list.length : 0,
      flagged: list.filter((s) => s.flags.length).length,
    };
  }
  // 시트에 있는 반 목록 (최근 날짜 기준)
  function classes(rows, date) {
    const set = new Map();
    rows.forEach((r) => { if (!date || dayOf(r) === date) { const k = `${r[COL.grade]}-${r[COL.cls]}`; set.set(k, (set.get(k) || 0) + 1); } });
    return [...set.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }
  return { COL, RULE, aggregate, classes, median };
})();
