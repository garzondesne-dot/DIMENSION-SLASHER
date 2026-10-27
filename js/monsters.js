// 몬스터 = 문제. 각 몬스터는 문제 하나를 갖고, 풀이 단계마다 체력 문턱(gates)이 있다.
// 공격은 문턱을 넘지 못하고, 문턱에서 그 단계를 풀어야 문턱이 깨진다. 모든 단계를 풀어야 쓰러뜨릴 수 있다.
// 문제는 조각(pieces)으로 나뉘어 스캔한 만큼만 보인다. 단계마다 필요한 조각 수(needs)가 있다.
// 그림 요소의 scan: k → k번째 조각이 공개돼야 보임, from: k → k단계를 푼 뒤 보임
// makeProblem() 은 전투에 들어갈 때 한 번 호출되고, 되감기·후퇴 후 재도전에도 같은 문제를 쓴다.
window.DS = window.DS || {};

DS.Monsters = (function () {
  const G = DS.MathGen;
  const { frac, num, lineStr } = G;
  const S2 = Math.SQRT2;

  // 직접 만든 4지선다 (최종보스용): 보기는 매번 섞는다
  function fixedQ(question, answer, distractors, solution, diagram) {
    return () => {
      const choices = G.shuffle([answer, ...distractors]);
      return { kind: 'fixed', question, choices, answerIndex: choices.indexOf(answer), answer, solution, diagram, params: {} };
    };
  }

  // ── 1층 잡몹: 수직선 슬라임 (문턱 1) ─────────────────────
  const slime = {
    name: '수직선 슬라임', sprite: 'slime', floor: 1,
    maxHp: 30, gates: [15], startMult: 1,
    intro: '수직선 위를 기어 다니는 슬라임. 두 팔 사이의 거리를 재면 약점이 드러난다.',
    campHint: '수직선 위 두 점 사이를 재는 도구가 필요하다.',
    intents: [{ v: 5, label: '튀어 오르기' }, { v: 7, label: '산성 침' }],
    makeProblem() {
      const a = G.ri(-9, 9);
      let b;
      do b = G.ri(-9, 9); while (b === a || Math.abs(b - a) < 3);
      return {
        pieces: [`수직선 위의 두 점 A(${num(a)}), B(${num(b)}) 사이의`, '거리를 구하시오.'],
        figure: { kind: 'numberline', points: [{ x: a, label: 'A', color: '#4cc9ff' }, { x: b, label: 'B', color: '#ff8c3a' }] },
        steps: [{
          goal: '두 팔 A, B 사이의 거리를 구하라', tool: 'segLen', needs: 2,
          challenge: () => G.gen.segLen({ a, b }),
          dmg: 8, penalty: { mult: 1.5, label: '약점 노출! 받는 피해 1.5배' },
          fx: { nslash: [a, b] },
        }],
      };
    },
  };

  // ── 1층 보스: 수직선 수문장 골렘 (문턱 2) ──────────────────
  // A(−1, 2), B(5, 8)을 2 : 1로 내분 → P(3, 6), OP = √45 = 3√5
  const golem = {
    name: '수직선 수문장 골렘', sprite: 'golem', floor: 1,
    maxHp: 70, gates: [46, 23], startMult: 0.5,
    intro: '좌표를 지키는 돌의 수문장. 철갑은 정확한 풀이로만 깨진다.',
    campHint: '"나누는 점"과 "좌표평면 위 거리"를 다룰 줄 알아야 한다.',
    intents: [{ v: 8, label: '돌주먹' }, { v: 12, label: '바위 투척' }, { v: 6, block: 6, label: '돌벽 세우기' }],
    makeProblem() {
      return {
        pieces: ['두 점 A(−1, 2), B(5, 8)에 대하여', '선분 AB를 2 : 1로 내분하는 점 P와', '원점 O 사이의 거리를 구하시오.'],
        figure: {
          kind: 'plane', view: { x0: -3, x1: 8, y0: -1, y1: 9 },
          els: [
            { t: 'pt', x: -1, y: 2, label: 'A(−1, 2)', color: '#4cc9ff', scan: 1 },
            { t: 'pt', x: 5, y: 8, label: 'B(5, 8)', color: '#ff8c3a', scan: 1 },
            { t: 'seg', x1: -1, y1: 2, x2: 5, y2: 8, color: '#8f8aa8', scan: 2 },
            { t: 'pt', x: 0, y: 0, label: 'O', color: '#cfcbe6', scan: 3 },
            { t: 'pt', x: 3, y: 6, label: 'P(3, 6)', color: '#ffd166', from: 1 },
            { t: 'seg', x1: 0, y1: 0, x2: 3, y2: 6, color: '#7df9ff', from: 2, glow: true },
          ],
        },
        steps: [
          {
            goal: '선분 AB를 2 : 1로 내분하는 점 P를 찾아라', tool: 'divide', needs: 2,
            challenge: () => G.gen.div2D({ x1: -1, y1: 2, x2: 5, y2: 8, m: 2, n: 1 }),
            dmg: 10, penalty: { mult: 1, label: '철갑 파괴! 받는 피해 ½ → 1배' },
            fx: { slash: [-1, 2, 5, 8], ring: [3, 6], shatter: 'golemArmor' },
          },
          {
            goal: '원점 O에서 점 P까지의 거리를 구하라', tool: 'dist', needs: 3,
            challenge: () => G.gen.dist2D({ x1: 0, y1: 0, x2: 3, y2: 6, labels: ['O', 'P'] }),
            dmg: 12, penalty: { mult: 1.5, label: '핵 노출! 받는 피해 1.5배' },
            fx: { slash: [0, 0, 3, 6], ring: [3, 6] },
          },
        ],
      };
    },
  };

  // ── 2층 잡몹: 결계 박쥐 (문턱 1) ─────────────────────────
  const bat = {
    name: '결계 박쥐', sprite: 'bat', floor: 2,
    maxHp: 40, gates: [20], startMult: 1,
    intro: '결계선을 따라 날아다니는 박쥐. 결계와 나란한 길을 찾으면 꿰뚫린다.',
    campHint: '두 직선이 "나란할" 조건을 알아야 한다.',
    intents: [{ v: 6, label: '초음파' }, { v: 8, label: '급강하' }],
    makeProblem() {
      const m = G.pick([-3, -2, 2, 3]);
      const n = G.ri(-3, 3);
      let a, b;
      do { a = G.ri(-3, 3); b = G.ri(-3, 3); } while (b === m * a + n);
      const c = b - m * a;
      return {
        pieces: [`결계선 ${lineStr(m, n)}이 있다.`, `점 Q(${num(a)}, ${num(b)})를 지나고`, '결계선에 평행한 직선의 방정식을 구하시오.'],
        figure: {
          kind: 'plane', view: { x0: -6, x1: 6, y0: -6, y1: 6 },
          els: [
            { t: 'line', m, n, color: '#c792ff', style: 'barrier', until: 1, scan: 1 },
            { t: 'line', m, n, color: '#c792ff', style: 'dashed', from: 1 },
            { t: 'pt', x: a, y: b, label: `Q(${num(a)}, ${num(b)})`, color: '#ffd166', scan: 2 },
            { t: 'line', m, n: c, color: '#7df9ff', from: 1, glow: true },
          ],
        },
        steps: [{
          goal: '점 Q를 지나고 결계선에 평행한 직선을 세워라', tool: 'para', needs: 3,
          challenge: () => G.gen.parallel({ m: frac(m), n, a, b, lineName: '결계선' }),
          dmg: 8, penalty: { mult: 1.5, label: '결계 소멸! 받는 피해 1.5배' },
          fx: { slash: [a - 3, b - 3 * m, a + 3, b + 3 * m], ring: [a, b] },
        }],
      };
    },
  };

  // ── 2층 보스: 방패 거수 (문턱 2) — 교과서 21쪽 예제 2 유형 ──────
  // 방패 y = −½x + 1 에 수직 → 기울기 2, 점 P(1, −1)을 지나므로 y = 2x − 3
  const beast = {
    name: '방패 거수', sprite: 'beast', floor: 2,
    maxHp: 80, gates: [52, 26], startMult: 0.5,
    intro: '직선의 방패를 든 거수. 방패와 "수직"으로 베어야 뚫린다.',
    campHint: '두 직선이 "수직"일 조건과, 한 점을 지나는 직선을 세우는 법이 필요하다.',
    intents: [{ v: 9, label: '돌진' }, { v: 13, label: '방패 강타' }, { v: 5, block: 10, label: '방어 태세' }],
    makeProblem() {
      const m = frac(-1, 2), n = 1;
      return {
        pieces: [`방패의 직선 ${lineStr(m, n)}에`, '수직인 직선 중에서', '점 P(1, −1)을 지나는 직선의 방정식을 구하시오.'],
        figure: {
          kind: 'plane', view: { x0: -4, x1: 5, y0: -5, y1: 4 },
          els: [
            { t: 'shield', m: -0.5, n, px: 1, py: -1, until: 1, scan: 1 },
            { t: 'line', m: -0.5, n, color: '#ffd166', style: 'dashed', from: 1 },
            { t: 'heart', x: 1, y: -1, label: 'P(1, −1)', labelScan: 3 },
            { t: 'line', m: 2, n: -3, color: '#ff9df0', from: 2, glow: true },
          ],
        },
        steps: [
          {
            goal: '방패와 수직인 직선의 기울기를 구하라', tool: 'perp', needs: 2,
            challenge: () => G.gen.perpSlope({ m, n }),
            dmg: 10, penalty: { mult: 1, label: '방패 파괴! 받는 피해 ½ → 1배' },
            fx: { slash: [-0.5, -4, 2.5, 2], shatter: 'shield' },
          },
          {
            goal: '심장 P를 지나는 그 수직선의 방정식을 세워라', tool: 'line', needs: 3,
            challenge: () => G.gen.lineEq({ m, n, P: { a: 1, b: -1 } }),
            dmg: 12, penalty: { mult: 1.5, label: '심장 노출! 받는 피해 1.5배' },
            fx: { slash: [-1, -5, 3.5, 4], ring: [1, -1] },
          },
        ],
      };
    },
  };

  // ── 최종보스 체험판: 교과서 41쪽 11번 (문턱 6, 3페이즈) ──────────
  // 원 x² + y² = 8 (r = 2√2), 직선 x − y + 6 = 0, d = 6/√2 = 3√2
  // 정삼각형 높이 h: d − r = √2 ≤ h ≤ d + r = 5√2, 넓이 S = h²/√3 → 최소 2√3/3, 최대 50√3/3
  const bossDiagram = {
    type: 'plane', lines: [{ m: frac(1), n: 6 }], circles: [{ cx: 0, cy: 0, r: 2 * S2 }],
    points: [{ x: 0, y: 0, label: 'O' }],
  };
  const tri = (() => { // 최대 넓이 정삼각형: 꼭짓점 A(2, −2), 높이의 발 H(−3, 3)
    const k = 5 / Math.sqrt(3);
    return [[2, -2], [-3 + k, 3 + k], [-3 - k, 3 - k]];
  })();
  const finalBoss = {
    name: '차원 군주 · 정삼각 결계', sprite: 'boss', floor: 'F',
    maxHp: 120, gates: [100, 82, 64, 36, 12, 12], startMult: 0.5,
    intro: '모든 문제의 끝에 선 군주. 8각 철갑 뒤에서 심장이 뛴다.',
    intents: [{ v: 10, label: '차원 참격' }, { v: 14, label: '결계 압착' }, { v: 6, block: 8, label: '정삼각 결계' }],
    phases: [
      { from: 0, title: 'PHASE 1 · 기준선 고정' },
      { from: 1, title: 'PHASE 2 · 수선의 발 측정' },
      { from: 4, title: 'PHASE 3 · 심장 타격' },
    ],
    makeProblem() {
      return {
        pieces: ['원 x² + y² = 8 위의 점 A와', '직선 y = x + 6 위의 서로 다른 두 점 B, C를', '꼭짓점으로 하는 정삼각형 ABC를 만들 때,', '그 넓이의 최댓값과 최솟값을 구하시오. (교과서 41쪽 11번)'],
        figure: {
          kind: 'plane', view: { x0: -7, x1: 4, y0: -4, y1: 8 },
          els: [
            { t: 'circle', cx: 0, cy: 0, r: 2 * S2, color: '#c792ff', scan: 1 },
            { t: 'line', m: 1, n: 6, color: '#ff6b81', style: 'dashed', until: 1, scan: 2 },
            { t: 'line', m: 1, n: 6, color: '#ff3355', style: 'laser', from: 1 },
            { t: 'pt', x: 0, y: 0, label: 'O', color: '#cfcbe6', scan: 1 },
            { t: 'label', x: 1.6, y: -2.6, text: 'r = 2√2', color: '#c792ff', from: 2 },
            { t: 'seg', x1: 0, y1: 0, x2: -3, y2: 3, color: '#7df9ff', from: 3, glow: true },
            { t: 'pt', x: -3, y: 3, label: 'H', color: '#7df9ff', from: 3 },
            { t: 'label', x: -2.9, y: 1.2, text: 'd = 3√2', color: '#7df9ff', from: 3 },
            { t: 'pt', x: -2, y: 2, label: 'A(최소)', color: '#ffd166', from: 4 },
            { t: 'pt', x: 2, y: -2, label: 'A(최대)', color: '#ffd166', from: 4 },
            { t: 'seg', x1: 2, y1: -2, x2: -3, y2: 3, color: '#ffd166', from: 4, dashed: true },
            { t: 'tri', pts: tri, color: '#ffd166', from: 5 },
          ],
        },
        steps: [
          {
            goal: '기준선 y = x + 6을 일반형으로 고정하라', tool: 'line', grant: true, needs: 2,
            challenge: fixedQ('보스의 기준선 y = x + 6 을 일반형 ax + by + c = 0 으로 나타내면?',
              'x − y + 6 = 0', ['x + y + 6 = 0', 'x − y − 6 = 0', '−x − y + 6 = 0'],
              'y = x + 6 에서 y를 오른쪽으로 옮기면 x − y + 6 = 0', bossDiagram),
            dmg: 10, penalty: { atkDown: 2, label: '기준선 고정! 보스의 공격 −2' },
            fx: { slash: [-7, -1, 2, 8], color: '#ff3355' },
          },
          {
            goal: '원의 결계(중심과 반지름)를 해석하라', tool: 'circle', grant: true, needs: 2,
            challenge: fixedQ('원 x² + y² = 8 의 중심과 반지름의 길이는?',
              '중심 (0, 0), 반지름 2√2', ['중심 (0, 0), 반지름 8', '중심 (0, 0), 반지름 4', '중심 (8, 8), 반지름 2√2'],
              'x² + y² = r² 꼴이므로 중심은 원점, r² = 8 → r = √8 = 2√2', bossDiagram),
            dmg: 10, penalty: { atkDown: 1, label: '결계 해석! 보스의 공격 −1' },
            fx: { ring: [0, 0], ringR: 2 * S2 },
          },
          {
            goal: '원의 중심에서 기준선까지의 거리 d를 재라', tool: 'ptLine', grant: true, needs: 2,
            challenge: fixedQ('원의 중심 O(0, 0)과 직선 x − y + 6 = 0 사이의 거리 d는?',
              '3√2', ['6', '3', '6√2'],
              'd = |0 − 0 + 6| ÷ √(1² + (−1)²) = 6 ÷ √2 = 3√2', bossDiagram),
            dmg: 12, penalty: { atkDown: 1, label: '수선의 발 측정! 보스의 공격 −1' },
            fx: { slash: [0, 0, -3, 3], ring: [-3, 3] },
          },
          {
            goal: '정삼각형의 높이 h의 범위를 구하라', tool: 'dPlusR', grant: true, needs: 3,
            forge: { from: ['circle', 'ptLine'] }, // 전투 중 유니크 연성 (레어는 사라지지 않음)
            challenge: fixedQ('원 위의 점 A에서 직선까지의 거리, 즉 정삼각형의 높이 h의 범위는?',
              '√2 ≤ h ≤ 5√2', ['0 ≤ h ≤ 3√2', '2√2 ≤ h ≤ 3√2', '3√2 ≤ h ≤ 5√2'],
              'd − r ≤ h ≤ d + r 이므로 3√2 − 2√2 ≤ h ≤ 3√2 + 2√2, 즉 √2 ≤ h ≤ 5√2', bossDiagram),
            dmg: 20, penalty: { mult: 1.5, label: 'ARMOR BREAK! 심장 노출' },
            cutin: { title: '한계 일도양단!', sub: 'd − r ≤ h ≤ d + r' },
            fx: { shatter: 'octagon', xslash: true, trace: true },
          },
          {
            goal: '넓이 S를 높이 h로 나타내라', tool: 'triArea', grant: true, needs: 4,
            challenge: fixedQ('높이가 h인 정삼각형의 넓이 S를 h로 나타내면?',
              'S = h²/√3', ['S = √3h²/4', 'S = h²/2', 'S = 2h²/√3'],
              '한 변 a = 2h ÷ √3 이므로 S = (√3/4)a² = (√3/4)·(4h²/3) = h²/√3', bossDiagram),
            dmg: 10, penalty: { label: '정삼각 결계 해석! 시간이 느려진다…' },
            fx: { triSlash: true },
            then: 'qte',
          },
          {
            goal: '넓이의 최솟값과 최댓값을 확정하라 (5초 QTE)', qte: true, needs: 4,
            challenge: fixedQ('h = √2 일 때와 h = 5√2 일 때, 정삼각형 넓이의 최솟값 · 최댓값은?',
              '최솟값 2√3/3 · 최댓값 50√3/3',
              ['최솟값 √2 · 최댓값 5√2', '최솟값 2/3 · 최댓값 50/3', '최솟값 2√3 · 최댓값 50√3'],
              'S = h²/√3 에 대입: (√2)²/√3 = 2/√3 = 2√3/3, (5√2)²/√3 = 50/√3 = 50√3/3', null),
            dmg: 999, penalty: { label: '섬멸!' },
            fx: { finisher: true },
          },
        ],
      };
    },
  };

  return { slime, golem, bat, beast, finalBoss };
})();
