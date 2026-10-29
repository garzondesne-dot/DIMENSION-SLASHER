// 연성 규칙 (화면과 분리된 순수 로직)
// 모루: [재료] [연산] [재료] (이항) 또는 [연산] [재료] (단항: ², √, |·|, ✂)
// 재료 토큰: { kind: 'part' | 'card', id, axis?: 'x' | 'y' }  — axis 는 ⇄ 로 뒤집는 카드만 (DS.Cards[id].axis)
//   직선의 방정식은 axis 'y' = 일반형
window.DS = window.DS || {};

DS.Craft = (function () {
  const isAxis = (id) => !!(DS.Cards[id] && DS.Cards[id].axis);
  const key = (t) => (t.kind === 'card' && isAxis(t.id) ? `card:${t.id}@${t.axis || 'x'}` : `${t.kind}:${t.id}`);

  // ordered: 재료 순서가 의미 있음 (나눗셈). out.axis: 결과 카드의 축
  // out.kind 'parts': 조각 여러 개 (식 분해). out.note: 성공했을 때 덧붙이는 설명
  const RULES = [
    { op: 'minus', in: ['part:x1', 'part:x2'], out: { kind: 'card', id: 'diff', axis: 'x' } },
    { op: 'abs', in: ['card:diff@x'], out: { kind: 'card', id: 'segLen', axis: 'x' } },
    { op: 'abs', in: ['card:diff@y'], out: { kind: 'card', id: 'segLen', axis: 'y' } },
    { op: 'sq', in: ['card:diff@x'], out: { kind: 'card', id: 'diffSq', axis: 'x' } },
    { op: 'sq', in: ['card:diff@y'], out: { kind: 'card', id: 'diffSq', axis: 'y' } },
    { op: 'sq', in: ['card:segLen@x'], out: { kind: 'card', id: 'diffSq', axis: 'x' } }, // |x₂−x₁|² = (x₂−x₁)²
    { op: 'sq', in: ['card:segLen@y'], out: { kind: 'card', id: 'diffSq', axis: 'y' } },
    // 같은 것을 두 번 곱하면 제곱 (v0.3.2): ² 를 발견하기 전에도 만들 수 있는 길
    { op: 'times', in: ['card:diff@x', 'card:diff@x'], out: { kind: 'card', id: 'diffSq', axis: 'x' } },
    { op: 'times', in: ['card:diff@y', 'card:diff@y'], out: { kind: 'card', id: 'diffSq', axis: 'y' } },
    { op: 'times', in: ['card:segLen@x', 'card:segLen@x'], out: { kind: 'card', id: 'diffSq', axis: 'x' } },
    { op: 'times', in: ['card:segLen@y', 'card:segLen@y'], out: { kind: 'card', id: 'diffSq', axis: 'y' } },
    { op: 'plus', in: ['card:diffSq@x', 'card:diffSq@y'], out: { kind: 'part', id: 'sumSq' } },
    { op: 'root', in: ['part:sumSq'], out: { kind: 'card', id: 'dist' } },
    { op: 'div', in: ['card:diff@y', 'card:diff@x'], ordered: true, out: { kind: 'part', id: 'slope' } },
    { op: 'ratio', in: ['part:x1', 'part:x2'], out: { kind: 'card', id: 'divide' } },
    { op: 'eq', in: ['part:slope', 'part:mPrime'], out: { kind: 'card', id: 'para' } },
    { op: 'times', in: ['part:slope', 'part:mPrime'], out: { kind: 'card', id: 'perp' } },
    { op: 'minus', in: ['part:pt1', 'part:slope'], out: { kind: 'card', id: 'line' } },
    // 3·4층: 원 단원 (교과서 23~41쪽)
    { op: 'subst', in: ['card:line@y', 'part:pt1'], out: { kind: 'part', id: 'plug' } }, // 일반형 직선의 식에 한 점 대입
    { op: 'abs', in: ['part:plug'], out: { kind: 'part', id: 'absPlug' } },
    { op: 'root', in: ['part:coefSq'], out: { kind: 'part', id: 'normLen' } }, // a² + b² 에 직접 √
    { op: 'div', in: ['part:absPlug', 'part:normLen'], ordered: true, out: { kind: 'card', id: 'ptLine' } },
    // 원의 방정식 첫째 길: 거리 = r → 양변 제곱 (교과서 30쪽)
    { op: 'eq', in: ['card:dist', 'part:radius'], out: { kind: 'part', id: 'circR' } }, // CP = r
    { op: 'sq', in: ['part:circR'], out: { kind: 'card', id: 'circle' } }, // 양변 제곱
    // 원의 방정식 둘째 길: 식 분해 → 0 = a² − a² 를 더해 완전제곱 → 합치기 (교과서 32쪽)
    { op: 'split', in: ['card:genCircle'], out: { kind: 'parts', ids: ['xPart', 'yPart'], note: '식을 x 조각과 y 조각으로 쪼갰어요. 이제 조각마다 [+] 영(零)의 결정을 붙여 보자.' } },
    { op: 'plus', in: ['part:xPart', 'part:zero'], out: { kind: 'part', id: 'xSq', note: '0 이 a² − a² 로 변신! x² − 2ax + a² 은 (x − a)². 빌려 온 a² 은 반드시 빼서 갚는다!' } },
    { op: 'plus', in: ['part:yPart', 'part:zero'], out: { kind: 'part', id: 'ySq', note: '0 이 b² − b² 로 변신! y² − 2by + b² 은 (y − b)². 빌려 온 b² 은 반드시 빼서 갚는다!' } },
    { op: 'plus', in: ['part:xSq', 'part:ySq'], out: { kind: 'card', id: 'circle', note: '빌린 a², b² 을 오른쪽으로 넘기면 (x − a)² + (y − b)² = a² + b² = r²' } },
    { op: 'cmp', in: ['card:ptLine', 'part:radius'], out: { kind: 'card', id: 'posRel' } }, // d ⋚ r
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
    'div>part:normLen,part:absPlug': '거꾸로예요! 거리 = |ax₁ + by₁ + c| ÷ √(a² + b²). 절댓값이 위, 계수 길이가 아래!',
    'div|part:normLen,part:plug': '거리는 음수가 될 수 없어요. 먼저 |·| 절댓값을 씌우고 나누세요.',
    'subst|card:line@y,part:x1': '직선의 식에 넣을 것은 점 하나의 좌표 (x₁, y₁)예요. [한 점]을 대입하세요.',
    'subst|card:line@y,part:x2': '직선의 식에 넣을 것은 점 하나의 좌표 (x₁, y₁)예요. [한 점]을 대입하세요.',
    'subst|card:line@x,part:pt1': '먼저 모루 위에서 ⇄ 로 직선의 방정식을 일반형 ax + by + c = 0 으로 뒤집자.',
    // 같은 것끼리 곱하기 (² 발견)
    'times|card:diff@x,card:diff@y': '가로 × 세로는 직사각형의 넓이예요. 같은 것끼리 곱해야 제곱!',
    'times|card:segLen@x,card:segLen@y': '가로 × 세로는 직사각형의 넓이예요. 같은 것끼리 곱해야 제곱!',
    // 원의 방정식 둘째 길 (식 분해 · 영의 결정)
    'plus|part:xPart,part:yPart': '아직 둘 다 완전제곱이 아니에요. 조각마다 영(零)의 결정을 [+] 로 붙여 바꿔 보자.',
    'sq|part:xPart': '제곱 꼴이 되려면 한 조각이 모자라요. 영(零)의 결정을 [+] 로 붙여 보자.',
    'sq|part:yPart': '제곱 꼴이 되려면 한 조각이 모자라요. 영(零)의 결정을 [+] 로 붙여 보자.',
    'plus|part:xPart': '제곱 꼴이 되려면 한 조각이 모자라요. 영(零)의 결정을 반대쪽 칸에 올려 보자.',
    'plus|part:yPart': '제곱 꼴이 되려면 한 조각이 모자라요. 영(零)의 결정을 반대쪽 칸에 올려 보자.',
    'minus|part:xPart,part:zero': '0 은 빼도 더해도 그대로지만, 완전제곱을 만들 땐 [+] 로 붙여 a² − a² 로 바꿔요.',
    'minus|part:yPart,part:zero': '0 은 빼도 더해도 그대로지만, 완전제곱을 만들 땐 [+] 로 붙여 b² − b² 로 바꿔요.',
    'plus|part:xSq,part:xSq': 'x 는 이미 완전제곱! y 조각도 바꿔서 합치자.',
    'plus|part:ySq,part:ySq': 'y 는 이미 완전제곱! x 조각도 바꿔서 합치자.',
    'plus|part:xSq,part:yPart': 'y 조각은 아직 완전제곱이 아니에요. 먼저 영(零)의 결정을 붙이자.',
    'plus|part:xPart,part:ySq': 'x 조각은 아직 완전제곱이 아니에요. 먼저 영(零)의 결정을 붙이자.',
    'split|card:circle': '이미 원의 방정식이에요. 식 분해는 [원 (일반형)] 카드에 써요.',
    'plus|card:dist,part:radius': '원 위의 점은 중심까지의 거리가 반지름과 같아요. 더하기가 아니라 = (같다)!',
    'sq|card:dist': '먼저 [거리] = [반지름 r] 로 원 위의 점의 조건을 세우고, 그다음에 양변을 제곱해요.',
    'cmp|card:dist,part:radius': '두 점 사이의 거리가 아니라 중심에서 직선까지의 거리 d, [점과 직선 사이의 거리]가 필요해요.',
    'cmp|card:circle,part:radius': '원의 방정식이 아니라, 중심에서 직선까지의 거리 d를 반지름 r과 비교해요.',
    'eq|card:ptLine,part:radius': 'd = r 은 접할 때뿐이에요. ⋚ 비교로 세 경우(두 점, 접함, 안 만남)를 한 번에 판정해요.',
  };

  // y축 카드도 같은 피드백을 쓰도록 키를 x 로 바꿔 한 번 더 찾는다
  const xKey = (k) => k.replace(/@y/g, '@x');

  // opts.unlocked: 발견한 연산 (Set). 없으면 모두 발견한 것으로 본다 (테스트·조합법 안내)
  const found = (op, opts) => !DS.Ops[op].discover || !opts || !opts.unlocked || opts.unlocked.has(op);
  // [제곱의 합]을 √ 없이 쓰려 할 때 (√ 를 아직 못 찾았으면 발견 방법을 안내)
  const sumSqMsg = (opts) => (found('root', opts)
    ? '제곱의 합은 아직 거리가 아니에요. √를 씌워야 두 점 사이의 거리!'
    : '제곱의 합은 아직 거리가 아니에요. 제곱을 되돌리는 연산이 필요해요. ² 를 모루에 올렸다가 다시 눌러 꺼내 보자!');

  // 결과: { ok, out } 또는 { ok: false, msg }. sqTry: 같은 것끼리 곱하기를 시도함 (² 발견 조건)
  function match(op, a, b, opts) {
    const res = matchRaw(op, a, b, opts);
    const ks = [a, b].filter(Boolean).map(key);
    if (op === 'times' && ks.length === 2 && ks[0] === ks[1]) res.sqTry = true;
    return res;
  }
  function matchRaw(op, a, b, opts) {
    const mats = [a, b].filter(Boolean);
    if (!op) return { ok: false, msg: '가운데 연산 칸이 비어 있어요.' };
    const o = DS.Ops[op];
    if (o.locked) return { ok: false, msg: `${o.name} 연산은 ${o.locked}.` };
    if (!found(op, opts)) return { ok: false, msg: `${o.sym} 연산은 아직 발견하지 못했어요. ${o.hint}` };
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
    if (keys.includes('part:sumSq')) return { ok: false, msg: hint() || sumSqMsg(opts) };
    if (keys.includes('part:mPrime')) return { ok: false, msg: hint() || 'm′ 은 [기울기]와 함께 × (수직) 또는 = (평행) 에만 반응해요.' };
    if (keys.includes('part:zero')) return { ok: false, msg: hint() || '0 은 더해도 식이 그대로예요. [x 조각]이나 [y 조각] 같은 짝과 [+] 로 올려 보자.' };
    if (op === 'split') return { ok: false, msg: '식 분해(✂)는 [원 (일반형)] 카드에 써요.' };
    return { ok: false, msg: hint() || '이 조합으로는 공식이 되지 않아요. 레시피 도감의 힌트를 보세요.' };
  }
  // 부품이 완성됐을 때 덧붙이는 안내 (√ 를 아직 못 찾았으면 제곱의 합에서 발견 방법을 알려 줌)
  const partNote = (id, opts) => (id === 'sumSq' && !found('root', opts) ? sumSqMsg(opts) : '');

  // 레시피 도감 · 숙련(직접 3번 → 즉시 연성) · 긴급 연성(손패만) · 분해 회수
  // quick: 캠프 즉시 연성 비용 (부품 가방 + 보관함 카드)
  // emergency: 전투 중 손패로 대신할 수 있는 재료 조합 (없으면 긴급 연성 불가)
  // refund: 분해 시 돌려받는 소재 (소재의 절반, 소수점 버림). pt: 점 x₁·x₂ 중에서 → refundParts 로 정함
  // guide: 조합법 창(베타)에 보여 줄 단계 [재료, 연산, 재료, 결과]. 테스트에서 실제 연성 규칙으로 검증한다.
  //   card:diff@y = ⇄로 세로로 뒤집은 차이 카드. n: 같은 연성을 몇 번. parts:a,b = 조각 여러 개
  // alt: 같은 카드를 만드는 다른 길 { chain, lore, guide } — 도감에 "길 2개"로 보인다
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
      card: 'diffSq', floor: 1, chain: '[차이] ² (또는 [차이] × [차이])', hint: '같은 차이 카드 두 장을 곱하면…',
      lore: '제곱 = 같은 것을 두 번 곱하기. 제곱하면 부호가 사라진다: |x₂ − x₁|² = (x₂ − x₁)²',
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
  // 3·4층 카드 (원 단원)
  const DIST = [D2, [null, 'sq', 'card:diff@x', 'card:diffSq@x'], [null, 'sq', 'card:diff@y', 'card:diffSq@y'],
    ['card:diffSq@x', 'plus', 'card:diffSq@y', 'part:sumSq'], [null, 'root', 'part:sumSq', 'card:dist']];
  // 점과 직선 사이의 거리 (v0.3.2): 직선의 방정식 카드를 ⇄ 일반형으로 뒤집어 한 점 대입, a² + b² 에는 직접 √
  const LINE = [D2, SLOPE, ['part:pt1', 'minus', 'part:slope', 'card:line']];
  const PTLINE = [...LINE, ['card:line@y', 'subst', 'part:pt1', 'part:plug'], [null, 'abs', 'part:plug', 'part:absPlug'],
    [null, 'root', 'part:coefSq', 'part:normLen'], ['part:absPlug', 'div', 'part:normLen', 'card:ptLine']];
  BOOK.push(
    {
      card: 'ptLine', floor: 3, chain: '[직선의 방정식 ⇄ 일반형] ↦ [한 점] → |·| → ÷ √[a² + b²]', hint: '직선의 식을 일반형으로 뒤집고 점의 좌표를 넣어 보면…',
      lore: '점과 직선 사이의 거리 = |ax₁ + by₁ + c| ÷ √(a² + b²). 교과서 24쪽',
      quick: { parts: { pt1: 1, coefSq: 1 }, cards: { line: 1 } }, emergency: [], refund: { pt1: 1 },
      guide: PTLINE,
    },
    {
      card: 'circle', floor: 3, chain: '✂[원 (일반형)] → [x 조각] + [0], [y 조각] + [0] → 합치기', hint: '0 을 더해도 식은 그대로… 원 (일반형)을 쪼개 보면?',
      lore: 'x² − 2ax + a² − a² = (x − a)² − a². 빌린 a², b² 을 오른쪽으로 넘기면 (x − a)² + (y − b)² = a² + b² = r². '
        + '부호 조심: +6x = −2a·x 이면 a = −3 → (x + 3)². 교과서 32쪽',
      quick: { cards: { genCircle: 1 } }, emergency: [], refund: { radius: 1 },
      guide: [[null, 'split', 'card:genCircle', 'parts:xPart,yPart'], ['part:xPart', 'plus', 'part:zero', 'part:xSq'],
        ['part:yPart', 'plus', 'part:zero', 'part:ySq'], ['part:xSq', 'plus', 'part:ySq', 'card:circle']],
      alt: {
        chain: '[두 점 사이의 거리] = [반지름 r] → ²',
        lore: '원 위의 점 P에 대하여 CP = r → √((x−a)² + (y−b)²) = r → 양변을 제곱. 교과서 30쪽',
        guide: [...DIST, ['card:dist', 'eq', 'part:radius', 'part:circR'], [null, 'sq', 'part:circR', 'card:circle']],
      },
    },
    {
      card: 'posRel', floor: 4, chain: '[점과 직선 사이의 거리] ⋚ [반지름 r]', hint: '중심에서 직선까지의 거리와 반지름을 견주면…',
      lore: 'd < r 이면 두 점에서, d = r 이면 한 점에서(접한다), d > r 이면 만나지 않는다. 교과서 35쪽',
      quick: { parts: { radius: 1 }, cards: { ptLine: 1 } }, emergency: [{ ptLine: 1 }], refund: { radius: 1 },
      guide: [...PTLINE, ['card:ptLine', 'cmp', 'part:radius', 'card:posRel']],
    },
  );
  const MASTERY = 3;
  const book = (id) => BOOK.find((b) => b.card === id);

  return { RULES, MISTAKES, BOOK, MASTERY, key, match, partNote, book, refundParts };
})();
