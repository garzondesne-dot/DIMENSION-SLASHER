// 게임 데이터 검증: node tests/game.test.js
// (1) 모든 일반·매직 카드가 처음 지급되는 부품만으로 연성 가능한지
// (2) 몬스터 문제의 각 단계가 올바른 정답 하나를 갖는지, 보스 정답을 독립적으로 검산
// (3) 문턱(gates)과 도구 카드 구성이 규칙에 맞는지
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = vm.createContext({});
ctx.window = ctx;
for (const f of ['mathgen', 'data', 'craft', 'monsters']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, `../js/${f}.js`), 'utf8'), ctx);
}
const { Cards, Craft, Monsters, Progress, Parts, Ops, Tiers } = ctx.DS;

let failures = 0;
function check(cond, msg) {
  if (!cond) { failures++; if (failures <= 15) console.error('FAIL:', msg); }
}
const near = (a, b) => Math.abs(a - b) < 1e-9;

// ── 1. 연성 규칙 ──────────────────────────────────────────
// 기본 부품에서 출발해 규칙을 반복 적용했을 때 도달 가능한 결과 (선분은 가로/세로 둘 다 가능)
const have = new Set(['part:ptA', 'part:ptB', 'part:dy', 'part:dx', 'part:pt1']);
const tok = (k) => {
  const [kind, rest] = k.split(':');
  const [id, axis] = rest.split('@');
  return { kind, id, axis };
};
for (let round = 0; round < 6; round++) {
  for (const r of Craft.RULES) {
    if (r.in.every((k) => have.has(k.replace(/@[xy]$/, '')) || have.has(k))) {
      const out = `${r.out.kind}:${r.out.id}`;
      have.add(out);
      if (r.out.id === 'segLen') { have.add('card:segLen@x'); have.add('card:segLen@y'); }
    }
  }
}
for (const [id, c] of Object.entries(Cards)) {
  if (c.tier === 'normal' || c.tier === 'magic') check(have.has(`card:${id}`), `연성 불가능한 카드: ${id}`);
}
// 규칙 하나하나가 match 로 실제 성공하는지, 나눗셈 순서가 반영되는지
for (const r of Craft.RULES) {
  const mats = r.in.map(tok);
  const res = Craft.match(r.op, mats[0], mats[1]);
  check(res.ok && res.out.id === r.out.id, `규칙 불일치: ${r.op} ${r.in}`);
}
check(!Craft.match('div', tok('part:dx'), tok('part:dy')).ok, '나눗셈 순서가 거꾸로여도 통과함');
check(/거꾸로/.test(Craft.match('div', tok('part:dx'), tok('part:dy')).msg), '나눗셈 역순 피드백 없음');
check(/축을 바꿔/.test(Craft.match('plus', tok('part:sqX'), tok('part:sqX')).msg), '축 바꾸기 피드백 없음');
check(/중점/.test(Craft.match('plus', tok('part:ptA'), tok('part:ptB')).msg), '중점 피드백 없음');
check(Craft.match('sq', tok('card:segLen@y')).out.id === 'sqY', '세로 선분 제곱이 sqY 가 아님');
check(!Craft.match('sq', tok('card:segLen@x'), tok('card:segLen@x')).ok, '단항 연산에 재료 두 개가 통과함');
for (const b of Craft.BOOK) {
  check(Cards[b.card] && ['normal', 'magic'].includes(Cards[b.card].tier), `도감 카드 등급 이상: ${b.card}`);
  for (const id of Object.keys(b.quick.parts || {})) check(Parts[id], `즉시 연성 부품 없음: ${id}`);
  for (const id of Object.keys(b.quick.cards || {})) check(Cards[id], `즉시 연성 카드 없음: ${id}`);
}
check(Object.values(Ops).length >= 8, '연산 수');
check(Tiers.magic.crit === 0.1 && Tiers.unique.critMult === 2, '크리티컬 수치');

// ── 2. 몬스터 문제 ────────────────────────────────────────
const tools = new Set();
for (const [key, m] of Object.entries(Monsters)) {
  for (let rep = 0; rep < 300; rep++) {
    const prob = m.makeProblem();
    check(prob.steps.length === m.gates.length, `${key}: 단계 수와 문턱 수 다름`);
    for (let i = 1; i < m.gates.length; i++) check(m.gates[i] <= m.gates[i - 1], `${key}: 문턱이 내림차순 아님`);
    check(m.gates[0] < m.maxHp, `${key}: 첫 문턱이 최대 체력 이상`);
    prob.steps.forEach((s, i) => {
      if (s.tool) { check(!!Cards[s.tool], `${key}: 없는 도구 ${s.tool}`); tools.add(s.tool); }
      const q = s.challenge();
      check(q.choices.length === 4 && new Set(q.choices).size === 4, `${key} ${i}: 보기 4개가 서로 달라야 함`);
      check(q.choices[q.answerIndex] === q.answer, `${key} ${i}: 정답 위치`);
    });
  }
}

// 고정 문제 정답 + 독립 검산
const ans = (m, i) => Monsters[m].makeProblem().steps[i].challenge().answer;
// 골렘: A(−1,2), B(5,8) 을 2:1 내분 → ((2·5+1·(−1))/3, (2·8+1·2)/3) = (3, 6), OP = √(9+36) = 3√5
check((2 * 5 + 1 * -1) / 3 === 3 && (2 * 8 + 1 * 2) / 3 === 6, '골렘 내분점 검산');
check(ans('golem', 0) === '(3, 6)', `골렘 1단계: ${ans('golem', 0)}`);
check(near(Math.hypot(3, 6), 3 * Math.sqrt(5)) && ans('golem', 1) === '3√5', `골렘 2단계: ${ans('golem', 1)}`);
// 방패 거수: y = −½x + 1 에 수직 → (−½)·m′ = −1 → m′ = 2, P(1,−1) 지남 → y = 2x − 3
check(near(-0.5 * 2, -1) && 2 * 1 - 3 === -1, '거수 검산');
check(ans('beast', 0) === '2', `거수 1단계: ${ans('beast', 0)}`);
check(ans('beast', 1) === 'y = 2x − 3', `거수 2단계: ${ans('beast', 1)}`);
// 최종보스 (41쪽 11번): r = 2√2, d = 6/√2 = 3√2, √2 ≤ h ≤ 5√2, S = h²/√3, 최소 2√3/3, 최대 50√3/3
const r = Math.sqrt(8), d = Math.abs(0 - 0 + 6) / Math.hypot(1, -1);
check(near(r, 2 * Math.SQRT2) && near(d, 3 * Math.SQRT2), '보스 r, d 검산');
check(near(d - r, Math.SQRT2) && near(d + r, 5 * Math.SQRT2), '보스 높이 범위 검산');
const areaFromSide = (h) => { const a = (2 * h) / Math.sqrt(3); return (Math.sqrt(3) / 4) * a * a; };
check(near(areaFromSide(Math.SQRT2), 2 * Math.sqrt(3) / 3) && near(areaFromSide(5 * Math.SQRT2), 50 * Math.sqrt(3) / 3), '보스 넓이 검산');
check(near(areaFromSide(2.7), 2.7 * 2.7 / Math.sqrt(3)), 'S = h²/√3 검산');
const boss = ['x − y + 6 = 0', '중심 (0, 0), 반지름 2√2', '3√2', '√2 ≤ h ≤ 5√2', 'S = h²/√3', '최솟값 2√3/3 · 최댓값 50√3/3'];
boss.forEach((a, i) => check(ans('finalBoss', i) === a, `최종보스 ${i + 1}단계: ${ans('finalBoss', i)}`));
// 그림 속 정삼각형: A(2,−2) 에서 직선 x − y + 6 = 0 까지 높이 5√2, 세 변 길이 같음, B·C 가 직선 위
const tri = Monsters.finalBoss.makeProblem().figure.els.find((e) => e.t === 'tri').pts;
const side = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
check(near(side(tri[0], tri[1]), side(tri[1], tri[2])) && near(side(tri[1], tri[2]), side(tri[2], tri[0])), '그림 정삼각형 변의 길이');
check(near(tri[1][1] - tri[1][0], 6) && near(tri[2][1] - tri[2][0], 6), '그림 B, C 가 직선 위');
check(near(Math.abs(tri[0][0] - tri[0][1] + 6) / Math.SQRT2, 5 * Math.SQRT2), '그림 최대 높이');

// ── 3. 캠페인 구성 ────────────────────────────────────────
// 캠페인 몬스터의 도구는 모두 연성 가능한 카드여야 한다 (레어 이상은 체험판 전용)
for (const n of Progress.nodes.filter((x) => x.type === 'battle')) {
  for (const s of Monsters[n.monster].makeProblem().steps) {
    check(['normal', 'magic'].includes(Cards[s.tool].tier), `캠페인 도구가 연성 불가 등급: ${s.tool}`);
  }
}
check(Progress.nodes[Progress.nodes.length - 1].type === 'clear', '마지막 노드는 클리어');

if (failures) { console.error(`\n${failures}건 실패`); process.exit(1); }
console.log(`OK: 연성 규칙 ${Craft.RULES.length}개 · 몬스터 ${Object.keys(Monsters).length}종 · 보스 정답 검산 통과`);
