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
      node: G.node, maxNode: G.maxNode, loop: G.loop,
      cards: G.cards, deckUids: [...G.deckUids], bag: G.bag,
      discovered: [...G.discovered], mastery: G.mastery, granted: [...G.granted],
      params, stats: G.stats, tutorial: G.tutorial || null, unlocked: [...(G.unlocked || [])],
    };
  }
  // v0.3.2 이전 저장 옮기기: 완전제곱 카드·반의 제곱 부품은 없어지고, 원 (일반형)은 부품 → 카드,
  // 직선 (일반형)·계수 길이 부품 대신 계수 제곱합 (a² + b²). ²·√ 기록이 없으면 1층 골렘을 지난 저장만 둘 다 해금
  function migrate(d) {
    const b = d.bag || {};
    const cards = (d.cards || []).filter((c) => c.id !== 'completeSq');
    const lost = (d.cards || []).length - cards.length;
    const genN = (b.genCircle || 0) + lost; // 완전제곱 카드는 재료였던 원 (일반형) 카드로 돌려준다
    for (let k = 0; k < genN; k++) cards.push(DS.CardKit.roll('genCircle'));
    if (b.normLen || b.lineGen) b.coefSq = (b.coefSq || 0) + Math.max(b.normLen || 0, b.lineGen || 0);
    ['genCircle', 'halfSq', 'lineGen', 'normLen'].forEach((k) => delete b[k]);
    const ids = new Set(cards.map((c) => c.uid));
    d.cards = cards;
    d.deckUids = (d.deckUids || []).filter((u) => ids.has(u));
    d.discovered = (d.discovered || []).filter((x) => x !== 'completeSq');
    if (d.mastery) delete d.mastery.completeSq;
    if (!d.unlocked) {
      const golem = DS.Progress.nodes.findIndex((n) => n.monster === 'golem');
      d.unlocked = (d.maxNode != null ? d.maxNode : d.node) >= golem ? ['sq', 'root'] : [];
    }
  }
  // 저장 객체 → 게임 상태 (문제는 node 번호의 몬스터로 다시 만든다)
  function unpack(d) {
    if (!d || d.ver !== VER) return null;
    migrate(d);
    // 옛 저장의 점 부품 변환 (v0.2.2): 점 A → x₁, 점 B → x₂, 통합했던 점(v0.2.1.1) → 반씩, 남는 1개는 x₁
    if (d.bag) {
      const b = d.bag;
      if (b.ptA != null || b.ptB != null) { b.x1 = (b.x1 || 0) + (b.ptA || 0); b.x2 = (b.x2 || 0) + (b.ptB || 0); delete b.ptA; delete b.ptB; }
      if (b.pt != null) { b.x1 = (b.x1 || 0) + Math.ceil(b.pt / 2); b.x2 = (b.x2 || 0) + Math.floor(b.pt / 2); delete b.pt; }
    }
    const problems = {};
    Object.entries(d.params || {}).forEach(([i, p]) => {
      const n = DS.Progress.nodes[i];
      if (n && n.monster) problems[i] = DS.Monsters[n.monster].makeProblem(Object.keys(p).length ? p : undefined);
    });
    return {
      node: d.node, maxNode: d.maxNode != null ? d.maxNode : d.node, loop: d.loop,
      cards: d.cards, deckUids: new Set(d.deckUids), bag: d.bag,
      discovered: new Set(d.discovered), mastery: d.mastery, granted: new Set(d.granted),
      problems, stats: d.stats, tutorial: d.tutorial || null, unlocked: new Set(d.unlocked),
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
