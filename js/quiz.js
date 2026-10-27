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
    let x0 = Math.min(...xs) - 2, x1 = Math.max(...xs) + 2, y0 = Math.min(...ys) - 2, y1 = Math.max(...ys) + 2;
    if (x1 - x0 < 10) { const c = (x0 + x1) / 2; x0 = c - 5; x1 = c + 5; }
    if (y1 - y0 < 8) { const c = (y0 + y1) / 2; y0 = c - 4; y1 = c + 4; }
    const u = Math.min((W - 20) / (x1 - x0), (H - 20) / (y1 - y0)); // 가로세로 같은 축척 → 수직이 진짜 수직으로 보임
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const P = (x, y) => ({ x: W / 2 + (x - cx) * u, y: H / 2 - (y - cy) * u });
    const vx0 = cx - W / 2 / u, vx1 = cx + W / 2 / u, vy0 = cy - H / 2 / u, vy1 = cy + H / 2 / u;

    g.strokeStyle = '#26223f';
    g.lineWidth = 1;
    for (let x = Math.ceil(vx0); x <= vx1; x++) { const p = P(x, 0); g.beginPath(); g.moveTo(p.x, 0); g.lineTo(p.x, H); g.stroke(); }
    for (let y = Math.ceil(vy0); y <= vy1; y++) { const p = P(0, y); g.beginPath(); g.moveTo(0, p.y); g.lineTo(W, p.y); g.stroke(); }
    const o = P(0, 0);
    g.strokeStyle = '#6f68a8';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, o.y); g.lineTo(W, o.y); g.stroke();
    g.beginPath(); g.moveTo(o.x, 0); g.lineTo(o.x, H); g.stroke();
    g.fillStyle = '#6f68a8';
    g.font = `11px ${FONT}`;
    g.textAlign = 'center';
    for (let x = Math.ceil(vx0); x <= vx1; x++) if (x && x % 2 === 0) g.fillText(neg(x), P(x, 0).x, o.y + 13);
    g.textAlign = 'right';
    for (let y = Math.ceil(vy0); y <= vy1; y++) if (y && y % 2 === 0) g.fillText(neg(y), o.x - 4, P(0, y).y + 4);
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

  return {
    draw(canvas, d) {
      const g = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      g.clearRect(0, 0, W, H);
      g.fillStyle = '#0e0c1a';
      g.fillRect(0, 0, W, H);
      if (!d) return;
      if (d.type === 'numberline') numberline(g, W, H, d);
      else plane(g, W, H, d);
    },
  };
})();

DS.Quiz = (function () {
  const $ = (s) => document.querySelector(s);

  // 문제를 띄우고 정답 여부를 Promise 로 돌려준다. 오답이면 해설을 보여 준 뒤 닫는다.
  function ask(card, prob) {
    return new Promise((resolve) => {
      const root = $('#quiz');
      $('#quiz-card').textContent = card.name;
      $('#quiz-formula').innerHTML = DS.UI.pretty(card.formula || '');
      $('#quiz-q').innerHTML = DS.UI.pretty(prob.question);
      DS.Diagram.draw($('#quiz-diagram'), prob.diagram);
      const sol = $('#quiz-sol'), next = $('#quiz-next'), box = $('#quiz-choices');
      sol.classList.add('hidden');
      next.classList.add('hidden');
      box.innerHTML = '';
      root.classList.remove('hidden', 'ok', 'ng');
      let done = false;
      prob.choices.forEach((ch, i) => {
        const b = document.createElement('button');
        b.className = 'choice';
        b.innerHTML = `<span class="no">${i + 1}</span><span class="math">${DS.UI.pretty(ch)}</span>`;
        b.addEventListener('click', () => {
          if (done) return;
          done = true;
          const ok = i === prob.answerIndex;
          box.children[prob.answerIndex].classList.add('right');
          if (ok) {
            DS.Sound.correct();
            root.classList.add('ok');
            setTimeout(() => { root.classList.add('hidden'); resolve(true); }, 650);
          } else {
            DS.Sound.wrong();
            b.classList.add('wrong');
            root.classList.add('ng');
            sol.innerHTML = `<b>해설</b> ${DS.UI.pretty(prob.solution)}`;
            sol.classList.remove('hidden');
            next.classList.remove('hidden');
            next.onclick = () => { root.classList.add('hidden'); resolve(false); };
          }
        });
        box.appendChild(b);
      });
    });
  }

  return { ask };
})();
