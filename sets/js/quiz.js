// 공식 카드 발동 시 뜨는 문제 창 + 문제 그림(수직선/좌표평면)
window.DS = window.DS || {};

DS.UI = {
  esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  },
  // '1/2', '2√3/3' 같은 분수를 세로 분수로 표시
  pretty(s) {
    return DS.UI.esc(s).replace(/((?:\d*√)?\d+)\/(\d+)/g, '<span class="fr"><span>$1</span><span>$2</span></span>');
  },
};

DS.Diagram = (function () {
  const FONT = '"Galmuri11", monospace';
  const neg = (v) => String(v).replace('-', '−');

  function numberline(g, W, H, d) {
    const xs = d.points.map((p) => p.x);
    let lo = Math.min(...xs, 0) - 2, hi = Math.max(...xs, 0) + 2;
    if (hi - lo < 10) { const c = (hi + lo) / 2; lo = Math.floor(c - 5); hi = Math.ceil(c + 5); }
    const X = (v) => 24 + ((v - lo) / (hi - lo)) * (W - 48);
    const y = H * 0.6;
    g.strokeStyle = '#8f8aa8';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(12, y); g.lineTo(W - 12, y); g.stroke();
    g.fillStyle = '#8f8aa8';
    g.font = `13px ${FONT}`;
    g.textAlign = 'center';
    const step = hi - lo > 14 ? 2 : 1;
    for (let v = Math.ceil(lo); v <= hi; v++) {
      g.fillRect(X(v) - 1, y - 4, 2, 8);
      if (v % step === 0) g.fillText(neg(v), X(v), y + 24);
    }
    if (d.segment) {
      g.fillStyle = 'rgba(232,176,74,0.35)';
      const [a, b] = d.segment;
      g.fillRect(Math.min(X(a), X(b)), y - 5, Math.abs(X(b) - X(a)), 10);
    }
    const cols = ['#4cc9ff', '#ff8c3a', '#c792ff'];
    d.points.forEach((p, i) => {
      g.fillStyle = cols[i % 3];
      g.beginPath(); g.arc(X(p.x), y, 6, 0, Math.PI * 2); g.fill();
      g.font = `bold 15px ${FONT}`;
      g.fillText(`${p.label}(${neg(p.x)})`, X(p.x), y - 16);
    });
  }

  function plane(g, W, H, d) {
    const xs = [0], ys = [0];
    (d.points || []).forEach((p) => { xs.push(p.x); ys.push(p.y); });
    (d.segments || []).forEach(([a, b, c, e]) => { xs.push(a, c); ys.push(b, e); });
    (d.circles || []).forEach((c) => { xs.push(c.cx - c.r, c.cx + c.r); ys.push(c.cy - c.r, c.cy + c.r); });
    (d.extent || []).forEach(([x, y]) => { xs.push(x); ys.push(y); });
    (d.curves || []).forEach((c) => { if (c.asym) { xs.push(c.asym[0] - 3, c.asym[0] + 3); ys.push(c.asym[1] - 3, c.asym[1] + 3); } });
    let x0 = Math.min(...xs) - 2, x1 = Math.max(...xs) + 2, y0 = Math.min(...ys) - 2, y1 = Math.max(...ys) + 2;
    if (x1 - x0 < 10) { const c = (x0 + x1) / 2; x0 = c - 5; x1 = c + 5; }
    if (y1 - y0 < 8) { const c = (y0 + y1) / 2; y0 = c - 4; y1 = c + 4; }
    const u = Math.min((W - 20) / (x1 - x0), (H - 20) / (y1 - y0)); // 가로세로 같은 축척 → 수직이 진짜 수직으로 보임
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const P = (x, y) => ({ x: W / 2 + (x - cx) * u, y: H / 2 - (y - cy) * u });
    DS.Diagram.lastMap = { u, cx, cy, W, H, P };
    const vx0 = cx - W / 2 / u, vx1 = cx + W / 2 / u, vy0 = cy - H / 2 / u, vy1 = cy + H / 2 / u;

    g.strokeStyle = '#26223f';
    g.lineWidth = 1;
    const gs = vx1 - vx0 > 40 ? 10 : 1, ls = gs === 10 ? 20 : 2; // 큰 좌표(당구대 등)는 10칸 단위 격자
    for (let x = Math.ceil(vx0 / gs) * gs; x <= vx1; x += gs) { const p = P(x, 0); g.beginPath(); g.moveTo(p.x, 0); g.lineTo(p.x, H); g.stroke(); }
    for (let y = Math.ceil(vy0 / gs) * gs; y <= vy1; y += gs) { const p = P(0, y); g.beginPath(); g.moveTo(0, p.y); g.lineTo(W, p.y); g.stroke(); }
    const o = P(0, 0);
    g.strokeStyle = '#6f68a8';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, o.y); g.lineTo(W, o.y); g.stroke();
    g.beginPath(); g.moveTo(o.x, 0); g.lineTo(o.x, H); g.stroke();
    g.fillStyle = '#6f68a8';
    g.font = `11px ${FONT}`;
    g.textAlign = 'center';
    for (let x = Math.ceil(vx0); x <= vx1; x++) if (x && x % ls === 0) g.fillText(neg(x), P(x, 0).x, o.y + 13);
    g.textAlign = 'right';
    for (let y = Math.ceil(vy0); y <= vy1; y++) if (y && y % ls === 0) g.fillText(neg(y), o.x - 4, P(0, y).y + 4);
    g.fillText('O', o.x - 4, o.y + 13);

    (d.lines || []).forEach((l) => {
      const m = l.m.n / l.m.d;
      const a = P(vx0, m * vx0 + l.n), b = P(vx1, m * vx1 + l.n);
      g.strokeStyle = 'rgba(255,209,102,0.35)';
      g.lineWidth = 8;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      g.strokeStyle = '#ffd166';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    });
    (d.curves || []).forEach((cv) => {
      g.strokeStyle = cv.color || '#ff9df0';
      g.lineWidth = 3;
      g.beginPath();
      let pen = false, prev = null;
      const span = (vy1 - vy0) * 2;
      for (let px = 0; px <= W; px += 2) {
        const x = cx + (px - W / 2) / u, y = cv.f(x);
        if (!Number.isFinite(y) || Math.abs(y - cy) > span || (prev != null && Math.abs(y - prev) > span / 2)) { pen = false; prev = Number.isFinite(y) ? y : null; continue; }
        const q = P(x, y);
        if (pen) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y);
        pen = true; prev = y;
      }
      g.stroke();
      if (cv.asym) {
        g.setLineDash([4, 5]);
        g.lineWidth = 1.5;
        const a = P(cv.asym[0], vy0), b = P(cv.asym[0], vy1), c2 = P(vx0, cv.asym[1]), e = P(vx1, cv.asym[1]);
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.moveTo(c2.x, c2.y); g.lineTo(e.x, e.y); g.stroke();
        g.setLineDash([]);
      }
    });
    (d.circles || []).forEach((c) => {
      const p = P(c.cx, c.cy);
      g.strokeStyle = '#c792ff';
      g.lineWidth = 3;
      g.beginPath(); g.arc(p.x, p.y, c.r * u, 0, Math.PI * 2); g.stroke();
    });
    g.setLineDash([5, 5]);
    g.strokeStyle = '#8f8aa8';
    g.lineWidth = 1.5;
    (d.guides || []).forEach(([a, b, c, e]) => {
      const p = P(a, b), q = P(c, e);
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke();
    });
    g.setLineDash([]);
    g.strokeStyle = '#7df9ff';
    g.lineWidth = 3;
    (d.segments || []).forEach(([a, b, c, e]) => {
      const p = P(a, b), q = P(c, e);
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke();
    });
    const cols = ['#4cc9ff', '#ff8c3a', '#c792ff'];
    (d.points || []).forEach((pt, i) => {
      const p = P(pt.x, pt.y);
      g.fillStyle = pt.label === 'P' ? '#ff3355' : cols[i % 3];
      g.beginPath(); g.arc(p.x, p.y, 5, 0, Math.PI * 2); g.fill();
      g.font = `bold 14px ${FONT}`;
      g.textAlign = 'left';
      g.fillText(`${pt.label}(${neg(pt.x)}, ${neg(pt.y)})`, p.x + 8, p.y - 8);
    });
  }

  // 벤 다이어그램 (문제 창): 원소 나열 또는 원소의 개수, 칠하기(shade)
  function venn(g, W, H, d) {
    const A = { x: W / 2 - 55, y: H / 2, r: 80 }, Bc = d.single ? null : { x: W / 2 + 55, y: H / 2, r: 80 };
    if (d.U || d.shade) { g.strokeStyle = '#6f68a8'; g.lineWidth = 2; g.strokeRect(20, 10, W - 40, H - 20); g.fillStyle = '#9a95c0'; g.font = `13px ${FONT}`; g.textAlign = 'left'; g.fillText('U', 26, 26); }
    if (d.shade) {
      const off = document.createElement('canvas'); off.width = W; off.height = H;
      const o = off.getContext('2d');
      o.fillStyle = '#7df9ff';
      const circ = (c) => { o.beginPath(); o.arc(c.x, c.y, c.r, 0, Math.PI * 2); o.fill(); };
      const out = (c) => { if (!c) return; o.globalCompositeOperation = 'destination-out'; circ(c); o.globalCompositeOperation = 'source-over'; };
      const rect = () => o.fillRect(20, 10, W - 40, H - 20);
      const op = d.shade;
      if (op === 'cap' && Bc) { circ(A); o.globalCompositeOperation = 'destination-in'; circ(Bc); }
      else if (op === 'cup') { circ(A); if (Bc) circ(Bc); }
      else if (op === 'diff') { circ(A); out(Bc); }
      else if (op === 'rdiff') { circ(Bc); out(A); }
      else if (op === 'complA') { rect(); out(A); }
      else if (op === 'complB') { rect(); out(Bc); }
      else if (op === 'cupC') { rect(); out(A); out(Bc); }
      else if (op === 'capC') { rect(); o.save(); o.beginPath(); o.arc(A.x, A.y, A.r, 0, Math.PI * 2); o.clip(); o.globalCompositeOperation = 'destination-out'; circ(Bc || A); o.restore(); }
      g.globalAlpha = 0.3; g.drawImage(off, 0, 0); g.globalAlpha = 1;
    }
    const names = d.labels || ['A', 'B'];
    [[A, '#4cc9ff', names[0]], [Bc, '#ff8c3a', names[1]]].forEach(([c, col, nm]) => {
      if (!c) return;
      g.strokeStyle = col; g.lineWidth = 3;
      g.beginPath(); g.arc(c.x, c.y, c.r, 0, Math.PI * 2); g.stroke();
      g.fillStyle = col; g.font = `bold 15px ${FONT}`; g.textAlign = 'center';
      g.fillText(nm, c.x + (c === A ? -c.r * 0.7 : c.r * 0.7), c.y - c.r * 0.75);
    });
    g.font = `bold 14px ${FONT}`; g.textAlign = 'center';
    if (d.counts) {
      if (d.counts.A != null) { g.fillStyle = '#bfe9ff'; g.fillText(`n(A) = ${d.counts.A}`, A.x - 25, A.y + A.r + 0 - 8); }
      if (Bc && d.counts.B != null) { g.fillStyle = '#ffd0a8'; g.fillText(`n(B) = ${d.counts.B}`, Bc.x + 25, Bc.y + Bc.r - 8); }
      return;
    }
    const AA = d.A || [], BB = d.B || [], UU = Array.isArray(d.U) ? d.U : [];
    const all = [...new Set([...AA, ...BB, ...UU])];
    const cnt = {};
    all.forEach((e) => {
      const a = AA.includes(e), b = BB.includes(e), key = `${a}${b}`;
      const k = cnt[key] = (cnt[key] || 0) + 1;
      let x, y;
      if (a && b) { x = W / 2; y = H / 2 - 30 + (k - 1) * 20; }
      else if (a) { x = A.x - 30 + ((k - 1) % 2) * 26; y = H / 2 - 30 + Math.floor((k - 1) / 2) * 20; }
      else if (b) { x = Bc.x + 22 + ((k - 1) % 2) * 26; y = H / 2 - 30 + Math.floor((k - 1) / 2) * 20; }
      else { x = 40 + (k - 1) * 28; y = H - 22; }
      g.fillStyle = a && b ? '#ffd166' : a ? '#bfe9ff' : b ? '#ffd0a8' : '#9a95c0';
      g.fillText(String(e).replace('-', '−'), x, y);
    });
  }

  return {
    draw(canvas, d) {
      const g = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      g.clearRect(0, 0, W, H);
      g.fillStyle = '#0e0c1a';
      g.fillRect(0, 0, W, H);
      if (!d) return;
      if (d.type === 'numberline') numberline(g, W, H, d);
      else if (d.type === 'venn') venn(g, W, H, d);
      else plane(g, W, H, d);
    },
  };
})();

DS.Quiz = (function () {
  const $ = (s) => document.querySelector(s);
  const { pretty, esc } = DS.UI;
  const S = () => DS.SetGen;
  const setLabel = (arr) => S().setStr(arr);

  // 채점 (화면과 분리, 테스트에서도 쓴다). given: 형식별 학생 답
  //  choice: 번호 / blanks: 기호 배열 / ox: true·false / number: 수 / multi: 번호 배열 / subsets: 부분집합 배열
  function grade(prob, given) {
    switch (prob.type) {
      case 'blanks': return prob.items.every((it, k) => given[k] === it.answer);
      case 'ox': return given === prob.answer;
      case 'number': return Number(given) === prob.answer;
      case 'multi': return given.slice().sort().join(',') === prob.answer.slice().sort().join(',');
      case 'subsets': {
        const want = new Set(S().allSubsets(prob.base).map(S().key));
        const got = new Set(given.map(S().key));
        return got.size === given.length && got.size === want.size && [...want].every((k) => got.has(k));
      }
      default: return given === prob.answerIndex;
    }
  }
  // 부분집합 모두 만들기: 무엇이 빠졌는지 개념 메시지
  function subsetsNote(prob, given) {
    const keys = given.map(S().key), n = prob.base.length;
    if (new Set(keys).size !== keys.length) return '같은 부분집합을 두 번 만들었어요.';
    if (!keys.includes('')) return '∅ (공집합)이 빠졌어요. 공집합은 모든 집합의 부분집합!';
    if (!keys.includes(S().key(prob.base))) return `${setLabel(prob.base)} 자신이 빠졌어요. 모든 집합은 자기 자신의 부분집합!`;
    return `${given.length}개를 만들었어요. 원소가 ${n}개면 부분집합은 2${'⁰¹²³⁴⁵⁶⁷⁸⁹'[n]} = ${2 ** n}개!`;
  }

  // 문제를 띄우고 정답 여부를 Promise 로 돌려준다. 오답이면 해설을 보여 준 뒤 닫는다.
  // opt.tag: 머리말 (예: '✨ 연성 예제'), opt.teacher: 문제풀이모드 표시
  function ask(card, prob, opt = {}) {
    DS.Quiz.last = prob; // 자동 플레이 테스트용 (읽기 전용)
    return new Promise((resolve) => {
      const root = $('#quiz');
      $('#quiz-card').textContent = (opt.tag ? opt.tag + ' · ' : '') + card.name;
      $('#quiz-formula').innerHTML = pretty(card.formula || '');
      $('#quiz-q').innerHTML = pretty(prob.question);
      const dia = $('#quiz-diagram');
      dia.classList.toggle('hidden', !prob.diagram);
      if (prob.diagram) DS.Diagram.draw(dia, prob.diagram);
      const sol = $('#quiz-sol'), next = $('#quiz-next'), box = $('#quiz-choices');
      sol.classList.add('hidden');
      next.classList.add('hidden');
      box.innerHTML = '';
      box.className = `choices q-${prob.type || 'choice'}`;
      root.classList.remove('hidden', 'ok', 'ng');
      let done = false;
      const finish = (ok, note) => {
        if (done) return;
        done = true;
        box.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        if (ok) {
          DS.Sound.correct();
          root.classList.add('ok');
          setTimeout(() => { root.classList.add('hidden'); resolve(true); }, 700);
          return;
        }
        DS.Sound.wrong();
        root.classList.add('ng');
        sol.innerHTML = (note ? `<b class="ng-note">${pretty(note)}</b><br>` : '') + `<b>해설</b> ${pretty(prob.solution)}`;
        sol.classList.remove('hidden');
        next.classList.remove('hidden');
        next.onclick = () => { root.classList.add('hidden'); resolve(false); };
      };
      const submitBtn = (label, onClick) => {
        const b = document.createElement('button');
        b.className = 'btn primary q-submit';
        b.textContent = label;
        b.addEventListener('click', onClick);
        box.appendChild(b);
        return b;
      };
      const t = prob.type || 'choice';

      if (t === 'choice') {
        prob.choices.forEach((ch, i) => {
          const b = document.createElement('button');
          b.className = 'choice';
          b.innerHTML = `<span class="no">${i + 1}</span><span class="math">${pretty(ch)}</span>`;
          b.addEventListener('click', () => {
            if (done) return;
            box.children[prob.answerIndex].classList.add('right');
            if (i !== prob.answerIndex) b.classList.add('wrong');
            finish(i === prob.answerIndex);
          });
          box.appendChild(b);
        });
      } else if (t === 'blanks') {
        // □ 칸마다 기호 버튼. 모두 채우면 [제출]
        const picks = prob.items.map(() => null);
        prob.items.forEach((it, k) => {
          const row = document.createElement('div');
          row.className = 'blank-row';
          row.innerHTML = `<span class="math bl-side">${pretty(it.left)}</span><b class="bl-box">□</b><span class="math bl-side">${pretty(it.right)}</span>`
            + `<span class="bl-opts">${prob.options.map((o) => `<button class="choice sym" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</span>`;
          row.querySelectorAll('.sym').forEach((b) => b.addEventListener('click', () => {
            if (done) return;
            picks[k] = b.dataset.o;
            row.querySelector('.bl-box').textContent = picks[k];
            row.querySelectorAll('.sym').forEach((x) => x.classList.toggle('on', x === b));
            sub.disabled = picks.some((p) => p == null);
            DS.Sound.clank();
          }));
          box.appendChild(row);
        });
        const sub = submitBtn('제출', () => {
          box.querySelectorAll('.blank-row').forEach((row, k) => row.classList.add(picks[k] === prob.items[k].answer ? 'right' : 'wrong'));
          finish(grade(prob, picks));
        });
        sub.disabled = true;
      } else if (t === 'ox') {
        [['O', true], ['X', false]].forEach(([lab, v]) => {
          const b = document.createElement('button');
          b.className = `choice ox ox-${lab}`;
          b.textContent = lab;
          b.addEventListener('click', () => {
            if (done) return;
            const ok = grade(prob, v);
            b.classList.add(ok ? 'right' : 'wrong');
            finish(ok);
          });
          box.appendChild(b);
        });
      } else if (t === 'number') {
        // 숫자 패드 (폰에서 키보드가 화면을 가리지 않게)
        let v = '';
        const disp = document.createElement('div');
        disp.className = 'num-disp';
        disp.textContent = '?';
        box.appendChild(disp);
        const pad = document.createElement('div');
        pad.className = 'num-pad';
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '−', '0', '⌫'].forEach((k) => {
          const b = document.createElement('button');
          b.className = 'choice key';
          b.textContent = k;
          b.addEventListener('click', () => {
            if (done) return;
            if (k === '⌫') v = v.slice(0, -1);
            else if (k === '−') v = v.startsWith('-') ? v.slice(1) : '-' + v;
            else if (v.replace('-', '').length < 4) v += k;
            disp.textContent = v ? v.replace('-', '−') : '?';
            sub.disabled = !/\d/.test(v);
            DS.Sound.clank();
          });
          pad.appendChild(b);
        });
        box.appendChild(pad);
        const sub = submitBtn('제출', () => {
          const ok = grade(prob, Number(v));
          disp.classList.add(ok ? 'right' : 'wrong');
          finish(ok, ok ? '' : `정답은 ${String(prob.answer).replace('-', '−')}`);
        });
        sub.disabled = true;
      } else if (t === 'multi') {
        const on = new Set();
        prob.options.forEach((o, i) => {
          const b = document.createElement('button');
          b.className = 'choice multi';
          b.innerHTML = `<span class="no">${'①②③④⑤⑥⑦⑧'[i]}</span><span class="math">${pretty(o)}</span>`;
          b.addEventListener('click', () => {
            if (done) return;
            if (on.has(i)) on.delete(i); else on.add(i);
            b.classList.toggle('on', on.has(i));
            sub.disabled = !on.size;
            DS.Sound.clank();
          });
          box.appendChild(b);
        });
        const sub = submitBtn('모두 골랐어요 · 제출', () => {
          const btns = box.querySelectorAll('.choice.multi');
          prob.answer.forEach((i) => btns[i].classList.add('right'));
          on.forEach((i) => { if (!prob.answer.includes(i)) btns[i].classList.add('wrong'); });
          finish(grade(prob, [...on]));
        });
        sub.disabled = true;
      } else if (t === 'subsets') {
        // 원소를 눌러 집합을 만들고 [추가] → 모은 부분집합 목록 → [제출]
        const made = [];
        let cur = new Set();
        const pickRow = document.createElement('div');
        pickRow.className = 'sub-pick';
        const shelf = document.createElement('div');
        shelf.className = 'sub-shelf';
        const now = document.createElement('div');
        now.className = 'sub-now math';
        const draw = () => {
          const arr = prob.base.filter((x) => cur.has(x));
          now.textContent = `만드는 중: ${setLabel(arr)}`;
          shelf.innerHTML = made.length ? made.map((m, k) => `<button class="sub-chip" data-k="${k}">${esc(setLabel(m))} ✕</button>`).join('') : '<span class="muted small">아직 없음</span>';
          shelf.querySelectorAll('.sub-chip').forEach((c) => c.addEventListener('click', () => { if (done) return; made.splice(Number(c.dataset.k), 1); draw(); }));
          cnt.textContent = `모은 부분집합 ${made.length}개`;
          sub.disabled = !made.length;
        };
        prob.base.forEach((x) => {
          const b = document.createElement('button');
          b.className = 'choice key elem';
          b.textContent = String(x).replace('-', '−');
          b.addEventListener('click', () => { if (done) return; if (cur.has(x)) cur.delete(x); else cur.add(x); b.classList.toggle('on', cur.has(x)); draw(); DS.Sound.clank(); });
          pickRow.appendChild(b);
        });
        const add = document.createElement('button');
        add.className = 'btn small sub-add';
        add.textContent = '＋ 이 집합 추가';
        add.addEventListener('click', () => {
          if (done) return;
          const arr = prob.base.filter((x) => cur.has(x));
          if (made.some((m) => S().key(m) === S().key(arr))) { DS.UI.toast('이미 모은 부분집합이에요.'); return; }
          made.push(arr);
          cur = new Set();
          pickRow.querySelectorAll('.elem').forEach((e) => e.classList.remove('on'));
          DS.Sound.clank();
          draw();
        });
        const cnt = document.createElement('p');
        cnt.className = 'sub-count';
        box.append(pickRow, now, add, cnt, shelf);
        const sub = submitBtn('다 모았어요 · 제출', () => {
          const ok = grade(prob, made);
          finish(ok, ok ? '' : subsetsNote(prob, made));
        });
        draw();
      }
    });
  }

  return { ask, grade, subsetsNote };
})();
