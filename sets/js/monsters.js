// 번외편 몬스터 = 문제 (10마리). 학습지(2·3차시)보다 한 단계 높은 문제로.
// 각 몬스터: 문제 조각(pieces, 스캔으로 공개) + 풀이 단계(steps, 체력 문턱 하나에 단계 하나)
// 단계: goal(목표) · tool(풀이 카드) · needs(필요한 조각 수) · challenge(문제, DS.SetGen 형식) · dmg · penalty · fx
// 그림: 벤 다이어그램 (kind: 'venn'). 정답 검산은 tests/game.test.js 에서 부분집합을 직접 세어 확인한다
window.DS = window.DS || {};

DS.Monsters = (function () {
  const S = DS.SetGen;
  const { IN, SUB, EQ } = S;
  const blank = (left, right, answer) => ({ left, right, answer });

  // ── 1페이즈: 전시학습 (2차시) ─────────────────────────────
  // 1. 소속 슬라임: A = {x | x는 12의 약수} = {1, 2, 3, 4, 6, 12}
  const belongSlime = {
    name: '소속 슬라임', sprite: 'belongSlime', floor: 1,
    maxHp: 30, gates: [20, 10], startMult: 1,
    intro: '몸속에 12의 약수만 품은 슬라임. 무엇이 속하고 무엇이 속하지 않는지 가려야 흩어진다.',
    intents: [{ v: 4, label: '점액 튀기기' }, { v: 5, label: '말랑 박치기' }],
    makeProblem() {
      const A = [1, 2, 3, 4, 6, 12];
      return {
        params: {},
        pieces: ['집합 A = {x | x는 12의 약수}에 대하여', '□ 안에 ∈ 또는 ∉ 를 쓰시오.'],
        figure: { kind: 'venn', single: true, names: ['A'], A, scan: 2 },
        steps: [
          {
            goal: '슬라임 속 원소를 가려라 (∈ · ∉)', tool: 'belong', needs: 2,
            challenge: () => S.blanks('A = {x | x는 12의 약수} 일 때 □ 안에 ∈ 또는 ∉ 를 쓰시오.',
              [blank('4', 'A', '∈'), blank('8', 'A', '∉')], IN, 'A = {1, 2, 3, 4, 6, 12}: 4 는 있고 8 은 없다', { set: A, elems: [4, 8] }),
            dmg: 8, penalty: { atkDown: 1, label: '원소 분리! 공격 −1' }, fx: { venn: 'cap' },
          },
          {
            goal: '함정을 피해 마무리하라', tool: 'belong', needs: 2,
            challenge: () => S.blanks('□ 안에 ∈ 또는 ∉ 를 쓰시오.',
              [blank('12', 'A', '∈'), blank('5', 'A', '∉'), blank('1', 'A', '∈')], IN,
              '12 의 약수에는 1 과 12 자신도 들어간다. 5 는 12 를 나누어떨어뜨리지 못한다', { set: A, elems: [12, 5, 1] }),
            dmg: 10, penalty: { mult: 1.5, label: '정체 폭로! 받는 피해 1.5배' }, fx: { venn: 'cap' },
          },
        ],
      };
    },
  };

  // 2. 공집합 유령: n(∅) = 0, {0} 은 공집합이 아니다 (n({0}) = 1)
  const emptyGhost = {
    name: '공집합 유령', sprite: 'emptyGhost', floor: 1,
    maxHp: 30, gates: [20, 10], startMult: 1,
    intro: '텅 빈 상자 속에 숨은 유령. "비어 있다"와 "0 이 들어 있다"를 구별해야 잡힌다.',
    intents: [{ v: 4, label: '허공 할퀴기' }, { v: 3, block: 4, label: '사라지기' }],
    makeProblem() {
      return {
        params: {},
        pieces: ['원소의 개수와 공집합', '빈 상자와 쪽지 "0" 이 한 장 든 상자는 같을까?'],
        figure: { kind: 'venn', single: true, names: ['∅ ?'], A: [], scan: 2 },
        steps: [
          {
            goal: '유령 상자 속 원소를 세어라', tool: 'count', needs: 1,
            challenge: () => S.number('n({x | x는 1보다 작은 자연수}) + n({0}) 의 값은?', 1,
              '1보다 작은 자연수는 없다 → n(∅) = 0. {0} 에는 원소 0 이 하나 → n({0}) = 1. 0 + 1 = 1', { sets: [[], [0]] }),
            dmg: 8, penalty: { atkDown: 1, label: '실체 포착! 공격 −1' }, fx: { venn: 'cap' },
          },
          {
            goal: '유령의 거짓말을 가려라 (O / X)', tool: 'count', needs: 2,
            challenge: () => S.ox('집합 {0} 은 공집합이다.', false,
              '{0} 은 원소 0 을 하나 가진 집합이다 (n({0}) = 1). 공집합 ∅ 은 원소가 하나도 없다', { set: [0] }),
            dmg: 10, penalty: { mult: 1.5, label: '빈 상자 봉인! 받는 피해 1.5배' }, fx: { venn: 'cap' },
          },
        ],
      };
    },
  };

  // ── 2페이즈 ①: 부분집합 (3차시 STEP 1·2) ────────────────────
  // 3. 유닛 골렘: {1, 5, 25} ⊂ {x | x는 25의 약수}, {−2, 0, 2} ⊄ {x | x² − 2x = 0} = {0, 2}
  const unitGolem = {
    name: '유닛 골렘', sprite: 'unitGolem', floor: 2,
    maxHp: 36, gates: [24, 12], startMult: 0.5,
    intro: '본 그룹과 유닛이 겹쳐진 골렘. 유닛의 멤버가 모두 본 그룹에 있는지 확인해야 철갑이 벗겨진다.',
    intents: [{ v: 5, label: '돌주먹' }, { v: 6, label: '합체 강타' }],
    makeProblem() {
      return {
        params: {},
        pieces: ['조건제시법은 먼저 원소나열법으로 바꿔 보자.', '□ 안에 ⊂ 또는 ⊄ 를 쓰시오.'],
        figure: { kind: 'venn', subset: true, names: ['유닛', '본 그룹'], A: [1, 5, 25], B: [1, 5, 25], scan: 1 },
        steps: [
          {
            goal: '유닛이 본 그룹에 쏙 들어가는지 확인하라', tool: 'subset', needs: 2,
            challenge: () => S.one('{1, 5, 25}', '{x | x는 25의 약수}', '⊂', SUB, '25의 약수 = {1, 5, 25} → 모든 원소가 있다 → ⊂ (자기 자신의 부분집합)', { a: [1, 5, 25], b: [1, 5, 25] }),
            dmg: 10, penalty: { mult: 1, label: '철갑 해제! 피해가 그대로 들어간다' }, fx: { venn: 'cap', shatter: 'golemArmor' },
          },
          {
            goal: '방정식 속 집합을 꿰뚫어라', tool: 'subset', needs: 2,
            challenge: () => S.one('{−2, 0, 2}', '{x | x² − 2x = 0}', '⊄', SUB, 'x² − 2x = x(x − 2) = 0 → {0, 2}. −2 가 없다 → ⊄', { a: [-2, 0, 2], b: [0, 2] }),
            dmg: 12, penalty: { mult: 1.5, label: '유닛 해체! 받는 피해 1.5배' }, fx: { venn: 'cup' },
          },
        ],
      };
    },
  };

  // 4. 포함의 기사: ∈ 와 ⊂ 구별, A ⊂ A, ∅ ⊂ A, ∅ ⊂ ∅
  const includeKnight = {
    name: '포함의 기사', sprite: 'includeKnight', floor: 2,
    maxHp: 36, gates: [24, 12], startMult: 1,
    intro: '∈ 와 ⊂ 를 뒤섞어 함정을 파는 기사. 옳지 않은 기호를 모두 찾아내야 쓰러진다.',
    intents: [{ v: 5, label: '기호 베기' }, { v: 4, label: '혼란의 외침', debuff: { weak: 1 } }],
    makeProblem() {
      const opts = ['2 ∈ {1, 2}', '{2} ⊂ {1, 2}', '∅ ⊂ {1, 2}', '2 ⊂ {1, 2}', '{1, 2} ⊂ {1, 2}', '{1} ∈ {1, 2}'];
      return {
        params: {},
        pieces: ['원소와 집합 사이 → ∈ · ∉, 집합과 집합 사이 → ⊂ · ⊄', '옳지 않은 것을 모두 고르시오.'],
        figure: { kind: 'venn', subset: true, names: ['{2}', '{1, 2}'], A: [2], B: [1, 2], scan: 1 },
        steps: [
          {
            goal: '옳지 않은 기호를 모두 찾아라', tool: 'subset', needs: 2,
            challenge: () => S.multi('다음 중 옳지 않은 것을 모두 고르시오.', opts, [3, 5],
              '2 ⊂ {1, 2} (✕): 2 는 원소 → 2 ∈ {1, 2}. {1} ∈ {1, 2} (✕): {1} 은 집합 → {1} ⊂ {1, 2}. 자기 자신 · 공집합은 언제나 부분집합',
              { items: [['in', 2, [1, 2]], ['sub', [2], [1, 2]], ['sub', [], [1, 2]], ['bad'], ['sub', [1, 2], [1, 2]], ['bad']] }),
            dmg: 10, penalty: { atkDown: 2, label: '함정 간파! 공격 −2' }, fx: { venn: 'cap' },
          },
          {
            goal: '기사의 마지막 질문에 답하라 (O / X)', tool: 'subset', needs: 2,
            challenge: () => S.ox('∅ ⊂ ∅ 이다.', true, '공집합은 모든 집합의 부분집합 → 공집합 자기 자신의 부분집합이기도 하다 (A ⊂ A)', { a: [], b: [] }),
            dmg: 12, penalty: { mult: 1.5, label: '기사의 맹세 파기! 받는 피해 1.5배' }, fx: { venn: 'cup' },
          },
        ],
      };
    },
  };

  // ── 2페이즈 ②: 서로 같은 집합 · 진부분집합 · 부분집합 모두 구하기 (3차시 STEP 3·4) ──
  // 5. 거울 쌍둥이: = / ≠, A = {1, a + 1}, B = {1, 4} 이고 A ⊂ B, B ⊂ A → a = 3
  const mirrorTwins = {
    name: '거울 쌍둥이', sprite: 'mirrorTwins', floor: 3,
    maxHp: 40, gates: [26, 12], startMult: 1,
    intro: '거울 속 쌍둥이. 정말 같은지, 하나가 모자란 가짜인지 양쪽 방향으로 확인해야 한다.',
    intents: [{ v: 5, label: '거울 반사' }, { v: 6, label: '쌍둥이 협공' }],
    makeProblem() {
      return {
        params: {},
        pieces: ['A ⊂ B 이고 B ⊂ A 이면 A = B', '두 집합 A = {1, a + 1}, B = {1, 4} 에 대하여 A ⊂ B 이고 B ⊂ A 일 때, a 의 값은?'],
        figure: { kind: 'venn', names: ['A', 'B'], A: [1, 'a+1'], B: [1, 4], scan: 2 },
        steps: [
          {
            goal: '진짜 쌍둥이와 가짜를 가려라 (= · ≠)', tool: 'equal', needs: 1,
            challenge: () => S.blanks('□ 안에 = 또는 ≠ 를 쓰시오.',
              [blank('{x | x는 4의 약수}', '{1, 2, 4}', '='), blank('{x | x는 8 이하의 짝수}', '{2, 4, 6}', '≠')], EQ,
              '4의 약수 = {1, 2, 4} → =. 8 이하의 짝수 = {2, 4, 6, 8} → 8 이 없으니 ≠', { pairs: [[[1, 2, 4], [1, 2, 4]], [[2, 4, 6, 8], [2, 4, 6]]] }),
            dmg: 10, penalty: { atkDown: 2, label: '가짜 분리! 공격 −2' }, fx: { venn: 'cap' },
          },
          {
            goal: '거울의 숨은 수 a 를 찾아라', tool: 'equal', needs: 2,
            challenge: () => S.number('A = {1, a + 1}, B = {1, 4} 에 대하여 A ⊂ B 이고 B ⊂ A 일 때, a 의 값은?', 3,
              'A ⊂ B 이고 B ⊂ A → A = B → 원소가 모두 같다 → a + 1 = 4 → a = 3', { solve: (a) => S.sameSet([1, a + 1], [1, 4]) }),
            dmg: 14, penalty: { mult: 1.5, label: '거울 파괴! 받는 피해 1.5배' }, fx: { venn: 'cup' },
          },
        ],
      };
    },
  };

  // 6. 부분집합 수집가: {1, 2, 3} 의 부분집합 모두 (8개), 진부분집합 7개
  const collector = {
    name: '부분집합 수집가', sprite: 'collector', floor: 3,
    maxHp: 40, gates: [26, 12], startMult: 1,
    intro: '부분집합을 하나라도 빠뜨리면 되살아나는 수집가. 0개 고르기부터 빠짐없이 모아야 한다.',
    intents: [{ v: 5, label: '수집 갈고리' }, { v: 4, block: 5, label: '진열장 보호' }],
    makeProblem() {
      return {
        params: {},
        pieces: ['원소를 0개, 1개, 2개, … 고르는 순서로 빠짐없이!', '집합 A = {1, 2, 3} 의 부분집합을 모두 구하시오.'],
        figure: { kind: 'venn', single: true, names: ['A'], A: [1, 2, 3], scan: 2 },
        steps: [
          {
            goal: '부분집합을 하나도 빠짐없이 모아라', tool: 'subset', needs: 2,
            challenge: () => S.subsets('집합 A = {1, 2, 3} 의 부분집합을 모두 만드시오. (∅ 과 A 자신도 잊지 말 것!)', [1, 2, 3],
              '0개: ∅ / 1개: {1}, {2}, {3} / 2개: {1, 2}, {1, 3}, {2, 3} / 3개: {1, 2, 3} → 8개'),
            dmg: 10, penalty: { atkDown: 2, label: '수집품 압수! 공격 −2' }, fx: { venn: 'cap' },
          },
          {
            goal: '진열장에서 자기 자신을 빼라 (진부분집합)', tool: 'proper', needs: 2,
            challenge: () => S.number('집합 A = {1, 2, 3} 의 진부분집합의 개수는?', 7, '부분집합 8개 중 자기 자신 {1, 2, 3} 을 빼면 7개', { base: [1, 2, 3], proper: true }),
            dmg: 14, penalty: { mult: 1.5, label: '진열장 붕괴! 받는 피해 1.5배' }, fx: { venn: 'cup' },
          },
        ],
      };
    },
  };

  // ── 3페이즈: 형성평가 필드 (선생님 도움 없이) ─────────────────
  // 7. 혼합 게: {x | x² = 1} = {−1, 1}, {0} ⊂ {0, 1}
  const mixCrab = {
    name: '기호 집게', sprite: 'mixCrab', floor: 4,
    maxHp: 34, gates: [22, 10], startMult: 1,
    intro: '∈ · ⊂ · = 를 양 집게에 쥔 게. 기호 하나만 틀려도 놓치지 않는다.',
    intents: [{ v: 5, label: '집게 찝기' }, { v: 6, label: '거품 발사' }],
    makeProblem() {
      return {
        params: {},
        pieces: ['형성평가 ①', '알맞은 기호를 고르시오.'],
        figure: { kind: 'venn', names: ['{x | x² = 1}', '{−1, 1}'], A: [-1, 1], B: [-1, 1], scan: 2 },
        steps: [
          {
            goal: '두 집합이 같은지 판정하라', tool: 'equal', needs: 2,
            challenge: () => S.one('{x | x² = 1}', '{−1, 1}', '=', EQ, 'x² = 1 → x = −1 또는 1 → {−1, 1}. 원소가 모두 같다 → =', { a: [-1, 1], b: [-1, 1] }),
            dmg: 9, penalty: { atkDown: 1, label: '집게 하나 해제! 공격 −1' }, fx: { venn: 'cap' },
          },
          {
            goal: '원소인가 집합인가?', tool: 'subset', needs: 2,
            challenge: () => S.one('{0}', '{0, 1}', '⊂', ['∈', '∉', '⊂', '⊄'], '{0} 은 집합 → 집합과 집합 사이 → {0} ⊂ {0, 1} (0 ∈ {0, 1} 과 구별!)', { a: [0], b: [0, 1] }),
            dmg: 11, penalty: { mult: 1.5, label: '껍데기 파괴! 받는 피해 1.5배' }, fx: { venn: 'cup' },
          },
        ],
      };
    },
  };

  // 8. 진부분집합 도깨비불: {x | x는 6의 약수} = {1, 2, 3, 6} → 진부분집합 15, {a, b, c, d, e} 부분집합 32
  const mixWisp = {
    name: '개수 도깨비불', sprite: 'mixWisp', floor: 4,
    maxHp: 34, gates: [22, 10], startMult: 1,
    intro: '부분집합의 수만큼 불꽃이 갈라지는 도깨비불. 개수를 정확히 세야 꺼진다.',
    intents: [{ v: 5, label: '불꽃 튀기기' }, { v: 4, label: '현혹', debuff: { vuln: 1 } }],
    makeProblem() {
      return {
        params: {},
        pieces: ['형성평가 ②', '부분집합과 진부분집합의 개수를 구하시오.'],
        figure: { kind: 'venn', single: true, names: ['6의 약수'], A: [1, 2, 3, 6], scan: 2 },
        steps: [
          {
            goal: '진부분집합의 개수를 세어라', tool: 'proper', needs: 2,
            challenge: () => S.number('집합 {x | x는 6의 약수} 의 진부분집합의 개수는?', 15, '{1, 2, 3, 6}: 부분집합 2⁴ = 16개 − 자기 자신 1개 = 15개', { base: [1, 2, 3, 6], proper: true }),
            dmg: 9, penalty: { atkDown: 1, label: '불꽃 하나 소멸! 공격 −1' }, fx: { venn: 'cap' },
          },
          {
            goal: '갈라지는 불꽃을 모두 세어라 (2ⁿ)', tool: 'subsetCount', needs: 2,
            challenge: () => S.number('집합 {a, b, c, d, e} 의 부분집합의 개수는?', 32, '원소 5개 → 2⁵ = 32', { base: ['a', 'b', 'c', 'd', 'e'] }),
            dmg: 11, penalty: { mult: 1.5, label: '불씨 봉인! 받는 피해 1.5배' }, fx: { venn: 'cup' },
          },
        ],
      };
    },
  };

  // 9. 미지수 기사: A = {a, a + 2} ⊂ {1, 2, 3, 4} → a = 1, 2 /  {1, 3, a} = {1, b, 5} → a + b = 8
  const mixKnight = {
    name: '미지수 기사', sprite: 'mixKnight', floor: 4,
    maxHp: 36, gates: [24, 10], startMult: 1,
    intro: '집합 속에 미지수를 숨긴 기사. 포함 관계를 조건으로 바꿔야 정체가 드러난다.',
    intents: [{ v: 6, label: '미지수 찌르기' }, { v: 5, label: '방패 밀치기' }],
    makeProblem() {
      return {
        params: {},
        pieces: ['형성평가 ③', '포함 관계로 미지수를 구하시오.'],
        figure: { kind: 'venn', subset: true, names: ['A', 'B'], A: ['a', 'a+2'], B: [1, 2, 3, 4], scan: 2 },
        steps: [
          {
            goal: 'A ⊂ B 가 되는 a 를 모두 찾아라', tool: 'subset', needs: 2,
            challenge: () => S.multi('두 집합 A = {a, a + 2}, B = {1, 2, 3, 4} 에 대하여 A ⊂ B 가 되도록 하는 자연수 a 를 모두 고르시오.',
              ['1', '2', '3', '4'], [0, 1], 'a 와 a + 2 가 모두 B 에 있어야 한다: a = 1 → {1, 3} ✓, a = 2 → {2, 4} ✓, a = 3 → {3, 5} ✗, a = 4 → {4, 6} ✗',
              { test: (a) => S.isSubset([a, a + 2], [1, 2, 3, 4]), values: [1, 2, 3, 4] }),
            dmg: 10, penalty: { atkDown: 2, label: '미지수 노출! 공격 −2' }, fx: { venn: 'cap' },
          },
          {
            goal: '두 집합이 같아지는 a + b 를 구하라', tool: 'equal', needs: 2,
            challenge: () => S.number('두 집합 A = {1, 3, a}, B = {1, b, 5} 에 대하여 A = B 일 때, a + b 의 값은?', 8,
              'A = B → 원소가 모두 같다. A 에 5 가 있어야 하니 a = 5, B 에 3 이 있어야 하니 b = 3 → a + b = 8', { a: 5, b: 3 }),
            dmg: 12, penalty: { mult: 1.5, label: '갑옷 붕괴! 받는 피해 1.5배' }, fx: { venn: 'cup' },
          },
        ],
      };
    },
  };

  // 10. 중간보스 2ⁿ의 수호자: A = {x | x는 12의 약수} = {1, 2, 3, 4, 6, 12}, n = 6
  //   ① 2⁶ = 64 ② 1, 12 반드시 포함 2⁴ = 16 ③ 홀수 1, 3 포함하지 않음 2⁴ = 16 ④ 2, 4 포함 · 3 제외 2³ = 8
  const powerGuardian = {
    name: '2ⁿ의 수호자', sprite: 'powerGuardian', floor: 4,
    maxHp: 64, gates: [48, 32, 16, 1], startMult: 0.5,
    intro: '부분집합의 수만큼 분신을 거느린 중간보스. 갈래를 세는 법을 아는 자만이 수호자를 넘는다.',
    phases: [{ from: 0, title: '중간보스 · 2ⁿ의 수호자' }, { from: 1, title: '고정된 원소는 갈래가 없다' }, { from: 3, title: '포함과 제외를 함께!' }],
    intents: [{ v: 6, label: '분신 돌격' }, { v: 7, label: '갈래 폭풍' }, { v: 5, block: 6, label: '분신 방벽' }],
    makeProblem() {
      const A = [1, 2, 3, 4, 6, 12];
      return {
        params: {},
        pieces: ['집합 A = {x | x는 12의 약수} 에 대하여', '조건에 맞는 부분집합의 개수를 구하시오.'],
        figure: { kind: 'venn', single: true, names: ['A (12의 약수)'], A, scan: 1 },
        steps: [
          {
            goal: '수호자의 분신을 모두 세어라 (2ⁿ)', tool: 'subsetCount', needs: 2,
            challenge: () => S.number('집합 A = {x | x는 12의 약수} 의 부분집합의 개수는?', 64, 'A = {1, 2, 3, 4, 6, 12} → n = 6 → 2⁶ = 64', { base: A }),
            dmg: 12, penalty: { mult: 1, label: '분신 해제! 철갑이 벗겨졌다' }, fx: { venn: 'cap', shatter: 'golemArmor' },
          },
          {
            goal: '반드시 포함하는 분신만 남겨라 (2ⁿ⁻ᵖ)', tool: 'fixIn', needs: 2,
            challenge: () => S.number('A 의 부분집합 중 1 과 12 를 반드시 포함하는 것의 개수는?', 16, '정해진 원소 2개를 빼고 2⁶⁻² = 2⁴ = 16', { base: A, must: [1, 12] }),
            dmg: 12, penalty: { atkDown: 2, label: '분신 절반 소멸! 공격 −2' }, fx: { venn: 'cap' },
          },
          {
            goal: '포함하지 않는 분신을 가려라 (2ⁿ⁻q)', tool: 'fixOut', needs: 2,
            challenge: () => S.number('A 의 부분집합 중 홀수인 원소를 하나도 포함하지 않는 것의 개수는?', 16, 'A 의 홀수는 1, 3 (2개) → 2⁶⁻² = 16', { base: A, not: [1, 3] }),
            dmg: 12, penalty: { mult: 1.5, label: '방벽 붕괴! 받는 피해 1.5배' }, fx: { venn: 'cup' },
          },
          {
            goal: '마지막 일격: 포함과 제외를 함께 (2ⁿ⁻ᵖ⁻q)', tool: 'fixBoth', needs: 2,
            challenge: () => S.number('A 의 부분집합 중 2, 4 는 반드시 포함하고 3 은 포함하지 않는 것의 개수는?', 8, '정해진 원소 3개(2, 4 포함 · 3 제외)를 빼고 2⁶⁻²⁻¹ = 2³ = 8', { base: A, must: [2, 4], not: [3] }),
            dmg: 20, penalty: { mult: 2, label: '수호자 붕괴! 받는 피해 2배' }, fx: { venn: 'cup', shatter: 'ring' },
          },
        ],
      };
    },
  };

  return { belongSlime, emptyGhost, unitGolem, includeKnight, mirrorTwins, collector, mixCrab, mixWisp, mixKnight, powerGuardian };
})();
