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
            goal: '완전제곱식으로 가면을 벗겨라', tool: 'circle', needs: 2,
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

  return { slime, golem, bat, beast, spider, mask, ringSpirit, meteor, knight, gatekeeper, finalBoss };
})();
