// 몬스터 = 문제. 각 몬스터는 문제 하나를 갖고, 풀이 단계마다 체력 문턱(gates)이 있다.
// 공격은 문턱을 넘지 못하고, 문턱에서 그 단계를 풀어야 문턱이 깨진다. 모든 단계를 풀어야 쓰러뜨릴 수 있다.
// 문제는 조각(pieces)으로 나뉘어 스캔한 만큼만 보인다. 단계마다 필요한 조각 수(needs)가 있다.
// 그림 요소의 scan: k → k번째 조각이 공개돼야 보임, from: k → k단계를 푼 뒤 보임
// makeProblem(params) 은 전투에 들어갈 때 한 번 호출되고, 되감기·후퇴 후 재도전에도 같은 문제를 쓴다.
// 무작위 숫자는 problem.params 에 담아 두고, 세이브에서 불러올 때 makeProblem(params) 로 같은 문제를 다시 만든다.
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
    makeProblem(p) {
      let a, b;
      if (p) ({ a, b } = p);
      else {
        a = G.ri(-9, 9);
        do b = G.ri(-9, 9); while (b === a || Math.abs(b - a) < 3);
      }
      return {
        params: { a, b },
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
    makeProblem(p) {
      let m, n, a, b;
      if (p) ({ m, n, a, b } = p);
      else {
        m = G.pick([-3, -2, 2, 3]);
        n = G.ri(-3, 3);
        do { a = G.ri(-3, 3); b = G.ri(-3, 3); } while (b === m * a + n);
      }
      const c = b - m * a;
      return {
        params: { m, n, a, b },
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

  // ══ 3층 · 원환의 신전 (점과 직선 사이의 거리, 원의 방정식: 교과서 23~34쪽) ══════════

  // 3층 잡몹: 수선 거미 — 점과 직선 사이의 거리 (24쪽 보기 유형, 무작위 정수 답)
  const spider = {
    name: '수선 거미', sprite: 'spider', floor: 3,
    maxHp: 40, gates: [20], startMult: 1,
    intro: '직선 위에 거미줄을 친 거미. 거미줄에서 가장 가까운 길(수선)을 찾아야 잘린다.',
    intents: [{ v: 5, label: '거미줄', debuff: { weak: 2 } }, { v: 7, label: '독니' }],
    makeProblem(p) {
      const prob = G.gen.ptLineDist(p || {});
      const { x1, y1, a, b, c } = prob.params;
      const t = (a * x1 + b * y1 + c) / (a * a + b * b);
      const hx = x1 - a * t, hy = y1 - b * t, L = G.lineFig(a, b, c);
      const cxv = (x1 + hx) / 2, cyv = (y1 + hy) / 2;
      return {
        params: { x1, y1, a, b, c },
        pieces: [`점 P(${num(x1)}, ${num(y1)})${G.waGwa(y1)} 직선 ${G.lineGenStr(a, b, c)} 사이의`, '거리를 구하시오.'],
        figure: {
          kind: 'plane', view: { x0: cxv - 6, x1: cxv + 6, y0: cyv - 5, y1: cyv + 5 },
          els: [
            { t: 'line', m: G.fval(L.m), n: L.n, color: '#c792ff', style: 'barrier', until: 1, scan: 1 },
            { t: 'line', m: G.fval(L.m), n: L.n, color: '#c792ff', style: 'dashed', from: 1 },
            { t: 'pt', x: x1, y: y1, label: 'P', color: '#ffd166', scan: 1 },
            { t: 'seg', x1, y1, x2: hx, y2: hy, color: '#7df9ff', from: 1, glow: true },
            { t: 'pt', x: hx, y: hy, label: 'H', color: '#7df9ff', from: 1 },
          ],
        },
        steps: [{
          goal: '점 P에서 거미줄(직선)까지의 거리를 구하라', tool: 'ptLine', needs: 2,
          challenge: () => G.gen.ptLineDist({ x1, y1, a, b, c }),
          dmg: 8, penalty: { mult: 1.5, label: '수선 절단! 받는 피해 1.5배' },
          fx: { slash: [x1, y1, hx, hy], ring: [hx, hy] },
        }],
      };
    },
  };

  // 3층 잡몹: 가면 원령 — x² + y² + 6x − 4y − 3 = 0 이 나타내는 도형 (33쪽 예제 3)
  // (x + 3)² + (y − 2)² = 16 → 중심 (−3, 2), 반지름 4
  const mask = {
    name: '가면 원령', sprite: 'mask', floor: 3,
    maxHp: 60, gates: [40, 20], startMult: 1,
    intro: '전개된 식의 가면을 쓴 원령. 완전제곱으로 가면을 벗기면 진짜 원이 드러난다.',
    intents: [{ v: 7, label: '환영 할퀴기' }, { v: 5, block: 6, label: '가면 수복' }, { v: 8, label: '저주의 외침', debuff: { vuln: 2 } }],
    makeProblem() {
      return {
        pieces: ['방정식 x² + y² + 6x − 4y − 3 = 0이', '나타내는 도형을 말하시오.'],
        figure: {
          kind: 'plane', view: { x0: -9, x1: 4, y0: -3, y1: 8 },
          els: [
            { t: 'label', x: -8.5, y: 7, text: 'x² + y² + 6x − 4y − 3 = 0', color: '#ff9df0', scan: 1, until: 1 },
            { t: 'label', x: -8.5, y: 7, text: '(x + 3)² + (y − 2)² = 16', color: '#7df9ff', from: 1 },
            { t: 'circle', cx: -3, cy: 2, r: 4, color: '#c792ff', from: 1 },
            { t: 'pt', x: -3, y: 2, label: 'C(−3, 2)', color: '#ffd166', from: 2 },
            { t: 'seg', x1: -3, y1: 2, x2: 1, y2: 2, color: '#7df9ff', from: 2, glow: true },
          ],
        },
        steps: [
          {
            goal: '완전제곱식으로 가면을 벗겨라', tool: 'completeSq', needs: 2,
            challenge: () => G.gen.completeSquare({ A: 6, B: -4, C: -3 }),
            dmg: 10, penalty: { atkDown: 2, label: '가면 균열! 공격 −2' },
            fx: { ring: [-3, 2], ringR: 4 },
          },
          {
            goal: '드러난 원의 중심과 반지름을 읽어라', tool: 'circle', needs: 2,
            challenge: () => G.gen.circleRead({ a: -3, b: 2, r2: 16 }),
            dmg: 12, penalty: { mult: 1.5, label: '정체 폭로! 받는 피해 1.5배' },
            fx: { slash: [-7, 2, 1, 2], ring: [-3, 2] },
          },
        ],
      };
    },
  };

  // 3층 보스: 고리 정령 — A(2, 8), B(10, 2)를 지름의 양 끝으로 하는 원 (31쪽 예제 1)
  // 중심 = 중점 (6, 5), 반지름 CA = √(16 + 9) = 5 → (x − 6)² + (y − 5)² = 25
  const ringSpirit = {
    name: '고리 정령', sprite: 'ringSpirit', floor: 3,
    maxHp: 90, gates: [70, 48, 24], startMult: 0.5,
    intro: '지름의 양 끝을 붙든 고리 정령. 중심과 반지름을 찾아 원의 이름을 불러야 흩어진다.',
    intents: [{ v: 8, label: '고리 회전' }, { v: 11, label: '지름 베기' }, { v: 6, block: 8, label: '원환 방벽' }, { v: 9, label: '구속의 고리', debuff: { weak: 2 } }],
    makeProblem() {
      return {
        pieces: ['두 점 A(2, 8)과 B(10, 2)를', '지름의 양 끝 점으로 하는', '원의 방정식을 구하시오.'],
        figure: {
          kind: 'plane', view: { x0: -1, x1: 13, y0: -1, y1: 11 },
          els: [
            { t: 'pt', x: 2, y: 8, label: 'A(2, 8)', color: '#4cc9ff', scan: 1 },
            { t: 'pt', x: 10, y: 2, label: 'B(10, 2)', color: '#ff8c3a', scan: 1 },
            { t: 'seg', x1: 2, y1: 8, x2: 10, y2: 2, color: '#8f8aa8', scan: 2 },
            { t: 'pt', x: 6, y: 5, label: 'C(6, 5)', color: '#ffd166', from: 1 },
            { t: 'seg', x1: 6, y1: 5, x2: 2, y2: 8, color: '#7df9ff', from: 2, glow: true },
            { t: 'circle', cx: 6, cy: 5, r: 5, color: '#c792ff', from: 2 },
          ],
        },
        steps: [
          {
            goal: '지름의 중점, 원의 중심 C를 찾아라', tool: 'divide', needs: 2,
            challenge: () => G.gen.circleCenter({ x1: 2, y1: 8, x2: 10, y2: 2 }),
            dmg: 10, penalty: { atkDown: 2, label: '중심 포착! 공격 −2' },
            fx: { slash: [2, 8, 10, 2], ring: [6, 5] },
          },
          {
            goal: '중심에서 원 위의 점까지, 반지름을 재라', tool: 'dist', needs: 2,
            challenge: () => G.gen.dist2D({ x1: 6, y1: 5, x2: 2, y2: 8, labels: ['C', 'A'] }),
            dmg: 10, penalty: { mult: 1, label: '반지름 측정! 원환 방벽 ½ → 1배' },
            fx: { slash: [6, 5, 2, 8], ring: [6, 5], ringR: 5, shatter: 'ring' },
          },
          {
            goal: '원의 방정식으로 정령의 이름을 불러라', tool: 'circle', needs: 3,
            challenge: () => G.gen.circleEq({ a: 6, b: 5, r2: 25 }),
            dmg: 14, penalty: { mult: 1.5, label: '진명 해방! 받는 피해 1.5배' },
            fx: { ring: [6, 5], ringR: 5, slash: [1, 5, 11, 5] },
          },
        ],
      };
    },
  };

  // ══ 4층 · 유성의 관측소 (원과 직선의 위치 관계: 교과서 35~41쪽) ══════════════════

  // 4층 잡몹: 유성 — 원 x² + y² = 16 과 직선 y = x − 2 의 위치 관계 (36쪽 예제 1)
  // d = |−2| / √2 = √2 < 4 → 서로 다른 두 점에서 만난다
  const R7 = Math.sqrt(7);
  const meteor = {
    name: '궤도 유성', sprite: 'meteor', floor: 4,
    maxHp: 60, gates: [40, 20], startMult: 1,
    intro: '관측소의 원형 결계를 가로지르는 유성. 궤도와 결계가 어떻게 만나는지 읽어야 떨어진다.',
    intents: [{ v: 8, label: '운석 낙하' }, { v: 6, label: '궤도 교란', debuff: { vuln: 2 } }, { v: 10, label: '충돌 돌진' }],
    makeProblem() {
      return {
        pieces: ['원 x² + y² = 16과', '직선 y = x − 2의', '위치 관계를 말하시오.'],
        figure: {
          kind: 'plane', view: { x0: -6, x1: 6, y0: -6, y1: 6 },
          els: [
            { t: 'circle', cx: 0, cy: 0, r: 4, color: '#c792ff', scan: 1 },
            { t: 'pt', x: 0, y: 0, label: 'O', color: '#cfcbe6', scan: 1 },
            { t: 'line', m: 1, n: -2, color: '#ff8c3a', style: 'laser', scan: 2 },
            { t: 'seg', x1: 0, y1: 0, x2: 1, y2: -1, color: '#7df9ff', from: 1, glow: true },
            { t: 'label', x: 1.2, y: -1.6, text: 'd = √2', color: '#7df9ff', from: 1 },
            { t: 'pt', x: 1 + R7, y: -1 + R7, label: '', color: '#ffd166', from: 2 },
            { t: 'pt', x: 1 - R7, y: -1 - R7, label: '', color: '#ffd166', from: 2 },
          ],
        },
        steps: [
          {
            goal: '원의 중심에서 유성 궤도까지의 거리 d를 재라', tool: 'ptLine', needs: 2,
            challenge: () => G.gen.ptLineDist({ x1: 0, y1: 0, a: 1, b: -1, c: -2, P: 'O', what: '원 x² + y² = 16의 중심 O(0, 0)과 직선 y = x − 2, 즉 x − y − 2 = 0 사이의 거리 d는?' }),
            dmg: 10, penalty: { atkDown: 2, label: '궤도 측정! 공격 −2' },
            fx: { slash: [0, 0, 1, -1], ring: [1, -1] },
          },
          {
            goal: 'd와 반지름 r을 비교해 위치 관계를 판정하라', tool: 'posRel', needs: 3,
            challenge: () => G.gen.circleLineRel({ dStr: '√2', d: Math.SQRT2, r: 4,
              diagram: { type: 'plane', circles: [{ cx: 0, cy: 0, r: 4 }], lines: [{ m: G.frac(1), n: -2 }], points: [] } }),
            dmg: 12, penalty: { mult: 1.5, label: '궤도 확정! 받는 피해 1.5배' },
            fx: { slash: [1 - R7, -1 - R7, 1 + R7, -1 + R7], ring: [1 + R7, -1 + R7] },
          },
        ],
      };
    },
  };

  // 4층 잡몹: 접선 기사 — 원 x² + y² = 25 위의 점 (4, 3)에서의 접선 (38쪽 보기)
  // 반지름 OP 기울기 3/4 → 접선 기울기 −4/3 → 4x + 3y = 25
  const knight = {
    name: '접선 기사', sprite: 'knight', floor: 4,
    maxHp: 70, gates: [46, 23], startMult: 0.5,
    intro: '원의 가장자리를 스치듯 지키는 기사. 반지름과 직각을 이루는 칼끝, 접선을 찾아라.',
    intents: [{ v: 8, label: '접선 찌르기' }, { v: 5, block: 8, label: '방패 자세' }, { v: 10, label: '원주 돌격', debuff: { weak: 2 } }],
    makeProblem() {
      return {
        pieces: ['원 x² + y² = 25 위의', '점 P(4, 3)에서의', '접선의 방정식을 구하시오.'],
        figure: {
          kind: 'plane', view: { x0: -7, x1: 9, y0: -7, y1: 9 },
          els: [
            { t: 'circle', cx: 0, cy: 0, r: 5, color: '#c792ff', scan: 1 },
            { t: 'pt', x: 0, y: 0, label: 'O', color: '#cfcbe6', scan: 1 },
            { t: 'pt', x: 4, y: 3, label: 'P(4, 3)', color: '#ffd166', scan: 2 },
            { t: 'seg', x1: 0, y1: 0, x2: 4, y2: 3, color: '#8f8aa8', scan: 2 },
            { t: 'line', m: -4 / 3, n: 25 / 3, color: '#ff9df0', style: 'dashed', from: 1 },
            { t: 'line', m: -4 / 3, n: 25 / 3, color: '#7df9ff', from: 2, glow: true },
          ],
        },
        steps: [
          {
            goal: '반지름 OP에 수직인 접선의 기울기를 구하라', tool: 'perp', needs: 2,
            challenge: () => G.gen.tangentSlope({ x1: 4, y1: 3, r2: 25 }),
            dmg: 10, penalty: { mult: 1, label: '칼끝 간파! 방패 ½ → 1배' },
            fx: { slash: [0, 0, 4, 3], ring: [4, 3], shatter: 'ring' },
          },
          {
            goal: '점 P를 지나는 접선의 방정식을 세워라', tool: 'line', needs: 3,
            challenge: () => G.gen.tangentLine({ x1: 4, y1: 3, r2: 25 }),
            dmg: 12, penalty: { mult: 1.5, label: '접선 일섬! 받는 피해 1.5배' },
            fx: { slash: [1, 7, 7, -1], ring: [4, 3] },
          },
        ],
      };
    },
  };

  // 4층 중간보스: 원환의 수문장 — 교과서 41쪽 07번
  // 원 (x − 2)² + (y − 5)² = 4 (중심 C(2, 5), r = 2), 직선 3x − 4y − 6 = 0
  // d = |6 − 20 − 6| / 5 = 4 → 최댓값 d + r = 6, 최솟값 d − r = 2
  // 가장 가까운 점 (3.2, 3.4), 가장 먼 점 (0.8, 6.6), 수선의 발 H(4.4, 1.8)
  const gatekeeper = {
    name: '원환의 수문장', sprite: 'gatekeeper', floor: 4,
    maxHp: 110, gates: [84, 56, 28], startMult: 0.5,
    intro: '원환과 직선의 경계를 지키는 수문장. 가장 가까운 거리와 가장 먼 거리를 한 번에 베어야 한다.',
    intents: [
      { v: 9, label: '원환 압박' }, { v: 7, label: '수선 결박', debuff: { weak: 2 } },
      { v: 12, label: '궤도 붕괴', debuff: { vuln: 2 } }, { v: 6, block: 10, label: '결계 재정렬' },
    ],
    makeProblem() {
      return {
        pieces: ['원 (x − 2)² + (y − 5)² = 4 위의 점과', '직선 3x − 4y − 6 = 0 사이의 거리의', '최댓값과 최솟값을 구하시오. (교과서 41쪽 07번)'],
        figure: {
          kind: 'plane', view: { x0: -2, x1: 8, y0: -1, y1: 9 },
          els: [
            { t: 'circle', cx: 2, cy: 5, r: 2, color: '#c792ff', scan: 1 },
            { t: 'pt', x: 2, y: 5, label: 'C', color: '#cfcbe6', from: 1 },
            { t: 'line', m: 0.75, n: -1.5, color: '#ff6b81', style: 'barrier', scan: 2, until: 2 },
            { t: 'line', m: 0.75, n: -1.5, color: '#ff6b81', style: 'dashed', from: 2 },
            { t: 'seg', x1: 2, y1: 5, x2: 4.4, y2: 1.8, color: '#7df9ff', from: 2, glow: true },
            { t: 'label', x: 3.4, y: 3.8, text: 'd = 4', color: '#7df9ff', from: 2 },
            { t: 'seg', x1: 0.8, y1: 6.6, x2: 4.4, y2: 1.8, color: '#ffd166', from: 3, dashed: true },
            { t: 'pt', x: 3.2, y: 3.4, label: '최소 2', color: '#ffd166', from: 3 },
            { t: 'pt', x: 0.8, y: 6.6, label: '최대 6', color: '#ffd166', from: 3 },
          ],
        },
        steps: [
          {
            goal: '원환의 중심과 반지름을 읽어라', tool: 'circle', needs: 1,
            challenge: () => G.gen.circleRead({ a: 2, b: 5, r2: 4 }),
            dmg: 10, penalty: { atkDown: 2, label: '원환 해석! 공격 −2' },
            fx: { ring: [2, 5], ringR: 2 },
          },
          {
            goal: '중심 C에서 경계선까지의 거리 d를 재라', tool: 'ptLine', needs: 2,
            challenge: () => G.gen.ptLineDist({ x1: 2, y1: 5, a: 3, b: -4, c: -6, P: 'C', what: '원의 중심 C(2, 5)와 직선 3x − 4y − 6 = 0 사이의 거리 d는?' }),
            dmg: 12, penalty: { mult: 1, label: '수선 측정! 철갑 ½ → 1배' },
            fx: { slash: [2, 5, 4.4, 1.8], ring: [4.4, 1.8], shatter: 'ring' },
          },
          {
            goal: '거리의 최댓값과 최솟값을 한 번에 베어라', tool: 'dPlusR', needs: 3,
            forge: { from: ['circle', 'ptLine'] }, // 덱에 두 레어가 있으면 전투 중 각성 연성
            challenge: () => G.gen.distRange({ d: 4, r: 2,
              diagram: { type: 'plane', circles: [{ cx: 2, cy: 5, r: 2 }], lines: [{ m: G.frac(3, 4), n: -1.5 }], points: [{ x: 2, y: 5, label: 'C' }] } }),
            dmg: 20, penalty: { mult: 1.5, label: 'ARMOR BREAK! 원환 붕괴' },
            cutin: { title: '한계 일도양단!', sub: 'd − r ≤ 거리 ≤ d + r' },
            fx: { xslash: true, trace: true, ring: [2, 5], ringR: 2 },
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

  // ══ v1.0 테스트판 ════════════════════════════════════════════════════════
  const aimQ = (gen, aim) => () => ({ ...gen(), aim }); // 생성기 문제에 조준 정보 덧붙이기
  function fixedAim(question, answer, distractors, solution, diagram, aim) {
    const q = fixedQ(question, answer, distractors, solution, diagram);
    return () => ({ ...q(), aim });
  }

  // ── 2층 잡몹: 쌍점 궁수 — 두 점을 지나는 직선 (교과서 11쪽 준비 학습) ──
  const archer = {
    name: '쌍점 궁수', sprite: 'archer', floor: 2,
    maxHp: 50, gates: [25], startMult: 1,
    intro: '두 표적 사이로만 화살을 쏘는 궁수. 두 점을 잇는 직선을 세우면 화살길이 막힌다.',
    intents: [{ v: 6, label: '연사' }, { v: 9, label: '관통 화살' }],
    makeProblem(p) {
      const q = G.gen.line2pt(p || {});
      const { x1, y1, x2, y2 } = q.params;
      const m = (y2 - y1) / (x2 - x1), n = y1 - m * x1;
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
      return {
        params: { x1, y1, x2, y2 },
        pieces: [`두 표적 A(${num(x1)}, ${num(y1)}), B(${num(x2)}, ${num(y2)})${G.eulReul(y2)}`, '지나는 직선의 방정식을 구하시오.'],
        figure: {
          kind: 'plane', view: { x0: cx - 7, x1: cx + 7, y0: cy - 6, y1: cy + 6 },
          els: [
            { t: 'pt', x: x1, y: y1, label: 'A', color: '#4cc9ff', scan: 1 },
            { t: 'pt', x: x2, y: y2, label: 'B', color: '#ff8c3a', scan: 1 },
            { t: 'seg', x1, y1, x2, y2: y1, color: '#8f8aa8', dashed: true, scan: 2, until: 1 },
            { t: 'seg', x1: x2, y1, x2, y2, color: '#8f8aa8', dashed: true, scan: 2, until: 1 },
            { t: 'line', m, n, color: '#7df9ff', from: 1, glow: true },
          ],
        },
        steps: [{
          goal: '두 표적을 지나는 직선을 세워라 (기울기부터!)', tool: 'line', needs: 2,
          challenge: () => G.gen.line2pt({ x1, y1, x2, y2 }),
          dmg: 9, penalty: { mult: 1.5, label: '화살길 봉쇄! 받는 피해 1.5배' },
          fx: { slash: [x1, y1, x2, y2], ring: [x2, y2] },
        }],
      };
    },
  };

  // ══ 5층 · 거울의 회랑 (도형의 이동: 교과서 44~55쪽) ══════════════════
  // 평행 환영 — 46쪽 예제 1: x² + y² = 1 을 (3, −1)만큼 → (x − 3)² + (y + 1)² = 1
  const shiftWraith = {
    name: '평행 환영', sprite: 'shiftWraith', floor: 5,
    maxHp: 60, gates: [40, 20], startMult: 1,
    intro: '제자리에 없는 환영. 몸(원)이 옮겨 간 곳을 정확히 짚어야 붙잡힌다.',
    intents: [{ v: 7, label: '잔상 베기' }, { v: 5, block: 6, label: '위치 교란' }, { v: 8, label: '어긋난 손톱', debuff: { weak: 2 } }],
    makeProblem() {
      return {
        pieces: ['원 x² + y² = 1을', 'x축의 방향으로 3만큼, y축의 방향으로 −1만큼 평행이동한', '원의 방정식을 구하시오. (교과서 46쪽 예제 1)'],
        figure: {
          kind: 'plane', view: { x0: -3, x1: 6, y0: -4, y1: 3 },
          els: [
            { t: 'circle', cx: 0, cy: 0, r: 1, color: '#c792ff', scan: 1 },
            { t: 'pt', x: 0, y: 0, label: 'O', color: '#cfcbe6', scan: 1 },
            { t: 'seg', x1: 0, y1: 0, x2: 3, y2: -1, color: '#ffd166', dashed: true, scan: 2 },
            { t: 'pt', x: 3, y: -1, label: "O′(3, −1)", color: '#ffd166', from: 1 },
            { t: 'circle', cx: 3, cy: -1, r: 1, color: '#7df9ff', from: 2 },
          ],
        },
        steps: [
          {
            goal: '원의 중심 O가 옮겨 간 점을 찾아라', tool: 'transPt', needs: 2,
            challenge: () => G.gen.transPoint({ x: 0, y: 0, a: 3, b: -1, label: 'O', what: '원 x² + y² = 1의 중심 O(0, 0)을 x축의 방향으로 3만큼, y축의 방향으로 −1만큼 평행이동한 점의 좌표는?' }),
            dmg: 10, penalty: { atkDown: 2, label: '잔상 포착! 공격 −2' },
            fx: { slash: [0, 0, 3, -1], ring: [3, -1] },
          },
          {
            goal: '옮겨 간 원의 방정식으로 환영을 붙잡아라', tool: 'transFig', needs: 3,
            challenge: () => G.gen.transCircle({ cx: 0, cy: 0, r2: 1, a: 3, b: -1 }),
            dmg: 12, penalty: { mult: 1.5, label: '본체 고정! 받는 피해 1.5배' },
            fx: { ring: [3, -1], ringR: 1, slash: [1, -1, 5, -1] },
          },
        ],
      };
    },
  };

  // 거울 원령 — 51쪽 예제 1: 원 (x − 4)² + (y + 3)² = 4 를 x축·y축·원점에 대하여 대칭이동
  const REFL_NAME = { x: 'x축', y: 'y축', o: '원점' };
  const mirrorWraith = {
    name: '거울 원령', sprite: 'mirrorWraith', floor: 5,
    maxHp: 70, gates: [46, 23], startMult: 0.5,
    intro: '거울 속에서만 공격하는 원령. 거울에 비친 진짜 위치를 찾아야 닿는다.',
    intents: [{ v: 8, label: '거울 파편' }, { v: 6, block: 8, label: '반사막' }, { v: 9, label: '뒤집힌 저주', debuff: { vuln: 2 } }],
    makeProblem(p) {
      const k = (p && p.k) || G.pick(['x', 'y', 'o']);
      const [rx, ry] = G.reflXY(4, -3, k);
      const mirrorEl = k === 'x' ? { t: 'line', m: 0, n: 0, color: '#9fe8ff', style: 'barrier', scan: 2 }
        : k === 'y' ? { t: 'seg', x1: 0, y1: -7, x2: 0, y2: 7, color: '#9fe8ff', glow: true, scan: 2 }
          : { t: 'pt', x: 0, y: 0, label: '원점', color: '#9fe8ff', scan: 2 };
      return {
        params: { k },
        pieces: ['원 (x − 4)² + (y + 3)² = 4를', `${REFL_NAME[k]}에 대하여 대칭이동한`, '원의 방정식을 구하시오. (교과서 51쪽 예제 1)'],
        figure: {
          kind: 'plane', view: { x0: -7, x1: 7, y0: -6, y1: 6 },
          els: [
            { t: 'circle', cx: 4, cy: -3, r: 2, color: '#c792ff', scan: 1 },
            { t: 'pt', x: 4, y: -3, label: 'C(4, −3)', color: '#cfcbe6', scan: 1 },
            mirrorEl,
            { t: 'pt', x: rx, y: ry, label: `C′(${num(rx)}, ${num(ry)})`, color: '#ffd166', from: 1 },
            { t: 'circle', cx: rx, cy: ry, r: 2, color: '#7df9ff', from: 2 },
          ],
        },
        steps: [
          {
            goal: '원의 중심 C(4, −3)이 비친 점을 찾아라', tool: 'reflPt', needs: 2,
            challenge: () => G.gen.reflPoint({ x: 4, y: -3, k, label: 'C' }),
            dmg: 10, penalty: { mult: 1, label: '반사막 해제! 받는 피해 ½ → 1배' },
            fx: { slash: [4, -3, rx, ry], ring: [rx, ry], shatter: 'ring' },
          },
          {
            goal: '거울에 비친 원의 방정식으로 원령을 묶어라', tool: 'reflFig', needs: 3,
            challenge: () => G.gen.reflCircle({ cx: 4, cy: -3, r2: 4, k }),
            dmg: 12, penalty: { mult: 1.5, label: '거울 봉인! 받는 피해 1.5배' },
            fx: { ring: [rx, ry], ringR: 2, slash: [rx - 2, ry, rx + 2, ry] },
          },
        ],
      };
    },
  };

  // 거울 군주 (5층 보스) — 55쪽 06번: (x − 1)² + (y − 6)² = 9 를 (5, −1)만큼 평행이동한 다음 y = x 대칭
  // 중심 (1, 6) → (6, 5) → (5, 6),  (x − 5)² + (y − 6)² = 9
  const mirrorLord = {
    name: '거울 군주', sprite: 'mirrorLord', floor: 5,
    maxHp: 100, gates: [75, 50, 25], startMult: 0.5,
    intro: '옮기고 비추기를 반복하는 회랑의 주인. 이동의 순서를 그대로 따라가야 정체가 드러난다.',
    intents: [{ v: 9, label: '평행 참격' }, { v: 7, label: '반전의 시선', debuff: { weak: 2 } }, { v: 11, label: '거울 붕괴', debuff: { vuln: 2 } }, { v: 6, block: 10, label: '이중 반사막' }],
    makeProblem() {
      return {
        pieces: ['원 (x − 1)² + (y − 6)² = 9를', 'x축의 방향으로 5만큼, y축의 방향으로 −1만큼 평행이동한 다음', '직선 y = x에 대하여 대칭이동한 원의 방정식을 구하시오. (교과서 55쪽 06번)'],
        figure: {
          kind: 'plane', view: { x0: -3, x1: 10, y0: 0, y1: 10 },
          els: [
            { t: 'circle', cx: 1, cy: 6, r: 3, color: '#c792ff', scan: 1 },
            { t: 'pt', x: 1, y: 6, label: 'C(1, 6)', color: '#cfcbe6', scan: 1 },
            { t: 'line', m: 1, n: 0, color: '#9fe8ff', style: 'barrier', scan: 3 },
            { t: 'pt', x: 6, y: 5, label: "C′(6, 5)", color: '#ffd166', from: 1 },
            { t: 'seg', x1: 1, y1: 6, x2: 6, y2: 5, color: '#ffd166', dashed: true, from: 1 },
            { t: 'pt', x: 5, y: 6, label: "C″(5, 6)", color: '#7df9ff', from: 2 },
            { t: 'circle', cx: 5, cy: 6, r: 3, color: '#7df9ff', from: 3 },
          ],
        },
        steps: [
          {
            goal: '평행이동한 원의 중심을 찾아라', tool: 'transPt', needs: 2,
            challenge: () => G.gen.transPoint({ x: 1, y: 6, a: 5, b: -1, label: 'C', what: '원의 중심 C(1, 6)을 x축의 방향으로 5만큼, y축의 방향으로 −1만큼 평행이동한 점의 좌표는?' }),
            dmg: 10, penalty: { atkDown: 2, label: '첫 이동 추적! 공격 −2' },
            fx: { slash: [1, 6, 6, 5], ring: [6, 5] },
          },
          {
            goal: '그 중심을 직선 y = x에 비춰라', tool: 'reflPt', needs: 3,
            challenge: () => G.gen.reflPoint({ x: 6, y: 5, k: 'yx', label: "C′" }),
            dmg: 12, penalty: { mult: 1, label: '반사막 붕괴! 받는 피해 ½ → 1배' },
            fx: { slash: [6, 5, 5, 6], ring: [5, 6], shatter: 'ring' },
          },
          {
            goal: '최종 원의 방정식으로 군주를 봉인하라', tool: 'circle', needs: 3,
            challenge: () => G.gen.circleEq({ a: 5, b: 6, r2: 9 }),
            dmg: 14, penalty: { mult: 1.5, label: '정체 폭로! 받는 피해 1.5배' },
            fx: { ring: [5, 6], ringR: 3, slash: [2, 6, 8, 6] },
          },
        ],
      };
    },
  };

  // ══ 6층 · 차원의 정점 (Ⅰ단원 종합) ════════════════════════════════
  // 대칭 사냥개 — 55쪽 07번: y = 2x − 3 을 x축 대칭 → y = −2x + 3, 수직 기울기 1/2, (−2, 3) → y = ½x + 4
  const mirrorHound = {
    name: '대칭 사냥개', sprite: 'mirrorHound', floor: 6,
    maxHp: 90, gates: [66, 44, 22], startMult: 0.5,
    intro: '뒤집힌 직선을 따라 달리는 사냥개. 뒤집고, 수직으로 꺾고, 한 점에 꽂아야 멈춘다.',
    intents: [{ v: 9, label: '물어뜯기' }, { v: 12, label: '직선 돌진' }, { v: 7, label: '포효', debuff: { weak: 2 } }, { v: 6, block: 8, label: '경계 태세' }],
    makeProblem() {
      return {
        pieces: ['직선 y = 2x − 3을 x축에 대하여 대칭이동한 직선과', '점 (−2, 3)을 지나는 직선 l이 서로 수직일 때,', '직선 l의 방정식을 구하시오. (교과서 55쪽 07번)'],
        figure: {
          kind: 'plane', view: { x0: -6, x1: 6, y0: -4, y1: 8 },
          els: [
            { t: 'line', m: 2, n: -3, color: '#c792ff', style: 'dashed', scan: 1 },
            { t: 'line', m: -2, n: 3, color: '#ffd166', from: 1 },
            { t: 'pt', x: -2, y: 3, label: '(−2, 3)', color: '#ff8c3a', scan: 2 },
            { t: 'line', m: 0.5, n: 4, color: '#7df9ff', from: 3, glow: true },
          ],
        },
        steps: [
          {
            goal: '직선 y = 2x − 3을 x축에 비춰라', tool: 'reflFig', needs: 1,
            challenge: () => G.gen.reflLine({ m: 2, n: -3, k: 'x' }),
            dmg: 10, penalty: { atkDown: 2, label: '궤적 반전! 공격 −2' },
            fx: { slash: [-2, 7, 3, -3], color: '#ffd166' },
          },
          {
            goal: '뒤집힌 직선에 수직인 기울기를 구하라', tool: 'perp', needs: 2,
            challenge: () => G.gen.perpSlope({ m: frac(-2), n: 3, lineName: '대칭이동한 직선' }),
            dmg: 12, penalty: { mult: 1, label: '수직 차단! 받는 피해 ½ → 1배' },
            fx: { slash: [-5, 1.5, 4, 6], shatter: 'ring' },
          },
          {
            goal: '점 (−2, 3)을 지나는 직선 l을 세워라', tool: 'line', needs: 3,
            challenge: () => G.gen.lineThrough({ a: -2, b: 3, mf: frac(1, 2) }),
            dmg: 14, penalty: { mult: 1.5, label: '추적 종료! 받는 피해 1.5배' },
            fx: { slash: [-6, 1, 6, 7], ring: [-2, 3] },
          },
        ],
      };
    },
  };

  // ══ Ⅱ 차원 · 7층 집합의 정원 (교과서 64~79쪽) ══════════════════════
  const SLIME_SETS = [
    { A: [1, 2, 3, 6], B: [2, 3, 5, 7], src: '69쪽 보기' },
    { A: [1, 3, 9, 27], B: [3, 9, 15, 21, 27], src: '70쪽 문제 1' },
  ];
  const setSlime = {
    name: '원소 슬라임', sprite: 'setSlime', floor: 7,
    maxHp: 50, gates: [34, 17], startMult: 1,
    intro: '두 몸이 겹쳐진 슬라임. 겹친 부분과 전체를 정확히 갈라야 흩어진다.',
    intents: [{ v: 6, label: '점액 튀기기' }, { v: 8, label: '합체 박치기' }],
    makeProblem(p) {
      const v = p && p.v != null ? p.v : G.ri(0, SLIME_SETS.length - 1);
      const { A, B, src } = SLIME_SETS[v];
      return {
        params: { v },
        pieces: [`두 집합 A = ${G.setStr(A)}, B = ${G.setStr(B)}에 대하여`, `A ∩ B와 A ∪ B를 구하시오. (교과서 ${src})`],
        figure: { kind: 'venn', A, B, scan: 1, shades: [{ op: 'cap', from: 1, until: 2 }, { op: 'cup', from: 2 }] },
        steps: [
          {
            goal: '두 몸이 겹친 부분, 교집합을 갈라라', tool: 'inter', needs: 2,
            challenge: () => G.gen.setOp({ A, B, op: 'cap' }),
            dmg: 9, penalty: { atkDown: 2, label: '겹침 분리! 공격 −2' }, fx: { venn: 'cap' },
          },
          {
            goal: '슬라임 전체, 합집합을 묶어라', tool: 'union', needs: 2,
            challenge: () => G.gen.setOp({ A, B, op: 'cup' }),
            dmg: 11, penalty: { mult: 1.5, label: '전체 포박! 받는 피해 1.5배' }, fx: { venn: 'cup' },
          },
        ],
      };
    },
  };
  // 여집합 유령 — U = {1, …, 10}, A = {1, 2, 3, 6}, B = {x | x는 9의 약수} (73~74쪽 문제 1·2 유형)
  const U10 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const complGhost = {
    name: '여집합 유령', sprite: 'complGhost', floor: 7,
    maxHp: 60, gates: [40, 20], startMult: 1,
    intro: '집합 바깥에만 머무는 유령. 바깥(여집합)과 빼낸 부분(차집합)을 짚으면 사라진다.',
    intents: [{ v: 7, label: '바깥의 손길' }, { v: 5, block: 6, label: '경계 숨기' }, { v: 8, label: '공허의 속삭임', debuff: { vuln: 2 } }],
    makeProblem() {
      const A = [1, 2, 3, 6], B = [1, 3, 9];
      return {
        pieces: ['전체집합 U = {1, 2, 3, …, 10}의 두 부분집합 A = {1, 2, 3, 6}, B = {x | x는 9의 약수}에 대하여', 'Aᶜ과 A − B를 구하시오.'],
        figure: { kind: 'venn', A, B, U: U10, scan: 1, shades: [{ op: 'complA', from: 1, until: 2 }, { op: 'diff', from: 2 }] },
        steps: [
          {
            goal: 'A 바깥, 여집합 Aᶜ을 짚어라', tool: 'compl', needs: 2,
            challenge: () => G.gen.setOp({ A, B, U: U10, op: 'complA' }),
            dmg: 9, penalty: { atkDown: 2, label: '바깥 포착! 공격 −2' }, fx: { venn: 'complA' },
          },
          {
            goal: 'A에서 B를 빼낸 차집합을 베어라', tool: 'diffSet', needs: 2,
            challenge: () => G.gen.setOp({ A, B, U: U10, op: 'diff' }),
            dmg: 11, penalty: { mult: 1.5, label: '빈자리 노출! 받는 피해 1.5배' }, fx: { venn: 'diff' },
          },
        ],
      };
    },
  };
  // 벤 골렘 (7층 보스) — 76쪽 예제 2: n(U) = 40, n(A) = 21, n(B) = 17, n(A ∪ B) = 34 → n(Aᶜ ∪ Bᶜ) = 36
  const vennGolem = {
    name: '벤 다이어그램 골렘', sprite: 'vennGolem', floor: 7,
    maxHp: 100, gates: [75, 50, 25], startMult: 0.5,
    intro: '두 원이 겹친 몸을 가진 골렘. 겹친 원소의 수를 세고, 바깥을 뒤집어야 무너진다.',
    intents: [{ v: 9, label: '원환 강타' }, { v: 7, label: '포함 압박', debuff: { weak: 2 } }, { v: 6, block: 10, label: '벤 방벽' }, { v: 12, label: '전체집합 붕괴' }],
    makeProblem() {
      return {
        pieces: ['전체집합 U의 두 부분집합 A, B에 대하여', 'n(U) = 40, n(A) = 21, n(B) = 17, n(A ∪ B) = 34일 때,', 'n(Aᶜ ∪ Bᶜ)를 구하시오. (교과서 76쪽 예제 2)'],
        figure: { kind: 'venn', U: true, counts: { U: 40, A: 21, B: 17 }, scan: 1, shades: [{ op: 'cap', from: 1, until: 2 }, { op: 'capC', from: 2 }], countLabel: [{ from: 1, text: 'n(A ∩ B) = 4' }, { from: 3, text: 'n((A ∩ B)ᶜ) = 36' }] },
        steps: [
          {
            goal: '겹친 부분의 원소의 개수 n(A ∩ B)를 세라', tool: 'countU', needs: 2,
            challenge: () => G.gen.countCap({ nA: 21, nB: 17, nAB: 34 }),
            dmg: 10, penalty: { atkDown: 2, label: '겹침 계수! 공격 −2' }, fx: { venn: 'cap' },
          },
          {
            goal: 'Aᶜ ∪ Bᶜ를 하나의 여집합으로 뒤집어라', tool: 'deMorgan', needs: 3,
            challenge: () => G.gen.deMorganQ({ k: 0 }),
            dmg: 12, penalty: { mult: 1, label: '벤 방벽 반전! 받는 피해 ½ → 1배' }, fx: { venn: 'capC', shatter: 'ring' },
          },
          {
            goal: '바깥의 원소의 개수로 골렘을 무너뜨려라', tool: 'compl', needs: 3,
            challenge: () => G.gen.complCount({ nU: 40, nX: 4, X: 'A ∩ B', what: 'n(U) = 40, n(A ∩ B) = 4일 때, n(Aᶜ ∪ Bᶜ) = n((A ∩ B)ᶜ)는?' }),
            dmg: 14, penalty: { mult: 1.5, label: '골렘 붕괴! 받는 피해 1.5배' }, fx: { venn: 'capC' },
          },
        ],
      };
    },
  };

  // ══ Ⅱ 차원 · 8층 명제의 법정 (교과서 82~97쪽) ══════════════════════
  // 부정의 그림자 — 83쪽 보기: U = {2, 4, 6, 8, 10}, p: x ≥ 6 → ~p: x < 6, 진리집합 {2, 4}
  const U_EVEN = [2, 4, 6, 8, 10];
  const negShade = {
    name: '부정의 그림자', sprite: 'negShade', floor: 8,
    maxHp: 55, gates: [36, 18], startMult: 1,
    intro: '조건을 뒤집어 숨는 그림자. "아니다"를 정확히 말하고 그 진리집합을 짚어야 걷힌다.',
    intents: [{ v: 7, label: '그림자 송곳' }, { v: 6, label: '반전 저주', debuff: { weak: 2 } }],
    makeProblem() {
      return {
        pieces: ['전체집합 U = {x | x는 10 이하의 짝수}에 대하여', '조건 p: x ≥ 6의 부정 ~p와 그 진리집합을 구하시오. (교과서 83쪽 보기)'],
        figure: { kind: 'venn', A: [6, 8, 10], U: U_EVEN, single: true, names: ['P'], scan: 1, shades: [{ op: 'cap', from: 0, until: 1 }, { op: 'complA', from: 1 }] },
        steps: [
          {
            goal: '조건 p: x ≥ 6을 부정하라', tool: 'neg', needs: 2,
            challenge: () => G.gen.negCond({ rel: '≥', k: 6 }),
            dmg: 9, penalty: { atkDown: 2, label: '그림자 반전! 공격 −2' }, fx: { venn: 'complA' },
          },
          {
            goal: '~p의 진리집합을 짚어라', tool: 'compl', needs: 2,
            challenge: () => G.gen.negTruthSet({ U: U_EVEN, rel: '≥', k: 6 }),
            dmg: 11, penalty: { mult: 1.5, label: '본체 노출! 받는 피해 1.5배' }, fx: { venn: 'complA' },
          },
        ],
      };
    },
  };
  // 반례 기사 — 87쪽 예제 1: ⑴ x − 1 = 0 이면 x² = x (참) ⑵ 소수는 홀수 (거짓, 반례 2)
  const counterKnight = {
    name: '반례 기사', sprite: 'counterKnight', floor: 8,
    maxHp: 70, gates: [46, 23], startMult: 0.5,
    intro: '두 개의 맹세를 지키는 기사. 참인 맹세는 포함 관계로, 거짓인 맹세는 반례 하나로 꺾어라.',
    intents: [{ v: 8, label: '맹세의 검' }, { v: 5, block: 8, label: '논리 방패' }, { v: 10, label: '단언', debuff: { vuln: 2 } }],
    makeProblem() {
      return {
        pieces: ['다음 명제의 참, 거짓을 판별하시오. (교과서 87쪽 예제 1)', '⑴ x − 1 = 0이면 x² = x이다.', '⑵ 소수는 홀수이다.'],
        figure: { kind: 'venn', A: [1], B: [0, 1], names: ['P', 'Q'], subset: true, scan: 2, shades: [{ op: 'cap', from: 1 }] },
        steps: [
          {
            goal: '⑴ 진리집합 P, Q의 포함 관계로 판별하라', tool: 'truth', needs: 2,
            challenge: () => G.gen.truthJudge({ i: 0 }),
            dmg: 10, penalty: { mult: 1, label: '첫 맹세 판결! 방패 ½ → 1배' }, fx: { venn: 'cap', shatter: 'ring' },
          },
          {
            goal: '⑵ 반례 하나로 거짓을 밝혀라', tool: 'truth', needs: 3,
            challenge: () => G.gen.truthJudge({ i: 1 }),
            dmg: 12, penalty: { mult: 1.5, label: '반례 일격! 받는 피해 1.5배' }, fx: { venn: 'cup' },
          },
        ],
      };
    },
  };
  // 대우의 수호자 (8층 보스) — 91쪽 예제 1 · 90쪽 예제 2 ⑴ · 93쪽 예제 3
  const contraWarden = {
    name: '대우의 수호자', sprite: 'contraWarden', floor: 8,
    maxHp: 110, gates: [84, 56, 28], startMult: 0.5,
    intro: 'Ⅱ차원을 지키는 수호자. 대우로 증명하고, 조건을 판정하고, 절대부등식으로 끝을 내야 한다.',
    intents: [{ v: 9, label: '역설의 창' }, { v: 7, label: '판정 유보', debuff: { weak: 2 } }, { v: 12, label: '귀류의 일격', debuff: { vuln: 2 } }, { v: 6, block: 10, label: '공리 방벽' }],
    makeProblem() {
      return {
        pieces: ['수호자의 세 질문:', '① n²이 짝수이면 n도 짝수임을 대우로 보여라. ② p: x는 3의 배수, q: x는 9의 배수일 때 p는 q이기 위한 어떤 조건인가?', '③ a² + b² ≥ ab에서 등호가 성립할 조건은? (교과서 91쪽 예제 1, 90쪽 예제 2, 93쪽 예제 3)'],
        figure: { kind: 'venn', A: [3, 6, 9, 12, 15, 18], B: [9, 18], names: ['P', 'Q'], subset: true, scan: 2, shades: [{ op: 'cap', from: 1 }] },
        steps: [
          {
            goal: '명제의 대우를 세워라', tool: 'contra', needs: 2,
            challenge: () => G.gen.contraQ({ i: 0 }),
            dmg: 10, penalty: { atkDown: 2, label: '대우 성립! 공격 −2' }, fx: { venn: 'cap' },
          },
          {
            goal: 'p는 q이기 위한 어떤 조건인지 판정하라', tool: 'suffNec', needs: 2,
            challenge: () => G.gen.suffNecQ({ i: 0 }),
            dmg: 12, penalty: { mult: 1, label: '공리 방벽 해제! 받는 피해 ½ → 1배' }, fx: { venn: 'cup', shatter: 'ring' },
          },
          {
            goal: '절대부등식의 등호 조건으로 마무리하라', tool: 'absIneq', needs: 3,
            challenge: () => G.gen.absIneqQ({ i: 0 }),
            dmg: 14, penalty: { mult: 1.5, label: 'Q.E.D.! 받는 피해 1.5배' }, fx: { xslash: true },
          },
        ],
      };
    },
  };

  // ══ Ⅲ 차원 · 9층 대응의 시계탑 (교과서 106~119쪽) ═════════════════
  // 함숫값 슬라임 — 112쪽 문제 1: f(x) = 2x + 1, g(x) = x² − 1, f(2) = 5, (g∘f)(2) = g(5) = 24
  const valSlime = {
    name: '함숫값 슬라임', sprite: 'valSlime', floor: 9,
    maxHp: 50, gates: [34, 17], startMult: 1,
    intro: '값을 넣으면 다른 값을 뱉는 슬라임. 넣은 값이 어디로 가는지 따라가라.',
    intents: [{ v: 6, label: '값 튀기기' }, { v: 8, label: '연쇄 대입' }],
    makeProblem() {
      return {
        pieces: ['두 함수 f(x) = 2x + 1, g(x) = x² − 1에 대하여', 'f(2)와 (g∘f)(2)를 구하시오. (교과서 112쪽 문제 1)'],
        figure: {
          kind: 'plane', view: { x0: -3, x1: 6, y0: -2, y1: 8 },
          els: [
            { t: 'line', m: 2, n: 1, color: '#4cc9ff', scan: 1 },
            { t: 'curve', f: (x) => x * x - 1, color: '#ff9df0', scan: 1 },
            { t: 'pt', x: 2, y: 5, label: 'f(2) = 5', color: '#ffd166', from: 1 },
            { t: 'label', x: 2.3, y: 7.3, text: 'g(5) = 24 ↑', color: '#7df9ff', from: 2 },
          ],
        },
        steps: [
          {
            goal: 'f(2)를 구하라', tool: 'funcVal', needs: 2,
            challenge: () => G.gen.funcValue({ a: 2, b: 1, x: 2 }),
            dmg: 9, penalty: { atkDown: 2, label: '첫 대응 포착! 공격 −2' }, fx: { ring: [2, 5] },
          },
          {
            goal: '그 값을 g에 넣어 (g∘f)(2)를 구하라', tool: 'compose', needs: 2,
            challenge: () => G.gen.composeVal({ f: { k: 'lin', a: 2, b: 1 }, g: { k: 'sq', a: 1, c: -1 }, x: 2, order: 'gf' }),
            dmg: 11, penalty: { mult: 1.5, label: '연쇄 차단! 받는 피해 1.5배' }, fx: { slash: [2, 5, 2.5, 7.5] },
          },
        ],
      };
    },
  };
  // 합성 키메라 — 112쪽 예제 1: f(x) = −x + 2, g(x) = 4x + 1 → g∘f = −4x + 9, f∘g = −4x + 1
  const chimera = {
    name: '합성 키메라', sprite: 'chimera', floor: 9,
    maxHp: 70, gates: [46, 23], startMult: 0.5,
    intro: '두 짐승을 이어 붙인 키메라. 어느 쪽이 먼저인지 순서를 틀리면 다른 괴물이 된다.',
    intents: [{ v: 8, label: '이중 물기' }, { v: 5, block: 8, label: '갑각 결합' }, { v: 10, label: '순서 뒤섞기', debuff: { weak: 2 } }],
    makeProblem() {
      return {
        pieces: ['두 함수 f(x) = −x + 2, g(x) = 4x + 1에 대하여', '(g∘f)(x)와 (f∘g)(x)를 구하시오. (교과서 112쪽 예제 1)'],
        figure: {
          kind: 'plane', view: { x0: -4, x1: 5, y0: -6, y1: 10 },
          els: [
            { t: 'line', m: -1, n: 2, color: '#4cc9ff', scan: 1 },
            { t: 'line', m: 4, n: 1, color: '#ff8c3a', scan: 1 },
            { t: 'line', m: -4, n: 9, color: '#ffd166', from: 1, glow: true },
            { t: 'line', m: -4, n: 1, color: '#7df9ff', from: 2, glow: true },
          ],
        },
        steps: [
          {
            goal: 'f 먼저, 그다음 g: (g∘f)(x)를 구하라', tool: 'compose', needs: 2,
            challenge: () => G.gen.composeExpr({ f: [-1, 2], g: [4, 1], order: 'gf' }),
            dmg: 10, penalty: { mult: 1, label: '앞머리 분리! 갑각 ½ → 1배' }, fx: { slash: [-1, 13, 3, -3], shatter: 'ring' },
          },
          {
            goal: 'g 먼저, 그다음 f: (f∘g)(x)를 구하라', tool: 'compose', needs: 2,
            challenge: () => G.gen.composeExpr({ f: [-1, 2], g: [4, 1], order: 'fg' }),
            dmg: 12, penalty: { mult: 1.5, label: '결합 해제! 받는 피해 1.5배' }, fx: { slash: [-1, 5, 2, -7] },
          },
        ],
      };
    },
  };
  // 역함수 마녀 (9층 보스) — 115쪽 예제 1: y = 3x + 4 → y = ⅓x − 4/3, (0, 4) ↔ (4, 0)
  const inverseWitch = {
    name: '역함수 마녀', sprite: 'inverseWitch', floor: 9,
    maxHp: 100, gates: [75, 50, 25], startMult: 0.5,
    intro: '모든 주문을 거꾸로 되돌리는 마녀. 되돌릴 수 있는지부터 따지고, 거울(y = x)에 비춰라.',
    intents: [{ v: 9, label: '역류 주문' }, { v: 7, label: '시간 되감기', debuff: { weak: 2 } }, { v: 11, label: '반전 폭발', debuff: { vuln: 2 } }, { v: 6, block: 10, label: '거울 장막' }],
    makeProblem() {
      return {
        pieces: ['함수 y = 3x + 4가', '일대일대응인지 확인하고 역함수를 구하시오. 또, 그래프 위의 점 (0, 4)에 대응하는', '역함수의 그래프 위의 점을 구하시오. (교과서 115~116쪽)'],
        figure: {
          kind: 'plane', view: { x0: -5, x1: 7, y0: -4, y1: 7 },
          els: [
            { t: 'line', m: 3, n: 4, color: '#ff9df0', scan: 1 },
            { t: 'line', m: 1, n: 0, color: '#9fe8ff', style: 'dashed', scan: 2 },
            { t: 'line', m: 1 / 3, n: -4 / 3, color: '#7df9ff', from: 2, glow: true },
            { t: 'pt', x: 0, y: 4, label: '(0, 4)', color: '#ffd166', scan: 3 },
            { t: 'pt', x: 4, y: 0, label: '(4, 0)', color: '#7df9ff', from: 3 },
          ],
        },
        steps: [
          {
            goal: '되돌릴 수 있는 함수인가? 일대일대응을 확인하라', tool: 'oneToOne', needs: 1,
            challenge: () => G.gen.oneToOneQ({ i: 0 }),
            dmg: 10, penalty: { atkDown: 2, label: '주문 해석! 공격 −2' }, fx: { ring: [0, 4] },
          },
          {
            goal: '역함수를 구하라 (x에 대해 풀고, x와 y를 바꾼다)', tool: 'inverse', needs: 2,
            challenge: () => G.gen.inverseLin({ a: 3, b: 4 }),
            dmg: 12, penalty: { mult: 1, label: '거울 장막 해제! 받는 피해 ½ → 1배' }, fx: { slash: [-4, -2.67, 7, 1], shatter: 'ring' },
          },
          {
            goal: '점 (0, 4)를 거울 y = x에 비춰라', tool: 'invGraph', needs: 3,
            challenge: () => G.gen.invPoint({ a: 0, b: 4, f: '3x + 4' }),
            dmg: 14, penalty: { mult: 1.5, label: '역류 봉인! 받는 피해 1.5배' }, fx: { slash: [0, 4, 4, 0], ring: [4, 0] },
          },
        ],
      };
    },
  };

  // ══ Ⅲ 차원 · 10층 점근선의 심연 (교과서 122~134쪽) ══════════════════
  // 점근선 유령 — 125쪽 보기: y = 1/(x − 2) + 1, 점근선 x = 2, y = 1
  const asymGhost = {
    name: '점근선 유령', sprite: 'asymGhost', floor: 10,
    maxHp: 60, gates: [40, 20], startMult: 1,
    intro: '끝없이 다가가지만 닿지 않는 유령. 옮겨 간 쌍곡선과 그 점근선을 짚어라.',
    intents: [{ v: 7, label: '무한 접근' }, { v: 5, block: 6, label: '닿지 않는 몸' }, { v: 9, label: '심연의 손', debuff: { vuln: 2 } }],
    makeProblem() {
      return {
        pieces: ['함수 y = 1/x의 그래프를 x축의 방향으로 2만큼, y축의 방향으로 1만큼 평행이동한', '그래프의 식과 점근선을 구하시오. (교과서 125쪽 보기)'],
        figure: {
          kind: 'plane', view: { x0: -4, x1: 7, y0: -4, y1: 6 },
          els: [
            { t: 'curve', f: (x) => 1 / x, color: '#c792ff', asym: [0, 0], scan: 1, until: 1 },
            { t: 'curve', f: (x) => 1 / (x - 2) + 1, color: '#7df9ff', from: 1 },
            { t: 'asym', x: 2, y: 1, color: '#ffd166', from: 2 },
          ],
        },
        steps: [
          {
            goal: '평행이동한 그래프의 식을 세워라', tool: 'rational', needs: 2,
            challenge: () => G.gen.rationalShift({ k: 1, p: 2, q: 1 }),
            dmg: 10, penalty: { mult: 1, label: '실체화! 받는 피해 ½ → 1배' }, fx: { slash: [0, 3, 5, 3], shatter: 'ring' },
          },
          {
            goal: '닿지 않는 경계, 점근선을 짚어라', tool: 'rational', needs: 2,
            challenge: () => G.gen.rationalAsym({ k: 1, p: 2, q: 1 }),
            dmg: 12, penalty: { mult: 1.5, label: '경계 포착! 받는 피해 1.5배' }, fx: { slash: [2, -4, 2, 6], ring: [2, 1] },
          },
        ],
      };
    },
  };
  // 루트 뱀 — 131쪽 예제 2: y = √(2x + 8) + 2 = √(2(x + 4)) + 2, 정의역 x ≥ −4, 치역 y ≥ 2
  const rootSnake = {
    name: '루트 뱀', sprite: 'rootSnake', floor: 10,
    maxHp: 70, gates: [46, 23], startMult: 0.5,
    intro: '한 점에서 시작해 한쪽으로만 기어가는 뱀. 꼬리(시작점)와 뻗는 방향을 붙잡아라.',
    intents: [{ v: 8, label: '독니' }, { v: 6, block: 8, label: '허물 벗기' }, { v: 10, label: '휘감기', debuff: { weak: 2 } }],
    makeProblem() {
      return {
        pieces: ['무리함수 y = √(2x + 8) + 2의 그래프를 그리고,', '정의역과 치역을 구하시오. (교과서 131쪽 예제 2)'],
        figure: {
          kind: 'plane', view: { x0: -6, x1: 6, y0: -2, y1: 8 },
          els: [
            { t: 'curve', f: (x) => (x >= -4 ? Math.sqrt(2 * x + 8) + 2 : NaN), color: '#5ce1a5', scan: 1 },
            { t: 'pt', x: -4, y: 2, label: '시작 (−4, 2)', color: '#ffd166', from: 1 },
            { t: 'seg', x1: -4, y1: -2, x2: -4, y2: 8, color: '#ffd166', dashed: true, from: 2 },
          ],
        },
        steps: [
          {
            goal: '√(a(x − p)) + q 꼴로 바꿔 꼬리를 찾아라', tool: 'radical', needs: 2,
            challenge: () => G.gen.radicalForm({ a: 2, p: -4, q: 2 }),
            dmg: 10, penalty: { mult: 1, label: '허물 제거! 받는 피해 ½ → 1배' }, fx: { ring: [-4, 2], shatter: 'ring' },
          },
          {
            goal: '정의역과 치역으로 뱀의 영역을 가둬라', tool: 'radical', needs: 2,
            challenge: () => G.gen.radicalDomain({ a: 2, p: -4, q: 2 }),
            dmg: 12, penalty: { mult: 1.5, label: '영역 봉쇄! 받는 피해 1.5배' }, fx: { slash: [-4, 2, 4, 6] },
          },
        ],
      };
    },
  };
  // 점근의 왕 (10층 보스) — 126쪽 예제 2: y = (2x − 1)/(x + 1) = −3/(x + 1) + 2, 점근선 x = −1, y = 2
  // 역함수 y = −3/(x − 2) − 1: 점근선 x = 2, y = −1
  const asymKing = {
    name: '점근의 왕', sprite: 'asymKing', floor: 10,
    maxHp: 120, gates: [90, 60, 30], startMult: 0.5,
    intro: 'Ⅲ차원의 끝에 선 왕. 분수의 가면을 벗기고, 경계를 짚고, 거울 너머의 경계까지 베어야 한다.',
    intents: [{ v: 10, label: '쌍곡 참격' }, { v: 8, label: '점근 결박', debuff: { weak: 2 } }, { v: 13, label: '무한 붕괴', debuff: { vuln: 2 } }, { v: 6, block: 10, label: '분모 방벽' }],
    makeProblem() {
      return {
        pieces: ['함수 y = (2x − 1)/(x + 1)을 y = k/(x − p) + q 꼴로 나타내고,', '그 그래프의 점근선을 구하시오. (교과서 126쪽 예제 2)', '또, 이 함수의 역함수의 그래프의 점근선을 구하시오.'],
        figure: {
          kind: 'plane', view: { x0: -6, x1: 6, y0: -6, y1: 6 },
          els: [
            { t: 'curve', f: (x) => (2 * x - 1) / (x + 1), color: '#ff9df0', scan: 1 },
            { t: 'asym', x: -1, y: 2, color: '#ffd166', from: 2 },
            { t: 'line', m: 1, n: 0, color: '#9fe8ff', style: 'dashed', scan: 3 },
            { t: 'curve', f: (x) => -3 / (x - 2) - 1, color: '#7df9ff', from: 3 },
            { t: 'asym', x: 2, y: -1, color: '#7df9ff', from: 3 },
          ],
        },
        steps: [
          {
            goal: '분수의 가면을 벗겨 k/(x − p) + q 꼴로 바꿔라', tool: 'rational', needs: 2,
            challenge: () => G.gen.rationalForm({ a: 2, b: -1, d: 1 }),
            dmg: 10, penalty: { atkDown: 2, label: '가면 해제! 공격 −2' }, fx: { ring: [-1, 2] },
          },
          {
            goal: '왕의 경계, 점근선을 짚어라', tool: 'rational', needs: 2,
            challenge: () => G.gen.rationalAsym({ k: -3, p: -1, q: 2 }),
            dmg: 12, penalty: { mult: 1, label: '분모 방벽 붕괴! 받는 피해 ½ → 1배' }, fx: { slash: [-1, -6, -1, 6], shatter: 'ring' },
          },
          {
            goal: '거울 너머, 역함수의 점근선까지 베어라', tool: 'invGraph', needs: 3,
            challenge: () => G.gen.invAsym({ k: -3, p: -1, q: 2 }),
            dmg: 16, penalty: { mult: 1.5, label: 'ASYMPTOTE BREAK!' }, cutin: { title: '점근선 절단!', sub: 'x = p, y = q ↔ x = q, y = p' },
            fx: { xslash: true, trace: true },
          },
        ],
      };
    },
  };

  // ══ 엘리트 (갈림길의 고난도 선택 스테이지) ═══════════════════════════
  // 1층: 무게중심 트라이앵글 — A(0, 6), B(−3, 0), C(9, 0): 중점 M(3, 0), 무게중심 G(2, 2)
  const centroid = {
    name: '무게중심 트라이앵글', sprite: 'centroid', floor: 1, elite: true,
    maxHp: 70, gates: [46, 23], startMult: 0.5,
    intro: '[엘리트] 세 꼭짓점으로 균형을 잡는 삼각형. 무게중심을 찌르면 무너진다.',
    intents: [{ v: 8, label: '꼭짓점 찌르기' }, { v: 6, block: 6, label: '균형 잡기' }, { v: 10, label: '삼각 압착' }],
    makeProblem() {
      const fig = { type: 'plane', points: [{ x: 0, y: 6, label: 'A' }, { x: -3, y: 0, label: 'B' }, { x: 9, y: 0, label: 'C' }], segments: [[0, 6, -3, 0], [-3, 0, 9, 0], [9, 0, 0, 6]] };
      return {
        pieces: ['세 점 A(0, 6), B(−3, 0), C(9, 0)을 꼭짓점으로 하는 삼각형 ABC에서', '변 BC의 중점을 M이라 할 때, 중선 AM을 2 : 1로 내분하는 점(무게중심) G를 구하시오.'],
        figure: {
          kind: 'plane', view: { x0: -5, x1: 10, y0: -2, y1: 8 },
          els: [
            { t: 'tri', pts: [[0, 6], [-3, 0], [9, 0]], color: '#c792ff', scan: 1 },
            { t: 'pt', x: 3, y: 0, label: 'M', color: '#ffd166', from: 1 },
            { t: 'seg', x1: 0, y1: 6, x2: 3, y2: 0, color: '#ffd166', dashed: true, from: 1 },
            { t: 'pt', x: 2, y: 2, label: 'G(2, 2)', color: '#7df9ff', from: 2 },
          ],
        },
        steps: [
          {
            goal: '변 BC의 중점 M을 찾아라', tool: 'divide', needs: 2,
            challenge: fixedAim('두 점 B(−3, 0), C(9, 0)을 1 : 1로 내분하는 점(중점) M의 좌표는?', '(3, 0)', ['(6, 0)', '(−6, 0)', '(3, 3)'],
              'M = ((−3 + 9)/2, (0 + 0)/2) = (3, 0)', fig, { x: 3, y: 0, label: 'M' }),
            dmg: 10, penalty: { mult: 1, label: '균형 붕괴! 받는 피해 ½ → 1배' }, fx: { slash: [-3, 0, 9, 0], ring: [3, 0], shatter: 'ring' },
          },
          {
            goal: '중선 AM을 2 : 1로 내분해 무게중심을 찔러라', tool: 'divide', needs: 2,
            challenge: fixedAim('두 점 A(0, 6), M(3, 0)에 대하여 선분 AM을 2 : 1로 내분하는 점 G의 좌표는?', '(2, 2)', ['(1, 4)', '(3/2, 3)', '(2, 3)'],
              'G = ((2×3 + 1×0)/3, (2×0 + 1×6)/3) = (2, 2). 세 꼭짓점의 평균 ((0 − 3 + 9)/3, (6 + 0 + 0)/3)과도 같다', fig, { x: 2, y: 2, label: 'G' }),
            dmg: 14, penalty: { mult: 1.5, label: '무게중심 관통! 받는 피해 1.5배' }, fx: { slash: [0, 6, 3, 0], ring: [2, 2] },
          },
        ],
      };
    },
  };
  // 2층: 수직이등분선 기사 — A(1, 2), B(5, 6): 중점 (3, 4), 기울기 1 → 수직 −1 → y = −x + 7 (교과서 21쪽 생각 넓히기 유형)
  const bisector = {
    name: '수직이등분선 기사', sprite: 'bisector', floor: 2, elite: true,
    maxHp: 90, gates: [66, 44, 22], startMult: 0.5,
    intro: '[엘리트] 두 점에서 같은 거리에 선 기사. 한가운데에서 수직으로 베어야 갈린다.',
    intents: [{ v: 9, label: '정중선 베기' }, { v: 6, block: 8, label: '등거리 수비' }, { v: 11, label: '양단 찌르기', debuff: { vuln: 2 } }],
    makeProblem() {
      const fig = { type: 'plane', points: [{ x: 1, y: 2, label: 'A' }, { x: 5, y: 6, label: 'B' }], segments: [[1, 2, 5, 6]] };
      return {
        pieces: ['두 점 A(1, 2), B(5, 6)에 대하여', '선분 AB의 수직이등분선의 방정식을 구하시오. (중점을 지나고 AB에 수직)'],
        figure: {
          kind: 'plane', view: { x0: -1, x1: 8, y0: 0, y1: 8 },
          els: [
            { t: 'pt', x: 1, y: 2, label: 'A', color: '#4cc9ff', scan: 1 },
            { t: 'pt', x: 5, y: 6, label: 'B', color: '#ff8c3a', scan: 1 },
            { t: 'seg', x1: 1, y1: 2, x2: 5, y2: 6, color: '#8f8aa8', scan: 1 },
            { t: 'pt', x: 3, y: 4, label: 'M(3, 4)', color: '#ffd166', from: 1 },
            { t: 'line', m: -1, n: 7, color: '#7df9ff', from: 3, glow: true },
          ],
        },
        steps: [
          {
            goal: '선분 AB의 중점을 찾아라', tool: 'divide', needs: 2,
            challenge: fixedAim('두 점 A(1, 2), B(5, 6)의 중점의 좌표는?', '(3, 4)', ['(2, 2)', '(6, 8)', '(4, 3)'], '((1 + 5)/2, (2 + 6)/2) = (3, 4)', fig, { x: 3, y: 4, label: 'M' }),
            dmg: 10, penalty: { atkDown: 2, label: '정중앙 포착! 공격 −2' }, fx: { ring: [3, 4] },
          },
          {
            goal: 'AB에 수직인 기울기를 구하라', tool: 'perp', needs: 2,
            challenge: fixedQ('선분 AB의 기울기는 (6 − 2)/(5 − 1) = 1이다. AB에 수직인 직선의 기울기는?', '−1', ['1', '1/2', '−1/2'], 'mm′ = −1 에서 1 × m′ = −1 → m′ = −1', fig),
            dmg: 12, penalty: { mult: 1, label: '수비 붕괴! 받는 피해 ½ → 1배' }, fx: { slash: [1, 2, 5, 6], shatter: 'ring' },
          },
          {
            goal: '중점을 지나는 수직선, 수직이등분선을 세워라', tool: 'line', needs: 2,
            challenge: () => G.gen.lineThrough({ a: 3, b: 4, mf: frac(-1), what: '점 (3, 4)를 지나고 기울기가 −1인 직선(수직이등분선)의 방정식은?' }),
            dmg: 14, penalty: { mult: 1.5, label: '양단 일섬! 받는 피해 1.5배' }, fx: { slash: [0, 7, 7, 0], ring: [3, 4] },
          },
        ],
      };
    },
  };
  // 5층: 당구 유령 — 52쪽 문제 5: P(10, 30) → y축 대칭 P′(−10, 30), Q(70, 10) → x축 대칭 Q′(70, −10)
  // 직선 P′Q′: y = −½x + 25 → A(0, 25), B(50, 0)
  const billiard = {
    name: '당구 유령', sprite: 'billiard', floor: 5, elite: true,
    maxHp: 90, gates: [66, 44, 22], startMult: 0.5,
    intro: '[엘리트] 벽에 튕기며 다가오는 당구공 유령. 벽에 비친 공을 이으면 튕기는 길이 보인다.',
    intents: [{ v: 9, label: '쿠션 샷' }, { v: 7, label: '회전 걸기', debuff: { weak: 2 } }, { v: 12, label: '브레이크 샷' }],
    makeProblem() {
      const fig = { type: 'plane', points: [{ x: 10, y: 30, label: 'P' }, { x: 70, y: 10, label: 'Q' }], segments: [[0, 0, 80, 0], [0, 0, 0, 40], [0, 40, 80, 40], [80, 0, 80, 40]] };
      const aim10 = (gen, x, y, label) => () => ({ ...gen(), aim: { x, y, label, step: 10 } });
      return {
        pieces: ['가로 80, 세로 40인 당구대에서 점 P(10, 30)의 공을 쳐서', 'y축과 x축에 차례로 부딪혀 점 Q(70, 10)의 공을 맞히려 한다.', '부딪히는 점 A(y축 위), B(x축 위)를 구하시오. (교과서 52쪽 문제 5)'],
        figure: {
          kind: 'plane', view: { x0: -15, x1: 85, y0: -15, y1: 45 },
          els: [
            { t: 'seg', x1: 0, y1: 0, x2: 80, y2: 0, color: '#8f8aa8', scan: 1 },
            { t: 'seg', x1: 0, y1: 0, x2: 0, y2: 40, color: '#8f8aa8', scan: 1 },
            { t: 'seg', x1: 0, y1: 40, x2: 80, y2: 40, color: '#8f8aa8', scan: 1 },
            { t: 'seg', x1: 80, y1: 0, x2: 80, y2: 40, color: '#8f8aa8', scan: 1 },
            { t: 'pt', x: 10, y: 30, label: 'P', color: '#ffd166', scan: 1 },
            { t: 'pt', x: 70, y: 10, label: 'Q', color: '#ff6b81', scan: 2 },
            { t: 'pt', x: -10, y: 30, label: "P′", color: '#7df9ff', from: 1 },
            { t: 'pt', x: 70, y: -10, label: "Q′", color: '#7df9ff', from: 2 },
            { t: 'seg', x1: -10, y1: 30, x2: 70, y2: -10, color: '#7df9ff', dashed: true, from: 2 },
            { t: 'seg', x1: 10, y1: 30, x2: 0, y2: 25, color: '#ffd166', from: 3, glow: true },
            { t: 'seg', x1: 0, y1: 25, x2: 50, y2: 0, color: '#ffd166', from: 3, glow: true },
            { t: 'seg', x1: 50, y1: 0, x2: 70, y2: 10, color: '#ffd166', from: 3, glow: true },
          ],
        },
        steps: [
          {
            goal: 'P를 y축 쿠션에 비춰라', tool: 'reflPt', needs: 2,
            challenge: aim10(() => G.gen.reflPoint({ x: 10, y: 30, k: 'y', label: 'P' }), -10, 30, "P′"),
            dmg: 10, penalty: { atkDown: 2, label: '첫 쿠션 간파! 공격 −2' }, fx: { slash: [10, 30, -10, 30], ring: [-10, 30] },
          },
          {
            goal: 'Q를 x축 쿠션에 비춰라', tool: 'reflPt', needs: 3,
            challenge: aim10(() => G.gen.reflPoint({ x: 70, y: 10, k: 'x', label: 'Q' }), 70, -10, "Q′"),
            dmg: 12, penalty: { mult: 1, label: '회전 해제! 받는 피해 ½ → 1배' }, fx: { slash: [70, 10, 70, -10], ring: [70, -10], shatter: 'ring' },
          },
          {
            goal: 'P′Q′를 이어 쿠션 점 A, B를 찾아라', tool: 'line', needs: 3,
            challenge: fixedQ('두 점 P′(−10, 30), Q′(70, −10)을 지나는 직선이 y축, x축과 만나는 점 A, B는?', 'A(0, 25), B(50, 0)',
              ['A(0, 30), B(60, 0)', 'A(0, 20), B(40, 0)', 'A(0, 25), B(40, 0)'],
              '기울기 (−10 − 30)/(70 + 10) = −1/2, y − 30 = −1/2(x + 10) → y = −1/2x + 25. x = 0 → A(0, 25), y = 0 → B(50, 0)', fig),
            dmg: 16, penalty: { mult: 1.5, label: '최단 경로 일섬!' }, fx: { slash: [-10, 30, 70, -10], ring: [50, 0] },
          },
        ],
      };
    },
  };
  // 7층: 자전거 동아리 정령 — 79쪽 11번: 40명 중 A 코스 28명, B 코스 21명 → 둘 다: 최솟값 9, 최댓값 21
  const bikeClub = {
    name: '자전거 동아리 정령', sprite: 'bikeClub', floor: 7, elite: true,
    maxHp: 80, gates: [53, 26], startMult: 0.5,
    intro: '[엘리트] 두 코스를 달리는 정령들의 무리. 겹친 수가 가장 적을 때와 많을 때를 모두 짚어라.',
    intents: [{ v: 8, label: '페달 돌진' }, { v: 6, block: 8, label: '대열 유지' }, { v: 11, label: '추월', debuff: { vuln: 2 } }],
    makeProblem() {
      return {
        pieces: ['자전거 동아리 회원 40명 중 A 코스를 다녀온 회원은 28명, B 코스는 21명이다.', '두 코스를 모두 다녀온 회원 수의 최댓값과 최솟값을 구하시오. (교과서 79쪽 11번)'],
        figure: { kind: 'venn', U: true, counts: { U: 40, A: 28, B: 21 }, scan: 1, shades: [{ op: 'cap', from: 0 }], countLabel: [{ from: 1, text: '최솟값 9 (A ∪ B = U)' }, { from: 2, text: '최댓값 21 (B ⊂ A)' }] },
        steps: [
          {
            goal: 'n(A ∪ B)가 가장 클 때, 겹친 수의 최솟값을 구하라', tool: 'countU', needs: 2,
            challenge: fixedQ('n(A ∩ B) = n(A) + n(B) − n(A ∪ B) 이고 n(A ∪ B) ≤ 40 이다. n(A ∩ B)의 최솟값은?', '9', ['11', '19', '7'],
              'n(A ∪ B)가 가장 클 때(40) n(A ∩ B)가 가장 작다: 28 + 21 − 40 = 9', { type: 'venn', counts: { A: 28, B: 21 } }),
            dmg: 12, penalty: { mult: 1, label: '대열 붕괴! 받는 피해 ½ → 1배' }, fx: { venn: 'cup', shatter: 'ring' },
          },
          {
            goal: '겹친 수가 가장 클 때(B ⊂ A)를 짚어라', tool: 'inter', needs: 2,
            challenge: fixedQ('n(A ∩ B)가 가장 클 때는 B ⊂ A일 때이다. n(A ∩ B)의 최댓값은?', '21', ['28', '40', '19'],
              'A ∩ B ⊂ B 이므로 n(A ∩ B) ≤ n(B) = 21. B ⊂ A 이면 A ∩ B = B → 최댓값 21', { type: 'venn', counts: { A: 28, B: 21 } }),
            dmg: 14, penalty: { mult: 1.5, label: '무리 해산! 받는 피해 1.5배' }, fx: { venn: 'cap' },
          },
        ],
      };
    },
  };
  // 9층: 일대일 수호령 — 119쪽 10번: X = {x | 1 ≤ x ≤ 3} → Y = {y | −1 ≤ y ≤ 5}, f(x) = ax + b 일대일대응
  // a > 0: (3, −4),  a < 0: (−3, 8)
  const bijection = {
    name: '일대일 수호령', sprite: 'bijection', floor: 9, elite: true,
    maxHp: 80, gates: [53, 26], startMult: 0.5,
    intro: '[엘리트] 정의역의 끝과 공역의 끝을 정확히 잇는 수호령. 오르막과 내리막, 두 경우를 모두 짚어라.',
    intents: [{ v: 8, label: '양 끝 결속' }, { v: 6, block: 8, label: '구간 봉인' }, { v: 11, label: '역대응', debuff: { weak: 2 } }],
    makeProblem() {
      const fig = { type: 'plane', points: [{ x: 1, y: -1, label: 'f(1)' }, { x: 3, y: 5, label: 'f(3)' }], segments: [[1, -1, 3, 5]] };
      return {
        pieces: ['두 집합 X = {x | 1 ≤ x ≤ 3}, Y = {y | −1 ≤ y ≤ 5}에 대하여', 'X에서 Y로의 함수 f(x) = ax + b가 일대일대응일 때, (a, b)를 모두 구하시오. (교과서 119쪽 10번)'],
        figure: {
          kind: 'plane', view: { x0: -1, x1: 5, y0: -2, y1: 6 },
          els: [
            { t: 'seg', x1: 1, y1: -1, x2: 1, y2: 5, color: '#8f8aa8', dashed: true, scan: 1 },
            { t: 'seg', x1: 3, y1: -1, x2: 3, y2: 5, color: '#8f8aa8', dashed: true, scan: 1 },
            { t: 'seg', x1: 1, y1: -1, x2: 3, y2: 5, color: '#7df9ff', from: 1, glow: true },
            { t: 'seg', x1: 1, y1: 5, x2: 3, y2: -1, color: '#ffd166', from: 2, glow: true },
          ],
        },
        steps: [
          {
            goal: 'a > 0 (오르막): f(1) = −1, f(3) = 5', tool: 'oneToOne', needs: 2,
            challenge: fixedQ('a > 0 이면 f(1) = −1, f(3) = 5 이다. (a, b)는?', '(3, −4)', ['(−3, 8)', '(2, −3)', '(3, 4)'], 'a + b = −1, 3a + b = 5 → 2a = 6, a = 3, b = −4', fig),
            dmg: 12, penalty: { mult: 1, label: '오르막 결속! 받는 피해 ½ → 1배' }, fx: { slash: [1, -1, 3, 5], shatter: 'ring' },
          },
          {
            goal: 'a < 0 (내리막): f(1) = 5, f(3) = −1', tool: 'oneToOne', needs: 2,
            challenge: fixedQ('a < 0 이면 f(1) = 5, f(3) = −1 이다. (a, b)는?', '(−3, 8)', ['(3, −4)', '(−3, 2)', '(−2, 7)'], 'a + b = 5, 3a + b = −1 → 2a = −6, a = −3, b = 8', fig),
            dmg: 14, penalty: { mult: 1.5, label: '내리막 결속! 받는 피해 1.5배' }, fx: { slash: [1, 5, 3, -1] },
          },
        ],
      };
    },
  };

  finalBoss.floor = 6; // v1: 캠페인 6층 보스 (체험판도 그대로)
  const all = {
    slime, golem, bat, archer, beast, spider, mask, ringSpirit, meteor, knight, gatekeeper,
    shiftWraith, mirrorWraith, mirrorLord, mirrorHound, finalBoss,
    setSlime, complGhost, vennGolem, negShade, counterKnight, contraWarden,
    valSlime, chimera, inverseWitch, asymGhost, rootSnake, asymKing,
    centroid, bisector, billiard, bikeClub, bijection,
  };
  Object.values(all).forEach((m) => { if (m.dim == null) m.dim = typeof m.floor === 'number' ? DS.floorDim(m.floor) : 1; });
  return all;
})();
