// 연성 규칙 (화면과 분리된 순수 로직)
// 모루: [재료] [연산] [재료] (이항) 또는 [연산] [재료] (단항: ², √, |·|)
// 재료 토큰: { kind: 'part' | 'card', id, axis?: 'x' | 'y' }  — axis 는 차이·선분의 길이·차이² 카드만
window.DS = window.DS || {};

DS.Craft = (function () {
  const axisCards = ['diff', 'segLen', 'diffSq'];
  const key = (t) => (t.kind === 'card' && axisCards.includes(t.id) ? `card:${t.id}@${t.axis || 'x'}` : `${t.kind}:${t.id}`);

  // ordered: 재료 순서가 의미 있음 (나눗셈). out.axis: 결과 카드의 축
  const RULES = [
    { op: 'minus', in: ['part:x1', 'part:x2'], out: { kind: 'card', id: 'diff', axis: 'x' } },
    { op: 'abs', in: ['card:diff@x'], out: { kind: 'card', id: 'segLen', axis: 'x' } },
    { op: 'abs', in: ['card:diff@y'], out: { kind: 'card', id: 'segLen', axis: 'y' } },
    { op: 'sq', in: ['card:diff@x'], out: { kind: 'card', id: 'diffSq', axis: 'x' } },
    { op: 'sq', in: ['card:diff@y'], out: { kind: 'card', id: 'diffSq', axis: 'y' } },
    { op: 'sq', in: ['card:segLen@x'], out: { kind: 'card', id: 'diffSq', axis: 'x' } }, // |x₂−x₁|² = (x₂−x₁)²
    { op: 'sq', in: ['card:segLen@y'], out: { kind: 'card', id: 'diffSq', axis: 'y' } },
    { op: 'plus', in: ['card:diffSq@x', 'card:diffSq@y'], out: { kind: 'part', id: 'sumSq' } },
    { op: 'root', in: ['part:sumSq'], out: { kind: 'card', id: 'dist' } },
    { op: 'div', in: ['card:diff@y', 'card:diff@x'], ordered: true, out: { kind: 'part', id: 'slope' } },
    { op: 'ratio', in: ['part:x1', 'part:x2'], out: { kind: 'card', id: 'divide' } },
    { op: 'eq', in: ['part:slope', 'part:mPrime'], out: { kind: 'card', id: 'para' } },
    { op: 'times', in: ['part:slope', 'part:mPrime'], out: { kind: 'card', id: 'perp' } },
    { op: 'minus', in: ['part:pt1', 'part:slope'], out: { kind: 'card', id: 'line' } },
  ];

  // 자주 하는 실수 → 개념 피드백. 키: 연산|재료(정렬), 순서가 중요한 경우 연산>재료(순서대로)
  const MISTAKES = {
    'plus|part:x1,part:x2': '두 좌표를 더하면 거리가 아니에요. 더해서 2로 나누면 "중점"이 됩니다. 차이는 빼기!',
    'minus|part:x1,part:x1': '같은 점끼리 빼면 0이에요. 서로 다른 두 점 x₁, x₂가 필요해요.',
    'minus|part:x2,part:x2': '같은 점끼리 빼면 0이에요. 서로 다른 두 점 x₁, x₂가 필요해요.',
    'ratio|part:x1,part:x1': '내분점은 서로 다른 두 점 사이에 생겨요. [x₁] m : n [x₂]',
    'ratio|part:x2,part:x2': '내분점은 서로 다른 두 점 사이에 생겨요. [x₁] m : n [x₂]',
    'ratio|card:diff@x': '내분점은 길이가 아니라 두 점의 좌표가 필요해요. [x₁] m : n [x₂]',
    'ratio|card:segLen@x': '내분점은 길이가 아니라 두 점의 좌표가 필요해요. [x₁] m : n [x₂]',
    'div>card:diff@x,card:diff@y': '거꾸로예요! 기울기는 (y₂ − y₁) ÷ (x₂ − x₁). 세로 ÷ 가로!',
    'div|card:diff@x,card:diff@x': '둘 다 가로 차이예요. 한 장은 ⇄ 로 세로(y₂ − y₁)로 바꿔서 세로 ÷ 가로!',
    'div|card:diff@y,card:diff@y': '둘 다 세로 차이예요. 기울기는 세로 ÷ 가로!',
    'minus|card:diff@x,card:diff@y': '기울기는 빼기가 아니라 나누기예요. (y₂ − y₁) ÷ (x₂ − x₁)',
    'plus|card:diffSq@x,card:diffSq@x': '둘 다 가로예요. 차이 카드를 ⇄ 로 세로로 바꿔서 제곱한 것도 필요해요.',
    'plus|card:diffSq@y,card:diffSq@y': '둘 다 세로예요. 가로 차이의 제곱도 있어야 직각삼각형이 됩니다.',
    'minus|card:diffSq@x,card:diffSq@y': '피타고라스 정리는 빼기가 아니라 더하기예요: 빗변² = 가로² + 세로²',
    'root|card:diffSq@x': '√((x₂−x₁)²) 은 |x₂−x₁|, 제자리예요. 세로²도 더한 뒤에 루트를 씌워요.',
    'root|card:diffSq@y': '세로만으로는 대각선 거리가 안 나와요. 가로²와 더한 뒤에 루트!',
    'root|card:diff@x': '루트는 "제곱의 합"에 씌우는 거예요. 먼저 제곱(²)부터!',
    'root|card:segLen@x': '루트는 "제곱의 합"에 씌우는 거예요. 먼저 제곱(²)부터!',
    'plus|card:diff@x,card:diff@y': '가로 + 세로는 계단처럼 꺾어 걸은 길이예요. 각각 제곱해서 더하고 루트!',
    'plus|card:segLen@x,card:segLen@y': '가로 + 세로는 계단처럼 꺾어 걸은 길이예요. 각각 제곱해서 더하고 루트!',
    'abs|card:segLen@x': '이미 절댓값이에요. 다음은 제곱(²)이나 다른 연성으로!',
    'abs|card:diffSq@x': '제곱한 값은 이미 0 이상이라 절댓값이 필요 없어요.',
    'times|part:pt1,part:slope': '직선의 방정식은 y − y₁ = m(x − x₁). 점을 빼서 옮기는 게 먼저예요(−).',
    'times|part:slope,part:slope': '기울기 두 개 대신 [기울기] × [m′] 으로 수직 조건을 만들어요.',
    'eq|part:slope,part:slope': '기울기 두 개 대신 [기울기] = [m′] 으로 평행 조건을 만들어요.',
  };

  // y축 카드도 같은 피드백을 쓰도록 키를 x 로 바꿔 한 번 더 찾는다
  const xKey = (k) => k.replace(/@y/g, '@x');

  function match(op, a, b) {
    const mats = [a, b].filter(Boolean);
    if (!op) return { ok: false, msg: '가운데 연산 칸이 비어 있어요.' };
    const o = DS.Ops[op];
    if (o.locked) return { ok: false, msg: `${o.name} 연산은 ${o.locked}.` };
    const keys = mats.map(key);
    const sorted = keys.slice().sort().join(',');
    const hint = () => MISTAKES[`${op}>${keys.join(',')}`] || MISTAKES[`${op}|${sorted}`]
      || MISTAKES[xKey(`${op}|${sorted}`)];
    if (o.unary && mats.length !== 1) return { ok: false, msg: `${o.sym} 는 재료 하나에만 씌워요.` };
    if (!o.unary && mats.length !== 2) return { ok: false, msg: hint() || `${o.sym} 는 양쪽에 재료가 하나씩 필요해요.` };
    for (const r of RULES) {
      if (r.op !== op) continue;
      if (r.ordered ? keys.join(',') === r.in.join(',') : sorted === r.in.slice().sort().join(',')) {
        return { ok: true, out: r.out };
      }
    }
    if (keys.includes('part:mPrime')) return { ok: false, msg: hint() || 'm′ 은 [기울기]와 함께 × (수직) 또는 = (평행) 에만 반응해요.' };
    return { ok: false, msg: hint() || '이 조합으로는 공식이 되지 않아요. 레시피 도감의 힌트를 보세요.' };
  }

  // 레시피 도감 · 숙련(직접 3번 → 즉시 연성) · 긴급 연성(손패만) · 분해 회수
  // quick: 캠프 즉시 연성 비용 (부품 가방 + 보관함 카드)
  // emergency: 전투 중 손패로 대신할 수 있는 재료 조합 (없으면 긴급 연성 불가)
  // refund: 분해 시 돌려받는 소재 (소재의 절반, 소수점 버림). pt: 점 x₁·x₂ 중에서 → refundParts 로 정함
  // guide: 조합법 창(베타)에 보여 줄 단계 [재료, 연산, 재료, 결과]. 테스트에서 실제 연성 규칙으로 검증한다.
  //   card:diff@y = ⇄로 세로로 뒤집은 차이 카드. n: 같은 연성을 몇 번
  const D = ['part:x1', 'minus', 'part:x2', 'card:diff@x'];
  const D2 = [...D, 2];
  const SLOPE = ['card:diff@y', 'div', 'card:diff@x', 'part:slope'];
  const BOOK = [
    {
      card: 'diff', floor: 1, chain: '[x₁] − [x₂]', hint: '두 점의 좌표를 빼면…',
      lore: '빼는 순서와 상관없이 x₂ − x₁. 카드를 ⇄ 로 뒤집으면 y₂ − y₁.',
      quick: { parts: { x1: 1, x2: 1 } }, emergency: [], refund: { pt: 1 },
      guide: [D],
    },
    {
      card: 'segLen', floor: 1, chain: '|·| [차이]', hint: '음수가 나와도 거리는 양수여야…',
      lore: '수직선 위 두 점 사이 거리 = |x₂ − x₁|',
      quick: { cards: { diff: 1 } }, emergency: [{ diff: 1 }], refund: { pt: 1 },
      guide: [D, [null, 'abs', 'card:diff@x', 'card:segLen@x']],
    },
    {
      card: 'diffSq', floor: 1, chain: '[차이] ² (또는 [선분의 길이] ²)', hint: '차이를 제곱하면…',
      lore: '제곱하면 부호가 사라진다: |x₂ − x₁|² = (x₂ − x₁)²',
      quick: { cards: { diff: 1 } }, emergency: [{ diff: 1 }, { segLen: 1 }], refund: { pt: 1 },
      guide: [D, [null, 'sq', 'card:diff@x', 'card:diffSq@x']],
    },
    {
      card: 'divide', floor: 1, chain: '[x₁] m : n [x₂]', hint: '두 점 사이를 일정한 비율로 나누는 연산',
      lore: '내분점 = (m·x₂ + n·x₁)/(m + n). 비율은 엇갈려 곱한다!',
      quick: { parts: { x1: 1, x2: 1 } }, emergency: [], refund: { pt: 1 },
      guide: [['part:x1', 'ratio', 'part:x2', 'card:divide']],
    },
    {
      card: 'dist', floor: 1, chain: '[차이]², [⇄차이]², 더하기 → √', hint: '가로·세로로 직각삼각형을 만들면 빗변이… (4단계)',
      lore: '(x₂−x₁)² + (y₂−y₁)² 에 루트. 교과서 14쪽의 유도 그대로!',
      quick: { cards: { diff: 2 } }, emergency: [{ diff: 2 }, { diffSq: 2 }], refund: { pt: 2 },
      guide: [D2, [null, 'sq', 'card:diff@x', 'card:diffSq@x'], [null, 'sq', 'card:diff@y', 'card:diffSq@y'], ['card:diffSq@x', 'plus', 'card:diffSq@y', 'part:sumSq'], [null, 'root', 'part:sumSq', 'card:dist']],
    },
    {
      card: 'para', floor: 2, chain: '[세로 차이] ÷ [가로 차이] → [기울기] = [m′]', hint: '두 기울기가 같으면?',
      lore: '두 직선이 평행 ⇔ m = m′ (y절편은 다름).',
      quick: { cards: { diff: 2 } }, emergency: [{ diff: 2 }], refund: { pt: 2 },
      guide: [D2, SLOPE, ['part:slope', 'eq', 'part:mPrime', 'card:para']],
    },
    {
      card: 'perp', floor: 2, chain: '[세로 차이] ÷ [가로 차이] → [기울기] × [m′]', hint: '두 기울기의 곱이 −1 이 되는 관계',
      lore: '두 직선이 수직 ⇔ mm′ = −1.',
      quick: { cards: { diff: 2 } }, emergency: [{ diff: 2 }], refund: { pt: 2 },
      guide: [D2, SLOPE, ['part:slope', 'times', 'part:mPrime', 'card:perp']],
    },
    {
      card: 'line', floor: 2, chain: '[한 점] − [기울기]', hint: '한 점을 지나고 기울기가 m인 직선',
      lore: 'y − y₁ = m(x − x₁). 점을 빼서 원점으로 옮긴 뒤 기울기를 곱한다.',
      quick: { parts: { pt1: 1 }, cards: { diff: 2 } }, emergency: [], refund: { pt: 2 },
      guide: [D2, SLOPE, ['part:pt1', 'minus', 'part:slope', 'card:line']],
    },
  ];
  // 분해 회수 계산: pt n개 → 2개 이상이면 x₁·x₂를 반씩, 남는 1개는 가방에 적은 쪽 (같으면 랜덤)
  // 연성은 항상 x₁·x₂를 하나씩 쓰므로, 이렇게 돌려주면 둘의 개수 차이가 1을 넘지 않아 진행이 막히지 않는다
  function refundParts(refund, bag, rnd = Math.random) {
    const out = {};
    const add = (id, n) => { if (n > 0) out[id] = (out[id] || 0) + n; };
    for (const [id, n] of Object.entries(refund || {})) {
      if (id !== 'pt') { add(id, n); continue; }
      const half = Math.floor(n / 2);
      add('x1', half); add('x2', half);
      if (n % 2) {
        const a = (bag.x1 || 0) + (out.x1 || 0), b = (bag.x2 || 0) + (out.x2 || 0);
        add(a < b ? 'x1' : b < a ? 'x2' : (rnd() < 0.5 ? 'x1' : 'x2'), 1);
      }
    }
    return out;
  }
  const MASTERY = 3;
  const book = (id) => BOOK.find((b) => b.card === id);

  return { RULES, MISTAKES, BOOK, MASTERY, key, match, book, refundParts };
})();
