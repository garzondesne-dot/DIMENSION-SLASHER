// 게임 데이터: 등급, 부품, 연산, 카드 종류, 옵션, 캠페인 진행
// 몬스터와 문제는 monsters.js, 연성 규칙은 craft.js, 카드 수치·덱 규칙은 cards.js
window.DS = window.DS || {};

// ── 등급 ─────────────────────────────────────────────────
// 기본·일반·매직: 재료로 쓰면 사라짐. 레어·유니크·특수는 V0.2.1에서 최종보스 체험판에만 등장.
DS.Tiers = {
  basic: { name: '기본', crit: 0, critMult: 1.5, affixes: 0 },
  normal: { name: '일반', crit: 0, critMult: 1.5, affixes: 0 },
  magic: { name: '매직', crit: 0.10, critMult: 1.5, affixes: 1 },
  rare: { name: '레어', crit: 0.15, critMult: 1.5, affixes: 2 },
  unique: { name: '유니크', crit: 0.25, critMult: 2, affixes: 0 }, // 고정 설계
  special: { name: '특수', crit: 0, critMult: 1.5, affixes: 0 },
};

// ── 부품 (부품 가방) ──────────────────────────────────────
// mid: 바로 다음 연성으로 넘어가는 중간 단계. inf: 무한 제공(소재로 세지 않음)
DS.Parts = {
  ptA: { name: '점 A', sym: 'A' },
  ptB: { name: '점 B', sym: 'B' },
  pt1: { name: '한 점', sym: '(x₁, y₁)' },
  sumSq: { name: '제곱의 합', sym: '(x₂−x₁)²+(y₂−y₁)²', mid: true },
  slope: { name: '기울기', sym: 'm = (y₂−y₁)/(x₂−x₁)', mid: true },
  mPrime: { name: 'm′', sym: 'm′', inf: true },
};

// ── 연산 (무한) ──────────────────────────────────────────
DS.Ops = {
  minus: { sym: '−', name: '빼기' },
  plus: { sym: '+', name: '더하기' },
  times: { sym: '×', name: '곱하기' },
  div: { sym: '÷', name: '나누기' },
  sq: { sym: '²', name: '제곱', unary: true },
  root: { sym: '√', name: '루트', unary: true },
  abs: { sym: '|·|', name: '절댓값', unary: true },
  ratio: { sym: 'm : n', name: '내분 비율' },
  eq: { sym: '=', name: '같다' },
  simul: { sym: '{', name: '연립', locked: 'V0.4에서 열림' },
};

// ── 카드 종류 ────────────────────────────────────────────
// score: 투자 점수 = 소재 수 + 연성 횟수 × 2 → 공격 + 방어 합계 = score + 2 ~ score + 4
// tool: 문턱에서 풀이 도구로 쓰이는 카드 (매직 이상)
DS.Cards = {
  diff: { name: '차이', tier: 'basic', formula: 'x₂ − x₁', score: 4, scan: 'always', axis: true, desc: '두 점의 차이를 재며 상대를 파악한다' },
  segLen: { name: '선분의 길이', tier: 'normal', formula: '|x₂ − x₁|', score: 6, scan: 'chance', axis: true, tool: true, desc: '수직선 위 두 점 사이 거리' },
  diffSq: { name: '차이²', tier: 'normal', formula: '(x₂ − x₁)²', score: 6, scan: 'chance', axis: true, desc: '제곱하면 부호가 사라진다' },

  divide: { name: '내분점', tier: 'magic', formula: '(mx₂+nx₁)/(m+n)', score: 4, tool: true, desc: '선분을 m : n으로 나누는 점' },
  para: { name: '평행 조건', tier: 'magic', formula: 'm = m′', score: 12, tool: true, desc: '두 직선이 평행할 때' },
  perp: { name: '수직 조건', tier: 'magic', formula: 'mm′ = −1', score: 12, tool: true, desc: '두 직선이 수직일 때' },
  line: { name: '직선의 방정식', tier: 'magic', formula: 'y − y₁ = m(x − x₁)', score: 13, tool: true, desc: '한 점과 기울기로 직선 세우기' },
  dist: { name: '두 점 사이의 거리', tier: 'magic', formula: '√((x₂−x₁)²+(y₂−y₁)²)', score: 16, tool: true, desc: '좌표평면 위 거리' },

  // 최종보스 체험판 전용 (기억 복원으로 지급)
  circle: { name: '원의 방정식', tier: 'rare', formula: '(x−a)²+(y−b)² = r²', score: 17, tool: true, desc: '중심과 반지름' },
  ptLine: { name: '점과 직선 사이의 거리', tier: 'rare', formula: '|ax₁+by₁+c|/√(a²+b²)', score: 20, tool: true, desc: '수선의 발까지의 거리' },
  dPlusR: { name: '한계 일도양단', tier: 'unique', formula: 'd − r ≤ h ≤ d + r', tool: true, desc: '원 위의 점에서 직선까지 거리의 범위', fixed: { atk: 30, def: 0, affixes: [['pierce', 1], ['critRate', 25], ['crush', 15]] } },
  triArea: { name: '정삼각형 넓이', tier: 'special', formula: 'S = h²/√3', score: 8, tool: true, desc: '높이로 나타낸 넓이' },
};

// ── 디아블로식 옵션 ──────────────────────────────────────
// 범위: [매직 최소, 매직 최대, 레어 최소, 레어 최대]. 어떤 옵션도 체력 문턱은 넘지 못한다.
DS.Affixes = {
  pierce: { name: '방어막 관통', range: [1, 1, 1, 1], text: () => '방어막 관통' },
  critRate: { name: '치명타 확률', range: [5, 10, 8, 15], text: (v) => `치명타 확률 +${v}%` },
  critDmg: { name: '치명타 피해', range: [20, 40, 30, 60], text: (v) => `치명타 피해 +${v}%` },
  vuln: { name: '취약 부여', range: [20, 30, 25, 40], text: (v) => `취약 ${v}%` },
  weak: { name: '약화 부여', range: [20, 30, 25, 40], text: (v) => `약화 ${v}%` },
  bleed: { name: '출혈', range: [2, 3, 3, 5], text: (v) => `출혈 ${v}×2턴` },
  crush: { name: '분쇄 일격', range: [5, 8, 8, 12], text: (v) => `분쇄 ${v}%` },
  leech: { name: '흡혈', range: [10, 15, 15, 25], text: (v) => `흡혈 ${v}%` },
  counter: { name: '반격 방어', range: [2, 3, 3, 5], text: (v) => `반격 방어 +${v}` },
  lucky: { name: '행운의 적중', range: [20, 30, 30, 40], text: (v) => `${v}% 기력 +1` },
  draw: { name: '추가 드로우', range: [25, 35, 35, 50], text: (v) => `${v}% 드로우` },
};
DS.SCAN_CHANCE = 0.35; // 일반 카드에 스캔이 붙을 확률

// ── 덱 규칙 ──────────────────────────────────────────────
DS.DeckRules = { min: 6, max: 12, minScan: 4, minDiff: 1, maxMagic: 4 };

// ── 캠페인 진행: 캠프 → 잡몹 → 캠프 → 보스 ───────────────────
DS.Progress = {
  startDiff: 6, // 시작할 때 받는 랜덤 수치 차이 카드
  trialDiff: 9,
  floors: {
    1: { title: '1층 · 수직선의 회랑', unit: '선분의 내분 (교과서 12~17쪽)' },
    2: { title: '2층 · 직선의 성벽', unit: '직선의 위치 관계 (교과서 18~22쪽)' },
  },
  nodes: [
    { type: 'camp', floor: 1, parts: { ptA: 6, ptB: 6 } },
    { type: 'battle', floor: 1, monster: 'slime', reward: { ptA: 4, ptB: 4 } },
    { type: 'camp', floor: 1 },
    { type: 'battle', floor: 1, monster: 'golem', reward: { ptA: 6, ptB: 6, pt1: 2 } },
    { type: 'camp', floor: 2 },
    { type: 'battle', floor: 2, monster: 'bat', reward: { ptA: 4, ptB: 4, pt1: 1 } },
    { type: 'camp', floor: 2 },
    { type: 'battle', floor: 2, monster: 'beast' },
    { type: 'clear' },
  ],
};
