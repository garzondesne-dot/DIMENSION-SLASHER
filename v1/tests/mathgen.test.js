// 문제 생성기 검증: node tests/mathgen.test.js
// 각 생성기를 여러 번 돌려 (1) 보기 4개가 서로 다르고 (2) 정답이 정확히 하나이며
// (3) 정답 값이 생성기와 독립적으로 다시 계산한 값과 같은지 확인한다.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = vm.createContext({});
ctx.window = ctx; // 브라우저처럼 window.DS 가 전역 DS 가 되도록
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/mathgen.js'), 'utf8'), ctx);
const G = ctx.window.DS.MathGen;

const N = 3000;
let failures = 0;
function check(cond, msg, prob) {
  if (!cond) {
    failures++;
    if (failures <= 10) console.error('FAIL:', msg, JSON.stringify(prob));
  }
}

// 문자열 → 수 (정수, a/b, a√b, √b 지원)
function parseVal(s) {
  s = s.replace(/−/g, '-').trim();
  let m;
  if ((m = s.match(/^(-?\d*)√(\d+)$/))) {
    const a = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
    return a * Math.sqrt(Number(m[2]));
  }
  if ((m = s.match(/^(-?\d+)\/(\d+)$/))) return Number(m[1]) / Number(m[2]);
  return Number(s);
}
// 'y = −2x + 3' → { k, c }
function parseLine(s) {
  const t = s.replace(/−/g, '-').replace(/\s+/g, '');
  const m = t.match(/^y=(-?[\d/]*)x([+-]\d+)?$/);
  if (!m) return null;
  const k = m[1] === '' ? 1 : m[1] === '-' ? -1 : parseVal(m[1]);
  return { k, c: m[2] ? Number(m[2]) : 0 };
}
const near = (a, b) => Math.abs(a - b) < 1e-9;

function common(p, name) {
  check(p.choices.length === 4, `${name}: 보기 4개`, p);
  check(new Set(p.choices).size === 4, `${name}: 보기 중복`, p);
  check(p.answerIndex >= 0 && p.choices[p.answerIndex] === p.answer, `${name}: 정답 위치`, p);
  check(p.choices.every((c) => c && !/NaN|undefined|Infinity/.test(c)), `${name}: 이상한 보기`, p);
}

for (let i = 0; i < N; i++) {
  // 수직선 거리
  let p = G.gen.segLen();
  common(p, 'segLen');
  check(Number(p.answer) === Math.abs(p.params.b - p.params.a), 'segLen 값', p);

  // 평면 거리 (값 비교 + 오답이 정답과 같은 값이 아닌지)
  p = G.gen.dist2D();
  common(p, 'dist2D');
  const { x1, y1, x2, y2 } = p.params;
  const d = Math.hypot(x2 - x1, y2 - y1);
  check(near(parseVal(p.answer), d), 'dist2D 값', p);
  check(p.choices.filter((c) => near(parseVal(c), d)).length === 1, 'dist2D 같은 값 중복', p);

  // 수직선 내분점
  p = G.gen.div1D();
  common(p, 'div1D');
  {
    const { x1: a, x2: b, m, n } = p.params;
    check(near(parseVal(p.answer), (m * b + n * a) / (m + n)), 'div1D 값', p);
    // P가 실제로 AP:PB = m:n 을 만족하는지
    const P = parseVal(p.answer);
    check(near(Math.abs(P - a) * n, Math.abs(b - P) * m), 'div1D 비율', p);
  }

  // 평면 내분점
  p = G.gen.div2D();
  common(p, 'div2D');
  {
    const q = p.params;
    const xy = p.answer.replace(/[()]/g, '').split(',').map(parseVal);
    check(near(xy[0], (q.m * q.x2 + q.n * q.x1) / (q.m + q.n)) && near(xy[1], (q.m * q.y2 + q.n * q.y1) / (q.m + q.n)), 'div2D 값', p);
  }

  // 수직 기울기
  const sl = G.pick(G.SLOPES);
  p = G.gen.perpSlope({ m: sl, n: G.ri(-2, 2) });
  common(p, 'perpSlope');
  check(near(parseVal(p.answer) * G.fval(sl), -1), 'perpSlope mm′=−1', p);

  // 직선의 방정식: 점 P를 지나고, 수직 모드면 방패와 수직
  const P = { a: G.ri(-2, 1), b: G.ri(-3, -1) };
  p = G.gen.lineEq({ m: sl, n: 1, P });
  common(p, 'lineEq');
  {
    const L = parseLine(p.answer);
    check(L && near(L.k * P.a + L.c, P.b), 'lineEq 점 통과', p);
    if (p.params.perpMode) check(near(L.k * G.fval(sl), -1), 'lineEq 수직', p);
    // 같은 직선을 나타내는 오답이 없어야 함
    const same = p.choices.filter((c) => { const l = parseLine(c); return l && near(l.k, L.k) && near(l.c, L.c); });
    check(same.length === 1, 'lineEq 같은 직선 중복', p);
  }

  // 평행선
  p = G.gen.parallel({ m: sl, n: G.ri(-2, 2) });
  common(p, 'parallel');
  {
    const L = parseLine(p.answer);
    check(L && near(L.k * p.params.a + L.c, p.params.b), 'parallel 점 통과', p);
    check(near(L.k, p.params.k), 'parallel 기울기', p);
    check(!near(L.c, p.params.n), 'parallel 원래 직선과 일치하면 안 됨', p);
  }
}

// 교과서 예시와 같은 값을 내는지 확인 (형식 검사)
const F = G.frac;
check(G.sqrtStr(100) === '10', 'sqrt 100', {});
check(G.sqrtStr(8) === '2√2', 'sqrt 8', {});
check(G.sqrtStr(20) === '2√5', 'sqrt 20', {});
check(G.lineStr(-2, 9) === 'y = −2x + 9', '예제2 직선 형식', {});
check(G.lineStr(F(1, 2), 1) === 'y = 1/2x + 1', '분수 기울기 형식', {});
check(G.fracStr(F(-2, 4)) === '−1/2', '약분', {});

if (failures) {
  console.error(`\n${failures}건 실패`);
  process.exit(1);
}
console.log(`OK: 생성기 7종 × ${N}회 검증 통과`);
