// 게임 데이터: 등급, 부품, 연산, 카드, 캠페인 진행
// 몬스터와 문제는 monsters.js, 연성 규칙은 craft.js
window.DS = window.DS || {};

// ── 등급 ─────────────────────────────────────────────────
// 일반·매직: 재료로 쓰면 사라짐, 장수 제한 없음 / 레어: 이름별 한 장, 재료로 써도 안 사라짐
// 유니크: 전투 중에만 연성, 그 전투에서만 존재 / 특수: 상점 카드(정삼각형 넓이)
DS.Tiers = {
  basic: { name: '기본', crit: 0 },
  normal: { name: '일반', crit: 0 },
  magic: { name: '매직', crit: 0.10, critMult: 1.5 },
  rare: { name: '레어', crit: 0.15, critMult: 1.5 },
  unique: { name: '유니크', crit: 0.25, critMult: 2 },
  special: { name: '특수', crit: 0 },
};

// ── 부품: 개수가 정해진 재료 (부품 가방) ─────────────────────
// mid: 연성 중간 단계. 덱에는 안 들어가고 가방에만 쌓인다.
DS.Parts = {
  ptA: { name: '점 A', sym: 'A(x₁)' },
  ptB: { name: '점 B', sym: 'B(x₂)' },
  dy: { name: '세로 변화', sym: 'Δy' },
  dx: { name: '가로 변화', sym: 'Δx' },
  pt1: { name: '한 점', sym: '(x₁, y₁)' },
  sqX: { name: '가로²', sym: '(x₂−x₁)²', mid: true },
  sqY: { name: '세로²', sym: '(y₂−y₁)²', mid: true },
  sumSq: { name: '제곱의 합', sym: '(x₂−x₁)²+(y₂−y₁)²', mid: true },
};

// ── 연산: 처음부터 무한 ────────────────────────────────────
// unary: 재료 하나에만 작용 (재료 칸 하나만 채움)
DS.Ops = {
  minus: { sym: '−', name: '빼기' },
  plus: { sym: '+', name: '더하기' },
  times: { sym: '×', name: '곱하기' },
  div: { sym: '÷', name: '나누기' },
  sq: { sym: '²', name: '제곱', unary: true },
  root: { sym: '√', name: '루트', unary: true },
  ratio: { sym: 'm : n', name: '내분 비율', unary: true },
  eq: { sym: '=', name: '같다' },
};

// ── 전투 카드 ────────────────────────────────────────────
// 기본 카드는 effect 로 바로 작동, 나머지는 '풀이 도구'로 몬스터 문제의 단계를 푼다.
DS.Cards = {
  strike: { name: '베기', tier: 'basic', cost: 1, desc: '피해 6', effect: { dmg: 6 } },
  guard: { name: '막기', tier: 'basic', cost: 1, desc: '방어도 5', effect: { block: 5 } },

  // 일반
  segLen: { name: '선분의 길이', tier: 'normal', cost: 1, formula: '|x₂ − x₁|', desc: '수직선 위 두 점 사이 거리', axis: true },
  slope: { name: '기울기', tier: 'normal', cost: 1, formula: 'm = Δy ÷ Δx', desc: '직선이 기운 정도' },
  // 매직
  dist: { name: '두 점 사이의 거리', tier: 'magic', cost: 1, formula: '√((x₂−x₁)²+(y₂−y₁)²)', desc: '좌표평면 위 거리' },
  divide: { name: '내분점', tier: 'magic', cost: 1, formula: '(mx₂+nx₁)/(m+n)', desc: '선분을 m : n으로 나누는 점' },
  line: { name: '직선의 방정식', tier: 'magic', cost: 1, formula: 'y − y₁ = m(x − x₁)', desc: '한 점과 기울기로 직선 세우기' },
  perp: { name: '수직 조건', tier: 'magic', cost: 1, formula: 'mm′ = −1', desc: '두 직선이 수직일 때' },
  para: { name: '평행 조건', tier: 'magic', cost: 1, formula: 'm = m′', desc: '두 직선이 평행할 때' },
  // 레어 · 유니크 · 특수 (V0.2에서는 최종보스 체험판에서만 지급)
  circle: { name: '원의 방정식', tier: 'rare', cost: 1, formula: '(x−a)²+(y−b)² = r²', desc: '중심과 반지름' },
  ptLine: { name: '점과 직선 사이의 거리', tier: 'rare', cost: 1, formula: '|ax₁+by₁+c|/√(a²+b²)', desc: '수선의 발까지의 거리' },
  dPlusR: { name: '한계 일도양단', tier: 'unique', cost: 1, formula: 'd − r ≤ h ≤ d + r', desc: '원 위의 점에서 직선까지 거리의 범위' },
  triArea: { name: '정삼각형 넓이', tier: 'special', cost: 1, formula: 'S = h²/√3', desc: '높이로 나타낸 넓이' },
};

// ── 캠페인 진행: 캠프 → 잡몹 → 캠프 → 보스 ───────────────────
DS.Progress = {
  startDeck: ['strike', 'strike', 'strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'guard'],
  floors: {
    1: { title: '1층 · 수직선의 회랑', unit: '선분의 내분 (교과서 12~17쪽)' },
    2: { title: '2층 · 직선의 성벽', unit: '직선의 위치 관계 (교과서 18~22쪽)' },
  },
  // 캠프에 처음 들어올 때 받는 부품 + 전투 승리 보상 부품
  nodes: [
    { type: 'camp', floor: 1, parts: { ptA: 3, ptB: 3 } },
    { type: 'battle', floor: 1, monster: 'slime', reward: { ptA: 3, ptB: 3 } },
    { type: 'camp', floor: 1 },
    { type: 'battle', floor: 1, monster: 'golem', reward: { dy: 4, dx: 4, pt1: 1 } },
    { type: 'camp', floor: 2 },
    { type: 'battle', floor: 2, monster: 'bat', reward: { dy: 3, dx: 3, pt1: 2 } },
    { type: 'camp', floor: 2 },
    { type: 'battle', floor: 2, monster: 'beast' },
    { type: 'clear' },
  ],
  trialDeck: ['strike', 'strike', 'strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'guard'],
};
