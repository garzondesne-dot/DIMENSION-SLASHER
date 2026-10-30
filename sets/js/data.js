// 번외편 「포함의 결계」 데이터: 공통수학2 Ⅱ-1 집합 (2차시 복습 · 3차시 집합 사이의 포함 관계)
// 50분 수업용. 1페이즈 전시학습 → 2페이즈 포함 관계 (연성 → 문제 → 연성 → 문제) → 3페이즈 형성평가 필드 + 중간보스
// 엔진은 v1.0 테스트판을 복사해 썼다 (차원·유물·물약·갈림길은 쓰지 않음, 구조만 남김)
// 몬스터와 문제는 monsters.js, 연성 규칙·예제는 craft.js, 카드 수치·덱 규칙은 cards.js
window.DS = window.DS || {};

// ── 등급 ─────────────────────────────────────────────────
DS.Tiers = {
  basic: { name: '기본', crit: 0, critMult: 1.5, affixes: 0 },
  normal: { name: '일반', crit: 0, critMult: 1.5, affixes: 0 },
  magic: { name: '매직', crit: 0.10, critMult: 1.5, affixes: 1 },
  rare: { name: '레어', crit: 0.15, critMult: 1.5, affixes: 2 },
  unique: { name: '유니크', crit: 0.25, critMult: 2, affixes: 0 },
  special: { name: '특수', crit: 0, critMult: 1.5, affixes: 0 },
};

// ── 차원: 번외편은 하나 (엔진 호환용) ───────────────────────────
DS.Dims = {
  2: { name: 'Ⅱ 집합', short: 'Ⅱ', basic: 'member', color: '#5ce1a5' },
};

// ── 부품 (부품 가방) ──────────────────────────────────────
// mid: 바로 다음 연성으로 넘어가는 중간 단계, inf: 무한 제공, floor: 이 층부터 보임
DS.Parts = {
  elem: { dim: 2, name: '원소', sym: 'a' },
  setA: { dim: 2, name: '집합 A', sym: 'A' },
  setB: { dim: 2, name: '집합 B', sym: 'B' },
  subBA: { dim: 2, name: '반대 방향 포함', sym: 'B ⊂ A', mid: true },
  nsubBA: { dim: 2, name: '반대 방향 불포함', sym: 'B ⊄ A', mid: true },
  branch: { dim: 2, name: '두 갈래 (넣는다·뺀다)', sym: '2', inf: true, floor: 4 },
  fixP: { dim: 2, name: '반드시 포함 p개', sym: 'p' },
  fixQ: { dim: 2, name: '포함하지 않음 q개', sym: 'q' },
};

// ── 연산 (무한) ──────────────────────────────────────────
// 순서가 뜻을 바꾸는 연산은 순서를 지켜야 연성된다 (craft.js 의 ordered)
DS.Ops = {
  in: { sym: '∈', name: '속한다', dims: [2] },
  count: { sym: 'n( )', name: '원소의 개수', unary: true, dims: [2] },
  sub: { sym: '⊂', name: '부분집합', floor: 2, dims: [2] },
  nsub: { sym: '⊄', name: '부분집합 아님', floor: 2, dims: [2] },
  and: { sym: '이고', name: '그리고', floor: 3, dims: [2] },
  pow: { sym: 'xⁿ', name: '거듭제곱', floor: 4, dims: [2] },
  minus: { sym: '−', name: '빼기', floor: 4, dims: [2] },
};

// ── 카드 종류 ────────────────────────────────────────────
// score: 투자 점수 → 공격 + 방어 합계 = score + 2 ~ score + 4,  tool: 결계 보호막에서 풀이 도구
// keep: 다음 개념의 재료로 써도 사라지지 않는 기초 개념 카드 (부분집합 → 같은 집합·진부분집합, 개수 → 2ⁿ)
DS.Cards = {
  member: { dim: 2, name: '원소 확인', tier: 'basic', formula: 'a ∈ A ?', score: 4, scan: 'always', desc: '원소가 집합에 있는지 살피며 문제를 밝힌다' },
  // 1페이즈 (2차시 복습)
  belong: { dim: 2, name: '소속 판정', tier: 'normal', formula: 'a ∈ A · a ∉ A', score: 6, scan: 'chance', tool: true, desc: '∈ 의 왼쪽은 원소, 오른쪽은 집합' },
  count: { dim: 2, name: '원소의 개수', tier: 'normal', formula: 'n(A)', score: 6, scan: 'chance', tool: true, keep: true, desc: '집합의 원소를 하나씩 센다. n(∅) = 0' },
  // 2페이즈 (3차시 포함 관계)
  subset: { dim: 2, name: '부분집합', tier: 'magic', formula: 'A ⊂ B · A ⊄ B', score: 10, tool: true, keep: true, desc: 'A의 모든 원소가 B에 속하면 A ⊂ B' },
  equal: { dim: 2, name: '서로 같은 집합', tier: 'magic', formula: 'A ⊂ B 이고 B ⊂ A ⇔ A = B', score: 14, tool: true, desc: '양쪽 방향 모두 포함될 때만 같다' },
  proper: { dim: 2, name: '진부분집합', tier: 'magic', formula: 'A ⊂ B 이고 A ≠ B', score: 14, tool: true, desc: '부분집합 중 자기 자신을 뺀 것 (2ⁿ − 1 개)' },
  // 3페이즈 (형성평가 · 중간보스)
  subsetCount: { dim: 2, name: '부분집합의 개수', tier: 'rare', formula: '2ⁿ', score: 16, tool: true, desc: '원소마다 넣는다·뺀다 두 갈래 → 2 × 2 × … × 2' },
  fixIn: { dim: 2, name: '반드시 포함', tier: 'rare', formula: '2ⁿ⁻ᵖ', score: 18, tool: true, desc: '특정한 원소 p개를 반드시 포함하는 부분집합의 개수' },
  fixOut: { dim: 2, name: '포함하지 않음', tier: 'rare', formula: '2ⁿ⁻q', score: 18, tool: true, desc: '특정한 원소 q개를 포함하지 않는 부분집합의 개수' },
  fixBoth: { dim: 2, name: '포함 · 제외', tier: 'rare', formula: '2ⁿ⁻ᵖ⁻q', score: 22, tool: true, desc: 'p개는 포함하고 q개는 포함하지 않는 부분집합의 개수' },
};

// ── 디아블로식 옵션 ──────────────────────────────────────
DS.Affixes = {
  pierce: { name: '철갑 관통', range: [1, 1, 1, 1], text: () => '철갑 관통' },
  critRate: { name: '치명타 확률', range: [5, 10, 8, 15], text: (v) => `치명타 확률 +${v}%` },
  critDmg: { name: '치명타 피해', range: [20, 40, 30, 60], text: (v) => `치명타 피해 +${v}%` },
  vuln: { name: '취약 부여', range: [20, 30, 25, 40], text: (v) => `취약 ${v}%` },
  bleed: { name: '출혈', range: [2, 3, 3, 5], text: (v) => `출혈 ${v}×2턴` },
  leech: { name: '흡혈', range: [10, 15, 15, 25], text: (v) => `흡혈 ${v}%` },
  counter: { name: '반격 방어', range: [2, 3, 3, 5], text: (v) => `반격 방어 +${v}` },
  draw: { name: '추가 드로우', range: [25, 35, 35, 50], text: (v) => `${v}% 드로우` },
};
DS.SCAN_CHANCE = 0.35;

// 유물·물약은 번외편에서 쓰지 않는다 (엔진 호환용 빈 목록)
DS.RELIC_SLOTS = 0;
DS.Relics = {};
DS.MAX_POTIONS = 0;
DS.Potions = {};

// ── 밸런스: 50분 수업이라 몬스터는 짧게 ───────────────────────
DS.Balance = { hp: 1, atk: 1, crystals: { mob: 0, boss: 0, elite: 0 } };

// ── 버전 · 설정 ──────────────────────────────────────────
DS.VERSION = 'sets-v1.0';
DS.SPINOFF = true; // 번외편 표시
DS.BETA = false;
DS.TEST = false;
DS.GUIDE = false;
DS.REPORT_URL = ''; // 2차(실시간 현황)에서 연결
// 설정 (⚙): 기기에 저장
DS.SettingDefs = {
  stack: { name: '대장간 카드 묶음 보기', desc: '같은 카드를 한 칸에 묶어 보기 (끄면 낱장)', def: false },
  vibrate: { name: '진동', desc: '공격·방어·피격 때 폰 진동', def: true },
};

// ── 덱 규칙: 새 카드는 자동으로 덱에 들어간다 ─────────────────
DS.DeckRules = { min: 6, max: 16, minScan: 4, minBasic: 1, maxMagic: 4 };

// ── 진행 ────────────────────────────────────────────────
// 층 = 수업의 한 구간. lock: 선생님이 알려 주는 해금 코드가 있어야 들어감 (날짜마다 바뀜, 교사용 화면에서 확인)
// need: 이 캠프에서 연성해야 출발할 수 있는 카드, sheet: 기다리는 동안 채울 학습지 칸
DS.Progress = {
  startBasic: 6,
  trialDiff: 6,
  floors: {
    1: { dim: 2, title: '1페이즈 · 집합의 기억', unit: '전시학습: ∈·∉, 조건제시법, 원소의 개수, 공집합 (2차시)' },
    2: { dim: 2, title: '2페이즈 ① 부분집합', unit: '부분집합 ⊂·⊄, A ⊂ A, ∅ ⊂ A (3차시 STEP 1·2)' },
    3: { dim: 2, title: '2페이즈 ② 같은 집합', unit: '서로 같은 집합, 진부분집합, 부분집합 모두 구하기 (3차시 STEP 3·4)' },
    4: { dim: 2, title: '3페이즈 · 형성평가 필드', unit: '선생님 도움 없이 클리어 · 중간보스 2ⁿ의 수호자' },
  },
  dimSupply: {},
  nodes: [
    { type: 'camp', floor: 1, parts: { elem: 4, setA: 4 }, need: ['belong', 'count'] },
    { type: 'battle', floor: 1, monster: 'belongSlime', lock: 'm1', sheet: '2차시 학습지 문제 2·3번 다시 보기' },
    { type: 'battle', floor: 1, monster: 'emptyGhost', lock: 'm2', sheet: '2차시 학습지 STEP 4 · 생각 톡톡' },
    { type: 'camp', floor: 2, parts: { setA: 3, setB: 3, elem: 2 }, need: ['subset'] },
    { type: 'battle', floor: 2, monster: 'unitGolem', lock: 'm3', sheet: '3차시 학습지 문제 1번 (1)~(4)' },
    { type: 'battle', floor: 2, monster: 'includeKnight', lock: 'm4', sheet: '3차시 학습지 보강 (5)~(7) · STEP 2' },
    { type: 'camp', floor: 3, parts: { setA: 4, setB: 4 }, need: ['equal', 'proper'] },
    { type: 'battle', floor: 3, monster: 'mirrorTwins', lock: 'm5', sheet: '3차시 학습지 문제 2번' },
    { type: 'battle', floor: 3, monster: 'collector', lock: 'm6', sheet: '3차시 학습지 문제 3번 (부분집합 표)' },
    { type: 'camp', floor: 4, lock: 'p3', parts: { fixP: 3, fixQ: 3 }, need: ['subsetCount', 'fixIn', 'fixOut', 'fixBoth'], solo: true, sheet: '3차시 학습지 보강: 부분집합의 개수 규칙' },
    { type: 'battle', floor: 4, monster: 'mixCrab', solo: true },
    { type: 'battle', floor: 4, monster: 'mixWisp', solo: true },
    { type: 'battle', floor: 4, monster: 'mixKnight', solo: true },
    { type: 'battle', floor: 4, monster: 'powerGuardian', solo: true },
    { type: 'clear' },
  ],
};
DS.floorDim = () => 2;
