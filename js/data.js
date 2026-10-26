// 게임 데이터: 부품, 연성 레시피, 전투 카드, 적
window.DS = window.DS || {};

// ── 부품 (대장간 재료) ─────────────────────────────────────
DS.Parts = {
  ptA: { name: '점 A', sym: 'A(x₁)' },
  ptB: { name: '점 B', sym: 'B(x₂)' },
  minus: { name: '빼기', sym: '−' },
  plus: { name: '더하기', sym: '+' },
  hseg: { name: '가로 선분', sym: '|x₂−x₁|' },
  vseg: { name: '세로 선분', sym: '|y₂−y₁|' },
  root: { name: '루트', sym: '√' },
  ratio: { name: '비율', sym: 'm : n' },
  pt1: { name: '한 점', sym: '(x₁, y₁)' },
  slopeM: { name: '기울기 m', sym: 'm' },
  slopeM2: { name: '기울기 m′', sym: 'm′' },
  times: { name: '곱하기', sym: '×' },
  equal: { name: '같음', sym: '=' },
};

// ── 연성 레시피 (부품 3개, 순서 무관) ────────────────────────
DS.Recipes = [
  {
    id: 'segLen', floor: 1, parts: ['ptA', 'minus', 'ptB'],
    hint: '두 점의 좌표를 빼면… 음수가 나오면?',
    lore: '수직선 위 두 점 사이의 거리는 |x₂ − x₁|. 빼고 나서 절댓값!',
  },
  {
    id: 'dist', floor: 1, parts: ['hseg', 'vseg', 'root'],
    hint: '가로와 세로로 직각삼각형을 만들면 빗변이… (피타고라스)',
    lore: '가로² + 세로² 에 루트를 씌우면 두 점 사이의 직선거리.',
  },
  {
    id: 'divide', floor: 1, parts: ['ptA', 'ratio', 'ptB'],
    hint: '두 점 사이를 m : n 으로 나누는 지점',
    lore: '내분점 = (m·x₂ + n·x₁)/(m + n). 비율은 엇갈려 곱한다!',
  },
  {
    id: 'line', floor: 2, parts: ['pt1', 'minus', 'slopeM'],
    hint: '한 점을 지나고 기울기가 m인 직선',
    lore: 'y − y₁ = m(x − x₁). 점을 빼서 원점으로 옮긴 뒤 기울기를 곱한다.',
  },
  {
    id: 'perp', floor: 2, parts: ['slopeM', 'times', 'slopeM2'],
    hint: '두 기울기를 곱하면 −1 이 되는 관계',
    lore: '두 직선이 수직 ⇔ mm′ = −1.',
  },
  {
    id: 'para', floor: 2, parts: ['slopeM', 'equal', 'slopeM2'],
    hint: '두 기울기가 같으면?',
    lore: '두 직선이 평행 ⇔ m = m′ (y절편은 다름).',
  },
];

// 자주 나오는 틀린 조합에 대한 개념 피드백 (부품 id 정렬 후 '|'로 연결)
DS.ForgeMistakes = {
  'plus|ptA|ptB': '두 좌표를 더하면 거리가 아니에요. 더해서 2로 나누면 "중점"이 됩니다. 거리는 빼기!',
  'hseg|plus|vseg': '가로 + 세로는 계단처럼 꺾어 걸은 길이예요. 직선거리는 제곱해서 더한 뒤 루트!',
  'hseg|minus|vseg': '가로와 세로는 서로 수직이라 빼면 안 돼요. 피타고라스 정리를 떠올려 봐요.',
  'equal|slopeM|times': '기울기 m 하나로는 관계가 안 생겨요. 두 직선이니까 m 과 m′ 둘이 필요해요.',
  'minus|pt1|slopeM2': '아까운 조합! 직선의 방정식은 기울기 m 으로 만들어요.',
};

// ── 전투 카드 ─────────────────────────────────────────────
// tier 0: 기본, 1: 1층 공식, 2: 2층 공식
// math: DS.MathGen.gen 의 생성기 키. 정답일 때만 effect 발동.
DS.Cards = {
  strike: { name: '베기', cost: 1, tier: 0, desc: '피해 6', effect: { dmg: 6 } },
  guard: { name: '막기', cost: 1, tier: 0, desc: '방어도 5', effect: { block: 5 } },

  segLen: {
    name: '선분의 길이', formula: '|x₂ − x₁|', cost: 1, tier: 1, math: 'segLen',
    desc: '정답: 피해 10 · 철갑 1 파괴', effect: { dmg: 10, armorBreak: 1 },
  },
  dist: {
    name: '두 점 사이의 거리', formula: '√((x₂−x₁)²+(y₂−y₁)²)', cost: 2, tier: 1, math: 'dist2D',
    desc: '정답: 피해 18 · 철갑 1 파괴', effect: { dmg: 18, armorBreak: 1 },
  },
  divide: {
    name: '내분점 관통', formula: '(mx₂+nx₁)/(m+n)', cost: 1, tier: 1, math: 'divide',
    desc: '정답: 철갑 무시 피해 12', effect: { dmg: 12, pierce: true },
  },

  line: {
    name: '직선의 방정식', formula: 'y − y₁ = m(x − x₁)', cost: 2, tier: 2, math: 'lineEq',
    desc: '정답: 방패 관통 피해 20', effect: { dmg: 20, pierce: true },
  },
  perp: {
    name: '수직 절단', formula: 'mm′ = −1', cost: 1, tier: 2, math: 'perpSlope',
    desc: '정답: 방패 파괴 + 피해 8', effect: { dmg: 8, shieldBreak: true },
  },
  para: {
    name: '평행 방어막', formula: 'm = m′', cost: 1, tier: 2, math: 'parallel',
    desc: '정답: 방어도 12', effect: { block: 12 },
  },
};

// ── 적 ───────────────────────────────────────────────────
// roll(e): 매 턴 시작 시 문제 맥락(ctx)을 새로 만든다. 화면에 그려지는 좌표와 문제 숫자가 같다.
DS.Enemies = {
  golem: {
    name: '수직선 수문장 골렘', floor: 1, maxHp: 70, armor: 3,
    intro: '수직선을 지키는 돌의 수문장. 철갑은 정확한 "거리" 계산으로만 깨진다.',
    rule: '철갑이 남아 있으면 기본 공격 피해가 절반. 공식 카드로 철갑을 깨라!',
    intents: [
      { kind: 'atk', v: 8, label: '돌주먹' },
      { kind: 'atk', v: 12, label: '바위 투척' },
      { kind: 'fortify', v: 1, block: 6, label: '철갑 수복' },
    ],
    roll(e) {
      const { ri } = DS.MathGen;
      const a = ri(-9, 9);
      let b;
      do b = ri(-9, 9); while (b === a || Math.abs(b - a) < 3);
      e.ctx = { a, b };
    },
  },
  beast: {
    name: '방패 거수', floor: 2, maxHp: 80, shield: true,
    intro: '직선의 방패를 든 거수. 방패와 "수직"으로 베어야 뚫린다.',
    rule: '방패가 서 있으면 일반 공격 피해가 절반. 수직 절단(mm′ = −1)으로 방패를 깨라!',
    intents: [
      { kind: 'atk', v: 9, label: '돌진' },
      { kind: 'atk', v: 13, label: '방패 강타' },
      { kind: 'atk', v: 5, block: 10, label: '방어 태세' },
    ],
    roll(e) {
      const { ri, pick, SLOPES, fval } = DS.MathGen;
      const m = pick(SLOPES);
      const n = ri(-2, 2);
      let P;
      do P = { a: ri(-2, 1), b: ri(-3, -1) }; while (Math.abs(fval(m) * P.a + n - P.b) < 0.5);
      e.ctx = { m, n, P };
      e.shieldUp = true;
    },
  },
};

// ── 진행 데이터 ───────────────────────────────────────────
DS.Progress = {
  startDeck: ['strike', 'strike', 'strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'guard'],
  // 캠프 1 (1층 출발 전) 부품 가방. '더하기'는 일부러 넣은 함정 부품.
  campParts: {
    1: { ptA: 3, ptB: 3, minus: 2, plus: 1, hseg: 1, vseg: 1, root: 1, ratio: 1 },
    2: { pt1: 2, minus: 2, slopeM: 6, slopeM2: 4, times: 3, equal: 1 }, // 골렘 격파 보상
  },
  floors: {
    1: { enemy: 'golem', title: '1층 · 수직선의 회랑', unit: '선분의 내분 (교과서 12~17쪽)' },
    2: { enemy: 'beast', title: '2층 · 직선의 성벽', unit: '직선의 위치 관계 (교과서 18~22쪽)' },
  },
  lastFloor: 2,
};
