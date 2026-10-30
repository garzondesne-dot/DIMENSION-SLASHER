// 연성 규칙 (화면과 분리된 순수 로직) — 번외편: 엄격한 연성
// 모루: [재료] [연산] [재료] (이항) 또는 [연산] [재료] (단항)
//  - 순서가 뜻을 바꾸는 연산(∈, ⊂, ⊄, 거듭제곱, 빼기)은 순서를 지켜야 연성된다. 비슷해도 봐주지 않는다
//  - 틀리면 재료는 돌려받고, 무엇이 틀렸는지 개념 메시지가 뜬다 (벌 없음)
//  - 카드를 처음 만들 때 한 번, 반짝이며 예제(DS.SetGen.example)가 뜨고 맞혀야 완성된다 (forge.js)
window.DS = window.DS || {};

DS.Craft = (function () {
  const key = (t) => `${t.kind}:${t.id}`;

  // ordered: 재료 순서가 의미 있음 (왼쪽 칸 → 오른쪽 칸)
  const RULES = [
    // 1페이즈: [원소] ∈ [집합], n( )[집합]
    { op: 'in', in: ['part:elem', 'part:setA'], ordered: true, out: { kind: 'card', id: 'belong' } },
    { op: 'count', in: ['part:setA'], out: { kind: 'card', id: 'count' } },
    // 2페이즈 ①: [집합 A] ⊂ [집합 B]
    { op: 'sub', in: ['part:setA', 'part:setB'], ordered: true, out: { kind: 'card', id: 'subset' } },
    // 2페이즈 ②: 반대 방향 B ⊂ A (또는 B ⊄ A) 를 만든 뒤 [A ⊂ B] 이고 [ … ]
    { op: 'sub', in: ['part:setB', 'part:setA'], ordered: true, out: { kind: 'part', id: 'subBA' } },
    { op: 'nsub', in: ['part:setB', 'part:setA'], ordered: true, out: { kind: 'part', id: 'nsubBA' } },
    { op: 'and', in: ['card:subset', 'part:subBA'], out: { kind: 'card', id: 'equal' } },
    { op: 'and', in: ['card:subset', 'part:nsubBA'], out: { kind: 'card', id: 'proper' } },
    // 3페이즈: [2] ^ [n(A)] → 2ⁿ, 2ⁿ − [p] → 2ⁿ⁻ᵖ, 2ⁿ − [q] → 2ⁿ⁻q, 2ⁿ⁻ᵖ − [q] → 2ⁿ⁻ᵖ⁻q
    { op: 'pow', in: ['part:branch', 'card:count'], ordered: true, out: { kind: 'card', id: 'subsetCount' } },
    { op: 'minus', in: ['card:subsetCount', 'part:fixP'], ordered: true, out: { kind: 'card', id: 'fixIn' } },
    { op: 'minus', in: ['card:subsetCount', 'part:fixQ'], ordered: true, out: { kind: 'card', id: 'fixOut' } },
    { op: 'minus', in: ['card:fixIn', 'part:fixQ'], ordered: true, out: { kind: 'card', id: 'fixBoth' } },
  ];

  // 자주 하는 실수 → 개념 피드백. 키: 연산>재료(순서대로) 또는 연산|재료(정렬)
  const MISTAKES = {
    // ∈ 자리
    'in>part:setA,part:elem': '∈ 의 왼쪽은 원소, 오른쪽은 집합이에요. A ∈ a (✕) → a ∈ A (○)',
    'in|part:setA,part:setB': '집합과 집합 사이에는 ∈ 를 쓰지 않아요. {1} ∈ {1, 4} (✕) → 집합끼리는 ⊂',
    'in|part:elem,part:elem': '원소와 원소 사이에는 ∈ 를 쓰지 않아요. 오른쪽에는 집합이 와야 해요.',
    'count|part:elem': 'n( ) 안에는 집합이 들어가요. 원소 하나의 "개수"가 아니라 집합의 원소의 개수!',
    // ⊂ 자리
    'sub>part:elem,part:setA': '1 ⊂ {1, 4} (✕). 원소와 집합 사이는 ∈, 집합과 집합 사이가 ⊂ 예요.',
    'sub>part:elem,part:setB': '1 ⊂ {1, 4} (✕). 원소와 집합 사이는 ∈, 집합과 집합 사이가 ⊂ 예요.',
    'sub>part:setA,part:elem': '⊂ 의 양쪽은 모두 집합이어야 해요.',
    'sub>part:setB,part:elem': '⊂ 의 양쪽은 모두 집합이어야 해요.',
    'sub|part:setA,part:setA': 'A ⊂ A 는 언제나 참이에요(자기 자신의 부분집합). 오늘 벼릴 카드는 서로 다른 두 집합 [A] ⊂ [B] 예요.',
    'nsub>part:setA,part:setB': '부분집합 카드는 ⊂ 로 벼려요: [A] ⊂ [B]. ⊄ 는 반대 방향 B ⊄ A 를 만들 때 써요.',
    // 이고 자리
    'and|part:setA,part:setB': '"이고"는 두 포함 관계를 잇는 연산이에요. [A ⊂ B] 카드와 반대 방향 [B ⊂ A] 를 이어 보자.',
    'and|card:subset,part:setB': '한쪽만 포함으로는 같다고 할 수 없어요. 먼저 [B] ⊂ [A] 로 반대 방향을 만들자.',
    'and|card:subset,part:setA': '한쪽만 포함으로는 같다고 할 수 없어요. 먼저 [B] ⊂ [A] 로 반대 방향을 만들자.',
    'and|card:subset,card:subset': '같은 방향 A ⊂ B 두 번은 소용없어요. 반대 방향 B ⊂ A 가 필요해요.',
    // 거듭제곱 · 빼기 자리
    'pow>card:count,part:branch': '거꾸로예요! 부분집합의 개수는 2ⁿ: 밑이 2(넣는다·뺀다), 지수가 n(원소의 개수)',
    'pow|card:count,part:fixP': '밑은 원소마다 생기는 두 갈래(2)예요. [2] ^ [n(A)]',
    'minus>part:fixP,card:subsetCount': '거꾸로예요! 2ⁿ 에서 고정된 원소 p 개를 빼서 2ⁿ⁻ᵖ',
    'minus>part:fixQ,card:subsetCount': '거꾸로예요! 2ⁿ 에서 빼기로 정한 원소 q 개를 빼서 2ⁿ⁻q',
    'minus>part:fixQ,card:fixIn': '거꾸로예요! 2ⁿ⁻ᵖ 에서 q 를 빼서 2ⁿ⁻ᵖ⁻q',
    'minus>card:count,part:fixP': '원소의 개수 n 에서 바로 빼면 아직 개수가 아니에요. 먼저 [2] ^ [n] 으로 2ⁿ 을 만들자.',
    'minus>card:fixOut,part:fixP': '이번에는 [2ⁿ⁻ᵖ] − [q] 순서로 만들어요. 결과는 같아도 레시피는 하나!',
  };

  // 개념별 일반 안내 (위에 없는 조합)
  function general(op, keys) {
    const has = (k) => keys.includes(k);
    if (op === 'in' && (has('part:setA') || has('part:setB')) && !has('part:elem')) return '∈ 는 원소와 집합 사이에만 써요. 왼쪽에 [원소], 오른쪽에 [집합].';
    if ((op === 'sub' || op === 'nsub') && has('part:elem')) return '⊂ · ⊄ 는 집합과 집합 사이에만 써요. 원소는 ∈ 로!';
    if (op === 'and') return '"이고"는 [A ⊂ B] 카드와 반대 방향 포함 관계(B ⊂ A 또는 B ⊄ A)를 이어요.';
    if (op === 'pow') return '2ⁿ 은 [2 (두 갈래)] ^ [원소의 개수] 순서로 벼려요.';
    if (op === 'minus') return '빼기는 개수 카드(2ⁿ, 2ⁿ⁻ᵖ)에서 고정된 원소 수(p, q)를 뺄 때 써요. 왼쪽이 카드, 오른쪽이 p · q.';
    return '';
  }

  function match(op, a, b) {
    const mats = [a, b].filter(Boolean);
    if (!op) return { ok: false, msg: '가운데 연산 칸이 비어 있어요.' };
    const o = DS.Ops[op];
    if (o.locked) return { ok: false, msg: `${o.name} 연산은 ${o.locked}.` };
    const keys = mats.map(key);
    const sorted = keys.slice().sort().join(',');
    const hint = () => MISTAKES[`${op}>${keys.join(',')}`] || MISTAKES[`${op}|${sorted}`] || general(op, keys);
    if (o.unary && mats.length !== 1) return { ok: false, msg: `${o.sym} 는 재료 하나에만 씌워요.` };
    if (!o.unary && (mats.length !== 2 || !a || !b)) return { ok: false, msg: `${o.sym} 는 왼쪽 칸과 오른쪽 칸에 재료가 하나씩 필요해요.` };
    for (const r of RULES) {
      if (r.op !== op) continue;
      if (r.ordered ? keys.join(',') === r.in.join(',') : sorted === r.in.slice().sort().join(',')) return { ok: true, out: r.out };
    }
    return { ok: false, msg: hint() || '이 조합으로는 개념이 되지 않아요. 레시피 도감의 힌트를 보세요.' };
  }

  // 레시피 도감: floor 부터 보임. quick: 즉시 연성 비용, guide: 단계 [왼쪽, 연산, 오른쪽, 결과] (테스트로 검증)
  const BOOK = [
    {
      card: 'belong', dim: 2, floor: 1, chain: '[원소] ∈ [집합]', hint: '원소가 집합에 속한다는 기호… 왼쪽과 오른쪽을 잘 보자',
      lore: 'a 가 집합 A 의 원소 → a ∈ A, 아니면 a ∉ A. ∈ 의 왼쪽은 원소, 오른쪽은 집합 (2차시)',
      quick: { parts: { elem: 1, setA: 1 } }, emergency: [], refund: { elem: 1 },
      guide: [['part:elem', 'in', 'part:setA', 'card:belong']],
    },
    {
      card: 'count', dim: 2, floor: 1, chain: 'n( ) [집합]', hint: '집합의 원소가 몇 개인지 세는 기호',
      lore: 'n(A): 유한집합 A 의 원소의 개수. n(∅) = 0, n({0}) = 1 (2차시)',
      quick: { parts: { setA: 1 } }, emergency: [], refund: { setA: 1 },
      guide: [[null, 'count', 'part:setA', 'card:count']],
    },
    {
      card: 'subset', dim: 2, floor: 2, chain: '[집합 A] ⊂ [집합 B]', hint: 'A 의 모든 원소가 B 에 속하면…',
      lore: 'A 의 모든 원소가 B 에 속하면 A ⊂ B. 하나라도 빠지면 A ⊄ B. A ⊂ A, ∅ ⊂ A 는 언제나 참 (3차시 STEP 1·2)',
      quick: { parts: { setA: 1, setB: 1 } }, emergency: [], refund: { setA: 1 },
      guide: [['part:setA', 'sub', 'part:setB', 'card:subset']],
    },
    {
      card: 'equal', dim: 2, floor: 3, chain: '[B] ⊂ [A] 를 만든 뒤 [A ⊂ B] 이고 [B ⊂ A]', hint: '한쪽 방향만으로는 부족해. 반대 방향도 포함되면…',
      lore: 'A ⊂ B 이고 B ⊂ A 일 때 A = B (원소가 모두 같다). 순서만 다른 {1, 2, 3} = {3, 1, 2} (3차시 STEP 3)',
      quick: { parts: { setA: 1, setB: 1 }, cards: { subset: 1 } }, emergency: [], refund: { setA: 1 },
      guide: [['part:setB', 'sub', 'part:setA', 'part:subBA'], ['card:subset', 'and', 'part:subBA', 'card:equal']],
    },
    {
      card: 'proper', dim: 2, floor: 3, chain: '[B] ⊄ [A] 를 만든 뒤 [A ⊂ B] 이고 [B ⊄ A]', hint: '포함은 되지만 같지는 않은 집합…',
      lore: 'A ⊂ B 이고 A ≠ B 이면 A 는 B 의 진부분집합 (부분집합 중 자기 자신을 뺀 것). 원소 n 개 → 2ⁿ − 1 개 (3차시 STEP 4)',
      quick: { parts: { setA: 1, setB: 1 }, cards: { subset: 1 } }, emergency: [], refund: { setA: 1 },
      guide: [['part:setB', 'nsub', 'part:setA', 'part:nsubBA'], ['card:subset', 'and', 'part:nsubBA', 'card:proper']],
    },
    {
      card: 'subsetCount', dim: 2, floor: 4, chain: '[2] ^ [원소의 개수]', hint: '원소 하나마다 넣는다·뺀다 두 갈래… 원소가 n 개면?',
      lore: '원소가 하나 늘 때마다 2배! 1개 → 2, 2개 → 4, 3개 → 8 … 원소 n 개 → 2ⁿ 개 (3차시 보강)',
      quick: { cards: { count: 1 } }, emergency: [], refund: {},
      guide: [['part:branch', 'pow', 'card:count', 'card:subsetCount']],
    },
    {
      card: 'fixIn', dim: 2, floor: 4, chain: '[2ⁿ] − [반드시 포함 p]', hint: '반드시 넣기로 정한 원소는 더 이상 갈래가 없어…',
      lore: '특정한 원소 p 개를 반드시 포함하는 부분집합: 2ⁿ⁻ᵖ 개 (정해진 원소는 고를 필요가 없다)',
      quick: { parts: { fixP: 1 }, cards: { subsetCount: 1 } }, emergency: [], refund: { fixP: 1 },
      guide: [['card:subsetCount', 'minus', 'part:fixP', 'card:fixIn']],
    },
    {
      card: 'fixOut', dim: 2, floor: 4, chain: '[2ⁿ] − [포함하지 않음 q]', hint: '빼기로 정한 원소도 갈래가 없어…',
      lore: '특정한 원소 q 개를 포함하지 않는 부분집합: 2ⁿ⁻q 개',
      quick: { parts: { fixQ: 1 }, cards: { subsetCount: 1 } }, emergency: [], refund: { fixQ: 1 },
      guide: [['card:subsetCount', 'minus', 'part:fixQ', 'card:fixOut']],
    },
    {
      card: 'fixBoth', dim: 2, floor: 4, chain: '[2ⁿ⁻ᵖ] − [포함하지 않음 q]', hint: '넣기로 정한 것도, 빼기로 정한 것도 갈래가 없어…',
      lore: 'p 개는 반드시 포함하고 q 개는 포함하지 않는 부분집합: 2ⁿ⁻ᵖ⁻q 개 (3차시 형성평가 도전 7번)',
      quick: { parts: { fixQ: 1 }, cards: { fixIn: 1 } }, emergency: [], refund: { fixQ: 1 },
      guide: [['card:subsetCount', 'minus', 'part:fixP', 'card:fixIn'], ['card:fixIn', 'minus', 'part:fixQ', 'card:fixBoth']],
    },
  ];
  const refundParts = (refund) => ({ ...(refund || {}) });
  const MASTERY = 2;
  const book = (id) => BOOK.find((b) => b.card === id);

  return { RULES, MISTAKES, BOOK, MASTERY, key, match, book, refundParts };
})();
