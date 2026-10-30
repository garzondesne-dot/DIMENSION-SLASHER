// 번외편 「포함의 결계」 검증: node sets/tests/game.test.js
// (1) 엄격한 연성: 모든 카드가 지급 부품으로 연성 가능, 순서·자리가 틀리면 실패 + 개념 메시지, 도감 안내 = 실제 규칙
// (2) 연성 예제 · 몬스터 문제: 정답을 부분집합을 직접 세거나 집합을 직접 비교해 독립 검산, 채점(DS.Quiz.grade) 확인
// (3) 진행: 자물쇠·필요 카드·도구 순서, 해금 코드, 세이브 왕복
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = vm.createContext({ localStorage: { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } } });
ctx.window = ctx;
for (const f of ['mathgen', 'setgen', 'codes', 'data', 'craft', 'cards', 'monsters', 'save']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, `../js/${f}.js`), 'utf8'), ctx);
}
// quiz.js 의 채점 함수만 쓴다 (DOM 없이)
ctx.document = { querySelector: () => null };
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/quiz.js'), 'utf8'), ctx);
const { Cards, Craft, CardKit: K, Monsters, Progress, Parts, Ops, SetGen: S, Codes, Save, Quiz } = ctx.DS;

let failures = 0;
function check(cond, msg) { if (!cond) { failures++; if (failures <= 30) console.error('FAIL:', msg); } }
const tok = (k) => { const [kind, id] = k.split(':'); return { kind, id }; };
const M = (op, a, b) => Craft.match(op, a && tok(a), b && tok(b));

// ── 1. 연성 ─────────────────────────────────────────────
const have = new Set(Object.keys(Parts).filter((id) => Parts[id].inf).map((id) => `part:${id}`));
Progress.nodes.forEach((n) => Object.keys(n.parts || {}).forEach((id) => have.add(`part:${id}`)));
for (let round = 0; round < 6; round++) {
  for (const r of Craft.RULES) if (r.in.every((k) => have.has(k))) have.add(`${r.out.kind}:${r.out.id}`);
}
for (const id of Object.keys(Cards)) if (id !== 'member') check(have.has(`card:${id}`), `연성 불가능한 카드: ${id}`);
for (const r of Craft.RULES) {
  const res = M(r.op, r.in[0], r.in[1]);
  check(res.ok && res.out.id === r.out.id, `규칙 불일치: ${r.op} ${r.in}`);
  if (r.ordered && r.in.length === 2 && r.in[0] !== r.in[1]) {
    const rev = M(r.op, r.in[1], r.in[0]);
    check(!rev.ok || rev.out.id !== r.out.id, `순서를 바꿔도 같은 결과면 안 됨 (엄격): ${r.op} ${r.in}`);
  }
}
// 엄격: 틀린 자리 → 실패 + 개념 메시지
const fail = (op, a, b, re, label) => { const r = M(op, a, b); check(!r.ok && re.test(r.msg), `${label}: ${r.msg}`); };
fail('in', 'part:setA', 'part:elem', /왼쪽은 원소/, '∈ 순서 거꾸로');
fail('in', 'part:setA', 'part:setB', /⊂/, '집합 ∈ 집합');
fail('sub', 'part:elem', 'part:setA', /∈/, '원소 ⊂ 집합');
fail('count', 'part:elem', null, /집합/, 'n( ) 안에 원소');
fail('and', 'card:subset', 'part:setB', /반대 방향/, '한쪽만 포함으로 같은 집합');
fail('pow', 'card:count', 'part:branch', /거꾸로/, '2ⁿ 밑·지수 거꾸로');
fail('minus', 'part:fixP', 'card:subsetCount', /거꾸로/, '2ⁿ⁻ᵖ 순서 거꾸로');
check(!M('in', 'part:elem', null).ok, '∈ 는 양쪽 재료가 필요');
check(M('sub', 'part:setB', 'part:setA').out.id === 'subBA' && M('sub', 'part:setA', 'part:setB').out.id === 'subset', '⊂ 방향에 따라 다른 결과');
check(M('and', 'part:nsubBA', 'card:subset').out.id === 'proper', '이고는 순서 무관 (A ⊂ B 이고 B ⊄ A = 진부분집합)');
// 도감 안내가 실제 규칙과 같은지
for (const r of Craft.BOOK) {
  let last = null;
  for (const [a, op, b, out] of r.guide) {
    const res = M(op, a, b);
    const got = res.ok ? `${res.out.kind}:${res.out.id}` : res.msg;
    check(got === out, `도감 안내 ${r.card}: ${a} ${op} ${b} → ${got} (기대 ${out})`);
    last = out;
  }
  check(last === `card:${r.card}`, `도감 마지막 결과: ${r.card}`);
  check(S.EXAMPLES[r.card] && S.EXAMPLES[r.card].length >= 2, `연성 예제 2개 이상: ${r.card}`);
  for (const id of Object.keys(r.quick.parts || {})) check(Parts[id] && !Parts[id].inf, `즉시 연성 부품: ${id}`);
}
// 필요 카드(need)는 그 층까지의 도감에 있고, 그 층의 연산·부품으로 만들 수 있어야 함
for (const n of Progress.nodes.filter((x) => x.need)) {
  for (const id of n.need) {
    const b = Craft.book(id);
    check(b && b.floor <= n.floor, `캠프 필요 카드의 레시피 층: ${id}`);
    for (const [, op] of b.guide) check(!Ops[op].floor || Ops[op].floor <= n.floor, `${id} 의 연산 ${op} 가 ${n.floor}층에 보여야 함`);
  }
}
// 전투 도구는 그 전투 전에 연성되어 있어야 함 (앞 캠프들의 need 누적)
{
  const made = new Set();
  Progress.nodes.forEach((n) => {
    (n.need || []).forEach((id) => made.add(id));
    if (n.type !== 'battle') return;
    for (const st of Monsters[n.monster].makeProblem().steps) check(made.has(st.tool), `${n.monster}: 도구 ${st.tool} 를 이전 캠프에서 연성하지 않음`);
  });
}

// ── 2. 독립 검산 ─────────────────────────────────────────
// 집합 원소를 직접 계산 (문제 문장과 독립)
const divisors = (n) => Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);
check(divisors(12).join() === '1,2,3,4,6,12' && divisors(25).join() === '1,5,25' && divisors(6).join() === '1,2,3,6' && divisors(18).join() === '1,2,3,6,9,18', '약수');
const roots = (f) => { const r = []; for (let x = -20; x <= 20; x++) if (f(x) === 0) r.push(x); return r; };
check(roots((x) => x * x - 2 * x).join() === '0,2' && roots((x) => x * x - 4 * x + 3).join() === '1,3' && roots((x) => x * x - 1).join() === '-1,1', '방정식의 해집합');
const cnt = (base, must = [], not = []) => { let c = 0; for (let m = 0; m < 1 << base.length; m++) { const s = base.filter((_, i) => m & (1 << i)); if (must.every((x) => s.includes(x)) && not.every((x) => !s.includes(x))) c++; } return c; };
// 채점기: 형식별 정답이면 true, 오답이면 false
function solveAndGrade(p, label) {
  let right, wrong;
  if (p.type === 'blanks') { right = p.items.map((it) => it.answer); wrong = right.map((a) => p.options.find((o) => o !== a)); }
  else if (p.type === 'ox') { right = p.answer; wrong = !p.answer; }
  else if (p.type === 'number') { right = p.answer; wrong = p.answer + 1; }
  else if (p.type === 'multi') { right = p.answer.slice(); wrong = p.answer.slice(1); }
  else if (p.type === 'subsets') { right = S.allSubsets(p.base); wrong = S.allSubsets(p.base).slice(1); }
  else { right = p.answerIndex; wrong = (p.answerIndex + 1) % p.choices.length; }
  check(Quiz.grade(p, right), `채점 정답 인정: ${label}`);
  check(!Quiz.grade(p, wrong), `채점 오답 거부: ${label}`);
  check(p.solution && p.question, `해설·문제 문장: ${label}`);
}
// 2-1. 연성 예제: check 정보로 직접 다시 계산
for (const [id, list] of Object.entries(S.EXAMPLES)) {
  list.forEach((mk, k) => {
    const p = mk(), c = p.check, label = `예제 ${id} ${k}`;
    solveAndGrade(p, label);
    if (p.type === 'blanks') {
      const it = p.items[0];
      if (c.elem != null) check(it.answer === (c.set.includes(c.elem) ? '∈' : '∉'), label);
      else if (id === 'subset') check(it.answer === (S.isSubset(c.a, c.b) ? '⊂' : '⊄'), label);
      else check(it.answer === (S.sameSet(c.a, c.b) ? '=' : '≠'), label);
    } else if (p.type === 'number') {
      const want = c.set ? c.set.length : c.proper ? cnt(c.base) - 1 : cnt(c.base, c.must, c.not);
      check(p.answer === want, `${label}: ${p.answer} vs ${want}`);
    }
  });
}
// 조건제시법 원소를 문제와 독립적으로 확인
check(S.sameSet([1, 3, 5, 7, 9], [1, 3, 5, 7, 9].filter((x) => x % 2 && x <= 10)), '10 이하 홀수');
check(S.sameSet([1, 2, 3, 4, 6, 12], divisors(12)) && S.sameSet([1, 2, 4], divisors(4)), '약수 집합');
// 2-2. 몬스터 문제 (정답을 직접 계산)
const A12 = divisors(12);
const want = {
  belongSlime: [[A12.includes(4) ? '∈' : '∉', A12.includes(8) ? '∈' : '∉'], [A12.includes(12) ? '∈' : '∉', A12.includes(5) ? '∈' : '∉', A12.includes(1) ? '∈' : '∉']],
  emptyGhost: [[].length + [0].length, false],
  unitGolem: [S.isSubset([1, 5, 25], divisors(25)) ? '⊂' : '⊄', S.isSubset([-2, 0, 2], roots((x) => x * x - 2 * x)) ? '⊂' : '⊄'],
  includeKnight: [null, true],
  mirrorTwins: [[S.sameSet(divisors(4), [1, 2, 4]) ? '=' : '≠', S.sameSet([2, 4, 6, 8], [2, 4, 6]) ? '=' : '≠'], [0, 1, 2, 3, 4, 5].find((a) => S.sameSet([1, a + 1], [1, 4]))],
  collector: [null, cnt([1, 2, 3]) - 1],
  mixCrab: [S.sameSet(roots((x) => x * x - 1), [-1, 1]) ? '=' : '≠', '⊂'],
  mixWisp: [cnt(divisors(6)) - 1, cnt(['a', 'b', 'c', 'd', 'e'])],
  mixKnight: [null, null],
  powerGuardian: [cnt(A12), cnt(A12, [1, 12]), cnt(A12, [], A12.filter((x) => x % 2)), cnt(A12, [2, 4], [3])],
};
check(want.powerGuardian.join() === '64,16,16,8', `중간보스 직접 계산 ${want.powerGuardian}`);
check(want.mirrorTwins[1] === 3 && want.mixWisp.join() === '15,32' && want.collector[1] === 7, '쌍둥이·도깨비불·수집가 직접 계산');
for (const [id, m] of Object.entries(Monsters)) {
  const prob = m.makeProblem();
  check(prob.steps.length === m.gates.length, `${id}: 단계 수 = 문턱 수`);
  for (let i = 1; i < m.gates.length; i++) check(m.gates[i] < m.gates[i - 1], `${id}: 문턱 내림차순`);
  check(m.gates[0] < m.maxHp && m.gates[m.gates.length - 1] > 0, `${id}: 문턱 범위`);
  check(prob.steps[prob.steps.length - 1].needs === prob.pieces.length, `${id}: 마지막 단계는 문제 전체 필요`);
  check(Cards[m.sprite] === undefined, `${id}: sprite 이름이 카드와 겹치지 않음`);
  prob.steps.forEach((st, k) => {
    const p = st.challenge(), label = `${id} ${k + 1}단계`;
    check(Cards[st.tool] && Cards[st.tool].tool, `${label}: 도구 카드`);
    // 벤 다이어그램 문제에 쓸 수 있는 연출만 (좌표평면 전용 'shield' 는 멈춤을 일으킴)
    check(!st.fx || !st.fx.shatter || ['golemArmor', 'ring'].includes(st.fx.shatter), `${label}: 부서짐 연출 ${st.fx && st.fx.shatter}`);
    solveAndGrade(p, label);
    const w = want[id][k];
    if (w == null) return;
    if (p.type === 'blanks') {
      const got = p.items.map((it) => it.answer);
      check(JSON.stringify(Array.isArray(w) ? w : [w]) === JSON.stringify(got), `${label}: ${got} vs ${w}`);
    } else check(p.answer === w, `${label}: ${p.answer} vs ${w}`);
  });
}
// 포함의 기사: 옳지 않은 것 = 원소에 ⊂, 집합에 ∈
{
  const p = Monsters.includeKnight.makeProblem().steps[0].challenge();
  const truth = (o) => {
    const m = o.replace(/−/g, '-').match(/^(.+?) (∈|⊂) (.+)$/);
    const parse = (t) => (t === '∅' ? [] : t.startsWith('{') ? t.slice(1, -1).split(',').map((x) => Number(x)) : Number(t));
    const L = parse(m[1]), R = parse(m[3]);
    if (m[2] === '∈') return !Array.isArray(L) && R.includes(L);
    return Array.isArray(L) && S.isSubset(L, R);
  };
  const bad = p.options.map((o, i) => (truth(o) ? -1 : i)).filter((i) => i >= 0);
  check(JSON.stringify(bad) === JSON.stringify(p.answer), `포함의 기사 옳지 않은 것: ${bad} vs ${p.answer}`);
}
// 미지수 기사: a 를 직접 대입
{
  const st = Monsters.mixKnight.makeProblem().steps;
  const p1 = st[0].challenge();
  const ok = [1, 2, 3, 4].filter((a) => S.isSubset([a, a + 2], [1, 2, 3, 4]));
  check(JSON.stringify(ok.map((a) => a - 1)) === JSON.stringify(p1.answer), `미지수 기사 ① ${ok}`);
  let found = null;
  for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) if (new Set([1, 3, a]).size === 3 && new Set([1, b, 5]).size === 3 && S.sameSet([1, 3, a], [1, b, 5])) found = a + b;
  check(st[1].challenge().answer === found && found === 8, `미지수 기사 ② a + b = ${found}`);
}
// 부분집합 모두 만들기: ∅ 이나 자기 자신이 빠지면 안내
{
  const p = Monsters.collector.makeProblem().steps[0].challenge();
  check(/공집합/.test(Quiz.subsetsNote(p, S.allSubsets(p.base).filter((s) => s.length))), '∅ 빠짐 안내');
  check(/자기 자신/.test(Quiz.subsetsNote(p, S.allSubsets(p.base).filter((s) => s.length < 3))), '자기 자신 빠짐 안내');
  check(!Quiz.grade(p, [...S.allSubsets(p.base), [1]]), '중복은 오답');
}

// ── 3. 진행 · 해금 코드 · 세이브 ─────────────────────────────
const locks = Progress.nodes.filter((n) => n.lock).map((n) => n.lock);
check(new Set(locks).size === locks.length && locks.every((k) => Codes.LOCKS.some((l) => l.key === k)), '자물쇠 이름 = 교사용 코드 목록');
check(Progress.nodes.filter((n) => n.floor === 4 && n.type === 'battle').every((n) => !n.lock && n.solo), '3페이즈 몬스터는 코드 하나로 전부');
check(Progress.nodes[Progress.nodes.length - 2].monster === 'powerGuardian', '중간보스가 마지막');
const days = ['2026-11-03', '2026-11-04'];
for (const d of days) {
  const cs = Codes.LOCKS.map((l) => Codes.code(l.key, d));
  check(cs.every((c, i) => (Codes.LOCKS[i].key === 'solve' ? /^\d{4}$/ : /^\d{3}$/).test(c)), `코드 자릿수 ${d}`);
  check(new Set(cs).size === cs.length, `같은 날 코드가 겹치지 않음 ${d}: ${cs}`);
}
check(Codes.code('m1', days[0]) !== Codes.code('m1', days[1]) || Codes.code('m2', days[0]) !== Codes.code('m2', days[1]), '날짜마다 코드가 바뀜');
check(Codes.check('m1', Codes.code('m1')) && !Codes.check('m1', '000'), '오늘 코드 확인');
{
  const cards = [K.roll('member'), K.roll('belong')];
  const G0 = { node: 3, maxNode: 4, loop: 2, cards, deckUids: new Set(cards.map((c) => c.uid)), bag: { setA: 2 }, discovered: new Set(['member', 'belong']),
    mastery: { belong: 1 }, granted: new Set([0]), problems: {}, stats: { asked: 3 }, opened: new Set(['m1', 'm2']), solveMode: true, wins: [1, 2], tuts: [1], battleTips: true };
  const G1 = Save.unpack(JSON.parse(JSON.stringify(Save.pack(G0))));
  check(G1.node === 3 && G1.opened.has('m2') && G1.solveMode && G1.wins.join() === '1,2' && G1.tuts[0] === 1 && G1.battleTips, '세이브 왕복 (자물쇠·문제풀이모드·공략·안내)');
  check(Save.KEY === 'dimension-slasher-sets-save', '번외편 저장은 본편과 따로');
}
// 재료로 쓰고도 나중 전투의 도구로 다시 필요한 카드는 사라지면 안 됨 (keep 또는 레어)
{
  const usedLater = new Set();
  Progress.nodes.forEach((n, i) => {
    if (n.type !== 'battle') return;
    Monsters[n.monster].makeProblem().steps.forEach((st) => usedLater.add(st.tool));
  });
  for (const r of Craft.RULES) for (const k of r.in) {
    const [kind, id] = k.split(':');
    if (kind === 'card' && usedLater.has(id)) check(Cards[id].keep || Cards[id].tier === 'rare', `재료로 쓰이는 도구 카드는 남아야 함: ${id}`);
  }
}
// 덱: 모든 카드를 넣어도 덱 규칙 안
{
  const deck = [...Array.from({ length: 6 }, () => K.roll('member')), ...Craft.BOOK.map((r) => K.roll(r.card))];
  check(K.checkDeck(deck, 2).ok, `모든 카드를 넣은 덱이 규칙 안 (${deck.length}장)`);
}

if (failures) { console.error(`\n${failures}건 실패`); process.exit(1); }
console.log(`OK: 연성 규칙 ${Craft.RULES.length}개(엄격) · 예제 ${Object.values(S.EXAMPLES).flat().length}개 · 몬스터 ${Object.keys(Monsters).length}마리 독립 검산 · 채점 · 해금 코드 · 세이브 통과`);
