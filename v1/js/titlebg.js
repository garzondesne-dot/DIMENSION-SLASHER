// 타이틀 배경: 천천히 흐르는 좌표 격자 + 반짝이는 점 + 가끔 지나가는 직선 참격
// 연산량을 줄이려고 타이틀 화면이 보일 때만, 초당 30프레임 이하로 그린다.
window.DS = window.DS || {};

DS.TitleBg = function (canvas, isActive) {
  const ctx = canvas.getContext('2d');
  const CELL = 40;
  let w = 0, h = 0, dpr = 1, last = 0, t = 0;
  const pts = Array.from({ length: 7 }, () => ({ gx: rnd(-6, 6), gy: rnd(-4, 4), ph: Math.random() * 6.28 }));
  let slash = null, nextSlash = 1.5;
  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);

  function draw(dt) {
    t += dt;
    ctx.clearRect(0, 0, w, h);
    const ox = w / 2 + ((t * 6) % CELL), oy = h * 0.42 + ((t * 3) % CELL);
    // 격자
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(76, 201, 255, 0.07)';
    ctx.beginPath();
    for (let x = ox % CELL; x < w; x += CELL) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = oy % CELL; y < h; y += CELL) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
    // 축
    const ax = w / 2, ay = h * 0.42;
    ctx.strokeStyle = 'rgba(167, 123, 255, 0.22)';
    ctx.beginPath(); ctx.moveTo(0, ay); ctx.lineTo(w, ay); ctx.moveTo(ax, 0); ctx.lineTo(ax, h); ctx.stroke();
    // 반짝이는 점
    pts.forEach((p) => {
      const a = 0.25 + 0.35 * (1 + Math.sin(t * 1.6 + p.ph)) / 2;
      const x = ax + p.gx * CELL, y = ay - p.gy * CELL;
      ctx.fillStyle = `rgba(232, 176, 74, ${a})`;
      ctx.fillRect(x - 3, y - 3, 6, 6);
      ctx.font = '11px Galmuri11, monospace';
      ctx.fillStyle = `rgba(236, 233, 247, ${a * 0.6})`;
      ctx.fillText(`(${p.gx}, ${p.gy})`, x + 6, y - 6);
    });
    // 직선 참격: 두 점을 잇는 직선이 빛나며 지나간다
    nextSlash -= dt;
    if (!slash && nextSlash <= 0) {
      const p = pts[rnd(0, pts.length - 1)], q = pts[rnd(0, pts.length - 1)];
      if (p !== q && p.gx !== q.gx) slash = { p, q, life: 0 };
      nextSlash = 2.5 + Math.random() * 2;
    }
    if (slash) {
      slash.life += dt;
      const k = slash.life / 0.9;
      if (k >= 1) slash = null;
      else {
        const { p, q } = slash;
        const m = (q.gy - p.gy) / (q.gx - p.gx);
        const x1 = -w, x2 = w;
        const sx = (gx) => ax + gx * CELL, sy = (gx) => ay - (p.gy + m * (gx - p.gx)) * CELL;
        ctx.strokeStyle = `rgba(125, 249, 255, ${0.6 * (1 - k)})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#7df9ff'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.moveTo(sx(x1 / CELL), sy(x1 / CELL)); ctx.lineTo(sx(x2 / CELL), sy(x2 / CELL)); ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
  }

  function loop(now) {
    requestAnimationFrame(loop);
    if (!isActive() || document.hidden) { last = now; return; }
    if (now - last < 33) return; // 30fps 이하
    if (canvas.clientWidth !== w || canvas.clientHeight !== h) resize();
    const dt = Math.min(0.1, (now - last) / 1000 || 0.033);
    last = now;
    draw(dt);
  }
  resize();
  requestAnimationFrame(loop);
};
