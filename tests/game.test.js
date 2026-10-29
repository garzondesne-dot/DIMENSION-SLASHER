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
// 캠프에서 받는 부품·카드(점 x₁·x₂, 한 점, 무한 m′·영의 결정, 3층의 원 단원 부품과 원 (일반형) 카드)에서 규칙을 반복 적용해 도달 가능한 결과
const have = new Set(['part:x1', 'part:x2', 'part:pt1', 'part:mPrime', 'part:zero', 'part:radius', 'part:coefSq', 'card:genCircle']);
for (const n of Progress.nodes) {
  for (const id of Object.keys(n.parts || {})) check(have.has(`part:${id}`), `지급 부품이 시작 재료 목록에 있음: ${id}`);
  for (const id of Object.keys(n.cards || {})) check(Cards[id] && Cards[id].grant && have.has(`card:${id}`), `지급 카드: ${id}`);
}
for (let round = 0; round < 10; round++) {
  for (const r of Craft.RULES) {
    if (r.in.every((k) => have.has(k))) {
      if (r.out.kind === 'parts') { r.out.ids.forEach((id) => have.add(`part:${id}`)); continue; }
      const out = `${r.out.kind}:${r.out.id}`;
      have.add(out);
      if (Cards[r.out.id] && Cards[r.out.id].axis) { have.add(`${out}@x`); have.add(`${out}@y`); } // ⇄ 뒤집기
    }
  }
}
for (const [id, c] of Object.entries(Cards)) {
  if (['basic', 'normal', 'magic', 'rare'].includes(c.tier) && id !== 'dPlusR' && !c.grant) {
    if (['circle', 'ptLine'].includes(id) || c.tier !== 'rare') check(have.has(`card:${id}`), `연성 불가능한 카드: ${id}`);
  }
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
for (const id of Object.keys(Cards)) check(!Cards[id].grant || !Craft.book(id), `받는 카드는 도감에 없음: ${id}`);

// ── v0.3.2 연성 개편 ──────────────────────────────────────
const ALL = { unlocked: new Set(['sq', 'root']) }, NONE = { unlocked: new Set() }, SQ = { unlocked: new Set(['sq']) };
// ² 발견형: 잠겨 있으면 안 되고, 같은 것끼리 × 로는 차이² 를 만들며 발견 신호(sqTry)가 붙는다
check(!Craft.match('sq', tok('card:diff@x'), null, NONE).ok && /발견/.test(Craft.match('sq', tok('card:diff@x'), null, NONE).msg), '² 잠김');
check(Craft.match('sq', tok('card:diff@x'), null, SQ).ok, '² 발견 후 사용');
{
  const r1 = Craft.match('times', tok('card:diff@x'), tok('card:diff@x'), NONE);
  check(r1.ok && r1.out.id === 'diffSq' && r1.out.axis === 'x' && r1.sqTry, '차이 × 차이 = 차이² + ² 발견');
  const r2 = Craft.match('times', tok('card:diff@y'), tok('card:diff@y'), NONE);
  check(r2.ok && r2.out.axis === 'y' && r2.sqTry, '세로 차이 × 세로 차이 = 세로 차이²');
  check(Craft.match('times', tok('card:segLen@x'), tok('card:segLen@x'), NONE).out.id === 'diffSq', '선분 × 선분 = 차이²');
  const r3 = Craft.match('times', tok('card:diff@x'), tok('card:diff@y'), NONE);
  check(!r3.ok && !r3.sqTry && /넓이/.test(r3.msg), '가로 × 세로 = 넓이 (발견 아님)');
  const r4 = Craft.match('times', tok('part:x1'), tok('part:x1'), NONE);
  check(!r4.ok && r4.sqTry, '레시피에 없어도 같은 것끼리 × 는 ² 발견');
  check(!Craft.match('times', tok('part:x1'), tok('part:x2'), NONE).sqTry, '다른 것끼리 × 는 발견 아님');
}
// √ 발견형 + 제곱의 합 안내 (√ 를 못 찾았으면 꺼내기 안내, 찾았으면 √ 를 씌우라는 안내)
check(!Craft.match('root', tok('part:sumSq'), null, SQ).ok, '√ 잠김');
check(Craft.match('root', tok('part:sumSq'), null, ALL).out.id === 'dist', '√ 발견 후 거리');
check(/꺼내/.test(Craft.match('eq', tok('part:sumSq'), tok('part:radius'), SQ).msg), '제곱의 합 안내 (√ 잠김)');
check(/√를 씌워야/.test(Craft.match('eq', tok('part:sumSq'), tok('part:radius'), ALL).msg), '제곱의 합 안내 (√ 발견)');
check(/꺼내/.test(Craft.partNote('sumSq', SQ)) && Craft.partNote('sumSq', ALL) === '', '제곱의 합 완성 안내');
check(Ops.sq.discover && Ops.root.discover && !Ops.times.discover, '발견형 연산은 ²·√ 만');
// 점과 직선 사이의 거리: ⇄ 일반형 뒤집기, a² + b² 에 직접 √, 이 레시피에는 √ 힌트 없음
check(K.formula({ id: 'line', axis: 'y' }) === 'ax + by + c = 0' && K.axisLabel({ id: 'line', axis: 'y' }) === '일반형', '직선의 방정식 ⇄ 일반형');
check(K.formula({ id: 'diff', axis: 'y' }) === 'y₂ − y₁' && K.axisLabel({ id: 'diff', axis: 'x' }) === '가로', '차이 카드 ⇄ 세로 그대로');
check(Craft.match('subst', tok('card:line@y'), tok('part:pt1')).out.id === 'plug', '일반형 직선 ↦ 한 점');
check(/일반형/.test(Craft.match('subst', tok('card:line@x'), tok('part:pt1')).msg), '표준형이면 먼저 뒤집기 안내');
check(Craft.match('root', tok('part:coefSq')).out.id === 'normLen', 'a² + b² 에 √ → 계수 길이');
check(!/√/.test(Craft.match('div', tok('part:absPlug'), tok('part:coefSq')).msg), '점과 직선 거리: √ 힌트 없음');
check(Cards.ptLine.score === 7 + 8 * 2, '점과 직선 거리 투자 점수 23 = 소재 7 + 연성 8번 × 2');
check(!Parts.lineGen && !Parts.halfSq && !Parts.genCircle && !Cards.completeSq, '옛 부품·완전제곱 카드 삭제');
// 원의 방정식 둘째 길: 식 분해 → 영의 결정 → 합치기
{
  const sp = Craft.match('split', tok('card:genCircle'));
  check(sp.ok && sp.out.kind === 'parts' && sp.out.ids.join() === 'xPart,yPart', '식 분해 → x 조각 + y 조각');
  check(Craft.match('plus', tok('part:xPart'), tok('part:zero')).out.id === 'xSq' && Craft.match('plus', tok('part:zero'), tok('part:yPart')).out.id === 'ySq', '조각 + 0 → 완전제곱');
  check(Craft.match('plus', tok('part:xSq'), tok('part:ySq')).out.id === 'circle', '두 완전제곱 합치기 → 원의 방정식');
  check(/아직 둘 다/.test(Craft.match('plus', tok('part:xPart'), tok('part:yPart')).msg), '분해 직후 합치기 안내');
  check(/영\(零\)/.test(Craft.match('sq', tok('part:xPart')).msg), '0 없이 연성 안내');
  check(/짝/.test(Craft.match('plus', tok('part:zero'), tok('part:x1')).msg), '0 혼자 안내');
  check(/이미/.test(Craft.match('plus', tok('part:xSq'), tok('part:xSq')).msg), '같은 쪽 두 번 안내');
  check(Parts.zero.inf && Parts.zero.floor === 3 && Ops.split.floor === 3, '영의 결정 무한·식 분해 3층부터');
  check(/a = −3/.test(Craft.book('circle').lore), '부호 안내 (a = −3)');
  check(Craft.book('circle').alt && /반지름/.test(Craft.book('circle').alt.chain), '원의 방정식 길 2개');
}
// 독립 검산: x² − 2ax = (x − a)² − a² 이고, 두 조각을 합치면 (x − a)² + (y − b)² = a² + b² (r² = a² + b²)
for (let t = 0; t < 2000; t++) {
  const a = Math.floor(Math.random() * 21) - 10, b = Math.floor(Math.random() * 21) - 10;
  const x = Math.random() * 20 - 10, y = Math.random() * 20 - 10;
  check(near(x * x - 2 * a * x, (x - a) ** 2 - a * a), `x 완전제곱 a=${a}`);
  check(near(x * x + y * y - 2 * a * x - 2 * b * y, (x - a) ** 2 + (y - b) ** 2 - (a * a + b * b)), `원 일반형 = 표준형 a=${a} b=${b}`);
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
  // 가면 원령 ①: 도구는 원의 방정식, 상수 −3 을 빠뜨린 함정 (= 13 = 9 + 4) 이 보기에 있고 힌트가 붙음
  const mq = Monsters.mask.makeProblem().steps[0];
  check(mq.tool === 'circle' && mq.challenge().choices.includes('(x + 3)² + (y − 2)² = 13') && /−3 도 오른쪽/.test(mq.challenge().question), '가면 원령 ① 도구·함정·힌트');
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
for (const n of Progress.nodes.filter((x) => x.type === 'battle')) {
  for (const s of Monsters[n.monster].makeProblem().steps) {
    if (Cards[s.tool].tier === 'unique') {
      check(s.forge && s.forge.from.every((id) => Craft.book(id)), `캠페인 유니크 각성 재료: ${s.tool}`);
    } else check(Craft.book(s.tool) && ['normal', 'magic', 'rare'].includes(Cards[s.tool].tier), `캠페인 도구 연성 가능: ${s.tool}`);
    // 도구 카드의 레시피가 그 층까지 열려 있어야 함
    if (Craft.book(s.tool)) check(Craft.book(s.tool).floor <= n.floor, `도구 레시피 층: ${s.tool} (${n.floor}층)`);
  }
}

// 조합법 창(베타)의 안내가 실제 연성 규칙과 맞는지: 각 단계를 그대로 모루에 올려 결과를 확인
for (const r of Craft.BOOK) {
  check(Array.isArray(r.guide) && r.guide.length, `조합법 안내 있음: ${r.card}`);
  for (const guide of [r.guide, ...(r.alt ? [r.alt.guide] : [])]) {
    let last = null;
    for (const [a, op, b, out] of guide) {
      const res = Craft.match(op, a && tok(a), b && tok(b));
      const got = !res.ok ? res.msg : res.out.kind === 'parts' ? `parts:${res.out.ids.join(',')}`
        : `${res.out.kind}:${res.out.id}${res.out.axis ? '@' + res.out.axis : ''}`;
      check(got === out, `조합법 안내 ${r.card}: ${a} ${op} ${b} → ${got} (기대 ${out})`);
      last = out;
    }
    check(last && last.startsWith(`card:${r.card}`), `조합법 안내 마지막 결과: ${r.card}`);
  }
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
  // 발견한 연산은 저장되고 되감기·이어하기 후에도 유지
  const G2 = Save.unpack(JSON.parse(JSON.stringify(Save.pack({ ...G0, unlocked: new Set(['sq']) }))));
  check(G2.unlocked.has('sq') && !G2.unlocked.has('root'), '세이브 발견 연산');
}
// v0.3.2 이전 저장 옮기기: 완전제곱 카드 → 원 (일반형) 카드, 옛 부품 정리, 골렘을 지난 저장은 ²·√ 해금
{
  const golem = Progress.nodes.findIndex((n) => n.monster === 'golem');
  const old = (maxNode, extra = {}) => ({
    ver: Save.VER, node: maxNode, maxNode, loop: 1, discovered: ['diff', 'completeSq'], mastery: { completeSq: 2 }, granted: [], params: {}, stats: {},
    cards: [{ ...K.roll('diff'), uid: 'a' }, { ...K.roll('dist'), id: 'completeSq', uid: 'b' }], deckUids: ['a', 'b'],
    bag: { genCircle: 1, halfSq: 2, lineGen: 3, normLen: 3, x1: 1 }, ...extra,
  });
  const g = Save.unpack(old(9));
  check(!g.cards.some((c) => c.id === 'completeSq') && g.cards.filter((c) => c.id === 'genCircle').length === 2, '옛 저장: 완전제곱 카드 → 원 (일반형) 카드');
  check([...g.deckUids].join() === 'a' && !g.discovered.has('completeSq') && g.mastery.completeSq === undefined, '옛 저장: 덱·도감·숙련 정리');
  check(g.bag.coefSq === 3 && g.bag.genCircle === undefined && g.bag.halfSq === undefined && g.bag.lineGen === undefined && g.bag.normLen === undefined && g.bag.x1 === 1, '옛 저장: 부품 정리');
  check(g.unlocked.has('sq') && g.unlocked.has('root'), '옛 저장(골렘 지남): ²·√ 해금');
  check(Save.unpack(old(golem - 1)).unlocked.size === 0, '옛 저장(골렘 전): 발견형 그대로');
  check(Save.unpack(old(9, { unlocked: ['sq'] })).unlocked.size === 1, '새 저장의 발견 기록은 그대로');
}
// 1층 부담 분산: 첫 캠프(튜토리얼) → 슬라임 보상 nudge → 골렘 직전 캠프 안내 → 골렘 입장 √ · 2층 입장 ² 자동 해금
{
  const N = Progress.nodes, at = (m) => N.findIndex((n) => n.monster === m);
  check(N[at('slime')].nudge === 'sq' && N[at('slime') + 1].type === 'camp' && N[at('slime') + 1].guide, '슬라임 보상 nudge, 골렘 직전 캠프 안내');
  check(N[at('golem')].autoOps.includes('root'), '골렘 입장 √ 자동 해금');
  const c2 = N.findIndex((n) => n.type === 'camp' && n.floor === 2);
  check(N[c2].autoOps.includes('sq') && N[c2].autoOps.includes('root'), '2층 입장 ² 자동 해금');
  // 골렘 ② 단계 도구(두 점 사이의 거리)는 √ 가 필요하다 → √ 자동 해금이 골렘 입장보다 늦으면 안 됨
  check(Monsters.golem.makeProblem().steps.some((s2) => s2.tool === 'dist'), '골렘은 두 점 사이의 거리 필요');
  const c3 = N.find((n) => n.type === 'camp' && n.floor === 3);
  check(c3.cards.genCircle === 2 && c3.parts.coefSq >= 1, '3층 캠프: 원 (일반형) 카드 2장, 계수 제곱합');
}

// ── 앱 설치(PWA): 서비스 워커가 저장할 파일 목록이 index.html 의 스크립트와 같은지, 캐시 이름이 버전과 같은지
{
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
  const scripts = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map((m) => m[1]);
  for (const s2 of scripts) check(sw.includes(`'./${s2}'`), `서비스 워커 저장 목록에 없음: ${s2}`);
  check(sw.includes(`const CACHE = 'ds-${ctx.DS.VERSION}';`), `서비스 워커 캐시 이름 = 버전 (${ctx.DS.VERSION})`);
  const mf = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.webmanifest'), 'utf8'));
  check(mf.display === 'standalone' && mf.icons.some((x) => x.sizes === '512x512') && mf.icons.some((x) => x.sizes === '192x192'), '매니페스트: 설치 조건');
  for (const ic of mf.icons) check(fs.existsSync(path.join(__dirname, '..', ic.src)), `아이콘 파일: ${ic.src}`);
}

if (failures) { console.error(`\n${failures}건 실패`); process.exit(1); }
console.log(`OK: 연성 규칙 ${Craft.RULES.length}개 · 카드 수치·옵션 · 덱 규칙 · 몬스터 ${Object.keys(Monsters).length}종 · 보스 정답 검산 · 3·4층 원 단원 검산 · 조합법 안내 · 세이브 왕복 · 앱 설치 파일 통과`);
