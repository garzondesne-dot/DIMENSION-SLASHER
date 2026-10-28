// 게임 데이터: 등급, 차원(대단원), 부품, 연산, 카드 종류, 옵션, 유물·물약, 캠페인 진행
// v1.0 테스트판: 공통수학2 Ⅰ·Ⅱ·Ⅲ 전 단원. 대단원 = 차원(dim). 차원마다 부품·연산·카드가 따로 있고,
// 지난 차원의 카드는 캠프의 [지난 차원 서고]에서 꺼내 쓴다.
// 몬스터와 문제는 monsters.js, 연성 규칙은 craft.js, 카드 수치·덱 규칙은 cards.js
window.DS = window.DS || {};

// ── 등급 ─────────────────────────────────────────────────
DS.Tiers = {
  basic: { name: '기본', crit: 0, critMult: 1.5, affixes: 0 },
  normal: { name: '일반', crit: 0, critMult: 1.5, affixes: 0 },
  magic: { name: '매직', crit: 0.10, critMult: 1.5, affixes: 1 },
  rare: { name: '레어', crit: 0.15, critMult: 1.5, affixes: 2 },
  unique: { name: '유니크', crit: 0.25, critMult: 2, affixes: 0 }, // 고정 설계
  special: { name: '특수', crit: 0, critMult: 1.5, affixes: 0 },
};

// ── 차원 (대단원) ─────────────────────────────────────────
// basic: 그 차원의 기본 스캔 카드 (덱에 1장 이상), start: 차원에 들어올 때 받는 기본 카드 수
DS.Dims = {
  1: { name: 'Ⅰ 도형의 방정식', short: 'Ⅰ', basic: 'diff', color: '#4cc9ff' },
  2: { name: 'Ⅱ 집합과 명제', short: 'Ⅱ', basic: 'member', color: '#5ce1a5' },
  3: { name: 'Ⅲ 함수와 그래프', short: 'Ⅲ', basic: 'corr', color: '#ff9df0' },
};

// ── 부품 (부품 가방) ──────────────────────────────────────
// dim: 차원, mid: 바로 다음 연성으로 넘어가는 중간 단계, inf: 무한 제공(소재로 세지 않음)
DS.Parts = {
  // Ⅰ-1·2 (1·2층)
  x1: { dim: 1, name: '점 x₁', sym: 'x₁' },
  x2: { dim: 1, name: '점 x₂', sym: 'x₂' },
  pt1: { dim: 1, name: '한 점', sym: '(x₁, y₁)' },
  sumSq: { dim: 1, name: '제곱의 합', sym: '(x₂−x₁)²+(y₂−y₁)²', mid: true },
  slope: { dim: 1, name: '기울기', sym: 'm = (y₂−y₁)/(x₂−x₁)', mid: true },
  mPrime: { dim: 1, name: 'm′', sym: 'm′', inf: true },
  // Ⅰ-2 원 (3·4층)
  radius: { dim: 1, name: '반지름 r', sym: 'r' },
  lineGen: { dim: 1, name: '직선 (일반형)', sym: 'ax + by + c = 0' },
  genCircle: { dim: 1, name: '원 (일반형)', sym: 'x² + y² + Ax + By + C = 0' },
  halfSq: { dim: 1, name: '반의 제곱', sym: '(A/2)² + (B/2)²' },
  cpDist: { dim: 1, name: '중심까지의 거리', sym: '√((x−a)²+(y−b)²)', mid: true }, // v1: [거리] ↦ [한 점(중심)]
  circR: { dim: 1, name: '원 위의 점 조건', sym: '√((x−a)²+(y−b)²) = r', mid: true },
  perpLine: { dim: 1, name: '수선', sym: 'PH ⊥ l', mid: true }, // v1: 점과 직선 거리 = 수직 조건 + 두 점 거리
  footH: { dim: 1, name: '수선의 발 H', sym: 'H(x₂, y₂)', mid: true },
  // Ⅰ-3 도형의 이동 (5·6층)
  vec: { dim: 1, name: '이동 (a, b)', sym: '(a, b)' },
  mirrorAx: { dim: 1, name: '대칭의 기준', sym: 'x축·y축·원점·y=x' },
  figF: { dim: 1, name: '도형', sym: 'f(x, y) = 0' },

  // Ⅱ 집합과 명제 (7·8층)
  elem: { dim: 2, name: '원소 a', sym: 'a' },
  setA: { dim: 2, name: '집합 A', sym: 'A' },
  setB: { dim: 2, name: '집합 B', sym: 'B' },
  setU: { dim: 2, name: '전체집합 U', sym: 'U' },
  nA: { dim: 2, name: 'n(A)', sym: 'n(A)', mid: true },
  nB: { dim: 2, name: 'n(B)', sym: 'n(B)', mid: true },
  nSum: { dim: 2, name: 'n(A)+n(B)', sym: 'n(A) + n(B)', mid: true },
  nCap: { dim: 2, name: 'n(A∩B)', sym: 'n(A ∩ B)', mid: true },
  ccap: { dim: 2, name: 'Aᶜ∩Bᶜ', sym: 'Aᶜ ∩ Bᶜ', mid: true },
  unionC: { dim: 2, name: '(A∪B)ᶜ', sym: '(A ∪ B)ᶜ', mid: true },
  condP: { dim: 2, name: '조건 p', sym: 'p' },
  condQ: { dim: 2, name: '조건 q', sym: 'q' },
  truthP: { dim: 2, name: '진리집합 P', sym: 'P = {x | p}', mid: true },
  truthQ: { dim: 2, name: '진리집합 Q', sym: 'Q = {x | q}', mid: true },
  sqNonneg: { dim: 2, name: '(실수)² ≥ 0', sym: '(실수)² ≥ 0' },

  // Ⅲ 함수와 그래프 (9·10층)
  domX: { dim: 3, name: '정의역 X', sym: 'X' },
  codY: { dim: 3, name: '공역 Y', sym: 'Y' },
  fx: { dim: 3, name: '함수 f', sym: 'f(x)' },
  gx: { dim: 3, name: '함수 g', sym: 'g(x)' },
  xval: { dim: 3, name: 'x의 값 a', sym: 'a' },
  xOfY: { dim: 3, name: 'x에 대해 푼 식', sym: 'x = f⁻¹(y)', mid: true },
  fSwap: { dim: 3, name: 'x, y를 바꾼 식', sym: 'x = f(y)', mid: true },
  recip: { dim: 3, name: '반비례 y = k/x', sym: 'y = k/x' },
  sqrtF: { dim: 3, name: '무리 y = √(ax)', sym: 'y = √(ax)' },
};

// ── 연산 (무한) ──────────────────────────────────────────
// dims: 보이는 차원, floor: 이 층부터 보임
DS.Ops = {
  minus: { sym: '−', name: '빼기', dims: [1, 2] },
  plus: { sym: '+', name: '더하기', dims: [1, 2] },
  times: { sym: '×', name: '곱하기', dims: [1] },
  div: { sym: '÷', name: '나누기', dims: [1] },
  sq: { sym: '²', name: '제곱', unary: true, dims: [1] },
  root: { sym: '√', name: '루트', unary: true, dims: [1] },
  abs: { sym: '|·|', name: '절댓값', unary: true, dims: [1] },
  ratio: { sym: 'm : n', name: '내분 비율', dims: [1] },
  eq: { sym: '=', name: '같다', dims: [1, 2] },
  subst: { sym: '↦', name: '대입', floor: 3, dims: [1, 3] },
  cmp: { sym: '⋚', name: '비교', floor: 3, dims: [1, 2, 3] },
  mirror: { sym: '⟷', name: '대칭', floor: 5, dims: [1, 3] },
  // Ⅱ
  in: { sym: '∈', name: '속한다', dims: [2] },
  cap: { sym: '∩', name: '교집합', dims: [2] },
  cup: { sym: '∪', name: '합집합', dims: [2] },
  comp: { sym: 'ᶜ', name: '여집합', unary: true, dims: [2] },
  count: { sym: 'n( )', name: '원소의 개수', unary: true, dims: [2] },
  tset: { sym: '{x|·}', name: '진리집합', unary: true, floor: 8, dims: [2] },
  not: { sym: '~', name: '부정', unary: true, floor: 8, dims: [2] },
  imp: { sym: '⇒', name: '이면', floor: 8, dims: [2] },
  sub: { sym: '⊂', name: '포함', floor: 8, dims: [2] },
  // Ⅲ
  compose: { sym: '∘', name: '합성', dims: [3] },
  solve: { sym: 'x=', name: 'x에 대해 풀기', unary: true, dims: [3] },
  swap: { sym: '⇆', name: 'x, y 바꾸기', unary: true, dims: [3] },
  simul: { sym: '{', name: '연립', locked: '다음 버전에서 열림', dims: [1] },
};

// ── 카드 종류 ────────────────────────────────────────────
// score: 투자 점수 → 공격 + 방어 합계 = score + 2 ~ score + 4,  cost: 기력 (없으면 1)
// tool: 문턱에서 풀이 도구, axis: ⇄ 로 뒤집는 카드 (formulaY: 뒤집었을 때 공식, axisName: [가로, 세로] 표시)
DS.Cards = {
  // ── Ⅰ 도형의 방정식 ──
  diff: { dim: 1, name: '차이', tier: 'basic', formula: 'x₂ − x₁', formulaY: 'y₂ − y₁', score: 4, scan: 'always', axis: true, desc: '두 점의 차이를 재며 상대를 파악한다' },
  segLen: { dim: 1, name: '선분의 길이', tier: 'normal', formula: '|x₂ − x₁|', formulaY: '|y₂ − y₁|', score: 6, scan: 'chance', axis: true, tool: true, desc: '수직선 위 두 점 사이 거리' },
  diffSq: { dim: 1, name: '차이²', tier: 'normal', formula: '(x₂ − x₁)²', formulaY: '(y₂ − y₁)²', score: 6, scan: 'chance', axis: true, desc: '제곱하면 부호가 사라진다' },

  divide: { dim: 1, name: '내분점', tier: 'magic', formula: '(mx₂+nx₁)/(m+n)', score: 4, tool: true, desc: '선분을 m : n으로 나누는 점' },
  para: { dim: 1, name: '평행 조건', tier: 'magic', formula: 'm = m′', score: 12, tool: true, desc: '두 직선이 평행할 때' },
  perp: { dim: 1, name: '수직 조건', tier: 'magic', formula: 'mm′ = −1', score: 12, tool: true, desc: '두 직선이 수직일 때' },
  line: { dim: 1, name: '직선의 방정식', tier: 'magic', formula: 'y − y₁ = m(x − x₁)', score: 13, tool: true, desc: '한 점과 기울기로 직선 세우기' },
  dist: { dim: 1, name: '두 점 사이의 거리', tier: 'magic', formula: '√((x₂−x₁)²+(y₂−y₁)²)', score: 16, tool: true, desc: '좌표평면 위 거리' },

  completeSq: { dim: 1, name: '완전제곱', tier: 'magic', formula: 'x² + Ax = (x + A/2)² − (A/2)²', score: 4, tool: true, desc: '일반형 원을 표준형으로' },
  // v1: 원 = [두 점 사이의 거리] ↦ [한 점(중심)] = [r] → ²  (소재 3 + 연성 3번)
  circle: { dim: 1, name: '원의 방정식', tier: 'rare', formula: '(x−a)²+(y−b)² = r²', score: 22, tool: true, desc: '중심과 반지름' },
  // v1: 점과 직선 거리 = 수직 조건 + 두 점 사이의 거리 (증명 과정 그대로) → 비싸지만 강한 기력 2 카드
  ptLine: { dim: 1, name: '점과 직선 사이의 거리', tier: 'rare', formula: '|ax₁+by₁+c|/√(a²+b²)', score: 34, cost: 2, tool: true, desc: '수선의 발까지의 거리 (수직 조건 + 두 점 거리)' },
  posRel: { dim: 1, name: '원과 직선의 위치 관계', tier: 'magic', formula: 'd < r · d = r · d > r', score: 12, tool: true, desc: '중심과 직선 사이의 거리 d를 반지름 r과 비교' },
  // Ⅰ-3 도형의 이동
  transPt: { dim: 1, name: '점의 평행이동', tier: 'magic', formula: '(x + a, y + b)', score: 6, tool: true, desc: 'x축 방향으로 a, y축 방향으로 b만큼' },
  transFig: { dim: 1, name: '도형의 평행이동', tier: 'magic', formula: 'f(x − a, y − b) = 0', score: 12, tool: true, desc: 'x 대신 x − a, y 대신 y − b' },
  reflPt: { dim: 1, name: '점의 대칭이동', tier: 'magic', formula: '(x, −y)·(−x, y)·(−x, −y)·(y, x)', score: 6, tool: true, desc: 'x축·y축·원점·직선 y = x' },
  reflFig: { dim: 1, name: '도형의 대칭이동', tier: 'magic', formula: 'f(x, −y)·f(−x, y)·f(−x, −y)·f(y, x)', score: 12, tool: true, desc: '대칭인 점의 좌표를 대입' },

  // 전투 중 각성(유니크) · 최종보스 전용
  dPlusR: { dim: 1, name: '한계 일도양단', tier: 'unique', formula: 'd − r ≤ h ≤ d + r', tool: true, desc: '원 위의 점에서 직선까지 거리의 범위', fixed: { atk: 30, def: 0, affixes: [['pierce', 1], ['critRate', 25], ['crush', 15]] } },
  triArea: { dim: 1, name: '정삼각형 넓이', tier: 'special', formula: 'S = h²/√3', score: 8, tool: true, desc: '높이로 나타낸 넓이' },

  // ── Ⅱ 집합과 명제 ──
  member: { dim: 2, name: '원소 확인', tier: 'basic', formula: 'a ∈ A', score: 4, scan: 'always', desc: '원소가 어느 집합에 속하는지 살핀다' },
  inter: { dim: 2, name: '교집합', tier: 'normal', formula: 'A ∩ B', score: 6, scan: 'chance', tool: true, desc: 'A에도 B에도 속하는 원소' },
  union: { dim: 2, name: '합집합', tier: 'normal', formula: 'A ∪ B', score: 6, scan: 'chance', tool: true, desc: 'A 또는 B에 속하는 원소' },
  compl: { dim: 2, name: '여집합', tier: 'normal', formula: 'Aᶜ = U − A', formulaY: 'Bᶜ = U − B', axis: true, axisName: ['A', 'B'], score: 6, scan: 'chance', tool: true, desc: 'U에서 A를 뺀 것' },
  diffSet: { dim: 2, name: '차집합', tier: 'normal', formula: 'A − B = A ∩ Bᶜ', score: 6, scan: 'chance', tool: true, desc: 'A에 속하지만 B에는 속하지 않는 원소' },
  neg: { dim: 2, name: '부정', tier: 'normal', formula: '~p', formulaY: '~q', axis: true, axisName: ['p', 'q'], score: 4, scan: 'chance', tool: true, desc: 'p가 아니다' },
  countU: { dim: 2, name: '합집합의 원소의 개수', tier: 'magic', formula: 'n(A∪B) = n(A)+n(B)−n(A∩B)', score: 14, tool: true, desc: '두 번 센 교집합을 한 번 뺀다' },
  truth: { dim: 2, name: '참·거짓 판별', tier: 'magic', formula: 'P ⊂ Q ⇔ p ⇒ q 참', formulaY: 'Q ⊂ P ⇔ q ⇒ p 참', axis: true, axisName: ['P⊂Q', 'Q⊂P'], score: 10, tool: true, desc: '진리집합의 포함 관계로 판별' },
  contra: { dim: 2, name: '대우', tier: 'magic', formula: '~q ⇒ ~p', score: 8, tool: true, desc: '명제가 참이면 대우도 참' },
  suffNec: { dim: 2, name: '필요충분조건', tier: 'magic', formula: 'P ⊂ Q · Q ⊂ P · P = Q', score: 14, tool: true, desc: '충분조건·필요조건 판정' },
  deMorgan: { dim: 2, name: '드모르간의 법칙', tier: 'rare', formula: '(A ∪ B)ᶜ = Aᶜ ∩ Bᶜ', score: 22, tool: true, desc: '여집합을 나누어 씌운다' },
  absIneq: { dim: 2, name: '절대부등식', tier: 'rare', formula: 'a² + b² ≥ ab', score: 16, tool: true, desc: '완전제곱(Ⅰ차원 카드) ≥ 0' },

  // ── Ⅲ 함수와 그래프 ──
  corr: { dim: 3, name: '대응', tier: 'basic', formula: 'x ↦ f(x)', score: 4, scan: 'always', desc: 'X의 원소에 Y의 원소를 짝 지어 본다' },
  funcVal: { dim: 3, name: '함숫값', tier: 'normal', formula: 'f(a)', formulaY: 'f(b)', axis: true, axisName: ['x₁', 'x₂'], score: 4, scan: 'chance', tool: true, desc: 'x에 a를 대입한 값' },
  oneToOne: { dim: 3, name: '일대일대응', tier: 'normal', formula: 'x₁ ≠ x₂ ⇒ f(x₁) ≠ f(x₂)', score: 8, scan: 'chance', tool: true, desc: '일대일함수이고 치역 = 공역' },
  compose: { dim: 3, name: '합성함수', tier: 'magic', formula: '(g∘f)(x) = g(f(x))', score: 6, tool: true, desc: 'f 먼저, 그다음 g' },
  inverse: { dim: 3, name: '역함수', tier: 'magic', formula: 'y = f⁻¹(x)', score: 6, tool: true, desc: 'x에 대해 풀고 x, y를 바꾼다' },
  invGraph: { dim: 3, name: '역함수의 그래프', tier: 'rare', formula: '(a, b) ↔ (b, a) : y = x 대칭', score: 14, tool: true, desc: '점의 대칭이동(Ⅰ차원 카드)과 역함수' },
  rational: { dim: 3, name: '유리함수', tier: 'magic', formula: 'y = k/(x − p) + q', score: 16, tool: true, desc: 'y = k/x 를 평행이동(Ⅰ차원 카드)' },
  radical: { dim: 3, name: '무리함수', tier: 'magic', formula: 'y = √(a(x − p)) + q', score: 16, tool: true, desc: 'y = √(ax) 를 평행이동(Ⅰ차원 카드)' },
};

// ── 디아블로식 옵션 ──────────────────────────────────────
DS.Affixes = {
  pierce: { name: '철갑 관통', range: [1, 1, 1, 1], text: () => '철갑 관통' },
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
DS.SCAN_CHANCE = 0.35;

// ── 유물 (보물상자·엘리트·상점) ─────────────────────────────
// 착용 칸 3개. medal: 훈장은 칸을 차지하지 않는다 (차원 최종보스 보상)
DS.RELIC_SLOTS = 3;
DS.Relics = {
  compass: { icon: '🧭', name: '컴퍼스', desc: '최대 기력 +1' },
  protractor: { icon: '📐', name: '각도기', desc: '매 턴 기력 ½칸 (두 턴마다 +1)' },
  ruler: { icon: '📏', name: '자', desc: '최대 체력 +12' },
  lens: { icon: '🔎', name: '돋보기', desc: '전투 시작 때 문제 조각 1개 더 공개' },
  hourglass: { icon: '⏳', name: '모래시계', desc: '첫 턴에 카드 2장 더' },
  calculator: { icon: '🧮', name: '계산기', desc: '풀이 피해 +6' },
  eraser: { icon: '🩹', name: '지우개', desc: '결계에서 맞지 않는 카드를 내도 기력이 줄지 않음' },
  inkpot: { icon: '🖋', name: '잉크병', desc: '턴마다 방어 3으로 시작' },
  medal1: { icon: '🥇', name: 'Ⅰ차원 훈장', desc: '도형의 방정식 정복 · 최대 체력 +5', medal: true },
  medal2: { icon: '🥈', name: 'Ⅱ차원 훈장', desc: '집합과 명제 정복 · 최대 체력 +5', medal: true },
  medal3: { icon: '🏅', name: 'Ⅲ차원 훈장', desc: '함수와 그래프 정복 · 최대 체력 +5', medal: true },
};
// 물약: 최대 3개, 전투 중 기력 없이 사용. 결계 보호막은 못 깬다
DS.MAX_POTIONS = 3;
DS.Potions = {
  heal: { icon: '❤️', name: '회복 물약', desc: '체력 15 회복', price: 15 },
  scan: { icon: '🔍', name: '스캔 물약', desc: '문제 조각 2개 공개', price: 15 },
  energy: { icon: '⚡', name: '기력 물약', desc: '이번 턴 기력 +2', price: 20 },
  guard: { icon: '🛡', name: '방패 물약', desc: '방어 12', price: 12 },
};

// ── 밸런스 (v1: 몬스터가 너무 쉽다는 의견 → 체력·공격 강화) ─────────
DS.Balance = { hp: 1.3, atk: 1.25, crystals: { mob: 15, boss: 30, elite: 25 } };

// ── 버전 · 설정 ──────────────────────────────────────────
DS.VERSION = 'v1.0-test';
DS.BETA = true;
DS.TEST = true; // v1.0 테스트판 표시
DS.GUIDE = false;
DS.REPORT_URL = ''; // 테스트판은 학생 결과 시트에 섞이지 않도록 보내지 않는다 (결과 코드만)
// 설정 (⚙): 기기에 저장. 테스트판 기본값
DS.SettingDefs = {
  stack: { name: '대장간 카드 묶음 보기', desc: '같은 카드를 한 칸에 묶어 보기 (끄면 낱장)', def: false },
  practice: { name: '매직·레어 연습 문제', desc: '처음 두 번 쓸 때 예제 문제를 풀어야 발동', def: true },
  vibrate: { name: '진동', desc: '공격·방어·피격 때 폰 진동', def: true },
  aim: { name: '조준 시스템', desc: '답이 점일 때 좌표판을 눌러 조준 (빗나가면 4지선다)', def: true },
  shoulder: { name: '숄더뷰 (실험)', desc: '주인공 등 뒤 시점 + 홀로그램 좌표판', def: false },
  cheat: { name: '치트 모드', desc: '무적 · 결계 무시 · 즉시 승리 · 층 이동 · 정답 표시', def: false },
};

// ── 덱 규칙 ──────────────────────────────────────────────
DS.DeckRules = { min: 6, max: 12, minScan: 4, minBasic: 1, maxMagic: 4 };

// ── 캠페인 진행 ─────────────────────────────────────────
// 층 = 수업 한 시간. 잡몹 뒤에는 갈림길(보물상자·상점·이벤트·엘리트) → 캠프 → 다음 전투
// grantAll: 이 층의 결계 보호막에서 풀이 카드가 없으면 기억 복원 (최종보스처럼 난이도를 낮춤)
DS.Progress = {
  startBasic: 6,
  trialDiff: 9,
  floors: {
    1: { dim: 1, title: '1층 · 수직선의 회랑', unit: '선분의 내분 (교과서 12~17쪽)' },
    2: { dim: 1, title: '2층 · 직선의 성벽', unit: '두 점을 지나는 직선, 직선의 위치 관계 (11, 18~22쪽)' },
    3: { dim: 1, title: '3층 · 원환의 신전', unit: '점과 직선 사이의 거리, 원의 방정식 (23~34쪽)' },
    4: { dim: 1, title: '4층 · 유성의 관측소', unit: '원과 직선의 위치 관계 (35~41쪽)' },
    5: { dim: 1, title: '5층 · 거울의 회랑', unit: '평행이동, 대칭이동 (44~55쪽)' },
    6: { dim: 1, title: '6층 · 차원의 정점', unit: 'Ⅰ단원 종합 · 최종보스 (41쪽 11번)', grantAll: true },
    7: { dim: 2, title: '7층 · 집합의 정원', unit: '집합, 교집합·합집합, 여집합·차집합 (64~79쪽)' },
    8: { dim: 2, title: '8층 · 명제의 법정', unit: '명제와 조건, 역·대우, 충분·필요조건, 절대부등식 (82~97쪽)' },
    9: { dim: 3, title: '9층 · 대응의 시계탑', unit: '함수, 합성함수, 역함수 (106~119쪽)' },
    10: { dim: 3, title: '10층 · 점근선의 심연', unit: '유리함수, 무리함수 (122~134쪽)' },
  },
  // 차원에 처음 들어올 때 지난 차원 서고에 넣어 주는 카드 (차원을 잇는 레시피용)
  dimSupply: {
    2: { completeSq: 2 },
    3: { transFig: 3, reflPt: 2 },
  },
  nodes: [
    { type: 'camp', floor: 1, parts: { x1: 6, x2: 6 } },
    { type: 'battle', floor: 1, monster: 'slime', reward: { x1: 4, x2: 4 } },
    { type: 'fork', floor: 1, options: ['chest', 'elite:centroid', 'event'] },
    { type: 'camp', floor: 1 },
    { type: 'battle', floor: 1, monster: 'golem', reward: { x1: 6, x2: 6, pt1: 2 } },
    { type: 'camp', floor: 2, parts: { pt1: 1 } },
    { type: 'battle', floor: 2, monster: 'bat', reward: { x1: 4, x2: 4, pt1: 1 } },
    { type: 'fork', floor: 2, options: ['shop', 'elite:bisector', 'chest'] },
    { type: 'camp', floor: 2 },
    { type: 'battle', floor: 2, monster: 'archer', reward: { x1: 4, x2: 4, pt1: 2 } },
    { type: 'camp', floor: 2 },
    { type: 'battle', floor: 2, monster: 'beast', reward: { x1: 4, x2: 4, pt1: 2 } },
    { type: 'camp', floor: 3, parts: { lineGen: 3, pt1: 4, radius: 3, genCircle: 2, halfSq: 2, x1: 6, x2: 6 } },
    { type: 'battle', floor: 3, monster: 'spider', reward: { radius: 1, x1: 4, x2: 4, lineGen: 1, pt1: 1 } },
    { type: 'fork', floor: 3, options: ['chest', 'event', 'shop'] },
    { type: 'camp', floor: 3 },
    { type: 'battle', floor: 3, monster: 'mask', reward: { x1: 4, x2: 4, pt1: 2 } },
    { type: 'camp', floor: 3 },
    { type: 'battle', floor: 3, monster: 'ringSpirit', reward: { x1: 6, x2: 6, radius: 2, lineGen: 2, pt1: 3 } },
    { type: 'camp', floor: 4 },
    { type: 'battle', floor: 4, monster: 'meteor', reward: { radius: 1, x1: 4, x2: 4, lineGen: 1, pt1: 1 } },
    { type: 'fork', floor: 4, options: ['shop', 'chest', 'event'] },
    { type: 'camp', floor: 4 },
    { type: 'battle', floor: 4, monster: 'knight', reward: { x1: 4, x2: 4, pt1: 2, radius: 1, lineGen: 1 } },
    { type: 'camp', floor: 4 },
    { type: 'battle', floor: 4, monster: 'gatekeeper', unlock: 'dPlusR', reward: { x1: 4, x2: 4, pt1: 2 } },
    { type: 'camp', floor: 5, parts: { vec: 4, mirrorAx: 4, figF: 4, pt1: 4 } },
    { type: 'battle', floor: 5, monster: 'shiftWraith', reward: { vec: 2, figF: 2, pt1: 2 } },
    { type: 'fork', floor: 5, options: ['chest', 'elite:billiard', 'shop'] },
    { type: 'camp', floor: 5 },
    { type: 'battle', floor: 5, monster: 'mirrorWraith', reward: { mirrorAx: 2, figF: 2, pt1: 2, x1: 4, x2: 4 } },
    { type: 'camp', floor: 5 },
    { type: 'battle', floor: 5, monster: 'mirrorLord', reward: { x1: 4, x2: 4, pt1: 3, radius: 2, vec: 2, mirrorAx: 2, figF: 2 } },
    { type: 'camp', floor: 6, parts: { lineGen: 2, radius: 2, mirrorAx: 2, figF: 2 } },
    { type: 'battle', floor: 6, monster: 'mirrorHound', reward: { x1: 4, x2: 4, pt1: 2 } },
    { type: 'fork', floor: 6, options: ['shop', 'event', 'chest'] },
    { type: 'camp', floor: 6 },
    { type: 'battle', floor: 6, monster: 'finalBoss', medal: 'medal1' },
    // ── Ⅱ 차원 ──
    { type: 'camp', floor: 7, parts: { elem: 6, setA: 6, setB: 6, setU: 4 }, dimIntro: 2 },
    { type: 'battle', floor: 7, monster: 'setSlime', reward: { elem: 3, setA: 3, setB: 3, setU: 2 } },
    { type: 'fork', floor: 7, options: ['chest', 'elite:bikeClub', 'event'] },
    { type: 'camp', floor: 7 },
    { type: 'battle', floor: 7, monster: 'complGhost', reward: { elem: 3, setA: 4, setB: 4, setU: 3 } },
    { type: 'camp', floor: 7 },
    { type: 'battle', floor: 7, monster: 'vennGolem', reward: { setA: 4, setB: 4, setU: 2, elem: 2 } },
    { type: 'camp', floor: 8, parts: { condP: 6, condQ: 6, sqNonneg: 2, setU: 2 } },
    { type: 'battle', floor: 8, monster: 'negShade', reward: { condP: 3, condQ: 3, setU: 2, elem: 2 } },
    { type: 'fork', floor: 8, options: ['shop', 'chest', 'event'] },
    { type: 'camp', floor: 8 },
    { type: 'battle', floor: 8, monster: 'counterKnight', reward: { condP: 4, condQ: 4, sqNonneg: 1 } },
    { type: 'camp', floor: 8 },
    { type: 'battle', floor: 8, monster: 'contraWarden', medal: 'medal2' },
    // ── Ⅲ 차원 ──
    { type: 'camp', floor: 9, parts: { domX: 6, codY: 6, fx: 6, gx: 4, xval: 4 }, dimIntro: 3 },
    { type: 'battle', floor: 9, monster: 'valSlime', reward: { domX: 3, codY: 3, fx: 3, gx: 3, xval: 3 } },
    { type: 'fork', floor: 9, options: ['chest', 'elite:bijection', 'shop'] },
    { type: 'camp', floor: 9 },
    { type: 'battle', floor: 9, monster: 'chimera', reward: { fx: 4, gx: 4, xval: 2, domX: 2, codY: 2 } },
    { type: 'camp', floor: 9 },
    { type: 'battle', floor: 9, monster: 'inverseWitch', reward: { fx: 3, gx: 2, recip: 3, sqrtF: 3, domX: 2, codY: 2 } },
    { type: 'camp', floor: 10, parts: { recip: 3, sqrtF: 3, fx: 2 } },
    { type: 'battle', floor: 10, monster: 'asymGhost', reward: { recip: 2, fx: 2, domX: 2, codY: 2 } },
    { type: 'fork', floor: 10, options: ['shop', 'chest', 'event'] },
    { type: 'camp', floor: 10 },
    { type: 'battle', floor: 10, monster: 'rootSnake', reward: { recip: 2, sqrtF: 2, fx: 3 } },
    { type: 'camp', floor: 10 },
    { type: 'battle', floor: 10, monster: 'asymKing', medal: 'medal3' },
    { type: 'clear' },
  ],
};
DS.floorDim = (f) => (DS.Progress.floors[f] ? DS.Progress.floors[f].dim : 1);
