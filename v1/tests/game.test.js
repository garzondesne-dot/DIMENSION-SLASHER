// 게임 데이터 검증: node tests/game.test.js
// (1) 연성 나무: 모든 카드가 시작 부품만으로 연성 가능, 실수 피드백, 순서·축 규칙
// (2) 카드 수치: 투자 점수 공식(합계 = 점수+2 ~ 점수+4), 옵션 개수·범위, 스캔 규칙
// (3) 덱 규칙 판정
// (4) 몬스터 문제: 단계별 정답 하나, 스캔 조각 조건, 보스 정답 독립 검산
// (5) 세이브: 저장 → 불러오기 왕복, 같은 문제 재생성, 다른 버전 거부
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = vm.createContext({});
ctx.window = ctx;
for (const f of ['mathgen', 'data', 'craft', 'cards', 'monsters', 'save']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, `../js/${f}.js`), 'utf8'), ctx);
}
const { Cards, Craft, CardKit: K, Monsters, Progress, Parts, Ops, Tiers, Affixes, DeckRules, Save } = ctx.DS;
const DS = ctx.DS;

let failures = 0;
function check(cond, msg) {
  if (!cond) { failures++; if (failures <= 20) console.error('FAIL:', msg); }
}
const near = (a, b) => Math.abs(a - b) < 1e-9;
const tok = (k) => {
  const [kind, rest] = k.split(':');
  const [id, axis] = rest.split('@');
  return { kind, id, axis };
};

// ── 1. 연성 나무 ──────────────────────────────────────────
// 캠프에서 받는 부품(점 x₁·x₂, 한 점, 무한 m′, 3층의 원 단원 부품)에서 규칙을 반복 적용해 도달 가능한 결과
// v1.0: 모든 차원의 기본 부품(중간 단계 제외)에서 출발. 지난 차원 카드도 서고에서 꺼내 재료로 쓸 수 있다
const have = new Set(Object.keys(Parts).filter((id) => !Parts[id].mid).map((id) => `part:${id}`));
for (let round = 0; round < 12; round++) {
  for (const r of Craft.RULES) {
    if (r.in.every((k) => have.has(k))) {
      const out = `${r.out.kind}:${r.out.id}`;
      have.add(out);
      if (Cards[r.out.id] && Cards[r.out.id].axis) { have.add(`${out}@x`); have.add(`${out}@y`); } // ⇄ 축 바꾸기
    }
  }
}
for (const [id, c] of Object.entries(Cards)) {
  if (['basic', 'normal', 'magic', 'rare'].includes(c.tier)) check(have.has(`card:${id}`), `연성 불가능한 카드: ${id}`);
}
for (const r of Craft.RULES) {
  const mats = r.in.map(tok);
  const res = Craft.match(r.op, mats[0], mats[1]);
  check(res.ok && res.out.id === r.out.id, `규칙 불일치: ${r.op} ${r.in}`);
}
// 빼는 순서는 상관없음, 나눗셈 순서는 중요
check(Craft.match('minus', tok('part:x2'), tok('part:x1')).out.id === 'diff' && Craft.match('minus', tok('part:x1'), tok('part:x2')).out.id === 'diff', '빼는 순서 무관');
check(!Craft.match('minus', tok('part:x1'), tok('part:x1')).ok && /같은 점/.test(Craft.match('minus', tok('part:x1'), tok('part:x1')).msg), '같은 점끼리 빼기 피드백');
check(Craft.match('div', tok('card:diff@y'), tok('card:diff@x')).out.id === 'slope', '세로 ÷ 가로 = 기울기');
check(/거꾸로/.test(Craft.match('div', tok('card:diff@x'), tok('card:diff@y')).msg), '나눗셈 역순 피드백');
check(/세로/.test(Craft.match('div', tok('card:diff@x'), tok('card:diff@x')).msg), '같은 축 나눗셈 피드백');
check(/축|세로/.test(Craft.match('plus', tok('card:diffSq@x'), tok('card:diffSq@x')).msg), '같은 축 제곱 합 피드백');
check(/중점/.test(Craft.match('plus', tok('part:x1'), tok('part:x2')).msg), '중점 피드백');
check(/두 점의 좌표/.test(Craft.match('ratio', tok('card:segLen@x')).msg), '내분점 = 두 점 피드백');
check(Craft.match('sq', tok('card:segLen@y')).out.id === 'diffSq' && Craft.match('sq', tok('card:segLen@y')).out.axis === 'y', '선분² = 차이² (축 유지)');
check(!Craft.match('times', tok('part:pt1'), tok('part:mPrime')).ok, 'm′ 은 기울기에만 반응');
check(/m′/.test(Craft.match('plus', tok('part:slope'), tok('part:mPrime')).msg), 'm′ 피드백');
check(/다음 버전/.test(Craft.match('simul', tok('part:x1'), tok('part:x2')).msg), '연립 잠김');
check(Parts.mPrime.inf && Ops.simul.locked, 'm′ 무한, 연립 잠김 표시');
for (const b of Craft.BOOK) {
  check(Cards[b.card] && ['basic', 'normal', 'magic', 'rare'].includes(Cards[b.card].tier), `도감 카드 등급: ${b.card}`);
  for (const id of Object.keys(b.quick.parts || {})) check(Parts[id] && !Parts[id].inf, `즉시 연성 부품: ${id}`);
  for (const id of Object.keys(b.quick.cards || {})) check(Cards[id], `즉시 연성 카드: ${id}`);
  for (const e of b.emergency) for (const id of Object.keys(e)) check(Cards[id], `긴급 연성 재료는 카드여야 함: ${id}`);
}
// 긴급 연성은 손패(카드)만: 부품이 필요한 내분점·직선의 방정식·차이는 불가
for (const id of ['divide', 'line', 'diff']) check(Craft.book(id).emergency.length === 0, `긴급 연성 불가여야 함: ${id}`);

// ── 2. 카드 수치 ──────────────────────────────────────────
// 투자 점수 = 소재 + 연성 횟수 × 2 (확정안 표)
const SCORE = { diff: [2, 1], segLen: [2, 2], diffSq: [2, 2], divide: [2, 1], para: [4, 4], perp: [4, 4], line: [5, 4], dist: [4, 6] };
for (const [id, [mat, n]] of Object.entries(SCORE)) check(Cards[id].score === mat + n * 2, `투자 점수: ${id}`);
check(K.statRange('diff')[0] === 6 && K.statRange('diff')[1] === 8, '차이 합계 6~8');
check(K.statRange('dist')[0] === 18 && K.statRange('dist')[1] === 20, '거리 합계 18~20');
let scanNormal = 0, normalN = 0;
for (let i = 0; i < 4000; i++) {
  for (const id of ['diff', 'segLen', 'diffSq', 'divide', 'para', 'perp', 'line', 'dist', 'circle', 'ptLine', 'triArea']) {
    const c = K.roll(id);
    const [lo, hi] = K.statRange(id);
    check(Number.isInteger(c.atk) && Number.isInteger(c.def) && c.atk >= 0 && c.def >= 0, `자연수 수치: ${id}`);
    check(c.atk + c.def >= lo && c.atk + c.def <= hi, `합계 범위: ${id} ${c.atk}+${c.def}`);
    const tier = Cards[id].tier;
    check(c.affixes.length === Tiers[tier].affixes, `옵션 개수: ${id}`);
    check(new Set(c.affixes.map(([k]) => k)).size === c.affixes.length, `옵션 중복: ${id}`);
    for (const [k, v] of c.affixes) {
      const r = Affixes[k].range;
      const [mn, mx] = tier === 'rare' ? [r[2], r[3]] : [r[0], r[1]];
      check(v >= mn && v <= mx, `옵션 범위: ${id} ${k}=${v}`);
    }
    if (id === 'diff') check(c.scan, '차이 카드는 항상 스캔');
    if (Cards[id].tier === 'magic') check(!c.scan, '매직은 스캔 없음');
    if (Cards[id].tier === 'normal') { normalN++; if (c.scan) scanNormal++; }
  }
}
const rate = scanNormal / normalN;
check(rate > 0.31 && rate < 0.39, `일반 카드 스캔 확률 약 35%: ${rate.toFixed(3)}`);
const u = K.roll('dPlusR');
check(u.atk === 30 && u.affixes.length === 3 && K.affix(u, 'pierce') === 1, '유니크 고정 설계');
check(near(K.critOf(K.roll('para')).rate >= 0.10 ? 1 : 0, 1), '매직 기본 치명 10% 이상');

// ── 3. 덱 규칙 ────────────────────────────────────────────
const mk = (id, scan) => ({ ...K.roll(id), scan: scan != null ? scan : K.roll(id).scan });
const diffs = (n) => Array.from({ length: n }, () => mk('diff'));
check(K.checkDeck(diffs(6)).ok, '차이 6장 덱 OK');
check(!K.checkDeck(diffs(5)).ok, '5장은 부족');
check(!K.checkDeck(diffs(13)).ok, '13장은 초과');
check(!K.checkDeck([...diffs(1), mk('segLen', false), mk('segLen', false), mk('segLen', false), mk('segLen', false), mk('segLen', false)]).ok, '스캔 4장 미만');
check(K.checkDeck([mk('diff'), mk('segLen', true), mk('diffSq', true), mk('segLen', true), mk('dist'), mk('para')]).ok, '차이 1 + 스캔 일반 3');
check(!K.checkDeck([mk('segLen', true), mk('segLen', true), mk('segLen', true), mk('segLen', true), mk('dist'), mk('para')]).ok, '차이 카드 0장이면 불가');
check(!K.checkDeck([...diffs(4), mk('dist'), mk('para'), mk('perp'), mk('line'), mk('divide')]).ok, '매직 5장은 불가');
check(DeckRules.max === 12 && DeckRules.maxMagic === 4 && DeckRules.minScan === 4, '덱 규칙 수치');

// ── 4. 몬스터 문제 ────────────────────────────────────────
for (const [key, m] of Object.entries(Monsters)) {
  for (let rep = 0; rep < 300; rep++) {
    const prob = m.makeProblem();
    check(prob.steps.length === m.gates.length, `${key}: 단계 수 = 문턱 수`);
    for (let i = 1; i < m.gates.length; i++) check(m.gates[i] <= m.gates[i - 1], `${key}: 문턱 내림차순`);
    check(m.gates[0] < m.maxHp, `${key}: 첫 문턱 < 최대 체력`);
    check(Array.isArray(prob.pieces) && prob.pieces.length >= 2, `${key}: 문제 조각`);
    let prev = 0;
    prob.steps.forEach((s, i) => {
      check(s.needs >= 1 && s.needs <= prob.pieces.length && s.needs >= prev, `${key} ${i}: 필요 조각 수`);
      prev = s.needs;
      if (s.tool) check(Cards[s.tool] && Cards[s.tool].tool, `${key}: 도구 카드 ${s.tool}`);
      const q = s.challenge();
      check(q.choices.length === 4 && new Set(q.choices).size === 4, `${key} ${i}: 보기 4개`);
      check(q.choices[q.answerIndex] === q.answer, `${key} ${i}: 정답 위치`);
    });
    check(prob.steps[prob.steps.length - 1].needs === prob.pieces.length, `${key}: 마지막 단계는 문제 전체 필요`);
  }
}
const ans = (m, i) => Monsters[m].makeProblem().steps[i].challenge().answer;
check((2 * 5 + 1 * -1) / 3 === 3 && (2 * 8 + 1 * 2) / 3 === 6 && ans('golem', 0) === '(3, 6)', '골렘 1단계');
check(near(Math.hypot(3, 6), 3 * Math.sqrt(5)) && ans('golem', 1) === '3√5', '골렘 2단계');
check(near(-0.5 * 2, -1) && ans('beast', 0) === '2', '거수 1단계');
check(2 * 1 - 3 === -1 && ans('beast', 1) === 'y = 2x − 3', '거수 2단계');
const r = Math.sqrt(8), d = 6 / Math.hypot(1, -1);
check(near(d - r, Math.SQRT2) && near(d + r, 5 * Math.SQRT2), '보스 높이 범위');
const area = (h) => { const a = (2 * h) / Math.sqrt(3); return (Math.sqrt(3) / 4) * a * a; };
check(near(area(Math.SQRT2), 2 * Math.sqrt(3) / 3) && near(area(5 * Math.SQRT2), 50 * Math.sqrt(3) / 3), '보스 넓이');
['x − y + 6 = 0', '중심 (0, 0), 반지름 2√2', '3√2', '√2 ≤ h ≤ 5√2', 'S = h²/√3', '최솟값 2√3/3 · 최댓값 50√3/3']
  .forEach((a, i) => check(ans('finalBoss', i) === a, `최종보스 ${i + 1}단계`));

// ── 3층·4층 (원 단원) 독립 검산 ────────────────────────────
// 'a√b/c', '√b', 'n/d', 'n' 꼴의 답을 수로 바꾼다
const val = (str) => {
  const m = String(str).replace('−', '-').match(/^(-?\d*)(?:√(\d+))?(?:\/(\d+))?$/);
  if (!m) return NaN;
  const coef = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
  return (coef * (m[2] ? Math.sqrt(Number(m[2])) : 1)) / (m[3] ? Number(m[3]) : 1);
};
const MG = ctx.DS.MathGen;
for (let t = 0; t < 3000; t++) { // 수선 거미: 무작위 점과 직선, 정수 답
  const p = MG.gen.ptLineDist();
  const { x1, y1, a, b, c } = p.params;
  const d = Math.abs(a * x1 + b * y1 + c) / Math.hypot(a, b);
  check(near(val(p.answer), d) && Number.isInteger(d) && d > 0, `점과 직선 거리 ${p.question} → ${p.answer}`);
  check(a > 0 && p.choices.length === 4 && new Set(p.choices).size === 4, `점과 직선 거리 보기: ${p.question}`);
}
{
  const sp = Monsters.spider.makeProblem({ x1: 3, y1: 5, a: 4, b: -3, c: -12 }); // 24쪽 보기
  check(sp.steps[0].challenge().answer === '3', '교과서 24쪽 보기: 3');
  const st = (id, i) => Monsters[id].makeProblem().steps[i].challenge().answer;
  // 가면 원령: x² + y² + 6x − 4y − 3 = 0 → (x + 3)² + (y − 2)² = 16 (전개해서 같은 식인지 점 몇 개로 확인)
  for (const [x, y] of [[0, 0], [1, 2], [-3, 5], [7, -4]]) {
    check(near((x + 3) ** 2 + (y - 2) ** 2 - 16, x * x + y * y + 6 * x - 4 * y - 3), '가면 원령 완전제곱 전개');
  }
  check(st('mask', 0) === '(x + 3)² + (y − 2)² = 16' && st('mask', 1) === '중심 (−3, 2), 반지름 4', '가면 원령 정답');
  // 고리 정령: 중심 = A(2, 8), B(10, 2)의 중점, 반지름 = CA, A·B가 원 위에 있음
  const C = [(2 + 10) / 2, (8 + 2) / 2], r = Math.hypot(2 - C[0], 8 - C[1]);
  check(C[0] === 6 && C[1] === 5 && r === 5, '고리 정령 중심·반지름');
  check((10 - 6) ** 2 + (2 - 5) ** 2 === 25 && (2 - 6) ** 2 + (8 - 5) ** 2 === 25, '고리 정령: 지름 양 끝이 원 위');
  check(st('ringSpirit', 0) === '(6, 5)' && st('ringSpirit', 1) === '5' && st('ringSpirit', 2) === '(x − 6)² + (y − 5)² = 25', '고리 정령 정답');
  // 유성: x² + y² = 16, y = x − 2 → d = √2 < 4, 대입한 이차방정식 판별식 > 0 (두 점)
  const dm = Math.abs(-2) / Math.hypot(1, -1);
  check(near(dm, Math.SQRT2) && dm < 4 && (-4) ** 2 - 4 * 2 * -12 > 0, '유성: d = √2, 두 점에서 만남');
  check(st('meteor', 0) === '√2' && st('meteor', 1) === '서로 다른 두 점에서 만난다', '유성 정답');
  // 접선 기사: P(4, 3)이 원 위, 접선 4x + 3y = 25 는 P를 지나고 원점과의 거리 = 반지름 5 (접함)
  check(16 + 9 === 25 && 4 * 4 + 3 * 3 === 25 && near(25 / Math.hypot(4, 3), 5), '접선 기사: 접선 검산');
  check(near((3 / 4) * (-4 / 3), -1), '접선 기사: 반지름과 접선 수직');
  check(st('knight', 0) === '−4/3' && st('knight', 1) === '4x + 3y = 25', '접선 기사 정답');
  // 원환의 수문장(41쪽 07번): 원 위의 점을 3600개 찍어 직선까지 거리의 최대·최소를 직접 구한다
  let mx = -Infinity, mn = Infinity;
  for (let k = 0; k < 3600; k++) {
    const th = (k / 3600) * 2 * Math.PI, x = 2 + 2 * Math.cos(th), y = 5 + 2 * Math.sin(th);
    const dd = Math.abs(3 * x - 4 * y - 6) / 5;
    mx = Math.max(mx, dd); mn = Math.min(mn, dd);
  }
  check(Math.abs(mx - 6) < 1e-3 && Math.abs(mn - 2) < 1e-3, `07번 최대·최소 직접 계산 ${mx}, ${mn}`);
  check(st('gatekeeper', 0) === '중심 (2, 5), 반지름 2' && st('gatekeeper', 1) === '4' && st('gatekeeper', 2) === '최댓값 6, 최솟값 2', '07번 정답');
}

// 캠페인 도구는 캠프에서 연성할 수 있어야 함 (유니크는 전투 중 각성: 재료 레어가 연성 가능해야 함)
// 6층(grantAll)은 결계에서 기억 복원으로 지급하므로 특수·QTE 단계는 제외. 엘리트(갈림길)도 검사
const campaignFights = [];
for (const n of Progress.nodes) {
  if (n.type === 'battle') campaignFights.push({ floor: n.floor, monster: n.monster });
  if (n.type === 'fork') n.options.filter((o) => o.startsWith('elite:')).forEach((o) => campaignFights.push({ floor: n.floor, monster: o.slice(6) }));
}
check(campaignFights.length >= 30, `캠페인 전투 수 ${campaignFights.length}`);
for (const n of campaignFights) {
  check(Monsters[n.monster], `몬스터 있음: ${n.monster}`);
  check(Monsters[n.monster].dim === DS.floorDim(n.floor), `몬스터 차원 = 층의 차원: ${n.monster}`);
  for (const s of Monsters[n.monster].makeProblem().steps) {
    if (s.qte || (Progress.floors[n.floor].grantAll && Cards[s.tool].tier === 'special')) continue;
    if (Cards[s.tool].tier === 'unique') {
      check(s.forge && s.forge.from.every((id) => Craft.book(id)), `캠페인 유니크 각성 재료: ${s.tool}`);
    } else check(Craft.book(s.tool) && ['normal', 'magic', 'rare'].includes(Cards[s.tool].tier), `캠페인 도구 연성 가능: ${s.tool}`);
    // 도구 카드의 레시피가 그 층까지 열려 있어야 함
    if (Craft.book(s.tool)) check(Craft.book(s.tool).floor <= n.floor && Craft.book(s.tool).dim <= DS.floorDim(n.floor), `도구 레시피 층: ${s.tool} (${n.floor}층)`);
  }
}

// 조합법 창(베타)의 안내가 실제 연성 규칙과 맞는지: 각 단계를 그대로 모루에 올려 결과를 확인
for (const r of Craft.BOOK) {
  check(Array.isArray(r.guide) && r.guide.length, `조합법 안내 있음: ${r.card}`);
  let last = null;
  for (const [a, op, b, out] of r.guide) {
    const res = Craft.match(op, a && tok(a), b && tok(b));
    const got = res.ok ? `${res.out.kind}:${res.out.id}${res.out.axis ? '@' + res.out.axis : ''}` : res.msg;
    check(got === out, `조합법 안내 ${r.card}: ${a} ${op} ${b} → ${got} (기대 ${out})`);
    last = out;
  }
  check(last && last.startsWith(`card:${r.card}`), `조합법 안내 마지막 결과: ${r.card}`);
}
// 점 부품 하나만으로는 차이가 안 됨 (두 점 필요)
check(!Craft.match('minus', tok('part:x1'), null).ok, '점 한 개로는 빼기 불가');
// 분해 회수: 어떤 순서로 분해해도 x₁·x₂ 개수 차이가 1을 넘지 않아 연성이 막히지 않음
for (let t = 0; t < 2000; t++) {
  const bag = { x1: Math.floor(Math.random() * 4), x2: 0 };
  bag.x2 = bag.x1 + Math.floor(Math.random() * 3) - 1; if (bag.x2 < 0) bag.x2 = 0;
  const startGap = Math.abs(bag.x1 - bag.x2);
  for (let k = 0; k < 6; k++) {
    const r = Craft.book(['diff', 'segLen', 'divide', 'dist', 'line'][Math.floor(Math.random() * 5)]).refund;
    const got = Craft.refundParts(r, bag);
    Object.entries(got).forEach(([id, n]) => { bag[id] = (bag[id] || 0) + n; });
    check(Math.abs(bag.x1 - bag.x2) <= Math.max(1, startGap), `분해 후 x₁·x₂ 균형 ${JSON.stringify(bag)}`);
  }
}
check(JSON.stringify(Craft.refundParts({ pt: 2 }, { x1: 3, x2: 0 })) === JSON.stringify({ x1: 1, x2: 1 }), '2개 회수는 x₁ 1 + x₂ 1');
check(JSON.stringify(Craft.refundParts({ pt: 1 }, { x1: 3, x2: 1 })) === JSON.stringify({ x2: 1 }), '1개 회수는 적은 쪽');
// v0.2.1 저장의 점 A·B → 점 변환
{
  const base = { ver: Save.VER, node: 0, loop: 1, cards: [], deckUids: [], discovered: [], mastery: {}, granted: [], params: {}, stats: {} };
  const g = Save.unpack({ ...base, bag: { ptA: 3, ptB: 5, pt1: 1 } });
  check(g.bag.x1 === 3 && g.bag.x2 === 5 && g.bag.ptA === undefined && g.bag.pt1 === 1, '옛 저장(v0.2.1) 점 A·B → x₁·x₂');
  const g2 = Save.unpack({ ...base, bag: { pt: 7 } });
  check(g2.bag.x1 === 4 && g2.bag.x2 === 3 && g2.bag.pt === undefined, '옛 저장(v0.2.1.1) 통합 점 → x₁·x₂');
}

// ── 5. 세이브 ─────────────────────────────────────────────
// 무작위 문제는 params 로 같은 문제를 다시 만들 수 있어야 함 (조각·정답이 같음)
for (let t = 0; t < 300; t++) {
  for (const id of ['slime', 'bat', 'golem', 'beast']) {
    const a = Monsters[id].makeProblem();
    const b = Monsters[id].makeProblem(JSON.parse(JSON.stringify(a.params || {})));
    check(JSON.stringify(a.pieces) === JSON.stringify(b.pieces), `세이브 문제 재생성(조각): ${id}`);
    a.steps.forEach((s, k) => check(s.challenge().answer === b.steps[k].challenge().answer, `세이브 문제 재생성(정답): ${id} ${k + 1}단계`));
  }
}
{
  const cards = [K.roll('diff'), K.roll('segLen', 'y'), K.roll('para')];
  cards[1].locked = true;
  const battleIdx = Progress.nodes.findIndex((n) => n.monster === 'slime');
  const batIdx = Progress.nodes.findIndex((n) => n.monster === 'bat');
  const G0 = {
    node: 4, loop: 3, cards, deckUids: new Set([cards[0].uid, cards[2].uid]), bag: { x1: 2, x2: 1, slope: 1 },
    discovered: new Set(['diff', 'segLen']), mastery: { diff: 3, segLen: 1 }, granted: new Set([0, 2]),
    problems: { [battleIdx]: Monsters.slime.makeProblem(), [batIdx]: Monsters.bat.makeProblem() },
    stats: { asked: 5, correct: 4, steps: 3, crits: 1, wrongTools: 2, emergencies: 1 },
  };
  const json = JSON.stringify(Save.pack(G0));
  const G1 = Save.unpack(JSON.parse(json));
  check(G1.node === 4 && G1.loop === 3, '세이브 위치·루프');
  check(JSON.stringify(G1.cards) === JSON.stringify(G0.cards), '세이브 카드(수치·옵션·잠금·축)');
  check([...G1.deckUids].join() === [...G0.deckUids].join(), '세이브 덱');
  check(JSON.stringify(G1.bag) === JSON.stringify(G0.bag) && JSON.stringify(G1.mastery) === JSON.stringify(G0.mastery), '세이브 부품·숙련');
  check(G1.discovered.has('segLen') && G1.granted.has(2) && G1.granted.size === 2, '세이브 도감·지급 기록');
  check(JSON.stringify(G1.stats) === JSON.stringify(G0.stats), '세이브 통계');
  for (const k of [battleIdx, batIdx]) check(JSON.stringify(G1.problems[k].pieces) === JSON.stringify(G0.problems[k].pieces), `세이브 문제 유지: 노드 ${k}`);
  check(Save.unpack({ ...JSON.parse(json), ver: Save.VER + 1 }) === null, '다른 버전 저장 거부');
  check(json.length < 20000, `세이브 크기 ${json.length}바이트`);
  check(Save.unpack(JSON.parse(JSON.stringify(Save.pack({ ...G0, tutorial: 'skipped' })))).tutorial === 'skipped', '세이브 튜토리얼 기록');
}

// ── v1.0 테스트판: 새 몬스터 정답 독립 검산 (교과서 풀이와 같은지) ───────────────
{
  const st = (id, i, p) => Monsters[id].makeProblem(p).steps[i].challenge().answer;
  const close = (f, g, xs) => xs.every((x) => near(f(x), g(x)));
  const XS = [-3.5, -2, -0.5, 0.25, 1.5, 3, 4.75, 7];
  // 2층 쌍점 궁수: 무작위 두 점을 지나는 직선 → 답의 기울기·절편으로 두 점을 다시 지나는지
  for (let t = 0; t < 500; t++) {
    const q = MG.gen.line2pt();
    const { x1, y1, x2, y2 } = q.params;
    const m = (y2 - y1) / (x2 - x1), c = y1 - m * x1;
    check(near(m * x2 + c, y2), `두 점을 지나는 직선 ${q.question}`);
    const mm = q.answer.match(/^y = (−?\d*)x(?: ([+−]) (\d+))?$/);
    if (mm) {
      const k = mm[1] === '' ? 1 : mm[1] === '−' ? -1 : Number(mm[1].replace('−', '-'));
      const cc = mm[2] ? (mm[2] === '−' ? -1 : 1) * Number(mm[3]) : 0;
      check(near(k, m) && near(cc, c), `직선 정답 문자열 ${q.answer} (m=${m}, c=${c})`);
    }
  }
  // 5층: 평행 환영 (46쪽 예제 1) — 옮긴 원 위의 점은 원래 원 위의 점 + (3, −1)
  check(st('shiftWraith', 0) === '(3, −1)' && st('shiftWraith', 1) === '(x − 3)² + (y + 1)² = 1', '평행 환영 정답');
  for (let k = 0; k < 12; k++) { const th = k / 2; const x = Math.cos(th) + 3, y = Math.sin(th) - 1; check(near((x - 3) ** 2 + (y + 1) ** 2, 1), '평행 환영 원 검산'); }
  // 거울 원령 (51쪽 예제 1): 세 경우 모두
  const want = { x: ['(4, 3)', '(x − 4)² + (y − 3)² = 4'], y: ['(−4, −3)', '(x + 4)² + (y + 3)² = 4'], o: ['(−4, 3)', '(x + 4)² + (y − 3)² = 4'] };
  for (const k of ['x', 'y', 'o']) check(st('mirrorWraith', 0, { k }) === want[k][0] && st('mirrorWraith', 1, { k }) === want[k][1], `거울 원령 ${k} 대칭 (교과서 풀이)`);
  // 거울 군주 (55쪽 06번): (1, 6) → (6, 5) → (5, 6)
  check(1 + 5 === 6 && 6 - 1 === 5 && st('mirrorLord', 0) === '(6, 5)' && st('mirrorLord', 1) === '(5, 6)' && st('mirrorLord', 2) === '(x − 5)² + (y − 6)² = 9', '거울 군주 정답');
  // 대칭 사냥개 (55쪽 07번): (x, 2x − 3)의 x축 대칭 (x, −2x + 3), 수직 기울기 ½, (−2, 3)을 지나는 y = ½x + 4
  check(XS.every((x) => near(-(2 * x - 3), -2 * x + 3)) && near(-2 * 0.5, -1) && near(0.5 * -2 + 4, 3), '대칭 사냥개 검산');
  check(st('mirrorHound', 0) === 'y = −2x + 3' && st('mirrorHound', 1) === '1/2' && st('mirrorHound', 2) === 'y = 1/2x + 4', '대칭 사냥개 정답');
  // Ⅱ 7층: 집합 연산을 Set 으로 직접
  const S = (a) => `{${[...a].sort((p, q) => p - q).join(', ')}}`;
  for (const v of [0, 1]) {
    const pr = Monsters.setSlime.makeProblem({ v });
    const [A, B] = [[1, 2, 3, 6], [1, 3, 9, 27]][v] && v === 0 ? [[1, 2, 3, 6], [2, 3, 5, 7]] : [[1, 3, 9, 27], [3, 9, 15, 21, 27]];
    check(pr.steps[0].challenge().answer === S(A.filter((x) => B.includes(x))) && pr.steps[1].challenge().answer === S(new Set([...A, ...B])), `원소 슬라임 ${v}`);
  }
  check(st('complGhost', 0) === '{4, 5, 7, 8, 9, 10}' && st('complGhost', 1) === '{2, 6}', '여집합 유령 (A − B: 9의 약수 1, 3, 9 제외)');
  check(21 + 17 - 34 === 4 && 40 - 4 === 36 && st('vennGolem', 0) === '4' && st('vennGolem', 1) === '(A ∩ B)ᶜ' && st('vennGolem', 2) === '36', '벤 골렘 (76쪽 예제 2)');
  // 드모르간: 무작위 집합 200번
  for (let t = 0; t < 200; t++) {
    const U = [1, 2, 3, 4, 5, 6, 7, 8], A = U.filter(() => Math.random() < 0.5), B = U.filter(() => Math.random() < 0.5);
    const c = (X) => U.filter((x) => !X.includes(x));
    check(S(c(A.filter((x) => B.includes(x)))) === S(new Set([...c(A), ...c(B)])) && S(c([...new Set([...A, ...B])])) === S(c(A).filter((x) => c(B).includes(x))), '드모르간 직접 확인');
  }
  // 8층
  check(st('negShade', 0) === '~p: x < 6' && st('negShade', 1) === '{2, 4}', '부정의 그림자 (83쪽 보기)');
  check(st('counterKnight', 0).startsWith('참') && st('counterKnight', 1).startsWith('거짓'), '반례 기사 (87쪽 예제 1)');
  let minV = Infinity, at = null;
  for (let a = -3; a <= 3; a += 0.25) for (let b = -3; b <= 3; b += 0.25) { const v = a * a + b * b - a * b; check(v >= -1e-12, 'a² + b² ≥ ab'); if (v < minV) { minV = v; at = [a, b]; } }
  check(near(minV, 0) && at[0] === 0 && at[1] === 0, '등호는 a = b = 0 일 때만');
  check(st('contraWarden', 0) === 'n이 홀수이면 n²도 홀수이다' && st('contraWarden', 1).startsWith('필요조건') && st('contraWarden', 2) === 'a = b = 0', '대우의 수호자 정답');
  // Ⅲ 9층
  check(2 * 2 + 1 === 5 && 5 * 5 - 1 === 24 && st('valSlime', 0) === '5' && st('valSlime', 1) === '24', '함숫값 슬라임 (112쪽 문제 1)');
  const f = (x) => -x + 2, g = (x) => 4 * x + 1;
  check(close((x) => g(f(x)), (x) => -4 * x + 9, XS) && close((x) => f(g(x)), (x) => -4 * x + 1, XS), '합성 키메라 직접 합성');
  check(st('chimera', 0) === '(g∘f)(x) = −4x + 9' && st('chimera', 1) === '(f∘g)(x) = −4x + 1', '합성 키메라 정답 (112쪽 예제 1)');
  const fi = (x) => x / 3 - 4 / 3;
  check(close((x) => fi(3 * x + 4), (x) => x, XS) && near(fi(4), 0), '역함수 마녀: f⁻¹(f(x)) = x, (4, 0)');
  check(st('inverseWitch', 1) === 'y = 1/3x − 4/3' && st('inverseWitch', 2) === '(4, 0)', '역함수 마녀 정답 (115쪽 예제 1)');
  // 10층
  check(st('asymGhost', 0) === 'y = 1/(x − 2) + 1' && st('asymGhost', 1) === 'x = 2, y = 1', '점근선 유령 (125쪽 보기)');
  check(close((x) => Math.sqrt(2 * x + 8) + 2, (x) => Math.sqrt(2 * (x + 4)) + 2, [-4, -3, 0, 2, 9]), '루트 뱀 변형');
  check(st('rootSnake', 0) === 'y = √(2(x + 4)) + 2' && st('rootSnake', 1) === '정의역 {x | x ≥ −4}, 치역 {y | y ≥ 2}', '루트 뱀 (131쪽 예제 2)');
  const K10 = (x) => (2 * x - 1) / (x + 1), Kinv = (x) => -3 / (x - 2) - 1;
  check(close(K10, (x) => -3 / (x + 1) + 2, XS) && close((x) => Kinv(K10(x)), (x) => x, XS), '점근의 왕: 변형 + 역함수 직접 확인');
  check(st('asymKing', 0) === 'y = −3/(x + 1) + 2' && st('asymKing', 1) === 'x = −1, y = 2' && st('asymKing', 2) === 'x = 2, y = −1', '점근의 왕 정답 (126쪽 예제 2)');
  // 엘리트
  check(st('centroid', 1) === '(2, 2)' && (0 - 3 + 9) / 3 === 2 && (6 + 0 + 0) / 3 === 2, '무게중심');
  check(st('bisector', 2) === 'y = −x + 7' && 3 + 4 === 7 && near(1 * -1, -1), '수직이등분선');
  // 당구: 반사 법칙 (입사각 = 반사각) — 꺾이는 점에서 기울기 부호만 바뀌는지
  const sl = (a, b) => (b[1] - a[1]) / (b[0] - a[0]);
  const P = [10, 30], A2 = [0, 25], B2 = [50, 0], Q = [70, 10];
  check(near(sl(P, A2), -sl(A2, B2)) && near(sl(A2, B2), -sl(B2, Q)) && st('billiard', 2) === 'A(0, 25), B(50, 0)', '당구 유령 (52쪽 문제 5) 반사 법칙');
  let mn = Infinity, mx = -Infinity;
  for (let both = 0; both <= 21; both++) { const uni = 28 + 21 - both; if (uni <= 40) { mn = Math.min(mn, both); mx = Math.max(mx, both); } }
  check(mn === 9 && mx === 21 && st('bikeClub', 0) === '9' && st('bikeClub', 1) === '21', '자전거 동아리 (79쪽 11번)');
  check(3 * 1 - 4 === -1 && 3 * 3 - 4 === 5 && -3 * 1 + 8 === 5 && -3 * 3 + 8 === -1, '일대일 수호령 (119쪽 10번)');
  // 연습 문제·보물상자
  for (const [id, gen] of Object.entries(MG.PRACTICE)) {
    check(Cards[id] && ['magic', 'rare'].includes(Cards[id].tier), `연습 문제 카드: ${id}`);
    for (let t = 0; t < 200; t++) { const q = gen(); check(q.choices.length === 4 && new Set(q.choices).size === 4 && q.choices[q.answerIndex] === q.answer, `연습 문제 보기: ${id}`); }
  }
  for (const [id, c] of Object.entries(Cards)) if (['magic', 'rare'].includes(c.tier)) check(MG.PRACTICE[id], `연습 문제 있음: ${id}`);
  for (let d = 1; d <= 3; d++) for (let t = 0; t < 300; t++) { const q = MG.chestQuestion(d); check(Number.isInteger(q.answer) && Math.abs(q.answer) <= 999 && q.solution, `보물상자 문제 ${d}: ${q.question}`); }
  // 차원: 기본 카드는 그 차원의 스캔 카드, 차원 보급 카드는 다음 차원 레시피의 재료
  for (const [d, dm] of Object.entries(DS.Dims)) check(Cards[dm.basic].dim === Number(d) && Cards[dm.basic].scan === 'always', `차원 기본 카드 ${d}`);
  for (const [d, sup] of Object.entries(Progress.dimSupply)) for (const id of Object.keys(sup)) check(Cards[id].dim < Number(d) && Craft.RULES.some((r) => r.in.includes(`card:${id}`) && Cards[r.out.id] && Cards[r.out.id].dim === Number(d)), `차원 보급 ${id} → ${d}차원 레시피 재료`);
  check(K.cost(K.roll('ptLine')) === 2 && K.cost(K.roll('diff')) === 1, '기력 2 카드: 점과 직선 사이의 거리');
}

if (failures) { console.error(`\n${failures}건 실패`); process.exit(1); }
console.log(`OK: 연성 규칙 ${Craft.RULES.length}개 · 카드 수치·옵션 · 덱 규칙 · 몬스터 ${Object.keys(Monsters).length}종 · 보스 정답 검산 · 3·4층 원 단원 검산 · v1 Ⅰ-3·Ⅱ·Ⅲ·엘리트 검산 · 연습 문제 · 보물상자 · 조합법 안내 · 세이브 왕복 통과`);
