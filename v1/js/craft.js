// 연성 규칙 (화면과 분리된 순수 로직)
// 모루: [재료] [연산] [재료] (이항) 또는 [연산] [재료] (단항)
// 재료 토큰: { kind: 'part' | 'card', id, axis?: 'x' | 'y' }  — axis 는 ⇄ 로 뒤집는 카드만
// v1.0 테스트판: 차원(대단원)마다 레시피가 따로 있다. 지난 차원 카드는 서고에서 꺼내 재료로 쓴다.
window.DS = window.DS || {};

DS.Craft = (function () {
  const isAxis = (id) => DS.Cards[id] && DS.Cards[id].axis;
  const key = (t) => (t.kind === 'card' && isAxis(t.id) ? `card:${t.id}@${t.axis || 'x'}` : `${t.kind}:${t.id}`);

  // ordered: 재료 순서가 의미 있음. out.axis: 결과 카드의 축
  const RULES = [
    // ── Ⅰ-1 (1층) ──
    { op: 'minus', in: ['part:x1', 'part:x2'], out: { kind: 'card', id: 'diff', axis: 'x' } },
    { op: 'abs', in: ['card:diff@x'], out: { kind: 'card', id: 'segLen', axis: 'x' } },
    { op: 'abs', in: ['card:diff@y'], out: { kind: 'card', id: 'segLen', axis: 'y' } },
    { op: 'sq', in: ['card:diff@x'], out: { kind: 'card', id: 'diffSq', axis: 'x' } },
    { op: 'sq', in: ['card:diff@y'], out: { kind: 'card', id: 'diffSq', axis: 'y' } },
    { op: 'sq', in: ['card:segLen@x'], out: { kind: 'card', id: 'diffSq', axis: 'x' } },
    { op: 'sq', in: ['card:segLen@y'], out: { kind: 'card', id: 'diffSq', axis: 'y' } },
    { op: 'plus', in: ['card:diffSq@x', 'card:diffSq@y'], out: { kind: 'part', id: 'sumSq' } },
    { op: 'root', in: ['part:sumSq'], out: { kind: 'card', id: 'dist' } },
    { op: 'div', in: ['card:diff@y', 'card:diff@x'], ordered: true, out: { kind: 'part', id: 'slope' } },
    { op: 'ratio', in: ['part:x1', 'part:x2'], out: { kind: 'card', id: 'divide' } },
    // ── Ⅰ-1 (2층) ──
    { op: 'eq', in: ['part:slope', 'part:mPrime'], out: { kind: 'card', id: 'para' } },
    { op: 'times', in: ['part:slope', 'part:mPrime'], out: { kind: 'card', id: 'perp' } },
    { op: 'minus', in: ['part:pt1', 'part:slope'], out: { kind: 'card', id: 'line' } },
    // ── Ⅰ-2 원 (3·4층) ──
    // 점과 직선 사이의 거리 (교과서 23쪽 유도): 수선 PH ⊥ l → 수선의 발 H → 두 점 P, H 사이의 거리
    { op: 'times', in: ['card:perp', 'part:lineGen'], out: { kind: 'part', id: 'perpLine' } },
    { op: 'subst', in: ['part:perpLine', 'part:pt1'], out: { kind: 'part', id: 'footH' } },
    { op: 'subst', in: ['card:dist', 'part:footH'], out: { kind: 'card', id: 'ptLine' } },
    // 원의 방정식 (30쪽): 중심 C(a, b)에서 P(x, y)까지의 거리 = r → 양변 제곱
    { op: 'subst', in: ['card:dist', 'part:pt1'], out: { kind: 'part', id: 'cpDist' } },
    { op: 'eq', in: ['part:cpDist', 'part:radius'], out: { kind: 'part', id: 'circR' } },
    { op: 'sq', in: ['part:circR'], out: { kind: 'card', id: 'circle' } },
    { op: 'plus', in: ['part:genCircle', 'part:halfSq'], out: { kind: 'card', id: 'completeSq' } },
    { op: 'cmp', in: ['card:ptLine', 'part:radius'], out: { kind: 'card', id: 'posRel' } },
    // ── Ⅰ-3 도형의 이동 (5·6층) ──
    { op: 'plus', in: ['part:pt1', 'part:vec'], out: { kind: 'card', id: 'transPt' } },
    { op: 'subst', in: ['part:figF', 'card:transPt'], out: { kind: 'card', id: 'transFig' } },
    { op: 'mirror', in: ['part:pt1', 'part:mirrorAx'], out: { kind: 'card', id: 'reflPt' } },
    { op: 'subst', in: ['part:figF', 'card:reflPt'], out: { kind: 'card', id: 'reflFig' } },

    // ── Ⅱ 집합 (7층) ──
    { op: 'in', in: ['part:elem', 'part:setA'], out: { kind: 'card', id: 'member' } },
    { op: 'in', in: ['part:elem', 'part:setB'], out: { kind: 'card', id: 'member' } },
    { op: 'cap', in: ['part:setA', 'part:setB'], out: { kind: 'card', id: 'inter' } },
    { op: 'cup', in: ['part:setA', 'part:setB'], out: { kind: 'card', id: 'union' } },
    { op: 'minus', in: ['part:setU', 'part:setA'], ordered: true, out: { kind: 'card', id: 'compl', axis: 'x' } },
    { op: 'minus', in: ['part:setU', 'part:setB'], ordered: true, out: { kind: 'card', id: 'compl', axis: 'y' } },
    { op: 'minus', in: ['part:setA', 'part:setB'], out: { kind: 'card', id: 'diffSet' } },
    { op: 'count', in: ['part:setA'], out: { kind: 'part', id: 'nA' } },
    { op: 'count', in: ['part:setB'], out: { kind: 'part', id: 'nB' } },
    { op: 'plus', in: ['part:nA', 'part:nB'], out: { kind: 'part', id: 'nSum' } },
    { op: 'count', in: ['card:inter'], out: { kind: 'part', id: 'nCap' } },
    { op: 'minus', in: ['part:nSum', 'part:nCap'], ordered: true, out: { kind: 'card', id: 'countU' } },
    { op: 'cap', in: ['card:compl@x', 'card:compl@y'], out: { kind: 'part', id: 'ccap' } },
    { op: 'comp', in: ['card:union'], out: { kind: 'part', id: 'unionC' } },
    { op: 'eq', in: ['part:unionC', 'part:ccap'], out: { kind: 'card', id: 'deMorgan' } },
    // ── Ⅱ 명제 (8층) ──
    { op: 'not', in: ['part:condP'], out: { kind: 'card', id: 'neg', axis: 'x' } },
    { op: 'not', in: ['part:condQ'], out: { kind: 'card', id: 'neg', axis: 'y' } },
    { op: 'tset', in: ['part:condP'], out: { kind: 'part', id: 'truthP' } },
    { op: 'tset', in: ['part:condQ'], out: { kind: 'part', id: 'truthQ' } },
    { op: 'sub', in: ['part:truthP', 'part:truthQ'], ordered: true, out: { kind: 'card', id: 'truth', axis: 'x' } },
    { op: 'sub', in: ['part:truthQ', 'part:truthP'], ordered: true, out: { kind: 'card', id: 'truth', axis: 'y' } },
    { op: 'imp', in: ['card:neg@y', 'card:neg@x'], ordered: true, out: { kind: 'card', id: 'contra' } },
    { op: 'cmp', in: ['card:truth@x', 'card:truth@y'], out: { kind: 'card', id: 'suffNec' } },
    { op: 'cmp', in: ['card:completeSq', 'part:sqNonneg'], out: { kind: 'card', id: 'absIneq' } }, // Ⅰ차원 카드를 꺼내 쓴다

    // ── Ⅲ 함수 (9층) ──
    { op: 'subst', in: ['part:domX', 'part:codY'], out: { kind: 'card', id: 'corr' } },
    { op: 'subst', in: ['part:fx', 'part:xval'], out: { kind: 'card', id: 'funcVal', axis: 'x' } },
    { op: 'cmp', in: ['card:funcVal@x', 'card:funcVal@y'], out: { kind: 'card', id: 'oneToOne' } },
    { op: 'compose', in: ['part:gx', 'part:fx'], out: { kind: 'card', id: 'compose' } },
    { op: 'solve', in: ['part:fx'], out: { kind: 'part', id: 'xOfY' } },
    { op: 'swap', in: ['part:xOfY'], out: { kind: 'card', id: 'inverse' } },
    { op: 'swap', in: ['part:fx'], out: { kind: 'part', id: 'fSwap' } },
    { op: 'solve', in: ['part:fSwap'], out: { kind: 'card', id: 'inverse' } },
    { op: 'mirror', in: ['card:inverse', 'card:reflPt'], out: { kind: 'card', id: 'invGraph' } }, // Ⅰ차원 카드
    // ── Ⅲ 유리·무리함수 (10층) ──
    { op: 'subst', in: ['part:recip', 'card:transFig'], out: { kind: 'card', id: 'rational' } }, // Ⅰ차원 카드
    { op: 'subst', in: ['part:sqrtF', 'card:transFig'], out: { kind: 'card', id: 'radical' } },
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
    // 점과 직선 사이의 거리 (v1: 증명 과정 그대로)
    'subst|part:lineGen,part:pt1': '점과 직선 사이의 거리는 점 P에서 직선에 내린 수선의 발 H까지의 거리예요. [수직 조건] × [직선]으로 수선부터!',
    'times|card:para,part:lineGen': '수선은 직선과 수직이에요. 평행 조건이 아니라 [수직 조건] × [직선]!',
    'subst|card:dist,part:perpLine': '수선이 직선과 만나는 점, 수선의 발 H를 먼저 구해요: [수선] ↦ [한 점 P]',
    'subst|card:segLen@x,part:footH': '좌표평면 위 두 점 P, H 사이의 거리예요. [두 점 사이의 거리] ↦ [수선의 발]',
    'minus|part:footH,part:pt1': '거리는 빼기 한 번으로 끝나지 않아요. [두 점 사이의 거리] ↦ [수선의 발 H]',
    // 원 (v1: 한 점 + 두 점 사이의 거리 + 반지름)
    'eq|card:dist,part:radius': '중심이 어디인지 먼저! [두 점 사이의 거리] ↦ [한 점(중심)] 으로 중심까지의 거리를 만든 뒤 = [반지름 r]',
    'plus|part:cpDist,part:radius': '원 위의 점은 중심까지의 거리가 반지름과 같아요. 더하기가 아니라 = (같다)!',
    'plus|card:dist,part:radius': '원 위의 점은 중심까지의 거리가 반지름과 같아요. 먼저 [두 점 사이의 거리] ↦ [한 점(중심)]',
    'sq|card:dist': '먼저 중심까지의 거리 = 반지름 r 로 원 위의 점의 조건을 세우고, 그다음에 양변을 제곱해요.',
    'sq|part:cpDist': '반지름 r과 같다(=)는 조건을 먼저 세운 뒤 제곱해요.',
    'minus|part:genCircle,part:halfSq': '빼면 제곱 꼴이 안 돼요. 양변에 (A/2)² + (B/2)² 를 더해서 완전제곱을 만들어요.',
    'cmp|card:dist,part:radius': '두 점 사이의 거리가 아니라 중심에서 직선까지의 거리 d, [점과 직선 사이의 거리]가 필요해요.',
    'cmp|card:circle,part:radius': '원의 방정식이 아니라, 중심에서 직선까지의 거리 d를 반지름 r과 비교해요.',
    'eq|card:ptLine,part:radius': 'd = r 은 접할 때뿐이에요. ⋚ 비교로 세 경우(두 점, 접함, 안 만남)를 한 번에 판정해요.',
    // 도형의 이동
    'minus|part:pt1,part:vec': '점의 평행이동은 더하기예요: (x + a, y + b)',
    'plus|part:figF,part:vec': '도형은 x 대신 x − a 를 대입해요. 먼저 [한 점] + [이동]으로 점의 평행이동을 만들고, 도형에 대입(↦)!',
    'subst|part:figF,part:vec': '먼저 [한 점] + [이동]으로 점의 평행이동을 만들고, 그 카드를 도형에 대입(↦)하세요.',
    'subst|part:figF,part:mirrorAx': '먼저 [한 점] ⟷ [대칭의 기준]으로 점의 대칭이동을 만들고, 그 카드를 도형에 대입(↦)하세요.',
    'mirror|part:figF,part:mirrorAx': '도형은 점의 대칭이동을 대입해서 옮겨요. 먼저 [한 점] ⟷ [대칭의 기준]!',
    'plus|part:pt1,part:mirrorAx': '대칭이동은 더하기가 아니라 ⟷ (대칭)이에요.',
    'mirror|part:pt1,part:vec': '(a, b)만큼 옮기는 것은 평행이동이에요. [한 점] + [이동]',

    // Ⅱ 집합
    'plus|part:setA,part:setB': '집합은 더하지 않아요. 합칠 때는 합집합(∪), 겹치는 부분은 교집합(∩)!',
    'minus>part:setA,part:setU': 'A − U 는 공집합이에요. 여집합은 U − A: 전체집합에서 A를 빼요.',
    'minus>part:setB,part:setU': 'B − U 는 공집합이에요. 여집합은 U − B: 전체집합에서 B를 빼요.',
    'comp|part:setA': 'ᶜ 는 합집합을 통째로 뒤집을 때 써요. A의 여집합 카드는 [U] − [A]로 만들어요 (교과서: Aᶜ = U − A).',
    'comp|part:setB': 'B의 여집합 카드는 [U] − [B]로 만들어요 (Bᶜ = U − B).',
    'plus|part:nSum,part:nCap': '교집합은 n(A)와 n(B)에서 두 번 세어졌어요. 한 번 빼야 해요(−).',
    'minus>part:nCap,part:nSum': '순서가 거꾸로예요. n(A) + n(B) 에서 n(A∩B) 를 빼요.',
    'count|card:union': 'n(A∪B)를 바로 셀 수 없을 때가 문제예요. n(A), n(B), n(A∩B)로 계산하는 공식을 만들어요.',
    'cup|card:compl@x,card:compl@y': 'Aᶜ ∪ Bᶜ 는 (A ∩ B)ᶜ 이에요. (A ∪ B)ᶜ 와 같은 것은 Aᶜ ∩ Bᶜ!',
    'cap|card:compl@x,card:compl@x': '둘 다 Aᶜ 예요. 한 장은 ⇄ 로 Bᶜ 로 바꾸세요.',
    'eq|card:union,part:ccap': '합집합에 먼저 ᶜ 를 씌워 (A∪B)ᶜ 를 만든 뒤 Aᶜ∩Bᶜ 와 같다(=)고 놓아요.',
    // Ⅱ 명제
    'imp|part:condP,part:condQ': 'p ⇒ q 는 명제 자체예요. 대우는 [~q] ⇒ [~p]: 부정 카드 두 장(⇄로 p·q)이 필요해요.',
    'imp>card:neg@x,card:neg@y': '~p ⇒ ~q 는 "이"예요. 대우는 가정과 결론을 부정하고 서로 바꾼 ~q ⇒ ~p!',
    'imp|card:neg@x,card:neg@x': '둘 다 ~p 예요. 한 장은 ⇄ 로 ~q 로 바꾸세요.',
    'sub|part:condP,part:condQ': '조건끼리가 아니라 진리집합끼리 포함 관계를 봐요. 먼저 {x|·}로 진리집합을 만드세요.',
    'cmp|card:truth@x,card:truth@x': '둘 다 P ⊂ Q 예요. 한 장은 ⇄ 로 Q ⊂ P 로 바꿔 양쪽 방향을 견줘요.',
    'cmp|part:sqNonneg,part:condP': '절대부등식은 완전제곱식 ≥ 0 에서 나와요. Ⅰ차원 [완전제곱] 카드를 서고에서 꺼내 오세요.',
    // Ⅲ
    'subst|part:fx,part:domX': '함숫값은 x에 값 하나(a)를 대입해요. [함수 f] ↦ [x의 값 a]',
    'solve|part:xOfY': '이미 x에 대해 풀었어요. 이제 x와 y를 바꾸면(⇆) 역함수!',
    'swap|part:fSwap': '이미 x, y를 바꿨어요. 이제 y에 대해 풀면(풀기) 역함수!',
    'compose|part:fx,part:fx': '합성함수는 서로 다른 두 함수 f, g를 이어요.',
    'plus|part:recip,card:transFig': '평행이동한 그래프는 x 대신 x − p, y 대신 y − q 를 대입(↦)해요.',
    'plus|part:sqrtF,card:transFig': '평행이동한 그래프는 x 대신 x − p, y 대신 y − q 를 대입(↦)해요.',
    'subst|part:recip,card:transPt': '그래프(도형)를 옮기려면 점이 아니라 [도형의 평행이동] 카드가 필요해요.',
    'subst|part:sqrtF,card:transPt': '그래프(도형)를 옮기려면 점이 아니라 [도형의 평행이동] 카드가 필요해요.',
    'mirror|card:inverse,card:reflFig': '점 하나로 보면 쉬워요: (a, b) → (b, a). [점의 대칭이동] 카드를 쓰세요.',
  };

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
  // dim: 차원, floor: 이 층부터 도감에 보임
  // guide: 단계 [재료, 연산, 재료, 결과]. 테스트에서 실제 연성 규칙으로 검증한다
  const D = ['part:x1', 'minus', 'part:x2', 'card:diff@x'];
  const D2 = [...D, 2];
  const SLOPE = ['card:diff@y', 'div', 'card:diff@x', 'part:slope'];
  const DIST = [D2, [null, 'sq', 'card:diff@x', 'card:diffSq@x'], [null, 'sq', 'card:diff@y', 'card:diffSq@y'],
    ['card:diffSq@x', 'plus', 'card:diffSq@y', 'part:sumSq'], [null, 'root', 'part:sumSq', 'card:dist']];
  const PERP = [D2, SLOPE, ['part:slope', 'times', 'part:mPrime', 'card:perp']];
  const BOOK = [
    {
      card: 'diff', dim: 1, floor: 1, chain: '[x₁] − [x₂]', hint: '두 점의 좌표를 빼면…',
      lore: '빼는 순서와 상관없이 x₂ − x₁. 카드를 ⇄ 로 뒤집으면 y₂ − y₁.',
      quick: { parts: { x1: 1, x2: 1 } }, emergency: [], refund: { pt: 1 }, guide: [D],
    },
    {
      card: 'segLen', dim: 1, floor: 1, chain: '|·| [차이]', hint: '음수가 나와도 거리는 양수여야…',
      lore: '수직선 위 두 점 사이 거리 = |x₂ − x₁|',
      quick: { cards: { diff: 1 } }, emergency: [{ diff: 1 }], refund: { pt: 1 },
      guide: [D, [null, 'abs', 'card:diff@x', 'card:segLen@x']],
    },
    {
      card: 'diffSq', dim: 1, floor: 1, chain: '[차이] ² (또는 [선분의 길이] ²)', hint: '차이를 제곱하면…',
      lore: '제곱하면 부호가 사라진다: |x₂ − x₁|² = (x₂ − x₁)²',
      quick: { cards: { diff: 1 } }, emergency: [{ diff: 1 }, { segLen: 1 }], refund: { pt: 1 },
      guide: [D, [null, 'sq', 'card:diff@x', 'card:diffSq@x']],
    },
    {
      card: 'divide', dim: 1, floor: 1, chain: '[x₁] m : n [x₂]', hint: '두 점 사이를 일정한 비율로 나누는 연산',
      lore: '내분점 = (m·x₂ + n·x₁)/(m + n). 비율은 엇갈려 곱한다!',
      quick: { parts: { x1: 1, x2: 1 } }, emergency: [], refund: { pt: 1 },
      guide: [['part:x1', 'ratio', 'part:x2', 'card:divide']],
    },
    {
      card: 'dist', dim: 1, floor: 1, chain: '[차이]², [⇄차이]², 더하기 → √', hint: '가로·세로로 직각삼각형을 만들면 빗변이… (4단계)',
      lore: '(x₂−x₁)² + (y₂−y₁)² 에 루트. 교과서 14쪽의 유도 그대로!',
      quick: { cards: { diff: 2 } }, emergency: [{ diff: 2 }, { diffSq: 2 }], refund: { pt: 2 }, guide: DIST,
    },
    {
      card: 'para', dim: 1, floor: 2, chain: '[세로 차이] ÷ [가로 차이] → [기울기] = [m′]', hint: '두 기울기가 같으면?',
      lore: '두 직선이 평행 ⇔ m = m′ (y절편은 다름).',
      quick: { cards: { diff: 2 } }, emergency: [{ diff: 2 }], refund: { pt: 2 },
      guide: [D2, SLOPE, ['part:slope', 'eq', 'part:mPrime', 'card:para']],
    },
    {
      card: 'perp', dim: 1, floor: 2, chain: '[세로 차이] ÷ [가로 차이] → [기울기] × [m′]', hint: '두 기울기의 곱이 −1 이 되는 관계',
      lore: '두 직선이 수직 ⇔ mm′ = −1.',
      quick: { cards: { diff: 2 } }, emergency: [{ diff: 2 }], refund: { pt: 2 }, guide: PERP,
    },
    {
      card: 'line', dim: 1, floor: 2, chain: '[한 점] − [기울기]', hint: '한 점을 지나고 기울기가 m인 직선 (두 점을 지나는 직선도 기울기부터)',
      lore: 'y − y₁ = m(x − x₁). 두 점을 지나면 기울기 (y₂ − y₁)/(x₂ − x₁)부터 구한다 (교과서 11쪽).',
      quick: { parts: { pt1: 1 }, cards: { diff: 2 } }, emergency: [], refund: { pt: 2 },
      guide: [D2, SLOPE, ['part:pt1', 'minus', 'part:slope', 'card:line']],
    },
    {
      card: 'ptLine', dim: 1, floor: 3, chain: '[수직 조건] × [직선] → 수선 ↦ [한 점] → 수선의 발 H, [두 점 사이의 거리] ↦ [H]',
      hint: '점 P에서 직선에 수선을 내리면, 그 발 H까지의 거리가 답… (수직 조건 + 두 점 사이 거리)',
      lore: '교과서 23쪽 유도 그대로: 수선 PH ⊥ l, 수선의 발 H를 구해 PH를 잰다 → |ax₁ + by₁ + c| ÷ √(a² + b²). 비싼 만큼 강하다 (기력 2).',
      quick: { parts: { lineGen: 1, pt1: 1 }, cards: { perp: 1, dist: 1 } }, emergency: [], refund: { pt1: 1, lineGen: 1, pt: 2 },
      guide: [...PERP, ['card:perp', 'times', 'part:lineGen', 'part:perpLine'], ['part:perpLine', 'subst', 'part:pt1', 'part:footH'], ...DIST, ['card:dist', 'subst', 'part:footH', 'card:ptLine']],
    },
    {
      card: 'completeSq', dim: 1, floor: 3, chain: '[원 (일반형)] + [(A/2)² + (B/2)²]', hint: '양변에 같은 수를 더해 제곱 꼴을 만들면…',
      lore: 'x² + 6x = (x + 3)² − 9 처럼, 양변에 (A/2)² + (B/2)² 를 더하면 원의 중심과 반지름이 보인다. 교과서 32쪽',
      quick: { parts: { genCircle: 1, halfSq: 1 } }, emergency: [], refund: { genCircle: 1 },
      guide: [['part:genCircle', 'plus', 'part:halfSq', 'card:completeSq']],
    },
    {
      card: 'circle', dim: 1, floor: 3, chain: '[두 점 사이의 거리] ↦ [한 점(중심)] = [반지름 r] → ²', hint: '중심 한 점에서 언제나 같은 거리(반지름)에 있는 점들…',
      lore: '중심 C(a, b), 원 위의 점 P(x, y): CP = √((x−a)² + (y−b)²) = r → 양변을 제곱. 교과서 30쪽',
      quick: { parts: { radius: 1, pt1: 1 }, cards: { dist: 1 } }, emergency: [], refund: { radius: 1, pt1: 1 },
      guide: [...DIST, ['card:dist', 'subst', 'part:pt1', 'part:cpDist'], ['part:cpDist', 'eq', 'part:radius', 'part:circR'], [null, 'sq', 'part:circR', 'card:circle']],
    },
    {
      card: 'posRel', dim: 1, floor: 4, chain: '[점과 직선 사이의 거리] ⋚ [반지름 r]', hint: '중심에서 직선까지의 거리와 반지름을 견주면…',
      lore: 'd < r 이면 두 점에서, d = r 이면 한 점에서(접한다), d > r 이면 만나지 않는다. 교과서 35쪽',
      quick: { parts: { radius: 1 }, cards: { ptLine: 1 } }, emergency: [{ ptLine: 1 }], refund: { radius: 1 },
      guide: [['card:ptLine', 'cmp', 'part:radius', 'card:posRel']],
    },
    {
      card: 'transPt', dim: 1, floor: 5, chain: '[한 점] + [이동 (a, b)]', hint: '점을 x축 방향으로 a, y축 방향으로 b만큼 옮기면…',
      lore: '(x, y) → (x + a, y + b). 교과서 44쪽',
      quick: { parts: { pt1: 1, vec: 1 } }, emergency: [], refund: { pt1: 1 },
      guide: [['part:pt1', 'plus', 'part:vec', 'card:transPt']],
    },
    {
      card: 'transFig', dim: 1, floor: 5, chain: '[도형 f(x, y) = 0] ↦ [점의 평행이동]', hint: '옮긴 점 (x′, y′)에서 x = x′ − a 를 거꾸로 대입하면…',
      lore: 'x′ = x + a 이므로 x = x′ − a. 이것을 f(x, y) = 0 에 대입 → f(x − a, y − b) = 0. 교과서 45쪽',
      quick: { parts: { figF: 1, pt1: 1, vec: 1 } }, emergency: [{ transPt: 1 }], refund: { figF: 1, pt1: 1 },
      guide: [['part:pt1', 'plus', 'part:vec', 'card:transPt'], ['part:figF', 'subst', 'card:transPt', 'card:transFig']],
    },
    {
      card: 'reflPt', dim: 1, floor: 5, chain: '[한 점] ⟷ [대칭의 기준]', hint: 'x축·y축·원점·직선 y = x 에 비친 점은…',
      lore: 'x축: (x, −y), y축: (−x, y), 원점: (−x, −y), y = x: (y, x). 교과서 49쪽',
      quick: { parts: { pt1: 1, mirrorAx: 1 } }, emergency: [], refund: { pt1: 1 },
      guide: [['part:pt1', 'mirror', 'part:mirrorAx', 'card:reflPt']],
    },
    {
      card: 'reflFig', dim: 1, floor: 5, chain: '[도형 f(x, y) = 0] ↦ [점의 대칭이동]', hint: '대칭인 점의 좌표를 도형의 식에 대입하면…',
      lore: 'x축: f(x, −y) = 0, y축: f(−x, y) = 0, 원점: f(−x, −y) = 0, y = x: f(y, x) = 0. 교과서 50~51쪽',
      quick: { parts: { figF: 1, pt1: 1, mirrorAx: 1 } }, emergency: [{ reflPt: 1 }], refund: { figF: 1, pt1: 1 },
      guide: [['part:pt1', 'mirror', 'part:mirrorAx', 'card:reflPt'], ['part:figF', 'subst', 'card:reflPt', 'card:reflFig']],
    },

    // ── Ⅱ 집합과 명제 ──
    {
      card: 'member', dim: 2, floor: 7, chain: '[원소 a] ∈ [집합]', hint: '원소가 집합에 속하는지…',
      lore: 'a가 집합 A의 원소이면 a ∈ A. 아니면 a ∉ A. 교과서 64쪽',
      quick: { parts: { elem: 1, setA: 1 } }, emergency: [], refund: { elem: 1 },
      guide: [['part:elem', 'in', 'part:setA', 'card:member']],
    },
    {
      card: 'inter', dim: 2, floor: 7, chain: '[A] ∩ [B]', hint: '두 집합에 공통으로 속하는 원소',
      lore: 'A ∩ B = {x | x ∈ A 그리고 x ∈ B}. 교과서 69쪽',
      quick: { parts: { setA: 1, setB: 1 } }, emergency: [], refund: { setA: 1 },
      guide: [['part:setA', 'cap', 'part:setB', 'card:inter']],
    },
    {
      card: 'union', dim: 2, floor: 7, chain: '[A] ∪ [B]', hint: 'A에 속하거나 B에 속하는 원소',
      lore: 'A ∪ B = {x | x ∈ A 또는 x ∈ B}. 교과서 69쪽',
      quick: { parts: { setA: 1, setB: 1 } }, emergency: [], refund: { setB: 1 },
      guide: [['part:setA', 'cup', 'part:setB', 'card:union']],
    },
    {
      card: 'compl', dim: 2, floor: 7, chain: '[U] − [A]  (⇄ 로 Bᶜ)', hint: '전체집합에서 A를 빼면…',
      lore: 'Aᶜ = {x | x ∈ U 그리고 x ∉ A} = U − A. 교과서 73~74쪽',
      quick: { parts: { setU: 1, setA: 1 } }, emergency: [], refund: { setU: 1 },
      guide: [['part:setU', 'minus', 'part:setA', 'card:compl@x']],
    },
    {
      card: 'diffSet', dim: 2, floor: 7, chain: '[A] − [B]', hint: 'A에는 속하지만 B에는 속하지 않는 원소',
      lore: 'A − B = {x | x ∈ A 그리고 x ∉ B} = A ∩ Bᶜ. 교과서 74쪽',
      quick: { parts: { setA: 1, setB: 1 } }, emergency: [], refund: { setA: 1 },
      guide: [['part:setA', 'minus', 'part:setB', 'card:diffSet']],
    },
    {
      card: 'countU', dim: 2, floor: 7, chain: 'n( )[A], n( )[B] 더하기 − n( )[교집합]', hint: '두 집합의 원소를 다 세면 겹친 부분을 두 번 센다… (5단계)',
      lore: 'n(A ∪ B) = n(A) + n(B) − n(A ∩ B). 교과서 70쪽',
      quick: { parts: { setA: 2, setB: 2 } }, emergency: [{ inter: 1 }], refund: { setA: 1, setB: 1 },
      guide: [[null, 'count', 'part:setA', 'part:nA'], [null, 'count', 'part:setB', 'part:nB'], ['part:nA', 'plus', 'part:nB', 'part:nSum'],
        ['part:setA', 'cap', 'part:setB', 'card:inter'], [null, 'count', 'card:inter', 'part:nCap'], ['part:nSum', 'minus', 'part:nCap', 'card:countU']],
    },
    {
      card: 'deMorgan', dim: 2, floor: 7, chain: 'ᶜ[합집합] = [Aᶜ] ∩ [⇄Bᶜ]', hint: '합집합 바깥은 A 바깥이면서 B 바깥…',
      lore: '(A ∪ B)ᶜ = Aᶜ ∩ Bᶜ, (A ∩ B)ᶜ = Aᶜ ∪ Bᶜ. 교과서 76쪽',
      quick: { parts: { setU: 2, setA: 2, setB: 2 } }, emergency: [], refund: { setU: 1, setA: 1, setB: 1 },
      guide: [['part:setU', 'minus', 'part:setA', 'card:compl@x', 2], ['card:compl@x', 'cap', 'card:compl@y', 'part:ccap'],
        ['part:setA', 'cup', 'part:setB', 'card:union'], [null, 'comp', 'card:union', 'part:unionC'], ['part:unionC', 'eq', 'part:ccap', 'card:deMorgan']],
    },
    {
      card: 'neg', dim: 2, floor: 8, chain: '~[조건 p]  (⇄ 로 ~q)', hint: '"p가 아니다"',
      lore: '~p 의 진리집합은 Pᶜ. 교과서 82~83쪽',
      quick: { parts: { condP: 1 } }, emergency: [], refund: { condP: 1 },
      guide: [[null, 'not', 'part:condP', 'card:neg@x']],
    },
    {
      card: 'truth', dim: 2, floor: 8, chain: '{x|·}[p] ⊂ {x|·}[q]', hint: 'p를 만족하는 것이 모두 q를 만족하면…',
      lore: 'P ⊂ Q 이면 명제 p ⇒ q 는 참, P ⊄ Q 이면 거짓 (반례). 교과서 87쪽',
      quick: { parts: { condP: 1, condQ: 1 } }, emergency: [], refund: { condP: 1 },
      guide: [[null, 'tset', 'part:condP', 'part:truthP'], [null, 'tset', 'part:condQ', 'part:truthQ'], ['part:truthP', 'sub', 'part:truthQ', 'card:truth@x']],
    },
    {
      card: 'contra', dim: 2, floor: 8, chain: '[~q] ⇒ [~p]', hint: '가정과 결론을 부정하고 서로 바꾸면…',
      lore: 'p ⇒ q 가 참이면 대우 ~q ⇒ ~p 도 참. 역(q ⇒ p)은 참이라는 보장이 없다. 교과서 88~89쪽',
      quick: { parts: { condP: 1, condQ: 1 } }, emergency: [{ neg: 2 }], refund: { condQ: 1 },
      guide: [[null, 'not', 'part:condP', 'card:neg@x', 2], ['card:neg@y', 'imp', 'card:neg@x', 'card:contra']],
    },
    {
      card: 'suffNec', dim: 2, floor: 8, chain: '[P ⊂ Q] ⋚ [⇄ Q ⊂ P]', hint: '포함 관계를 양쪽 방향으로 견주면…',
      lore: 'P ⊂ Q: p는 q이기 위한 충분조건, q는 p이기 위한 필요조건. P = Q: 필요충분조건. 교과서 89~90쪽',
      quick: { parts: { condP: 2, condQ: 2 } }, emergency: [{ truth: 2 }], refund: { condP: 1, condQ: 1 },
      guide: [[null, 'tset', 'part:condP', 'part:truthP'], [null, 'tset', 'part:condQ', 'part:truthQ'], ['part:truthP', 'sub', 'part:truthQ', 'card:truth@x', 2], ['card:truth@x', 'cmp', 'card:truth@y', 'card:suffNec']],
    },
    {
      card: 'absIneq', dim: 2, floor: 8, chain: '[완전제곱 (Ⅰ차원)] ⋚ [(실수)² ≥ 0]', hint: '완전제곱식으로 바꾸면 0 이상… (지난 차원 서고)',
      lore: 'a² − ab + b² = (a − b/2)² + 3b²/4 ≥ 0. 등호는 a = b = 0. 교과서 93쪽',
      quick: { parts: { sqNonneg: 1 }, cards: { completeSq: 1 } }, emergency: [], refund: { sqNonneg: 1 },
      guide: [['card:completeSq', 'cmp', 'part:sqNonneg', 'card:absIneq']],
    },

    // ── Ⅲ 함수와 그래프 ──
    {
      card: 'corr', dim: 3, floor: 9, chain: '[정의역 X] ↦ [공역 Y]', hint: 'X의 원소에 Y의 원소를 짝 지으면…',
      lore: 'X의 각 원소에 Y의 원소가 오직 하나씩 대응하면 함수. 교과서 106쪽',
      quick: { parts: { domX: 1, codY: 1 } }, emergency: [], refund: { domX: 1 },
      guide: [['part:domX', 'subst', 'part:codY', 'card:corr']],
    },
    {
      card: 'funcVal', dim: 3, floor: 9, chain: '[함수 f] ↦ [x의 값 a]', hint: 'x에 값을 넣으면…',
      lore: 'f(a): x = a 일 때의 함숫값. 교과서 106쪽',
      quick: { parts: { fx: 1, xval: 1 } }, emergency: [], refund: { xval: 1 },
      guide: [['part:fx', 'subst', 'part:xval', 'card:funcVal@x']],
    },
    {
      card: 'oneToOne', dim: 3, floor: 9, chain: '[f(a)] ⋚ [⇄ f(b)]', hint: '서로 다른 x에서 함숫값도 다른지 견주면…',
      lore: 'x₁ ≠ x₂ 이면 f(x₁) ≠ f(x₂): 일대일함수. 치역 = 공역이면 일대일대응. 교과서 109쪽',
      quick: { parts: { fx: 2, xval: 2 } }, emergency: [{ funcVal: 2 }], refund: { xval: 1 },
      guide: [['part:fx', 'subst', 'part:xval', 'card:funcVal@x', 2], ['card:funcVal@x', 'cmp', 'card:funcVal@y', 'card:oneToOne']],
    },
    {
      card: 'compose', dim: 3, floor: 9, chain: '[g] ∘ [f]', hint: '한 함수의 결과를 다른 함수에 넣으면…',
      lore: '(g∘f)(x) = g(f(x)): f 먼저, g 나중. g∘f ≠ f∘g (교환법칙 성립 안 함). 교과서 111~112쪽',
      quick: { parts: { fx: 1, gx: 1 } }, emergency: [], refund: { gx: 1 },
      guide: [['part:gx', 'compose', 'part:fx', 'card:compose']],
    },
    {
      card: 'inverse', dim: 3, floor: 9, chain: '풀기[f] → ⇆ (또는 ⇆ → 풀기)', hint: 'y = f(x)를 x에 대해 풀고, x와 y를 바꾸면…',
      lore: 'y = f(x) → x = f⁻¹(y) → y = f⁻¹(x). 순서를 바꿔 x, y부터 바꿔도 된다. 교과서 114~115쪽',
      quick: { parts: { fx: 1 } }, emergency: [], refund: { fx: 1 },
      guide: [[null, 'solve', 'part:fx', 'part:xOfY'], [null, 'swap', 'part:xOfY', 'card:inverse']],
    },
    {
      card: 'invGraph', dim: 3, floor: 9, chain: '[역함수] ⟷ [점의 대칭이동 (Ⅰ차원)]', hint: '역함수의 그래프는 어떤 직선에 비친 모습… (지난 차원 서고)',
      lore: 'y = f(x) 위의 점 (a, b) ↔ y = f⁻¹(x) 위의 점 (b, a): 직선 y = x 에 대하여 대칭. 교과서 116쪽',
      quick: { parts: { fx: 1 }, cards: { reflPt: 1 } }, emergency: [], refund: { fx: 1 },
      guide: [[null, 'solve', 'part:fx', 'part:xOfY'], [null, 'swap', 'part:xOfY', 'card:inverse'], ['card:inverse', 'mirror', 'card:reflPt', 'card:invGraph']],
    },
    {
      card: 'rational', dim: 3, floor: 10, chain: '[y = k/x] ↦ [도형의 평행이동 (Ⅰ차원)]', hint: 'y = k/x 그래프를 옮기면… (지난 차원 서고)',
      lore: 'y = k/(x − p) + q: y = k/x 를 x축 방향 p, y축 방향 q만큼 평행이동. 점근선 x = p, y = q. 교과서 125쪽',
      quick: { parts: { recip: 1 }, cards: { transFig: 1 } }, emergency: [], refund: { recip: 1 },
      guide: [['part:recip', 'subst', 'card:transFig', 'card:rational']],
    },
    {
      card: 'radical', dim: 3, floor: 10, chain: '[y = √(ax)] ↦ [도형의 평행이동 (Ⅰ차원)]', hint: 'y = √(ax) 그래프를 옮기면… (지난 차원 서고)',
      lore: 'y = √(a(x − p)) + q: 시작점 (p, q). a > 0 이면 정의역 x ≥ p, 치역 y ≥ q. 교과서 130~131쪽',
      quick: { parts: { sqrtF: 1 }, cards: { transFig: 1 } }, emergency: [], refund: { sqrtF: 1 },
      guide: [['part:sqrtF', 'subst', 'card:transFig', 'card:radical']],
    },
  ];
  // 분해 회수: pt n개 → 2개 이상이면 x₁·x₂를 반씩, 남는 1개는 가방에 적은 쪽
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
