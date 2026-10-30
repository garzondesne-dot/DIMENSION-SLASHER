// 번외편 문제 도구: 집합 표시, 부분집합 세기, 문제 형식(4지선다가 아닌 문제 포함)
// 문제 객체 { type, question, solution, ... }
//  - choice : choices[], answerIndex, answer           (고르기)
//  - blanks : items[{ left, right, answer }], options[] (□ 안에 기호 넣기, 여러 칸)
//  - ox     : answer (true = O)
//  - number : answer (정수)
//  - multi  : options[], answer[] (정답 번호들, 모두 고르기)
//  - subsets: base[] (원소), 정답은 base 의 부분집합 전체 (모두 만들기)
// check: 테스트에서 독립 검산에 쓰는 정보 (부분집합을 직접 세어 확인)
window.DS = window.DS || {};

DS.SetGen = (function () {
  const M = '−';
  const num = (v) => (typeof v === 'number' && v < 0 ? M + Math.abs(v) : String(v));
  const setStr = (arr) => (arr.length ? `{${arr.map(num).join(', ')}}` : '∅');
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // 부분집합 전체 (원소 n개 → 2ⁿ개). 독립 검산과 "모두 만들기" 채점에 쓴다
  function allSubsets(base) {
    const out = [];
    for (let m = 0; m < 1 << base.length; m++) out.push(base.filter((_, i) => m & (1 << i)));
    return out;
  }
  // 조건에 맞는 부분집합의 개수: must 는 반드시 포함, not 은 포함하지 않음
  const countSubsets = (base, must = [], not = []) => allSubsets(base)
    .filter((s) => must.every((x) => s.includes(x)) && not.every((x) => !s.includes(x))).length;
  const isSubset = (a, b) => a.every((x) => b.includes(x));
  const sameSet = (a, b) => isSubset(a, b) && isSubset(b, a);
  const key = (s) => s.map(String).sort().join(',');

  // ── 문제 만들기 ─────────────────────────────────────────
  const blanks = (question, items, options, solution, check) => ({ type: 'blanks', question, items, options, solution, check });
  const ox = (question, answer, solution, check) => ({ type: 'ox', question, answer, solution, check });
  const number = (question, answer, solution, check) => ({ type: 'number', question, answer, solution, check });
  const multi = (question, options, answer, solution, check) => ({ type: 'multi', question, options, answer, solution, check });
  const subsets = (question, base, solution) => ({ type: 'subsets', question, base, solution, check: { base } });
  function choice(question, answer, wrongs, solution, check) {
    const choices = DS.MathGen.shuffle([answer, ...wrongs]);
    return { type: 'choice', question, choices, answer, answerIndex: choices.indexOf(answer), solution, check };
  }
  // 기호 칸 하나짜리 (∈/∉, ⊂/⊄, =/≠)
  const one = (left, right, ans, options, solution, check) => blanks('□ 안에 알맞은 기호를 넣으시오.', [{ left, right, answer: ans }], options, solution, check);

  // ── 연성 예제 (카드를 처음 만들 때 한 번) ─────────────────────
  // 틀리면 다른 숫자의 예제로 다시. check 로 테스트에서 직접 검산
  const IN = ['∈', '∉'], SUB = ['⊂', '⊄'], EQ = ['=', '≠'];
  const EXAMPLES = {
    belong: [
      () => one('9', 'A = {x | x는 10 이하의 홀수}', '∈', IN, 'A = {1, 3, 5, 7, 9} 에 9 가 있다 → 9 ∈ A', { elem: 9, set: [1, 3, 5, 7, 9] }),
      () => one('8', 'A = {x | x는 12의 약수}', '∉', IN, 'A = {1, 2, 3, 4, 6, 12} 에 8 이 없다 → 8 ∉ A', { elem: 8, set: [1, 2, 3, 4, 6, 12] }),
      () => one('12', 'A = {x | x는 20 이하의 4의 배수}', '∈', IN, 'A = {4, 8, 12, 16, 20} → 12 ∈ A', { elem: 12, set: [4, 8, 12, 16, 20] }),
    ],
    count: [
      () => number('n({x | x는 18의 약수}) 의 값은?', 6, '18의 약수 {1, 2, 3, 6, 9, 18} → 6개', { set: [1, 2, 3, 6, 9, 18] }),
      () => number('n({x | x는 10 이하의 소수}) 의 값은?', 4, '{2, 3, 5, 7} → 4개 (1은 소수가 아니다)', { set: [2, 3, 5, 7] }),
      () => number('n({x | x는 1보다 작은 자연수}) 의 값은?', 0, '1보다 작은 자연수는 없다 → 공집합, n(∅) = 0', { set: [] }),
    ],
    subset: [
      () => one('{3, 6}', '{x | x는 3의 배수}', '⊂', SUB, '3, 6 모두 3의 배수 → ⊂', { a: [3, 6], b: [3, 6, 9, 12, 15] }),
      () => one('{2, 4, 8}', '{x | x는 12의 약수}', '⊄', SUB, '12의 약수 {1, 2, 3, 4, 6, 12} 에 8 이 없다 → ⊄', { a: [2, 4, 8], b: [1, 2, 3, 4, 6, 12] }),
      () => one('{1, 3}', '{x | x² − 4x + 3 = 0}', '⊂', SUB, 'x² − 4x + 3 = (x − 1)(x − 3) = 0 → {1, 3}. 모든 원소가 있다 → ⊂', { a: [1, 3], b: [1, 3] }),
    ],
    equal: [
      () => one('{1, 2, 4}', '{x | x는 4의 약수}', '=', EQ, '4의 약수 = {1, 2, 4}. 서로 포함 → =', { a: [1, 2, 4], b: [1, 2, 4] }),
      () => one('{2, 4, 6}', '{x | x는 8 이하의 짝수}', '≠', EQ, '8 이하의 짝수 = {2, 4, 6, 8}. 8 이 없다 → ≠', { a: [2, 4, 6], b: [2, 4, 6, 8] }),
      () => one('{−1, 1}', '{x | x² = 1}', '=', EQ, 'x² = 1 → x = −1, 1 → =', { a: [-1, 1], b: [-1, 1] }),
    ],
    proper: [
      () => number('집합 {a, b} 의 진부분집합의 개수는?', 3, '부분집합 ∅, {a}, {b}, {a, b} 중 자기 자신을 빼면 3개', { base: ['a', 'b'], proper: true }),
      () => number('집합 {1, 2, 3} 의 진부분집합의 개수는?', 7, '부분집합 8개 − 자기 자신 1개 = 7개', { base: [1, 2, 3], proper: true }),
      () => number('집합 {x | x는 4의 약수} 의 진부분집합의 개수는?', 7, '{1, 2, 4} → 2³ − 1 = 7개', { base: [1, 2, 4], proper: true }),
    ],
    subsetCount: [
      () => number('집합 {a, b, c, d} 의 부분집합의 개수는?', 16, '원소 4개, 원소마다 넣는다·뺀다 → 2⁴ = 16', { base: ['a', 'b', 'c', 'd'] }),
      () => number('집합 {1, 2, 3, 4, 5} 의 부분집합의 개수는?', 32, '2⁵ = 32', { base: [1, 2, 3, 4, 5] }),
      () => number('집합 {x | x는 6의 약수} 의 부분집합의 개수는?', 16, '{1, 2, 3, 6} → 2⁴ = 16', { base: [1, 2, 3, 6] }),
    ],
    fixIn: [
      () => number('집합 {a, b, c, d} 의 부분집합 중 a 를 반드시 포함하는 것의 개수는?', 8, 'a 는 정해졌으니 나머지 3개만 두 갈래 → 2⁴⁻¹ = 8', { base: ['a', 'b', 'c', 'd'], must: ['a'] }),
      () => number('집합 {1, 2, 3, 4, 5} 의 부분집합 중 1, 2 를 반드시 포함하는 것의 개수는?', 8, '2⁵⁻² = 8', { base: [1, 2, 3, 4, 5], must: [1, 2] }),
    ],
    fixOut: [
      () => number('집합 {a, b, c, d} 의 부분집합 중 a 를 포함하지 않는 것의 개수는?', 8, 'a 는 빼기로 정해졌으니 나머지 3개만 두 갈래 → 2⁴⁻¹ = 8', { base: ['a', 'b', 'c', 'd'], not: ['a'] }),
      () => number('집합 {1, 2, 3, 4, 5, 6} 의 부분집합 중 6 을 포함하지 않는 것의 개수는?', 32, '2⁶⁻¹ = 32', { base: [1, 2, 3, 4, 5, 6], not: [6] }),
    ],
    fixBoth: [
      () => number('집합 {1, 2, 3, 4, 5, 6, 7} 의 부분집합 중 2 와 6 을 반드시 포함하고 5 는 포함하지 않는 것의 개수는?', 16, '정해진 원소 3개를 빼고 2⁷⁻²⁻¹ = 2⁴ = 16', { base: [1, 2, 3, 4, 5, 6, 7], must: [2, 6], not: [5] }),
      () => number('집합 {a, b, c, d, e} 의 부분집합 중 a 는 포함하고 e 는 포함하지 않는 것의 개수는?', 8, '2⁵⁻¹⁻¹ = 2³ = 8', { base: ['a', 'b', 'c', 'd', 'e'], must: ['a'], not: ['e'] }),
    ],
  };
  const example = (id) => (EXAMPLES[id] ? pick(EXAMPLES[id])() : null);

  return {
    M, num, setStr, pick, allSubsets, countSubsets, isSubset, sameSet, key,
    blanks, ox, number, multi, subsets, choice, one, IN, SUB, EQ, EXAMPLES, example,
  };
})();
