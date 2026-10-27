// 연성 규칙 (화면과 분리된 순수 로직): [재료] [연산] [재료] 또는 [연산] [재료]
// 재료 토큰: { kind: 'part' | 'card', id, axis?: 'x' | 'y' }  (axis 는 선분의 길이 카드만)
window.DS = window.DS || {};

DS.Craft = (function () {
  const key = (t) => (t.kind === 'card' && t.id === 'segLen' ? `card:segLen@${t.axis || 'x'}` : `${t.kind}:${t.id}`);

  // ordered: 재료 순서가 의미 있음 (나눗셈). unary 연산은 재료 하나.
  const RULES = [
    { op: 'minus', in: ['part:ptA', 'part:ptB'], out: { kind: 'card', id: 'segLen' } },
    { op: 'div', in: ['part:dy', 'part:dx'], ordered: true, out: { kind: 'card', id: 'slope' } },
    { op: 'sq', in: ['card:segLen@x'], out: { kind: 'part', id: 'sqX' } },
    { op: 'sq', in: ['card:segLen@y'], out: { kind: 'part', id: 'sqY' } },
    { op: 'plus', in: ['part:sqX', 'part:sqY'], out: { kind: 'part', id: 'sumSq' } },
    { op: 'root', in: ['part:sumSq'], out: { kind: 'card', id: 'dist' } },
    { op: 'ratio', in: ['card:segLen@x'], out: { kind: 'card', id: 'divide' } },
    { op: 'ratio', in: ['card:segLen@y'], out: { kind: 'card', id: 'divide' } },
    { op: 'minus', in: ['part:pt1', 'card:slope'], out: { kind: 'card', id: 'line' } },
    { op: 'times', in: ['card:slope', 'card:slope'], out: { kind: 'card', id: 'perp' } },
    { op: 'eq', in: ['card:slope', 'card:slope'], out: { kind: 'card', id: 'para' } },
  ];

  // 자주 하는 실수 → 개념 피드백. 키: 연산|재료(정렬), 순서가 중요한 경우 연산>재료(순서대로)
  const MISTAKES = {
    'plus|part:ptA,part:ptB': '두 좌표를 더하면 거리가 아니에요. 더해서 2로 나누면 "중점"이 됩니다. 거리는 빼기!',
    'div>part:dx,part:dy': '거꾸로예요! 기울기는 세로 변화 ÷ 가로 변화 (y의 증가량 ÷ x의 증가량).',
    'minus|part:dx,part:dy': '기울기는 빼기가 아니라 나누기예요. 세로 변화 ÷ 가로 변화!',
    'plus|part:sqX,part:sqX': '둘 다 가로예요. 선분 카드의 ⇄ 버튼으로 축을 바꿔 세로 선분도 만들어 보세요.',
    'plus|part:sqY,part:sqY': '둘 다 세로예요. 가로 선분의 제곱도 있어야 직각삼각형이 됩니다.',
    'minus|part:sqX,part:sqY': '피타고라스 정리는 빼기가 아니라 더하기예요: 빗변² = 가로² + 세로²',
    'root|part:sqX': '√((x₂−x₁)²) 은 |x₂−x₁|, 제자리예요. 세로²도 더한 뒤에 루트를 씌워요.',
    'root|part:sqY': '세로만으로는 대각선 거리가 안 나와요. 가로²와 더한 뒤에 루트!',
    'root|card:segLen@x': '루트는 "제곱의 합"에 씌우는 거예요. 먼저 제곱(²)부터!',
    'root|card:segLen@y': '루트는 "제곱의 합"에 씌우는 거예요. 먼저 제곱(²)부터!',
    'plus|card:segLen@x,card:segLen@x': '선분 길이를 그냥 더하면 거리가 아니에요. 제곱(²)해서 더하고 루트!',
    'plus|card:segLen@x,card:segLen@y': '가로 + 세로는 계단처럼 꺾어 걸은 길이예요. 각각 제곱해서 더하고 루트!',
    'plus|card:slope,card:slope': '두 기울기를 더하면 의미가 없어요. 곱이 −1이면 수직(×), 같으면 평행(=)!',
    'minus|card:slope,card:slope': '두 기울기 사이의 관계는 곱(×) 또는 같음(=)으로 나타내요.',
    'times|card:slope,part:pt1': '직선의 방정식은 y − y₁ = m(x − x₁). 점을 빼서 옮기는 게 먼저예요(−).',
  };

  // 재료를 순서대로 받아 결과를 판정한다.
  function match(op, a, b) {
    const mats = [a, b].filter(Boolean);
    if (!op) return { ok: false, msg: '가운데 연산 칸이 비어 있어요.' };
    const opDef = DS.Ops[op];
    if (opDef.unary && mats.length !== 1) return { ok: false, msg: `${opDef.sym} 는 재료 하나에만 씌워요.` };
    if (!opDef.unary && mats.length !== 2) return { ok: false, msg: `${opDef.sym} 는 양쪽에 재료가 하나씩 필요해요.` };
    const keys = mats.map(key);
    const sorted = keys.slice().sort().join(',');
    for (const r of RULES) {
      if (r.op !== op) continue;
      if (r.ordered ? keys.join(',') === r.in.join(',') : sorted === r.in.slice().sort().join(',')) {
        return { ok: true, out: r.out };
      }
    }
    const hint = MISTAKES[`${op}>${keys.join(',')}`] || MISTAKES[`${op}|${sorted}`];
    return { ok: false, msg: hint || '이 조합으로는 공식이 되지 않아요. 레시피 도감의 힌트를 보세요.' };
  }

  // 레시피 도감 + 숙련(직접 3번 연성하면 즉시 연성) 정보. 카드 결과만 숙련 대상.
  const BOOK = [
    { card: 'segLen', floor: 1, chain: '[점 A] − [점 B]', hint: '두 점의 좌표를 빼면…', lore: '수직선 위 두 점 사이 거리 |x₂ − x₁|. 빼고 나서 절댓값!', quick: { parts: { ptA: 1, ptB: 1 } } },
    { card: 'dist', floor: 1, chain: '[선분]² + [⇄선분]² → √', hint: '가로·세로로 직각삼각형을 만들면 빗변이… (3단계 연성)', lore: '(x₂−x₁)² + (y₂−y₁)² 에 루트. 교과서 14쪽의 유도 그대로!', quick: { cards: { segLen: 2 } } },
    { card: 'divide', floor: 1, chain: '[m : n] [선분]', hint: '선분을 일정한 비율로 나누는 연산', lore: '내분점 = (m·x₂ + n·x₁)/(m + n). 비율은 엇갈려 곱한다!', quick: { cards: { segLen: 1 } } },
    { card: 'slope', floor: 2, chain: '[세로 변화] ÷ [가로 변화]', hint: '얼마나 올라가는지 ÷ 얼마나 옆으로 가는지', lore: '기울기 = y의 증가량 ÷ x의 증가량 (순서 주의!)', quick: { parts: { dy: 1, dx: 1 } } },
    { card: 'para', floor: 2, chain: '[기울기] = [기울기]', hint: '두 기울기가 같으면?', lore: '두 직선이 평행 ⇔ m = m′ (y절편은 다름).', quick: { cards: { slope: 2 } } },
    { card: 'perp', floor: 2, chain: '[기울기] × [기울기]', hint: '두 기울기를 곱하면 −1 이 되는 관계', lore: '두 직선이 수직 ⇔ mm′ = −1.', quick: { cards: { slope: 2 } } },
    { card: 'line', floor: 2, chain: '[한 점] − [기울기]', hint: '한 점을 지나고 기울기가 m인 직선', lore: 'y − y₁ = m(x − x₁). 점을 빼서 원점으로 옮긴 뒤 기울기를 곱한다.', quick: { parts: { pt1: 1 }, cards: { slope: 1 } } },
  ];
  const MASTERY = 3;

  return { RULES, MISTAKES, BOOK, MASTERY, key, match };
})();
