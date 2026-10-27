// 문제 생성기: 교과서 공통수학2 Ⅰ-1 (12~22쪽) 범위의 객관식 문제를 무작위로 만든다.
// 모든 생성기는 { kind, question, choices[4], answerIndex, answer, solution, diagram, params }를 반환한다.
window.DS = window.DS || {};

DS.MathGen = (function () {
  const M = '−'; // 수학 기호 마이너스 (U+2212)

  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) [a, b] = [b, a % b];
    return a;
  }
  function frac(n, d = 1) {
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d) || 1;
    return { n: n / g, d: d / g };
  }
  const fval = (f) => f.n / f.d;

  // ── 문자열 포맷 ──────────────────────────────────────────
  const num = (v) => (v < 0 ? M + Math.abs(v) : String(v));
  const par = (v) => (v < 0 ? `(${num(v)})` : String(v));
  const fracStr = (f) => (f.d === 1 ? num(f.n) : `${f.n < 0 ? M : ''}${Math.abs(f.n)}/${f.d}`);
  const pt = (x, y) => `(${num(x)}, ${num(y)})`;
  const ptF = (fx, fy) => `(${fracStr(fx)}, ${fracStr(fy)})`;

  // 숫자 읽기(영·일·이·삼…)의 받침에 맞춘 조사: (1, 3)을 / (1, 2)를, 3 : 2로 / 2 : 3으로
  const lastDigit = (v) => String(Math.abs(v)).slice(-1);
  const eulReul = (v) => ('013678'.includes(lastDigit(v)) ? '을' : '를');
  const euroRo = (v) => ('03678'.includes(lastDigit(v)) ? '으로' : '로');

  // √n 을 a√b 꼴로 간단히
  function sqrtStr(n) {
    if (n <= 0) return '0';
    let a = 1, b = n;
    for (let k = Math.floor(Math.sqrt(n)); k > 1; k--) {
      if (n % (k * k) === 0) { a = k; b = n / (k * k); break; }
    }
    if (b === 1) return String(a);
    return `${a === 1 ? '' : a}√${b}`;
  }

  function coefX(f) {
    if (f.d === 1) {
      if (f.n === 1) return 'x';
      if (f.n === -1) return M + 'x';
      return num(f.n) + 'x';
    }
    return fracStr(f) + 'x';
  }
  const constTail = (c) => (c > 0 ? ` + ${c}` : c < 0 ? ` ${M} ${-c}` : '');
  // y = mx + c  (m: 정수 또는 분수 객체, c: 정수)
  function lineStr(m, c) {
    const f = typeof m === 'number' ? frac(m) : m;
    return `y = ${coefX(f)}${constTail(c)}`;
  }
  // 'x − 3', 'y + 2'
  const shift = (name, v) => (v === 0 ? name : v > 0 ? `${name} ${M} ${v}` : `${name} + ${-v}`);
  // k(x − a) 꼴
  function kTimes(k, a) {
    const kk = k === 1 ? '' : k === -1 ? M : num(k);
    return a === 0 ? `${kk}x` : `${kk}(${shift('x', a)})`;
  }

  // 정답 + 오답 후보 → 서로 다른 보기 4개
  function finish(o, pad) {
    const opts = [o.answer];
    for (const d of o.distractors) {
      if (opts.length >= 4) break;
      if (d && d !== '0' && !opts.includes(d)) opts.push(d);
    }
    let guard = 0;
    while (opts.length < 4 && guard++ < 200) {
      const d = pad();
      if (d && d !== '0' && !opts.includes(d)) opts.push(d);
    }
    const choices = shuffle(opts);
    return {
      kind: o.kind, question: o.question, choices,
      answerIndex: choices.indexOf(o.answer), answer: o.answer,
      solution: o.solution, diagram: o.diagram, params: o.params,
    };
  }

  // 방패 거수의 방패 기울기 후보 (±1 제외: 수직 기울기와 보기가 겹침)
  const SLOPES = [[2, 1], [-2, 1], [3, 1], [-3, 1], [1, 2], [-1, 2], [1, 3], [-1, 3], [2, 3], [-3, 2]]
    .map(([n, d]) => frac(n, d));

  // ── 1층: 선분의 내분 단원 ─────────────────────────────────

  // 수직선 위 두 점 사이의 거리 |x₂ − x₁|  (교과서 12쪽)
  function segLen(ctx = {}) {
    let a = ctx.a, b = ctx.b;
    if (a == null || b == null || a === b) {
      a = ri(-9, 9);
      do b = ri(-9, 9); while (b === a);
    }
    const d = Math.abs(b - a);
    const wrong = [Math.abs(a + b), Math.abs(a) + Math.abs(b), Math.abs(Math.abs(a) - Math.abs(b)), d + 2, d - 1, d + 1]
      .filter((v) => v > 0 && v !== d).map(String);
    return finish({
      kind: 'segLen',
      question: `수직선 위의 두 점 A(${num(a)}), B(${num(b)}) 사이의 거리 AB는?`,
      answer: String(d),
      distractors: wrong,
      solution: `AB = |x₂ ${M} x₁| = |${num(b)} ${M} ${par(a)}| = ${d}`,
      diagram: { type: 'numberline', points: [{ x: a, label: 'A' }, { x: b, label: 'B' }], segment: [a, b] },
      params: { a, b },
    }, () => String(d + ri(3, 9)));
  }

  // 좌표평면 위 두 점 사이의 거리 (교과서 14쪽)
  // ctx 로 두 점을 고정할 수 있다: { x1, y1, x2, y2, labels: ['O', 'P'] }
  function dist2D(ctx = {}) {
    const fixed = ctx.x1 != null;
    const x1 = fixed ? ctx.x1 : ri(-4, 4), y1 = fixed ? ctx.y1 : ri(-4, 4);
    const [L1, L2] = ctx.labels || ['A', 'B'];
    let dx, dy;
    if (fixed) {
      dx = ctx.x2 - x1; dy = ctx.y2 - y1;
    } else if (Math.random() < 0.4) {
      [dx, dy] = pick([[3, 4], [4, 3]]);
      dx *= pick([1, -1]); dy *= pick([1, -1]);
    } else {
      do dx = ri(-5, 5); while (dx === 0);
      do dy = ri(-5, 5); while (dy === 0);
    }
    const x2 = x1 + dx, y2 = y1 + dy, s = dx * dx + dy * dy;
    const ans = sqrtStr(s);
    const wrong = [
      String(Math.abs(dx) + Math.abs(dy)),
      sqrtStr((x1 + x2) ** 2 + (y1 + y2) ** 2),
      sqrtStr(Math.abs(dx) + Math.abs(dy)),
      sqrtStr(s + 2),
      sqrtStr(s - 1),
    ];
    const tail = ans === `√${s}` ? '' : ` = ${ans}`;
    return finish({
      kind: 'dist2D',
      question: `두 점 ${L1}${pt(x1, y1)}, ${L2}${pt(x2, y2)} 사이의 거리 ${L1}${L2}는?`,
      answer: ans,
      distractors: wrong,
      solution: `${L1}${L2} = √((x₂${M}x₁)² + (y₂${M}y₁)²) = √(${par(dx)}² + ${par(dy)}²) = √${s}${tail}`,
      diagram: {
        type: 'plane',
        points: [{ x: x1, y: y1, label: L1 }, { x: x2, y: y2, label: L2 }],
        segments: [[x1, y1, x2, y2]],
        guides: [[x1, y1, x2, y1], [x2, y1, x2, y2]],
      },
      params: { x1, y1, x2, y2 },
    }, () => sqrtStr(s + ri(3, 30)));
  }

  // 수직선 위 선분의 내분점 (교과서 13쪽)
  function div1D(ctx = {}) {
    let x1, x2, m, n;
    if (ctx.x1 != null) ({ x1, x2, m, n } = ctx);
    else {
      do {
        x1 = ri(-8, 8); x2 = ri(-8, 8); m = ri(1, 4); n = ri(1, 4);
      } while (x1 === x2 || m === n || (m * x2 + n * x1) % (m + n) !== 0);
    }
    const p = (m * x2 + n * x1) / (m + n);
    const wrong = [
      fracStr(frac(m * x1 + n * x2, m + n)), // m, n을 바꿔 곱함
      fracStr(frac(x1 + x2, 2)), // 중점과 혼동
      fracStr(frac(m * x2 - n * x1, m + n)),
      num(p + 1), num(p - 1),
    ];
    return finish({
      kind: 'div1D',
      question: `수직선 위의 두 점 A(${num(x1)}), B(${num(x2)})에 대하여 선분 AB를 ${m} : ${n}${euroRo(n)} 내분하는 점 P의 좌표는?`,
      answer: num(p),
      distractors: wrong,
      solution: `P = (m·x₂ + n·x₁)/(m + n) = (${m}×${par(x2)} + ${n}×${par(x1)})/(${m} + ${n}) = ${num(p)}`,
      diagram: { type: 'numberline', points: [{ x: x1, label: 'A' }, { x: x2, label: 'B' }], segment: [x1, x2] },
      params: { x1, x2, m, n },
    }, () => num(p + ri(2, 6) * pick([1, -1])));
  }

  // 좌표평면 위 선분의 내분점 (교과서 15쪽)
  function div2D(ctx = {}) {
    let x1, y1, x2, y2, m, n;
    if (ctx.x1 != null) ({ x1, y1, x2, y2, m, n } = ctx);
    else {
      do {
        x1 = ri(-6, 6); y1 = ri(-6, 6); x2 = ri(-6, 6); y2 = ri(-6, 6); m = ri(1, 3); n = ri(1, 3);
      } while ((x1 === x2 && y1 === y2) || m === n
        || (m * x2 + n * x1) % (m + n) !== 0 || (m * y2 + n * y1) % (m + n) !== 0);
    }
    const px = (m * x2 + n * x1) / (m + n), py = (m * y2 + n * y1) / (m + n);
    const ans = pt(px, py);
    const wrong = [
      ptF(frac(m * x1 + n * x2, m + n), frac(m * y1 + n * y2, m + n)),
      ptF(frac(x1 + x2, 2), frac(y1 + y2, 2)),
      pt(py, px),
      pt(px + 1, py), pt(px, py - 1),
    ];
    return finish({
      kind: 'div2D',
      question: `두 점 A${pt(x1, y1)}, B${pt(x2, y2)}에 대하여 선분 AB를 ${m} : ${n}${euroRo(n)} 내분하는 점 P의 좌표는?`,
      answer: ans,
      distractors: wrong,
      solution: `x = (${m}×${par(x2)} + ${n}×${par(x1)})/${m + n} = ${num(px)},  `
        + `y = (${m}×${par(y2)} + ${n}×${par(y1)})/${m + n} = ${num(py)}  →  P${ans}`,
      diagram: {
        type: 'plane',
        points: [{ x: x1, y: y1, label: 'A' }, { x: x2, y: y2, label: 'B' }],
        segments: [[x1, y1, x2, y2]],
      },
      params: { x1, y1, x2, y2, m, n },
    }, () => pt(px + ri(-3, 3), py + ri(-3, 3)));
  }

  const divide = () => (Math.random() < 0.5 ? div1D() : div2D());

  // ── 2층: 직선의 위치 관계 단원 ─────────────────────────────

  // 수직인 직선의 기울기 mm′ = −1 (교과서 20~21쪽)
  function perpSlope(ctx = {}) {
    const m = ctx.m || pick(SLOPES);
    const n = ctx.n != null ? ctx.n : ri(-3, 3);
    const ans = fracStr(frac(-m.d, m.n));
    const wrong = [fracStr(frac(m.d, m.n)), fracStr(frac(-m.n, m.d)), fracStr(m)];
    return finish({
      kind: 'perpSlope',
      question: `방패의 직선 ${lineStr(m, n)}에 수직인 직선의 기울기는?`,
      answer: ans,
      distractors: wrong,
      solution: `수직 조건 m × m′ = ${M}1 이므로 ${fracStr(m)} × m′ = ${M}1  →  m′ = ${ans}`,
      diagram: { type: 'plane', lines: [{ m, n, color: 'shield' }], points: [] },
      params: { m, n },
    }, () => fracStr(frac(ri(-5, 5) || 4, ri(1, 4))));
  }

  // 한 점과 기울기로 직선의 방정식 y − y₁ = m(x − x₁) (교과서 18, 21쪽)
  function lineEq(ctx = {}) {
    const m = ctx.m, n = ctx.n;
    let k, perpMode = false;
    if (m && Math.abs(m.n) === 1) { // −1/m 이 정수일 때는 예제 2처럼 '수직인 직선'을 묻는다
      k = -m.d * m.n;
      perpMode = true;
    } else {
      k = pick([-3, -2, 2, 3, 4, -4]);
    }
    const P = ctx.P || { a: ri(-4, 4), b: ri(-4, 4) };
    const { a, b } = P;
    const c = b - k * a;
    const ans = lineStr(k, c);
    const wrong = [
      lineStr(k, b + k * a), // 부호 실수
      lineStr(-k, b + k * a), // 기울기 부호 실수
      lineStr(k, a - k * b), // x, y 좌표 뒤바꿈
      c !== 0 ? lineStr(k, -c) : lineStr(k, c + 2),
      lineStr(k, c + 1),
    ];
    const question = perpMode
      ? `점 P${pt(a, b)}${eulReul(b)} 지나고 방패의 직선 ${lineStr(m, n)}에 수직인 직선의 방정식은?`
      : `점 P${pt(a, b)}${eulReul(b)} 지나고 기울기가 ${num(k)}인 직선의 방정식은?`;
    const pre = perpMode ? `${fracStr(m)} × m′ = ${M}1 에서 기울기 m′ = ${num(k)}.  ` : '';
    const lines = perpMode ? [{ m, n, color: 'shield' }] : [];
    return finish({
      kind: 'lineEq',
      question,
      answer: ans,
      distractors: wrong,
      solution: `${pre}${shift('y', b)} = ${kTimes(k, a)}  →  ${ans}`,
      diagram: { type: 'plane', lines, points: [{ x: a, y: b, label: 'P' }] },
      params: { a, b, k, perpMode },
    }, () => lineStr(k, c + ri(2, 6) * pick([1, -1])));
  }

  // 평행한 직선 m = m′ (교과서 19쪽 예제 1)
  function parallel(ctx = {}) {
    let m = ctx.m, n = ctx.n, fromShield = true;
    if (!m || m.d !== 1) {
      m = frac(pick([-3, -2, 2, 3]));
      n = ri(-4, 4);
      fromShield = false;
    }
    const k = m.n;
    let a = ctx.a, b = ctx.b;
    if (a == null || b == null || b === k * a + n) {
      do { a = ri(-4, 4); b = ri(-4, 4); } while (b === k * a + n);
    }
    const lineName = ctx.lineName || (fromShield ? '방패의 직선' : '결계선');
    const c = b - k * a;
    const ans = lineStr(k, c);
    const wrong = [
      lineStr(k, n), // 원래 직선 그대로
      lineStr(k, b + k * a),
      lineStr(-k, b + k * a),
      lineStr(k, a - k * b),
      lineStr(k, c + 1),
    ];
    return finish({
      kind: 'parallel',
      question: `점 Q${pt(a, b)}${eulReul(b)} 지나고 ${lineName} ${lineStr(m, n)}에 평행한 직선의 방정식은?`,
      answer: ans,
      distractors: wrong,
      solution: `평행하면 기울기가 같으므로 m′ = ${num(k)}.  ${shift('y', b)} = ${kTimes(k, a)}  →  ${ans}`,
      diagram: { type: 'plane', lines: [{ m, n, color: 'shield' }], points: [{ x: a, y: b, label: 'Q' }] },
      params: { a, b, k, n },
    }, () => lineStr(k, c + ri(2, 6) * pick([1, -1])));
  }

  return {
    M, ri, pick, shuffle, frac, fval, fracStr, lineStr, sqrtStr, num, SLOPES,
    gen: { segLen, dist2D, div1D, div2D, divide, perpSlope, lineEq, parallel },
  };
})();
