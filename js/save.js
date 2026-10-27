// 세이브: 캠페인 진행을 브라우저 저장소(localStorage)에 자동 저장 (저장 칸 1개)
//  - 캠프에 들어갈 때, 출발할 때, 전투에서 이긴 직후 저장. 전투 중에는 저장하지 않는다.
//  - 이어하기는 저장된 위치(캠프)에서 시작 → 전투 중에 닫았다면 후퇴와 같은 결과
//  - 문제는 무작위 숫자(params)만 저장했다가 같은 문제로 다시 만든다
//  - 버전이 다른 저장은 읽지 않는다 (카드 구조가 바뀌어도 오류가 나지 않게)
window.DS = window.DS || {};

DS.Save = (function () {
  const KEY = 'dimension-slasher-save';
  const VER = 1;

  // 게임 상태 → JSON으로 바꿀 수 있는 객체 (Set은 배열로, 문제는 숫자만)
  function pack(G) {
    const params = {};
    Object.entries(G.problems).forEach(([i, p]) => { params[i] = p.params || {}; });
    return {
      ver: VER, savedAt: Date.now(),
      node: G.node, loop: G.loop,
      cards: G.cards, deckUids: [...G.deckUids], bag: G.bag,
      discovered: [...G.discovered], mastery: G.mastery, granted: [...G.granted],
      params, stats: G.stats,
    };
  }
  // 저장 객체 → 게임 상태 (문제는 node 번호의 몬스터로 다시 만든다)
  function unpack(d) {
    if (!d || d.ver !== VER) return null;
    const problems = {};
    Object.entries(d.params || {}).forEach(([i, p]) => {
      const n = DS.Progress.nodes[i];
      if (n && n.monster) problems[i] = DS.Monsters[n.monster].makeProblem(Object.keys(p).length ? p : undefined);
    });
    return {
      node: d.node, loop: d.loop,
      cards: d.cards, deckUids: new Set(d.deckUids), bag: d.bag,
      discovered: new Set(d.discovered), mastery: d.mastery, granted: new Set(d.granted),
      problems, stats: d.stats,
    };
  }

  // 저장소가 막힌 환경(일부 시크릿 창 등)에서도 게임은 계속되도록 실패는 조용히 넘긴다
  function write(G, node) {
    try {
      const d = pack(G);
      if (node != null) d.node = node;
      localStorage.setItem(KEY, JSON.stringify(d));
      return true;
    } catch (e) { return false; }
  }
  function raw() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
  }
  const read = () => unpack(raw());
  const has = () => !!raw();
  const compatible = () => { const d = raw(); return !!d && d.ver === VER; };
  function clear() { try { localStorage.removeItem(KEY); } catch (e) { /* 무시 */ } }

  return { KEY, VER, pack, unpack, write, read, has, compatible, clear };
})();
