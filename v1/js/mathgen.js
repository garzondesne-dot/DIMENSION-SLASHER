// 문제 생성기: 교과서 공통수학2 Ⅰ-1·Ⅰ-2 (12~41쪽) 범위의 객관식 문제를 만든다 (무작위 또는 교과서 숫자 고정).
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
  const waGwa = (v) => ('013678'.includes(lastDigit(v)) ? '과' : '와');

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
      solution: o.solution, diagram: o.diagram, params: o.params, aim: o.aim || null,
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
      params: { x1, y1, x2, y2, m, n }, aim: { x: px, y: py, label: 'P' },
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
      question: `${ctx.lineName || '방패의 직선'} ${lineStr(m, n)}에 수직인 직선의 기울기는?`,
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

  // ── 3층·4층: 점과 직선 사이의 거리, 원의 방정식, 원과 직선 ─────────────

  // ax + by + c = 0  (a, b, c 정수)
  function lineGenStr(a, b, c) {
    const term = (k, v, first) => {
      if (k === 0) return '';
      const mag = Math.abs(k) === 1 && v ? '' : String(Math.abs(k));
      if (first) return `${k < 0 ? M : ''}${mag}${v}`;
      return ` ${k < 0 ? M : '+'} ${mag}${v}`;
    };
    let out = term(a, 'x', true);
    out += term(b, 'y', !out);
    out += term(c, '', !out);
    return `${out} = 0`;
  }
  // p / √q 를 간단히 (p ≥ 0 정수, q > 0 정수): 3√2/2, √2, 4 …
  function ratSqrt(p, q) {
    if (p === 0) return '0';
    let a = 1, b = q;
    for (let k = Math.floor(Math.sqrt(q)); k > 1; k--) if (q % (k * k) === 0) { a = k; b = q / (k * k); break; }
    // p / (a√b) = p√b / (a·b)
    const den = b === 1 ? a : a * b;
    const g = gcd(p, den), n = p / g, d = den / g;
    const top = b === 1 ? String(n) : `${n === 1 ? '' : n}√${b}`;
    return d === 1 ? top : `${top}/${d}`;
  }
  // (x − a)² + (y − b)² = r²  (중심이 원점이면 x² + y²)
  const sqTerm = (name, v) => (v === 0 ? `${name}²` : `(${shift(name, v)})²`);
  const circleStr = (a, b, r2) => `${sqTerm('x', a)} + ${sqTerm('y', b)} = ${r2}`;
  const rStr = (r2) => sqrtStr(r2);
  // 직선 ax + by + c = 0 을 그림용 기울기 꼴로 (b ≠ 0)
  const lineFig = (a, b, c) => ({ m: frac(-a, b), n: -c / b });

  // 점과 직선 사이의 거리 |ax₁ + by₁ + c| / √(a² + b²)  (교과서 23~24쪽)
  // ctx 고정: { x1, y1, a, b, c, P: '점 이름', what: '물어볼 말' }. 없으면 피타고라스 수로 정수 답이 나오게 만든다
  function ptLineDist(ctx = {}) {
    let { x1, y1, a, b, c } = ctx;
    if (a == null) {
      const [p, q] = pick([[3, 4], [4, 3], [6, 8], [8, 6], [5, 12], [12, 5]]);
      a = p * pick([1, -1]); b = q * pick([1, -1]);
      const k = Math.hypot(a, b);
      x1 = ri(-3, 3); y1 = ri(-3, 3);
      const d = ri(1, 4);
      c = pick([1, -1]) * d * k - (a * x1 + b * y1);
      if (Math.abs(c) > 40) c = d * k - (a * x1 + b * y1);
      // 교과서처럼 x 계수를 양수로, 공약수는 약분 (거리는 그대로)
      const g = gcd(gcd(a, b), c) || 1, sg = a < 0 ? -1 : 1;
      a = (sg * a) / g; b = (sg * b) / g; c = (sg * c) / g;
    }
    const P = ctx.P || 'P';
    const top = a * x1 + b * y1 + c, q = a * a + b * b;
    const ans = ratSqrt(Math.abs(top), q);
    const wrong = [
      ratSqrt(Math.abs(a * x1 + b * y1), q), // c 빠뜨림
      String(Math.abs(top)), // 분모 빠뜨림
      ratSqrt(Math.abs(top), q * q), // √ 없이 a² + b² 로 나눔
      ratSqrt(Math.abs(a * x1 + b * y1 - c), q), // c 부호 실수
      ratSqrt(Math.abs(top) + 1, q),
    ];
    const what = ctx.what || `점 ${P}${pt(x1, y1)}${waGwa(y1)} 직선 ${lineGenStr(a, b, c)} 사이의 거리는?`;
    return finish({
      kind: 'ptLineDist',
      question: what,
      answer: ans,
      distractors: wrong,
      solution: `|ax₁ + by₁ + c| ÷ √(a² + b²) = |${num(a)}×${par(x1)} + ${par(b)}×${par(y1)} + ${par(c)}| ÷ √(${par(a)}² + ${par(b)}²) = ${Math.abs(top)} ÷ √${q} = ${ans}`,
      diagram: { type: 'plane', lines: [lineFig(a, b, c)], points: [{ x: x1, y: y1, label: P }] },
      params: { x1, y1, a, b, c },
    }, () => ratSqrt(Math.abs(top) + ri(2, 6), q));
  }

  // 지름의 양 끝 → 원의 중심 = 중점 (교과서 31쪽 예제 1)
  function circleCenter(ctx) {
    const { x1, y1, x2, y2 } = ctx;
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    const ans = pt(cx, cy);
    return finish({
      kind: 'circleCenter',
      question: `두 점 A${pt(x1, y1)}, B${pt(x2, y2)}${eulReul(y2)} 지름의 양 끝 점으로 하는 원의 중심 C의 좌표는?`,
      answer: ans,
      distractors: [pt(cx, cy + 1), pt(x2 - x1, y2 - y1), pt(x1 + x2, y1 + y2), pt(cy, cx), pt((x2 - x1) / 2, (y2 - y1) / 2)],
      solution: `원의 중심은 지름 AB의 중점 = 1 : 1 내분점 → ((${x1} + ${x2})/2, (${y1} + ${y2})/2) = ${ans}`,
      diagram: { type: 'plane', points: [{ x: x1, y: y1, label: 'A' }, { x: x2, y: y2, label: 'B' }], segments: [[x1, y1, x2, y2]] },
      params: ctx, aim: { x: cx, y: cy, label: 'C', step: Number.isInteger(cx) && Number.isInteger(cy) ? 1 : 0.5 },
    }, () => pt(cx + ri(1, 3), cy - ri(1, 3)));
  }

  // 중심과 반지름 → 원의 방정식 (교과서 30~31쪽)
  function circleEq(ctx) {
    const { a, b, r2 } = ctx;
    const ans = circleStr(a, b, r2);
    const r = rStr(r2);
    return finish({
      kind: 'circleEq',
      question: ctx.what || `중심이 ${pt(a, b)}이고 반지름의 길이가 ${r}인 원의 방정식은?`,
      answer: ans,
      distractors: [circleStr(-a, -b, r2), `${sqTerm('x', a)} + ${sqTerm('y', b)} = ${r}`, circleStr(b, a, r2), circleStr(a, b, r2 * 2), circleStr(-a, b, r2)],
      solution: `(x − a)² + (y − b)² = r² 에 중심 ${pt(a, b)}, r = ${r} 대입 → ${ans}`,
      diagram: { type: 'plane', points: [{ x: a, y: b, label: 'C' }], circles: [{ cx: a, cy: b, r: Math.sqrt(r2) }] },
      params: ctx,
    }, () => circleStr(a, b, r2 + ri(1, 9)));
  }

  // x² + y² + Ax + By + C = 0 → 완전제곱식 (교과서 32~33쪽 예제 3).  A, B 짝수
  const genCircleStr = (A, B, C) => {
    const t = (k, v) => (k === 0 ? '' : ` ${k < 0 ? M : '+'} ${Math.abs(k) === 1 && v ? '' : Math.abs(k)}${v}`);
    return `x² + y²${t(A, 'x')}${t(B, 'y')}${t(C, '')} = 0`;
  };
  function completeSquare(ctx) {
    const { A, B, C } = ctx;
    const a = -A / 2, b = -B / 2, r2 = a * a + b * b - C;
    const ans = circleStr(a, b, r2);
    return finish({
      kind: 'completeSquare',
      question: `방정식 ${genCircleStr(A, B, C)}을 완전제곱식 꼴로 바꾸면?`,
      answer: ans,
      distractors: [circleStr(a, b, -C), circleStr(-a, -b, r2), circleStr(2 * a, 2 * b, r2), circleStr(a, b, a * a + b * b + C)],
      solution: `x² ${A < 0 ? M : '+'} ${Math.abs(A)}x + ${a * a} + y² ${B < 0 ? M : '+'} ${Math.abs(B)}y + ${b * b} = ${-C} + ${a * a} + ${b * b}  →  ${ans}`,
      diagram: null,
      params: ctx,
    }, () => circleStr(a, b, r2 + ri(1, 6)));
  }

  // 원의 방정식 → 중심과 반지름 읽기
  function circleRead(ctx) {
    const { a, b, r2 } = ctx;
    const r = rStr(r2);
    const say = (x, y, rr) => `중심 ${pt(x, y)}, 반지름 ${rr}`;
    const ans = say(a, b, r);
    return finish({
      kind: 'circleRead',
      question: `원 ${circleStr(a, b, r2)}의 중심과 반지름의 길이는?`,
      answer: ans,
      distractors: [say(-a, -b, r), say(a, b, String(r2)), say(-a, -b, String(r2)), say(b, a, r)],
      solution: `(x − a)² + (y − b)² = r² 꼴이므로 중심 ${pt(a, b)}, r² = ${r2} → r = ${r}`,
      diagram: { type: 'plane', points: [{ x: a, y: b, label: 'C' }], circles: [{ cx: a, cy: b, r: Math.sqrt(r2) }] },
      params: ctx,
    }, () => say(a, b, String(r2 + 1)));
  }

  // 원과 직선의 위치 관계: d 와 r 비교 (교과서 35~36쪽)
  const REL = ['서로 다른 두 점에서 만난다', '한 점에서 만난다 (접한다)', '만나지 않는다', '원의 중심을 지난다'];
  function circleLineRel(ctx) {
    const { dStr, d, r } = ctx;
    const ans = d < r - 1e-9 ? REL[0] : Math.abs(d - r) < 1e-9 ? REL[1] : REL[2];
    const sign = d < r - 1e-9 ? '<' : Math.abs(d - r) < 1e-9 ? '=' : '>';
    return finish({
      kind: 'circleLineRel',
      question: `원의 중심과 직선 사이의 거리 d = ${dStr}, 반지름 r = ${ctx.rStr || r}일 때, 원과 직선의 위치 관계는?`,
      answer: ans,
      distractors: REL.filter((x) => x !== ans),
      solution: `d ${sign} r 이므로 ${ans}`,
      diagram: ctx.diagram || null,
      params: ctx,
    }, () => REL[3]);
  }

  // 원 위의 점에서의 접선: 접선 ⊥ 반지름 → 기울기 (교과서 38쪽)
  function tangentSlope(ctx) {
    const { x1, y1, r2 } = ctx;
    const mOP = frac(y1, x1), ans = fracStr(frac(-x1, y1));
    return finish({
      kind: 'tangentSlope',
      question: `원 x² + y² = ${r2} 위의 점 P${pt(x1, y1)}에서의 접선은 반지름 OP에 수직이다. 반지름 OP의 기울기가 ${fracStr(mOP)}일 때, 접선의 기울기는?`,
      answer: ans,
      distractors: [fracStr(mOP), fracStr(frac(x1, y1)), fracStr(frac(-y1, x1))],
      solution: `수직 조건 m × m′ = ${M}1: ${fracStr(mOP)} × m′ = ${M}1 → m′ = ${ans}`,
      diagram: { type: 'plane', points: [{ x: x1, y: y1, label: 'P' }], circles: [{ cx: 0, cy: 0, r: Math.sqrt(r2) }], segments: [[0, 0, x1, y1]] },
      params: ctx,
    }, () => fracStr(frac(ri(-5, 5) || 2, ri(1, 4))));
  }

  // 원 위의 점에서의 접선의 방정식 x₁x + y₁y = r² (교과서 38쪽)
  function tangentLine(ctx) {
    const { x1, y1, r2 } = ctx;
    const eq = (a, b, c) => `${a === 1 ? '' : a === -1 ? M : num(a)}x ${b < 0 ? M : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}y = ${num(c)}`;
    const ans = eq(x1, y1, r2);
    return finish({
      kind: 'tangentLine',
      question: `원 x² + y² = ${r2} 위의 점 P${pt(x1, y1)}${eulReul(y1)} 지나고 기울기가 ${fracStr(frac(-x1, y1))}인 직선(접선)의 방정식은?`,
      answer: ans,
      distractors: [eq(x1, -y1, r2), eq(y1, x1, r2), eq(x1, y1, Math.round(Math.sqrt(r2))), eq(-x1, y1, r2)],
      solution: `${shift('y', y1)} = ${fracStr(frac(-x1, y1))}(${shift('x', x1)}) → 정리하면 ${ans}  (공식 x₁x + y₁y = r² 과 같다)`,
      diagram: { type: 'plane', points: [{ x: x1, y: y1, label: 'P' }], circles: [{ cx: 0, cy: 0, r: Math.sqrt(r2) }], lines: [{ m: frac(-x1, y1), n: r2 / y1 }] },
      params: ctx,
    }, () => eq(x1, y1, r2 + ri(1, 9)));
  }

  // 원 위의 점과 직선 사이 거리의 최댓값·최솟값: d + r, d − r (교과서 41쪽 07번)
  function distRange(ctx) {
    const { d, r } = ctx;
    const say = (mx, mn) => `최댓값 ${mx}, 최솟값 ${mn}`;
    const ans = say(d + r, d - r);
    return finish({
      kind: 'distRange',
      question: `원의 중심과 직선 사이의 거리가 d = ${d}, 반지름이 r = ${r}일 때, 원 위의 점과 직선 사이의 거리의 최댓값과 최솟값은?`,
      answer: ans,
      distractors: [say(d, d - r), say(d + r, d), say(d + 2 * r, 0), say(d + r, r)],
      solution: `가장 먼 점은 d + r = ${d} + ${r} = ${d + r}, 가장 가까운 점은 d − r = ${d} − ${r} = ${d - r}`,
      diagram: ctx.diagram || null,
      params: ctx,
    }, () => say(d + r + 1, d - r));
  }

  // ══ v1.0 테스트판: Ⅰ-1 보강 · Ⅰ-3 도형의 이동 · Ⅱ 집합과 명제 · Ⅲ 함수와 그래프 ═══════════

  // 분수 계수 직선 y = mx + c  (m, c 는 분수 객체)
  function linStr(mf, cf) {
    const c = cf.n / cf.d;
    if (mf.n === 0) return `y = ${fracStr(cf)}`;
    const tail = c === 0 ? '' : ` ${c < 0 ? M : '+'} ${fracStr(frac(Math.abs(cf.n), cf.d))}`;
    return `y = ${coefX(mf)}${tail}`;
  }
  const polyStr = (a, b) => (a === 0 ? num(b) : `${coefX(frac(a))}${constTail(b)}`);

  // 두 점을 지나는 직선 (교과서 11쪽 준비 학습, 기울기 → 한 점과 기울기)
  function line2pt(ctx = {}) {
    let { x1, y1, x2, y2 } = ctx;
    if (x1 == null) {
      do { x1 = ri(-4, 4); x2 = ri(-4, 4); } while (x1 === x2);
      y1 = ri(-4, 4);
      y2 = y1 + pick([-3, -2, -1, 1, 2, 3]) * (x2 - x1);
    }
    const dx = x2 - x1, dy = y2 - y1;
    const mf = frac(dy, dx), cf = frac(y1 * dx - dy * x1, dx);
    const ans = linStr(mf, cf);
    const wrong = [
      dy !== 0 ? linStr(frac(dx, dy), cf) : null, // 기울기 뒤집음
      linStr(mf, frac(-cf.n, cf.d)),
      linStr(frac(-mf.n, mf.d), cf),
      linStr(mf, frac(cf.n + cf.d, cf.d)),
    ];
    return finish({
      kind: 'line2pt',
      question: ctx.what || `두 점 A${pt(x1, y1)}, B${pt(x2, y2)}${eulReul(y2)} 지나는 직선의 방정식은?`,
      answer: ans,
      distractors: wrong,
      solution: `기울기 = (${num(y2)} ${M} ${par(y1)}) ÷ (${num(x2)} ${M} ${par(x1)}) = ${fracStr(mf)}.  ${shift('y', y1)} = ${fracStr(mf)}(${shift('x', x1)})  →  ${ans}`,
      diagram: { type: 'plane', points: [{ x: x1, y: y1, label: 'A' }, { x: x2, y: y2, label: 'B' }], lines: [{ m: mf, n: cf.n / cf.d }] },
      params: { x1, y1, x2, y2 },
    }, () => linStr(mf, frac(cf.n + ri(2, 5) * cf.d, cf.d)));
  }
  // 한 점과 분수 기울기 → 직선 (6층 대칭 사냥개)
  function lineThrough(ctx) {
    const { a, b, mf } = ctx;
    const cf = frac(b * mf.d - mf.n * a, mf.d);
    const ans = linStr(mf, cf);
    return finish({
      kind: 'lineThrough',
      question: ctx.what || `점 ${pt(a, b)}${eulReul(b)} 지나고 기울기가 ${fracStr(mf)}인 직선의 방정식은?`,
      answer: ans,
      distractors: [linStr(mf, frac(b * mf.d + mf.n * a, mf.d)), linStr(frac(-mf.n, mf.d), cf), linStr(mf, frac(a * mf.d - mf.n * b, mf.d)), linStr(mf, frac(cf.n + cf.d, cf.d))],
      solution: `${shift('y', b)} = ${fracStr(mf)}(${shift('x', a)})  →  ${ans}`,
      diagram: { type: 'plane', points: [{ x: a, y: b, label: 'P' }], lines: [{ m: mf, n: cf.n / cf.d }] },
      params: ctx,
    }, () => linStr(mf, frac(cf.n + ri(2, 5) * cf.d, cf.d)));
  }

  // ── Ⅰ-3 도형의 이동 (교과서 44~55쪽) ─────────────────────
  const moveTxt = (a, b) => `x축의 방향으로 ${num(a)}만큼, y축의 방향으로 ${num(b)}만큼`;
  function transPoint(ctx = {}) {
    let { x, y, a, b } = ctx;
    if (x == null) { x = ri(-5, 5); y = ri(-5, 5); do { a = ri(-4, 4); b = ri(-4, 4); } while (!a || !b || a === b); }
    const ans = pt(x + a, y + b);
    return finish({
      kind: 'transPoint',
      question: ctx.what || `점 ${pt(x, y)}${eulReul(y)} ${moveTxt(a, b)} 평행이동한 점의 좌표는?`,
      answer: ans,
      distractors: [pt(x - a, y - b), pt(x + b, y + a), pt(x + a, y - b), pt(x - a, y + b)],
      solution: `(x + a, y + b) = (${num(x)} + ${par(a)}, ${num(y)} + ${par(b)}) = ${ans}`,
      diagram: { type: 'plane', points: [{ x, y, label: ctx.label || 'P' }] },
      params: { x, y, a, b }, aim: { x: x + a, y: y + b, label: (ctx.label || 'P') + '′' },
    }, () => pt(x + a + ri(1, 3), y + b - ri(1, 3)));
  }
  function transCircle(ctx = {}) {
    let { cx, cy, r2, a, b } = ctx;
    if (cx == null) {
      cx = ri(-3, 3); cy = ri(-3, 3); r2 = pick([1, 4, 9, 2, 5]);
      do { a = ri(-4, 4); b = ri(-4, 4); } while (!a || !b || a === b);
    }
    const ans = circleStr(cx + a, cy + b, r2);
    return finish({
      kind: 'transCircle',
      question: `원 ${circleStr(cx, cy, r2)}${eulReul(r2)} ${moveTxt(a, b)} 평행이동한 원의 방정식은?`,
      answer: ans,
      distractors: [circleStr(cx - a, cy - b, r2), circleStr(cx + b, cy + a, r2), circleStr(cx + a, cy - b, r2), circleStr(cx - a, cy + b, r2)],
      solution: `x 대신 ${shift('x', a)}, y 대신 ${shift('y', b)}를 대입 (중심 ${pt(cx, cy)} → ${pt(cx + a, cy + b)})  →  ${ans}`,
      diagram: { type: 'plane', points: [{ x: cx, y: cy, label: 'C' }], circles: [{ cx, cy, r: Math.sqrt(r2) }] },
      params: { cx, cy, r2, a, b },
    }, () => circleStr(cx + a, cy + b, r2 + ri(2, 5)));
  }
  function transLine(ctx = {}) {
    let { A, B, C, a, b } = ctx;
    if (A == null) {
      A = pick([1, 2, 3]); B = pick([-4, -3, -2, -1, 1, 2, 3]); C = ri(-5, 5);
      do { a = ri(-4, 4); b = ri(-4, 4); } while (!a || !b || A * a + B * b === 0);
    }
    const C2 = C - A * a - B * b;
    const ans = lineGenStr(A, B, C2);
    return finish({
      kind: 'transLine',
      question: `직선 ${lineGenStr(A, B, C)}${C ? eulReul(C) : '을'} ${moveTxt(a, b)} 평행이동한 직선의 방정식은?`,
      answer: ans,
      distractors: [lineGenStr(A, B, C + A * a + B * b), lineGenStr(A, B, C - A * a + B * b), lineGenStr(A, B, C + A * a - B * b), lineGenStr(A, B, C)],
      solution: `x 대신 ${shift('x', a)}, y 대신 ${shift('y', b)}를 대입: ${num(A)}(${shift('x', a)}) + ${par(B)}(${shift('y', b)}) + ${par(C)} = 0  →  ${ans}`,
      diagram: null, params: { A, B, C, a, b },
    }, () => lineGenStr(A, B, C2 + ri(1, 4)));
  }
  const REFL = { x: 'x축', y: 'y축', o: '원점', yx: '직선 y = x' };
  const REFL_RULE = { x: '(x, −y): y좌표의 부호가 반대', y: '(−x, y): x좌표의 부호가 반대', o: '(−x, −y): 두 좌표의 부호가 모두 반대', yx: '(y, x): x좌표와 y좌표를 서로 바꿈' };
  const reflXY = (x, y, k) => (k === 'x' ? [x, -y] : k === 'y' ? [-x, y] : k === 'o' ? [-x, -y] : [y, x]);
  const eunNeun = (k) => (k === 'yx' ? '에' : '에');
  function reflPoint(ctx = {}) {
    let { x, y, k } = ctx;
    if (x == null) {
      do { x = ri(-6, 6); y = ri(-6, 6); } while (!x || !y || Math.abs(x) === Math.abs(y));
      k = pick(['x', 'y', 'o', 'yx']);
    }
    const [rx, ry] = reflXY(x, y, k);
    const ans = pt(rx, ry);
    const others = ['x', 'y', 'o', 'yx'].filter((q) => q !== k).map((q) => pt(...reflXY(x, y, q)));
    return finish({
      kind: 'reflPoint',
      question: ctx.what || `점 ${pt(x, y)}${eulReul(y)} ${REFL[k]}${eunNeun(k)} 대하여 대칭이동한 점의 좌표는?`,
      answer: ans,
      distractors: [...others, pt(-ry, -rx)],
      solution: `${REFL[k]} 대칭 → ${REFL_RULE[k]}.  ${pt(x, y)} → ${ans}`,
      diagram: { type: 'plane', points: [{ x, y, label: ctx.label || 'P' }] },
      params: { x, y, k }, aim: { x: rx, y: ry, label: (ctx.label || 'P') + '′' },
    }, () => pt(rx + ri(1, 2), ry - ri(1, 2)));
  }
  const REFL_SUB = { x: 'y 대신 −y', y: 'x 대신 −x', o: 'x 대신 −x, y 대신 −y', yx: 'x 대신 y, y 대신 x' };
  function reflCircle(ctx = {}) {
    let { cx, cy, r2, k } = ctx;
    if (cx == null) {
      do { cx = ri(-5, 5); cy = ri(-5, 5); } while (!cx || !cy || Math.abs(cx) === Math.abs(cy));
      r2 = pick([1, 4, 9, 16, 5]); k = pick(['x', 'y', 'o', 'yx']);
    }
    const [rx, ry] = reflXY(cx, cy, k);
    const ans = circleStr(rx, ry, r2);
    const others = ['x', 'y', 'o', 'yx'].filter((q) => q !== k).map((q) => circleStr(...reflXY(cx, cy, q), r2));
    return finish({
      kind: 'reflCircle',
      question: `원 ${circleStr(cx, cy, r2)}${eulReul(r2)} ${REFL[k]}에 대하여 대칭이동한 원의 방정식은?`,
      answer: ans,
      distractors: others,
      solution: `${REFL_SUB[k]}를 대입 (중심 ${pt(cx, cy)} → ${pt(rx, ry)})  →  ${ans}`,
      diagram: { type: 'plane', points: [{ x: cx, y: cy, label: 'C' }], circles: [{ cx, cy, r: Math.sqrt(r2) }] },
      params: { cx, cy, r2, k },
    }, () => circleStr(rx, ry, r2 + ri(1, 4)));
  }
  function reflLine(ctx = {}) {
    let { m, n, k } = ctx;
    if (m == null) { m = pick([-3, -2, 2, 3]); do n = ri(-5, 5); while (!n); k = pick(['x', 'y', 'o']); }
    const res = { x: [-m, -n], y: [-m, n], o: [m, -n] };
    const ans = lineStr(...res[k]);
    const others = Object.entries(res).filter(([q]) => q !== k).map(([, v]) => lineStr(...v));
    return finish({
      kind: 'reflLine',
      question: `직선 ${lineStr(m, n)}${eulReul(n)} ${REFL[k]}에 대하여 대칭이동한 직선의 방정식은?`,
      answer: ans,
      distractors: [...others, lineStr(m, n)],
      solution: `${REFL_SUB[k]}를 대입  →  ${ans}`,
      diagram: { type: 'plane', lines: [{ m: frac(m), n }], points: [] },
      params: { m, n, k },
    }, () => lineStr(res[k][0], res[k][1] + ri(1, 3)));
  }

  // ── Ⅱ 집합 (교과서 64~79쪽) ──────────────────────────────
  const setStr = (arr) => (arr.length ? `{${[...new Set(arr)].sort((p, q) => p - q).map(num).join(', ')}}` : '∅');
  const SET_OPS = {
    cap: { sym: 'A ∩ B', sol: 'A와 B에 공통으로 속하는 원소', f: (A, B) => A.filter((x) => B.includes(x)) },
    cup: { sym: 'A ∪ B', sol: 'A 또는 B에 속하는 원소', f: (A, B) => [...new Set([...A, ...B])] },
    diff: { sym: 'A − B', sol: 'A에는 속하지만 B에는 속하지 않는 원소', f: (A, B) => A.filter((x) => !B.includes(x)) },
    rdiff: { sym: 'B − A', sol: 'B에는 속하지만 A에는 속하지 않는 원소', f: (A, B) => B.filter((x) => !A.includes(x)) },
    complA: { sym: 'Aᶜ', sol: 'U의 원소 중 A에 속하지 않는 원소', f: (A, B, U) => U.filter((x) => !A.includes(x)) },
    complB: { sym: 'Bᶜ', sol: 'U의 원소 중 B에 속하지 않는 원소', f: (A, B, U) => U.filter((x) => !B.includes(x)) },
  };
  const randSub = (U, lo, hi) => shuffle(U).slice(0, ri(lo, hi));
  function setOp(ctx = {}) {
    let { A, B, U, op } = ctx;
    if (!A) {
      U = Array.from({ length: 10 }, (_, i) => i + 1);
      do { A = randSub(U, 3, 5); B = randSub(U, 3, 5); } while (!A.some((x) => B.includes(x)) || A.every((x) => B.includes(x)));
      op = pick(['cap', 'cup', 'diff', 'complA']);
    }
    const res = SET_OPS[op].f(A, B, U || []);
    const ans = setStr(res);
    const alts = Object.keys(SET_OPS).filter((k) => k !== op && (U || !k.startsWith('compl'))).map((k) => setStr(SET_OPS[k].f(A, B, U || [])));
    const intro = U ? `전체집합 U = ${setStr(U)}의 두 부분집합 A = ${setStr(A)}, B = ${setStr(B)}에 대하여` : `두 집합 A = ${setStr(A)}, B = ${setStr(B)}에 대하여`;
    const pool = U || [...new Set([...A, ...B, 4, 8])];
    return finish({
      kind: 'setOp',
      question: `${intro} ${SET_OPS[op].sym}는?`,
      answer: ans,
      distractors: alts,
      solution: `${SET_OPS[op].sym}: ${SET_OPS[op].sol} → ${ans}`,
      diagram: { type: 'venn', A, B, U, shade: op },
      params: { A, B, U, op },
    }, () => setStr(res.length > 1 && Math.random() < 0.5 ? res.slice(1) : [...res, pick(pool)]));
  }
  // n(A ∩ B) = n(A) + n(B) − n(A ∪ B)
  function countCap(ctx = {}) {
    let { nA, nB, nAB } = ctx;
    if (nA == null) { nA = ri(8, 25); nB = ri(6, 20); nAB = nA + nB - ri(1, Math.min(nA, nB) - 1); }
    const ans = nA + nB - nAB;
    return finish({
      kind: 'countCap',
      question: ctx.what || `두 집합 A, B에 대하여 n(A) = ${nA}, n(B) = ${nB}, n(A ∪ B) = ${nAB}일 때, n(A ∩ B)는?`,
      answer: String(ans),
      distractors: [nA + nB + nAB, nAB - nA, nAB - nB, ans + 1, ans - 1, nA + nB].filter((v) => v > 0 && v !== ans).map(String),
      solution: `n(A ∪ B) = n(A) + n(B) − n(A ∩ B) → ${nAB} = ${nA} + ${nB} − n(A ∩ B) → n(A ∩ B) = ${ans}`,
      diagram: { type: 'venn', counts: { A: nA, B: nB } }, params: { nA, nB, nAB },
    }, () => String(ans + ri(2, 6)));
  }
  function countCup(ctx = {}) {
    let { nA, nB, nC } = ctx;
    if (nA == null) { nA = ri(5, 20); nB = ri(5, 20); nC = ri(1, Math.min(nA, nB) - 1); }
    const ans = nA + nB - nC;
    return finish({
      kind: 'countCup',
      question: `두 집합 A, B에 대하여 n(A) = ${nA}, n(B) = ${nB}, n(A ∩ B) = ${nC}일 때, n(A ∪ B)는?`,
      answer: String(ans),
      distractors: [nA + nB, nA + nB + nC, nA + nB - 2 * nC, ans + 1].filter((v) => v > 0 && v !== ans).map(String),
      solution: `n(A ∪ B) = n(A) + n(B) − n(A ∩ B) = ${nA} + ${nB} − ${nC} = ${ans}`,
      diagram: { type: 'venn', counts: { A: nA, B: nB } }, params: { nA, nB, nC },
    }, () => String(ans + ri(2, 6)));
  }
  const DM = [['Aᶜ ∪ Bᶜ', '(A ∩ B)ᶜ', 'capC'], ['Aᶜ ∩ Bᶜ', '(A ∪ B)ᶜ', 'cupC']];
  function deMorganQ(ctx = {}) {
    const k = ctx.k != null ? ctx.k : ri(0, 1);
    const [q, a, shade] = DM[k];
    return finish({
      kind: 'deMorgan',
      question: `전체집합 U의 두 부분집합 A, B에 대하여 ${q}와 같은 집합은?`,
      answer: a,
      distractors: ['(A ∩ B)ᶜ', '(A ∪ B)ᶜ', 'A ∩ B', 'A ∪ B', 'A − B'].filter((x) => x !== a),
      solution: `드모르간의 법칙: (A ∪ B)ᶜ = Aᶜ ∩ Bᶜ, (A ∩ B)ᶜ = Aᶜ ∪ Bᶜ  →  ${q} = ${a}`,
      diagram: { type: 'venn', shade }, params: { k },
    }, () => 'B − A');
  }
  function complCount(ctx = {}) {
    let { nU, nX, X } = ctx;
    if (nU == null) { nU = ri(20, 50); nX = ri(3, nU - 5); X = pick(['A', 'A ∩ B', 'A ∪ B']); }
    const ans = nU - nX;
    return finish({
      kind: 'complCount',
      question: ctx.what || `n(U) = ${nU}, n(${X}) = ${nX}일 때, n((${X})ᶜ)는?`,
      answer: String(ans),
      distractors: [nU + nX, nX, ans + 1, ans - 1, nU].filter((v) => v > 0 && v !== ans).map(String),
      solution: `n(Xᶜ) = n(U) − n(X) = ${nU} − ${nX} = ${ans}`,
      diagram: null, params: { nU, nX, X },
    }, () => String(ans + ri(2, 6)));
  }

  // ── Ⅱ 명제 (교과서 82~97쪽) ──────────────────────────────
  const NEG_REL = { '≥': '<', '>': '≤', '≤': '>', '<': '≥' };
  function negCond(ctx = {}) {
    let { rel, k } = ctx;
    if (!rel) { rel = pick(['≥', '>', '≤', '<']); k = ri(-5, 9); }
    const ans = `~p: x ${NEG_REL[rel]} ${num(k)}`;
    return finish({
      kind: 'negCond',
      question: `조건 p: x ${rel} ${num(k)}의 부정 ~p는?`,
      answer: ans,
      distractors: ['≥', '>', '≤', '<'].filter((r) => r !== NEG_REL[rel]).map((r) => `~p: x ${r} ${num(k)}`),
      solution: `'x ${rel} ${num(k)}'가 아니다 → x ${NEG_REL[rel]} ${num(k)} (등호가 붙는지 주의)`,
      diagram: null, params: { rel, k },
    }, () => `~p: x ${NEG_REL[rel]} ${num(k + 1)}`);
  }
  // 전체집합 U에서 ~p의 진리집합 = Pᶜ
  function negTruthSet(ctx = {}) {
    let { U, rel, k } = ctx;
    if (!U) { const s = pick([1, 2]); U = Array.from({ length: 5 }, (_, i) => s + 2 * i); rel = pick(['≥', '>', '≤', '<']); k = pick(U.slice(1, 4)); }
    const test = { '≥': (x) => x >= k, '>': (x) => x > k, '≤': (x) => x <= k, '<': (x) => x < k }[rel];
    const P = U.filter(test), ans = setStr(U.filter((x) => !test(x)));
    return finish({
      kind: 'negTruthSet',
      question: `전체집합 U = ${setStr(U)}에서 조건 p: x ${rel} ${num(k)}에 대하여 ~p의 진리집합은?`,
      answer: ans,
      distractors: [setStr(P), setStr([...U.filter((x) => !test(x)), k]), setStr(U.filter((x) => !test(x) && x !== k)), setStr(U)],
      solution: `P = ${setStr(P)} 이므로 ~p 의 진리집합은 Pᶜ = ${ans}`,
      diagram: { type: 'venn', A: P, U, single: true, shade: 'complA', labels: ['P'] }, params: { U, rel, k },
    }, () => setStr(U.slice(0, ri(1, 3))));
  }
  const TRUTH = [
    { s: 'x − 1 = 0이면 x² = x이다.', ok: true, why: 'P = {1}, Q = {0, 1} 에서 P ⊂ Q 이므로 참' },
    { s: '소수는 홀수이다.', ok: false, why: '2는 소수이지만 홀수가 아니다 (반례). P ⊄ Q 이므로 거짓' },
    { s: 'x ≤ 6이면 x² ≤ 36이다.', ok: false, why: 'x = −7 이면 x ≤ 6 이지만 x² = 49 (반례). 거짓' },
    { s: '4의 약수는 8의 약수이다.', ok: true, why: 'P = {1, 2, 4}, Q = {1, 2, 4, 8} 에서 P ⊂ Q 이므로 참' },
    { s: 'x = 2이면 x² = 4이다.', ok: true, why: 'P = {2}, Q = {−2, 2} 에서 P ⊂ Q 이므로 참' },
    { s: 'x² = 4이면 x = 2이다.', ok: false, why: 'x = −2 (반례). P = {−2, 2} ⊄ Q = {2} 이므로 거짓' },
  ];
  const T_YES = '참 (P ⊂ Q)', T_NO = '거짓 (반례가 있다)';
  function truthJudge(ctx = {}) {
    const i = ctx.i != null ? ctx.i : ri(0, TRUTH.length - 1);
    const t = TRUTH[i];
    return finish({
      kind: 'truthJudge',
      question: `명제 '${t.s}'의 참, 거짓은? (진리집합 P, Q로 판별)`,
      answer: t.ok ? T_YES : T_NO,
      distractors: [T_YES, T_NO, '명제가 아니다', '참도 거짓도 될 수 있다'],
      solution: t.why, diagram: null, params: { i },
    }, () => '알 수 없다');
  }
  const CONTRA = [
    { s: '자연수 n에 대하여 n²이 짝수이면 n도 짝수이다', c: 'n이 홀수이면 n²도 홀수이다', conv: 'n이 짝수이면 n²도 짝수이다', inv: 'n²이 홀수이면 n도 홀수이다', x: 'n²이 짝수이면 n은 홀수이다' },
    { s: 'x = 1이면 x² = 1이다', c: 'x² ≠ 1이면 x ≠ 1이다', conv: 'x² = 1이면 x = 1이다', inv: 'x ≠ 1이면 x² ≠ 1이다', x: 'x = 1이면 x² ≠ 1이다' },
    { s: 'a = b이면 a² = b²이다', c: 'a² ≠ b²이면 a ≠ b이다', conv: 'a² = b²이면 a = b이다', inv: 'a ≠ b이면 a² ≠ b²이다', x: 'a² ≠ b²이면 a = b이다' },
    { s: '자연수 n에 대하여 n²이 3의 배수이면 n도 3의 배수이다', c: 'n이 3의 배수가 아니면 n²도 3의 배수가 아니다', conv: 'n이 3의 배수이면 n²도 3의 배수이다', inv: 'n²이 3의 배수가 아니면 n도 3의 배수가 아니다', x: 'n이 3의 배수가 아니면 n²은 3의 배수이다' },
  ];
  function contraQ(ctx = {}) {
    const i = ctx.i != null ? ctx.i : ri(0, CONTRA.length - 1);
    const t = CONTRA[i];
    return finish({
      kind: 'contra',
      question: `명제 '${t.s}'의 대우는?`,
      answer: t.c,
      distractors: [t.conv, t.inv, t.x],
      solution: `대우: 가정과 결론을 각각 부정하고 서로 바꾼다 (~q ⇒ ~p) → '${t.c}'. ('${t.conv}'는 역)`,
      diagram: null, params: { i },
    }, () => t.s);
  }
  const SN_CH = ['충분조건 (필요조건은 아님)', '필요조건 (충분조건은 아님)', '필요충분조건', '충분조건도 필요조건도 아님'];
  const SN = [
    { p: 'x는 3의 배수이다', q: 'x는 9의 배수이다', a: 1, why: 'P = {3, 6, 9, …}, Q = {9, 18, 27, …} 에서 Q ⊂ P, P ⊄ Q → 필요조건' },
    { p: 'x² ≤ 25', q: '|x| ≤ 5', a: 2, why: 'P = Q = {x | −5 ≤ x ≤ 5} → 필요충분조건' },
    { p: 'a = 0이고 b = 0', q: 'ab = 0', a: 0, why: 'p ⇒ q 는 참, q ⇒ p 는 거짓 (a = 0, b = 1) → 충분조건' },
    { p: 'x = 2', q: 'x² = 4', a: 0, why: 'P = {2} ⊂ Q = {−2, 2}, Q ⊄ P → 충분조건' },
    { p: 'x는 2의 배수이다', q: 'x는 4의 배수이다', a: 1, why: 'Q ⊂ P, P ⊄ Q → 필요조건' },
    { p: 'x는 짝수이다', q: 'x는 2의 배수이다', a: 2, why: 'P = Q → 필요충분조건' },
  ];
  function suffNecQ(ctx = {}) {
    const i = ctx.i != null ? ctx.i : ri(0, SN.length - 1);
    const t = SN[i];
    return finish({
      kind: 'suffNec',
      question: `두 조건 p: ${t.p}, q: ${t.q}에 대하여 p는 q이기 위한 어떤 조건인가?`,
      answer: SN_CH[t.a],
      distractors: SN_CH,
      solution: t.why, diagram: null, params: { i },
    }, () => '알 수 없다');
  }
  const ABS = [
    { s: 'a² + b² ≥ ab', eq: 'a = b = 0', why: 'a² − ab + b² = (a − b/2)² + 3b²/4 ≥ 0. 등호는 a − b/2 = 0 이고 b = 0, 즉 a = b = 0', wrong: ['a = b', 'a = −b', 'a = 0 또는 b = 0'] },
    { s: '(a + b)/2 ≥ √(ab) (a > 0, b > 0)', eq: 'a = b', why: '(a + b)/2 − √(ab) = (√a − √b)²/2 ≥ 0. 등호는 √a = √b, 즉 a = b', wrong: ['a = b = 0', 'a = 2b', 'a + b = 1'] },
    { s: 'a + 1/a ≥ 2 (a > 0)', eq: 'a = 1', why: 'a + 1/a ≥ 2√(a × 1/a) = 2. 등호는 a = 1/a, 즉 a = 1', wrong: ['a = 2', 'a = 1/2', 'a = 0'] },
    { s: '(a + b)² ≥ 4ab', eq: 'a = b', why: '(a + b)² − 4ab = (a − b)² ≥ 0. 등호는 a = b', wrong: ['a = b = 0', 'a = −b', 'a = 2b'] },
  ];
  function absIneqQ(ctx = {}) {
    const i = ctx.i != null ? ctx.i : ri(0, ABS.length - 1);
    const t = ABS[i];
    return finish({
      kind: 'absIneq',
      question: `실수 a, b에 대한 절대부등식 ${t.s}에서 등호가 성립할 조건은?`,
      answer: t.eq, distractors: t.wrong, solution: t.why, diagram: null, params: { i },
    }, () => '항상 성립');
  }

  // ── Ⅲ 함수 (교과서 106~119쪽) ────────────────────────────
  // 함수: { k: 'lin', a, b } = ax + b,  { k: 'sq', a, c } = ax² + c
  const fnEval = (f, x) => (f.k === 'sq' ? f.a * x * x + f.c : f.a * x + f.b);
  const fnStr = (f) => (f.k === 'sq' ? `${f.a === 1 ? '' : f.a === -1 ? M : num(f.a)}x²${constTail(f.c)}` : polyStr(f.a, f.b));
  function funcValue(ctx = {}) {
    let { a, b, x } = ctx;
    if (a == null) { a = pick([-3, -2, 2, 3, 4]); b = ri(-6, 6); x = ri(-4, 4); }
    const v = a * x + b;
    return finish({
      kind: 'funcValue',
      question: `함수 f(x) = ${polyStr(a, b)}에 대하여 f(${num(x)})의 값은?`,
      answer: num(v),
      distractors: [a * -x + b, a + x + b, a * x - b, v + 1, v - 1].filter((t) => t !== v).map(num),
      solution: `x = ${num(x)} 을 대입: ${num(a)} × ${par(x)} + ${par(b)} = ${num(v)}`,
      diagram: null, params: { a, b, x },
    }, () => num(v + ri(2, 6)));
  }
  function composeVal(ctx = {}) {
    let { f, g, x, order } = ctx;
    if (!f) {
      f = { k: 'lin', a: pick([-2, 2, 3]), b: ri(-3, 3) };
      g = Math.random() < 0.5 ? { k: 'sq', a: 1, c: ri(-3, 3) } : { k: 'lin', a: pick([-3, 2, 4]), b: ri(-4, 4) };
      x = ri(-3, 3); order = pick(['gf', 'fg']);
    }
    const inner = order === 'gf' ? f : g, outer = order === 'gf' ? g : f;
    const mid = fnEval(inner, x), v = fnEval(outer, mid);
    const other = fnEval(inner, fnEval(outer, x));
    const name = order === 'gf' ? 'g∘f' : 'f∘g';
    return finish({
      kind: 'composeVal',
      question: `두 함수 f(x) = ${fnStr(f)}, g(x) = ${fnStr(g)}에 대하여 (${name})(${num(x)})의 값은?`,
      answer: num(v),
      distractors: [other, mid, fnEval(outer, x), v + 1].filter((t) => t !== v).map(num),
      solution: `(${name})(${num(x)}) = ${order === 'gf' ? 'g(f' : 'f(g'}(${num(x)})) = ${order === 'gf' ? 'g' : 'f'}(${num(mid)}) = ${num(v)}`,
      diagram: null, params: { f, g, x, order },
    }, () => num(v + ri(2, 6)));
  }
  function composeExpr(ctx = {}) {
    let { f, g, order } = ctx; // f = [a, b], g = [c, d] (일차함수)
    if (!f) {
      do { f = [pick([-2, -1, 2, 3]), ri(-4, 4)]; g = [pick([-3, 2, 4]), ri(-4, 4)]; } while (g[0] * f[1] + g[1] === f[0] * g[1] + f[1]);
      order = pick(['gf', 'fg']);
    }
    const gf = [g[0] * f[0], g[0] * f[1] + g[1]], fg = [f[0] * g[0], f[0] * g[1] + f[1]];
    const ans = order === 'gf' ? gf : fg, other = order === 'gf' ? fg : gf;
    const name = order === 'gf' ? 'g∘f' : 'f∘g';
    const inner = order === 'gf' ? 'f' : 'g', outer = order === 'gf' ? 'g' : 'f';
    return finish({
      kind: 'composeExpr',
      question: `두 함수 f(x) = ${polyStr(...f)}, g(x) = ${polyStr(...g)}에 대하여 (${name})(x)는?`,
      answer: `(${name})(x) = ${polyStr(...ans)}`,
      distractors: [`(${name})(x) = ${polyStr(...other)}`, `(${name})(x) = ${polyStr(f[0] + g[0], f[1] + g[1])}`, `(${name})(x) = ${polyStr(ans[0], -ans[1])}`, `(${name})(x) = ${polyStr(-ans[0], ans[1])}`],
      solution: `(${name})(x) = ${outer}(${inner}(x)) = ${outer}(${polyStr(...(order === 'gf' ? f : g))}) = ${polyStr(...ans)}  (f 먼저 대입하는지 순서 주의!)`,
      diagram: null, params: { f, g, order },
    }, () => `(${name})(x) = ${polyStr(ans[0], ans[1] + ri(2, 5))}`);
  }
  function inverseLin(ctx = {}) {
    let { a, b } = ctx;
    if (a == null) { a = pick([-4, -3, -2, 2, 3, 4, 5]); do b = ri(-6, 6); while (!b); }
    const ans = linStr(frac(1, a), frac(-b, a));
    return finish({
      kind: 'inverseLin',
      question: `함수 y = ${polyStr(a, b)}의 역함수는?`,
      answer: ans,
      distractors: [linStr(frac(1, a), frac(b, a)), linStr(frac(-1, a), frac(-b, a)), linStr(frac(a), frac(-b)), linStr(frac(1, a), frac(-b))],
      solution: `x에 대해 풀면 x = ${linStr(frac(1, a), frac(-b, a)).replace('y = ', '').replace(/x/g, 'y')}, x와 y를 바꾸면 ${ans}`,
      diagram: { type: 'plane', lines: [{ m: frac(a), n: b }, { m: frac(1, a), n: -b / a }], points: [] },
      params: { a, b },
    }, () => linStr(frac(1, a), frac(-b + ri(1, 3) * a, a)));
  }
  const OTO_CH = ['일대일대응이다', '일대일함수가 아니다', '상수함수이다', '함수가 아니다'];
  const OTO = [
    { f: 'y = 3x + 4', a: 0, why: 'x₁ ≠ x₂ 이면 3x₁ + 4 ≠ 3x₂ + 4 (일대일함수), 치역 = 공역 = 실수 전체 → 일대일대응' },
    { f: 'y = x²', a: 1, why: '−1 ≠ 1 이지만 f(−1) = f(1) = 1 → 일대일함수가 아니다' },
    { f: 'y = −2x + 1', a: 0, why: '기울기가 0이 아닌 일차함수: 일대일함수이고 치역 = 공역 → 일대일대응' },
    { f: 'y = |x|', a: 1, why: 'f(−1) = f(1) = 1 → 일대일함수가 아니다' },
    { f: 'y = 5', a: 2, why: '모든 x에 같은 값 5가 대응 → 상수함수' },
    { f: 'y = −x² + 2', a: 1, why: 'f(−1) = f(1) = 1 → 일대일함수가 아니다' },
  ];
  function oneToOneQ(ctx = {}) {
    const i = ctx.i != null ? ctx.i : ri(0, OTO.length - 1);
    const t = OTO[i];
    return finish({
      kind: 'oneToOne',
      question: `실수 전체에서 정의된 함수 ${t.f}에 대한 설명으로 옳은 것은?`,
      answer: OTO_CH[t.a], distractors: OTO_CH, solution: t.why, diagram: null, params: { i },
    }, () => '알 수 없다');
  }
  function invPoint(ctx = {}) {
    let { a, b, f } = ctx;
    if (a == null) { do { a = ri(-5, 5); b = ri(-5, 5); } while (a === b || !a || !b || a === -b); }
    const ans = pt(b, a);
    return finish({
      kind: 'invPoint',
      question: ctx.what || `함수 y = f(x)${f ? ` = ${f}` : ''}의 그래프가 점 ${pt(a, b)}${eulReul(b)} 지날 때, 역함수 y = f⁻¹(x)의 그래프가 반드시 지나는 점은?`,
      answer: ans,
      distractors: [pt(-a, -b), pt(a, -b), pt(-b, -a), pt(-a, b), pt(a, b)],
      solution: `b = f(a) ⇔ a = f⁻¹(b): 점 (a, b)를 직선 y = x 에 대하여 대칭이동하면 (b, a) → ${ans}`,
      diagram: { type: 'plane', points: [{ x: a, y: b, label: 'P' }], lines: [{ m: frac(1), n: 0 }] },
      params: { a, b, f }, aim: { x: b, y: a, label: 'P′' },
    }, () => pt(b + ri(1, 3), a));
  }
  // ── Ⅲ 유리함수·무리함수 (교과서 122~134쪽) ───────────────────
  const ratStr = (k, p, q) => `y = ${k < 0 ? M : ''}${Math.abs(k)}/(${shift('x', p)})${constTail(q)}`;
  function rationalShift(ctx = {}) {
    let { k, p, q } = ctx;
    if (k == null) { k = pick([-6, -3, -2, -1, 1, 2, 3, 4]); do { p = ri(-4, 4); q = ri(-4, 4); } while (!p || !q || p === q); }
    return finish({
      kind: 'rationalShift',
      question: `함수 y = ${k < 0 ? M : ''}${Math.abs(k)}/x의 그래프를 ${moveTxt(p, q)} 평행이동한 그래프의 식은?`,
      answer: ratStr(k, p, q),
      distractors: [ratStr(k, -p, q), ratStr(k, p, -q), ratStr(k, q, p), ratStr(-k, p, q)],
      solution: `x 대신 ${shift('x', p)}, y 대신 ${shift('y', q)}를 대입 → ${ratStr(k, p, q)}`,
      diagram: { type: 'plane', curves: [{ f: (x) => k / (x - p) + q, asym: [p, q] }], points: [] },
      params: { k, p, q },
    }, () => ratStr(k + 1, p, q));
  }
  function rationalAsym(ctx = {}) {
    let { k, p, q } = ctx;
    if (k == null) { k = pick([-6, -3, -2, -1, 1, 2, 3, 4]); do { p = ri(-4, 4); q = ri(-4, 4); } while (!p || !q || p === q || p === -q); }
    const say = (a, b) => `x = ${num(a)}, y = ${num(b)}`;
    return finish({
      kind: 'rationalAsym',
      question: ctx.what || `함수 ${ratStr(k, p, q)}의 그래프의 점근선은?`,
      answer: say(p, q),
      distractors: [say(q, p), say(-p, q), say(p, -q), say(-p, -q)],
      solution: `y = k/(x − p) + q 의 점근선은 두 직선 x = p, y = q → ${say(p, q)}`,
      diagram: { type: 'plane', curves: [{ f: (x) => k / (x - p) + q, asym: [p, q] }], points: [] },
      params: { k, p, q },
    }, () => say(p + 1, q));
  }
  // y = (ax + b)/(x + d) → y = (b − ad)/(x + d) + a
  function rationalForm(ctx = {}) {
    let { a, b, d } = ctx;
    if (a == null) { do { a = pick([-3, -2, 1, 2, 3]); b = ri(-5, 5); d = pick([-3, -2, -1, 1, 2, 3]); } while (b - a * d === 0); }
    const k = b - a * d, ans = ratStr(k, -d, a);
    return finish({
      kind: 'rationalForm',
      question: `함수 y = (${polyStr(a, b)})/(${shift('x', -d)})를 y = k/(x − p) + q 꼴로 나타내면?`,
      answer: ans,
      distractors: [ratStr(b + a * d, -d, a), ratStr(k, d, a), ratStr(k, -d, -a), ratStr(b, -d, a)],
      solution: `${polyStr(a, b)} = ${num(a)}(${shift('x', -d)}) ${k < 0 ? M : '+'} ${Math.abs(k)} 이므로 → ${ans}`,
      diagram: { type: 'plane', curves: [{ f: (x) => k / (x + d) + a, asym: [-d, a] }], points: [] },
      params: { a, b, d },
    }, () => ratStr(k + 2, -d, a));
  }
  // y = k/(x − p) + q 의 역함수 y = k/(x − q) + p: 점근선 x = q, y = p
  function invAsym(ctx = {}) {
    let { k, p, q } = ctx;
    if (k == null) { k = pick([-3, -2, 2, 3]); do { p = ri(-4, 4); q = ri(-4, 4); } while (!p || !q || p === q || p === -q); }
    const say = (a, b) => `x = ${num(a)}, y = ${num(b)}`;
    return finish({
      kind: 'invAsym',
      question: `함수 ${ratStr(k, p, q)}의 역함수의 그래프의 점근선은?`,
      answer: say(q, p),
      distractors: [say(p, q), say(-q, -p), say(-p, -q), say(q, -p)],
      solution: `역함수의 그래프는 직선 y = x 에 대하여 대칭 → 점근선 x = ${num(p)}, y = ${num(q)} 도 바뀌어 ${say(q, p)}`,
      diagram: { type: 'plane', curves: [{ f: (x) => k / (x - p) + q, asym: [p, q] }, { f: (x) => k / (x - q) + p, asym: [q, p], color: '#7df9ff' }], lines: [{ m: frac(1), n: 0 }], points: [] },
      params: { k, p, q },
    }, () => say(q + 1, p));
  }
  const radStr = (a, p, q) => `y = √(${a === 1 ? '' : a === -1 ? M : num(a)}${p === 0 ? 'x' : `(${shift('x', p)})`})${constTail(q)}`;
  function radicalForm(ctx = {}) {
    let { a, p, q } = ctx;
    if (a == null) { a = pick([-3, -2, 2, 3]); do { p = ri(-4, 4); q = ri(-4, 4); } while (!p || !q || p === q); }
    const ans = radStr(a, p, q);
    return finish({
      kind: 'radicalForm',
      question: `함수 y = √(${polyStr(a, -a * p)})${constTail(q)}를 y = √(a(x − p)) + q 꼴로 나타내면?`,
      answer: ans,
      distractors: [radStr(a, -p, q), radStr(a, -a * p, q), radStr(a, p, -q), radStr(-a, p, q)],
      solution: `근호 안을 a로 묶는다: ${polyStr(a, -a * p)} = ${num(a)}(${shift('x', p)}) → ${ans}`,
      diagram: { type: 'plane', curves: [{ f: (x) => (a * (x - p) >= 0 ? Math.sqrt(a * (x - p)) + q : NaN) }], points: [{ x: p, y: q, label: '시작' }] },
      params: { a, p, q },
    }, () => radStr(a, p + 1, q));
  }
  function radicalDomain(ctx = {}) {
    let { a, p, q } = ctx;
    if (a == null) { a = pick([-3, -2, 2, 3]); do { p = ri(-4, 4); q = ri(-4, 4); } while (!p || !q || p === q || p === -q); }
    const xs = a > 0 ? '≥' : '≤';
    const say = (rel, x, y) => `정의역 {x | x ${rel} ${num(x)}}, 치역 {y | y ≥ ${num(y)}}`;
    return finish({
      kind: 'radicalDomain',
      question: `함수 ${radStr(a, p, q)}의 정의역과 치역은?`,
      answer: say(xs, p, q),
      distractors: [say(xs, q, p), say(xs === '≥' ? '≤' : '≥', p, q), say(xs, -p, q), say(xs, p, -q)],
      solution: `근호 안 ${num(a)}(${shift('x', p)}) ≥ 0 → x ${xs} ${num(p)},  √ ≥ 0 이므로 y ≥ ${num(q)} (시작점 ${pt(p, q)})`,
      diagram: { type: 'plane', curves: [{ f: (x) => (a * (x - p) >= 0 ? Math.sqrt(a * (x - p)) + q : NaN) }], points: [{ x: p, y: q, label: '시작' }] },
      params: { a, p, q },
    }, () => say(xs, p + 1, q));
  }

  // ── 연습 문제: 매직·레어 카드를 처음 두 번 쓸 때 (무작위 숫자) ───────────
  const circleRand = () => { const a = ri(-4, 4), b = ri(-4, 4); return circleEq({ a, b, r2: pick([1, 4, 9, 16, 25, 2, 5]) }); };
  const csRand = () => {
    let A, B, C;
    do { A = 2 * ri(-4, 4); B = 2 * ri(-4, 4); C = ri(-12, 6); } while (!A || !B || (A * A + B * B) / 4 - C <= 0);
    return completeSquare({ A, B, C });
  };
  const relRand = () => {
    const d = ri(1, 6), r = ri(1, 6);
    return circleLineRel({ dStr: String(d), d, r });
  };
  const PRACTICE = {
    divide: () => divide(), dist: () => dist2D(), para: () => parallel(), perp: () => perpSlope({ lineName: '직선' }),
    line: () => (Math.random() < 0.5 ? lineEq() : line2pt()), completeSq: csRand, circle: circleRand,
    ptLine: () => ptLineDist(), posRel: relRand,
    transPt: () => transPoint(), transFig: () => (Math.random() < 0.5 ? transCircle() : transLine()),
    reflPt: () => reflPoint(), reflFig: () => (Math.random() < 0.5 ? reflCircle() : reflLine()),
    countU: () => (Math.random() < 0.5 ? countCap() : countCup()), truth: () => truthJudge(), contra: () => contraQ(),
    suffNec: () => suffNecQ(), deMorgan: () => deMorganQ(), absIneq: () => absIneqQ(),
    compose: () => (Math.random() < 0.5 ? composeVal() : composeExpr()), inverse: () => inverseLin(), invGraph: () => (Math.random() < 0.5 ? invPoint() : invAsym()),
    rational: () => pick([rationalShift, rationalAsym, rationalForm])(), radical: () => (Math.random() < 0.5 ? radicalForm() : radicalDomain()),
  };

  // ── 보물상자 자물쇠: 정답이 정수인 주관식 (다이얼로 입력) ───────────────
  // { question, answer(정수), solution, figure? }
  function chestQuestion(dim) {
    const pool = {
      1: [
        () => {
          const [p, q] = pick([[3, 4], [6, 8], [5, 12], [8, 6], [9, 12]]);
          const x1 = ri(-3, 3), y1 = ri(-3, 3), x2 = x1 + p * pick([1, -1]), y2 = y1 + q * pick([1, -1]);
          return { question: `보물은 두 표식 A${pt(x1, y1)}, B${pt(x2, y2)} 사이에 묻혀 있다. 자물쇠의 번호는 두 점 사이의 거리 AB.`, answer: Math.hypot(p, q), solution: `√(${p}² + ${q}²) = ${Math.hypot(p, q)}`, pts: [[x1, y1, 'A'], [x2, y2, 'B']] };
        },
        () => {
          let x1, x2, m, n;
          do { x1 = ri(-8, 8); x2 = ri(-8, 8); m = ri(1, 4); n = ri(1, 4); } while (x1 === x2 || m === n || (m * x2 + n * x1) % (m + n));
          const v = (m * x2 + n * x1) / (m + n);
          return { question: `수직선 위 두 점 A(${num(x1)}), B(${num(x2)})를 ${m} : ${n}${euroRo(n)} 내분하는 점에 보물이 있다. 자물쇠 번호는 그 점의 좌표.`, answer: v, solution: `(${m}×${par(x2)} + ${n}×${par(x1)}) ÷ ${m + n} = ${num(v)}` };
        },
        () => {
          let A, B, C;
          do { A = 2 * ri(-4, 4); B = 2 * ri(-4, 4); C = ri(-12, 4); } while (!A || !B || (A * A + B * B) / 4 - C <= 0);
          const r2 = (A * A + B * B) / 4 - C;
          return { question: `원 ${genCircleStr(A, B, C)}의 반지름을 r이라 할 때, 자물쇠 번호는 r².`, answer: r2, solution: `완전제곱: (A/2)² + (B/2)² − C = ${(A * A) / 4} + ${(B * B) / 4} − ${par(C)} = ${r2}` };
        },
        () => {
          const x = ri(-5, 5), y = ri(-5, 5), a = ri(-4, 4) || 2, b = ri(-4, 4) || -3;
          return { question: `점 ${pt(x, y)}${eulReul(y)} ${moveTxt(a, b)} 평행이동한 점을 (p, q)라 할 때, 자물쇠 번호는 p + q.`, answer: x + a + y + b, solution: `(${num(x + a)}, ${num(y + b)}) → ${num(x + a)} + ${par(y + b)} = ${num(x + a + y + b)}` };
        },
        () => {
          let x, y;
          do { x = ri(-6, 6); y = ri(-6, 6); } while (!x || !y);
          const k = pick(['x', 'y', 'o']);
          const [rx, ry] = reflXY(x, y, k);
          return { question: `점 ${pt(x, y)}${eulReul(y)} ${REFL[k]}에 대하여 대칭이동한 점을 (p, q)라 할 때, 자물쇠 번호는 p − q.`, answer: rx - ry, solution: `${REFL_RULE[k]} → ${pt(rx, ry)}, ${num(rx)} − ${par(ry)} = ${num(rx - ry)}` };
        },
      ],
      2: [
        () => { const nA = ri(5, 20), nB = ri(5, 20), nC = ri(1, 4); return { question: `n(A) = ${nA}, n(B) = ${nB}, n(A ∩ B) = ${nC}. 자물쇠 번호는 n(A ∪ B).`, answer: nA + nB - nC, solution: `${nA} + ${nB} − ${nC} = ${nA + nB - nC}` }; },
        () => { const nU = ri(20, 40), nA = ri(5, 15); return { question: `n(U) = ${nU}, n(A) = ${nA}. 자물쇠 번호는 n(Aᶜ).`, answer: nU - nA, solution: `n(Aᶜ) = n(U) − n(A) = ${nU - nA}` }; },
        () => { const n = ri(2, 6); return { question: `원소가 ${n}개인 집합의 부분집합의 개수가 자물쇠 번호다.`, answer: 2 ** n, solution: `원소마다 넣는다/안 넣는다 2가지 → 2^${n} = ${2 ** n} (교과서 68쪽: {a, b, c}의 부분집합 8개)` }; },
        () => { const n = ri(12, 40), k = pick([3, 4, 5, 6, 7]); return { question: `${n} 이하의 자연수 중 ${k}의 배수의 집합을 A라 할 때, 자물쇠 번호는 n(A).`, answer: Math.floor(n / k), solution: `${k}, ${2 * k}, …, ${Math.floor(n / k) * k} → ${Math.floor(n / k)}개` }; },
      ],
      3: [
        () => { const a = pick([-3, 2, 3, 4]), b = ri(-6, 6), x = ri(-4, 5); return { question: `f(x) = ${polyStr(a, b)}일 때, 자물쇠 번호는 f(${num(x)}).`, answer: a * x + b, solution: `${num(a)} × ${par(x)} + ${par(b)} = ${num(a * x + b)}` }; },
        () => { const a = pick([2, 3]), b = ri(-3, 3), c = ri(-3, 3), x = ri(-2, 3); const v = (a * x + b) ** 2 + c; return { question: `f(x) = ${polyStr(a, b)}, g(x) = x²${constTail(c)}일 때, 자물쇠 번호는 (g∘f)(${num(x)}).`, answer: v, solution: `f(${num(x)}) = ${num(a * x + b)}, g(${num(a * x + b)}) = ${num(v)}` }; },
        () => { const a = pick([2, 3, 4, 5]), b = ri(-6, 6), x = ri(-4, 6); const y = a * x + b; return { question: `f(x) = ${polyStr(a, b)}일 때, 자물쇠 번호는 f⁻¹(${num(y)}).`, answer: x, solution: `f(a) = ${num(y)} 인 a: ${num(a)}a + ${par(b)} = ${num(y)} → a = ${num(x)}` }; },
      ],
    }[dim] || [];
    const q = pick(pool)();
    return q;
  }

  return {
    M, ri, pick, shuffle, frac, fval, fracStr, lineStr, sqrtStr, num, SLOPES,
    lineGenStr, ratSqrt, circleStr, genCircleStr, lineFig, waGwa, eulReul, linStr, polyStr, setStr, ratStr, radStr, reflXY, finish,
    gen: {
      segLen, dist2D, div1D, div2D, divide, perpSlope, lineEq, parallel,
      ptLineDist, circleCenter, circleEq, completeSquare, circleRead, circleLineRel, tangentSlope, tangentLine, distRange,
      line2pt, lineThrough, transPoint, transCircle, transLine, reflPoint, reflCircle, reflLine,
      setOp, countCap, countCup, deMorganQ, complCount, negCond, negTruthSet, truthJudge, contraQ, suffNecQ, absIneqQ,
      funcValue, composeVal, composeExpr, inverseLin, oneToOneQ, invPoint, rationalShift, rationalAsym, rationalForm, invAsym, radicalForm, radicalDomain,
    },
    PRACTICE, chestQuestion,
  };
})();
