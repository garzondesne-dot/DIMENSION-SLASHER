// 전투 장면 캔버스 렌더러: 픽셀 블록 스프라이트, 수직선/좌표평면 배경, 이펙트(참격·파편·글리치)
// 좌표평면의 방패 직선과 수직 참격은 실제 기울기 그대로 그려서 화면이 곧 수학 그림이 되게 한다.
window.DS = window.DS || {};

DS.Scene = function (canvas) {
  const W = 640, H = 360;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const FONT = '"Galmuri11", "Galmuri14", monospace';

  const GROUND = 292;
  const HERO = { x: 128, y: GROUND, u: 5 };
  const NL_Y = 328; // 1층 수직선
  const nl = (v) => 320 + v * 27;
  const O = { x: 450, y: 165 }, U = 22; // 2층 좌표평면 원점과 1칸 크기
  const pl = (x, y) => ({ x: O.x + x * U, y: O.y - y * U });

  let B = null; // 전투 상태 (battle.js 가 넘겨줌)
  let bgCache = {};
  const fx = {};
  function resetFx() {
    Object.assign(fx, {
      slashes: [], parts: [], shards: [], texts: [], rings: [],
      shake: 0, flash: null, glitch: 0, glitchMax: 1,
      heroDx: 0, enemyDx: 0, enemyFlash: 0, heroFlash: 0, enemyAlpha: 1, shieldFlash: 0,
    });
  }
  resetFx();

  // ── 픽셀 블록 스프라이트 ──────────────────────────────────
  // [x, y, w, h, color] 단위 블록. body 는 외곽선을 두르고, detail 은 그 위에 덧칠한다.
  const SPR = {
    hero: {
      u: 5,
      body: [
        [-3, -4, 2, 4, '#3a2e2a'], [1, -4, 2, 4, '#3a2e2a'],
        [-6, -12, 2, 9, '#5a2590'],
        [-4, -11, 8, 7, '#5c6b80'],
        [-3, -17, 6, 6, '#8a94a6'],
        [-2, -19, 2, 2, '#c0392b'],
        [4, -10, 2, 2, '#8a94a6'],
        [6, -20, 1, 11, '#e0e6f0'],
        [5, -9, 3, 1, '#e8b04a'], [6, -8, 1, 2, '#6b4a2a'],
      ],
      detail: [
        [-4, -11, 8, 1, '#8a94a6'], [-4, -6, 8, 1, '#e8b04a'], [-1, -9, 2, 1, '#e8b04a'],
        [-3, -17, 6, 1, '#c9d1de'], [-1, -15, 4, 1, '#141020'], [1, -15, 2, 1, '#4cc9ff'],
        [6, -20, 1, 1, '#ffffff'], [-6, -12, 1, 9, '#7a3ab8'],
      ],
    },
    golem: {
      u: 6,
      body: [
        [-6, -7, 4, 7, '#5d5a66'], [2, -7, 4, 7, '#5d5a66'],
        [-13, -18, 5, 11, '#6d6a75'], [8, -18, 5, 11, '#6d6a75'],
        [-14, -8, 6, 4, '#5d5a66'], [8, -8, 6, 4, '#5d5a66'],
        [-8, -19, 16, 13, '#6d6a75'],
        [-4, -25, 8, 6, '#7a7784'],
      ],
      detail: [
        [-8, -19, 16, 2, '#8f8c99'], [-4, -25, 8, 1, '#9a97a5'], [-13, -18, 5, 1, '#8f8c99'], [8, -18, 5, 1, '#8f8c99'],
        [-6, -11, 1, 3, '#46434d'], [4, -9, 3, 1, '#46434d'], [-11, -14, 1, 2, '#46434d'], [10, -12, 2, 1, '#46434d'],
        [-3, -23, 2, 1, '#ffb347'], [1, -23, 2, 1, '#ffb347'],
        [-8, -19, 3, 1, '#4f7a3a'], [2, -25, 2, 1, '#4f7a3a'], [9, -18, 2, 1, '#4f7a3a'],
      ],
      plates: [
        [[-7, -18, 14, 2, '#9fb4c7'], [-7, -18, 14, 1, '#d6e4f0']],
        [[-14, -20, 7, 3, '#9fb4c7'], [-14, -20, 7, 1, '#d6e4f0']],
        [[7, -20, 7, 3, '#9fb4c7'], [7, -20, 7, 1, '#d6e4f0']],
      ],
    },
    beast: {
      u: 6,
      body: [
        [-9, -6, 3, 6, '#3f2550'], [-3, -6, 3, 6, '#3f2550'], [3, -6, 3, 6, '#3f2550'], [8, -6, 3, 6, '#3f2550'],
        [-10, -15, 22, 10, '#5b3a6e'],
        [12, -13, 4, 2, '#5b3a6e'],
        [-17, -17, 8, 8, '#6a4580'],
        [-16, -20, 2, 3, '#e8e0d0'], [-11, -20, 2, 3, '#e8e0d0'],
      ],
      detail: [
        [-10, -15, 22, 2, '#7d5593'], [-17, -17, 8, 1, '#8a62a0'],
        [-16, -14, 2, 1, '#ff3355'], [-17, -10, 6, 1, '#e8e0d0'],
        [-6, -12, 1, 4, '#47285a'], [2, -11, 1, 3, '#47285a'], [7, -13, 1, 3, '#47285a'],
      ],
    },
  };

  function blocks(list, ox, oy, u, white, outline) {
    if (outline) {
      ctx.fillStyle = white ? '#ffffff' : '#0b0912';
      for (const [x, y, w, h] of list) ctx.fillRect(ox + (x - 1) * u, oy + (y - 1) * u, (w + 2) * u, (h + 2) * u);
    }
    for (const [x, y, w, h, c] of list) {
      ctx.fillStyle = white ? '#ffffff' : c;
      ctx.fillRect(ox + x * u, oy + y * u, w * u, h * u);
    }
  }
  function sprite(s, ox, oy, white) {
    blocks(s.body, ox, oy, s.u, white, true);
    blocks(s.detail, ox, oy, s.u, white, false);
  }
  function glow(x, y, r, color, a = 1) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  // ── 배경 (층별로 한 번만 그려서 캐시) ─────────────────────
  function makeBg(floor) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = floor === 1 ? '#110e1a' : '#0d0b19';
    g.fillRect(0, 0, W, H);
    if (floor === 1) {
      for (let row = 0; row < 14; row++) {
        const off = row % 2 ? 0 : 20;
        for (let col = -1; col < 18; col++) {
          const v = 22 + Math.floor(Math.random() * 10);
          g.fillStyle = `rgb(${v},${v - 4},${v + 10})`;
          g.fillRect(col * 40 + off + 1, row * 21 + 1, 38, 19);
        }
      }
    } else {
      g.strokeStyle = '#211d3d';
      g.lineWidth = 1;
      for (let x = O.x % U; x < W; x += U) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, GROUND); g.stroke(); }
      for (let y = O.y % U; y < GROUND; y += U) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
      g.strokeStyle = '#4b4580';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, O.y); g.lineTo(W, O.y); g.stroke();
      g.beginPath(); g.moveTo(O.x, 0); g.lineTo(O.x, GROUND); g.stroke();
      g.fillStyle = '#6f68a8';
      g.font = `11px ${FONT}`;
      g.textAlign = 'center';
      for (let i = -18; i <= 8; i += 2) if (i) g.fillText(String(i).replace('-', '−'), O.x + i * U, O.y + 14);
      g.textAlign = 'right';
      for (let i = -4; i <= 7; i += 2) if (i) g.fillText(String(i).replace('-', '−'), O.x - 5, O.y - i * U + 4);
      g.fillText('O', O.x - 4, O.y + 14);
      g.fillText('x', W - 6, O.y - 6);
      g.fillText('y', O.x - 6, 12);
    }
    // 바닥
    g.fillStyle = '#1a1526';
    g.fillRect(0, GROUND, W, H - GROUND);
    g.fillStyle = '#2c2440';
    g.fillRect(0, GROUND, W, 3);
    return c;
  }

  // ── 그리기 ────────────────────────────────────────────────
  let time = 0;

  function drawTorches() {
    for (const x of [40, 600]) {
      ctx.fillStyle = '#3a2e2a';
      ctx.fillRect(x - 3, 120, 6, 22);
      const f = 0.8 + Math.sin(time * 13 + x) * 0.15 + Math.random() * 0.08;
      glow(x, 112, 60 * f, 'rgba(255,140,58,0.35)');
      ctx.fillStyle = '#ff8c3a';
      ctx.fillRect(x - 4, 106, 8, 12);
      ctx.fillStyle = '#ffe08a';
      ctx.fillRect(x - 2, 110 + Math.round(Math.random() * 2), 4, 6);
    }
  }

  function drawNumberLine() {
    ctx.strokeStyle = '#8f8aa8';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(nl(-10.6), NL_Y); ctx.lineTo(nl(10.6), NL_Y); ctx.stroke();
    ctx.fillStyle = '#8f8aa8';
    ctx.font = `10px ${FONT}`;
    ctx.textAlign = 'center';
    for (let v = -10; v <= 10; v++) {
      ctx.fillRect(nl(v) - 1, NL_Y - (v % 5 ? 3 : 6), 2, v % 5 ? 6 : 12);
      if (v % 2 === 0) ctx.fillText(String(v).replace('-', '−'), nl(v), NL_Y + 20);
    }
    const c = B && B.enemy.ctx;
    if (!c) return;
    const xa = nl(c.a), xb = nl(c.b);
    ctx.fillStyle = 'rgba(232,176,74,0.25)';
    ctx.fillRect(Math.min(xa, xb), NL_Y - 4, Math.abs(xb - xa), 8);
    const marks = [
      [xa, `A(${String(c.a).replace('-', '−')})`, '#4cc9ff', 'rgba(76,201,255,0.6)'],
      [xb, `B(${String(c.b).replace('-', '−')})`, '#ff8c3a', 'rgba(255,140,58,0.6)'],
    ];
    for (const [x, lab, col, glowCol] of marks) {
      glow(x, NL_Y, 16, glowCol);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(x, NL_Y - 4); ctx.lineTo(x - 6, NL_Y - 14); ctx.lineTo(x + 6, NL_Y - 14); ctx.fill();
      ctx.font = `bold 13px ${FONT}`;
      ctx.fillText(lab, x, NL_Y - 18);
    }
  }

  // 방패: 방패 직선 위에서 심장 P 의 수선의 발을 중심으로 한 선분
  function shieldSegment(c, half = 3.6) {
    const m = c.m.n / c.m.d;
    const t = (c.P.a + m * (c.P.b - c.n)) / (1 + m * m); // 수선의 발 x좌표
    const fy = m * t + c.n;
    const len = Math.hypot(1, m);
    const dx = half / len, dy = (half * m) / len;
    return { a: pl(t - dx, fy - dy), b: pl(t + dx, fy + dy), foot: pl(t, fy), m };
  }

  function drawShield() {
    const e = B.enemy, c = e.ctx;
    if (!c) return;
    const s = shieldSegment(c);
    if (e.shieldUp) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,209,102,0.25)';
      ctx.lineWidth = 16;
      ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y); ctx.lineTo(s.b.x, s.b.y); ctx.stroke();
      ctx.strokeStyle = fx.shieldFlash > 0 ? '#ffffff' : '#ffd166';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y); ctx.lineTo(s.b.x, s.b.y); ctx.stroke();
      ctx.strokeStyle = '#fff3c4';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y); ctx.lineTo(s.b.x, s.b.y); ctx.stroke();
      ctx.lineCap = 'butt';
    } else {
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(255,209,102,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y); ctx.lineTo(s.b.x, s.b.y); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawHeart() {
    const c = B.enemy.ctx;
    if (!c) return;
    const p = pl(c.P.a, c.P.b);
    const beat = 1 + Math.max(0, Math.sin(time * 6)) * 0.25;
    glow(p.x, p.y, 26 * beat, 'rgba(255,51,85,0.55)');
    const u = 2 * beat;
    ctx.fillStyle = '#ff3355';
    for (const [x, y, w, h] of [[-3, -2, 2, 2], [1, -2, 2, 2], [-4, -1, 8, 2], [-3, 1, 6, 1], [-2, 2, 4, 1], [-1, 3, 2, 1]]) {
      ctx.fillRect(p.x + x * u, p.y + y * u, w * u, h * u);
    }
    ctx.fillStyle = '#ffd0da';
    ctx.font = `bold 12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`P(${String(c.P.a).replace('-', '−')}, ${String(c.P.b).replace('-', '−')})`, p.x + 12, p.y - 10);
  }

  function enemyAnchor() {
    if (!B) return { x: 480, y: GROUND };
    return B.def.floor === 1 ? { x: 470, y: GROUND } : { x: 500, y: GROUND };
  }
  function enemyCenter() {
    const a = enemyAnchor();
    return B && B.def.floor === 2 ? { x: a.x - 20, y: a.y - 70 } : { x: a.x, y: a.y - 90 };
  }

  function drawEnemy() {
    const e = B.enemy, a = enemyAnchor();
    const white = fx.enemyFlash > 0;
    const bob = Math.round(Math.sin(time * 2) * 2);
    ctx.globalAlpha = fx.enemyAlpha;
    if (B.def.floor === 1) {
      const s = SPR.golem, ox = a.x + fx.enemyDx, oy = a.y + bob;
      sprite(s, ox, oy, white);
      // 심장 코어
      const pulse = 0.6 + Math.sin(time * 4) * 0.3;
      glow(ox, oy - 13 * s.u, 30, `rgba(255,140,58,${pulse})`);
      blocks([[-2, -15, 4, 4, '#ff8c3a'], [-1, -14, 2, 2, '#ffe08a']], ox, oy, s.u, white, false);
      for (let i = 0; i < e.armor; i++) blocks(s.plates[i], ox, oy, s.u, white, true);
    } else {
      sprite(SPR.beast, a.x + fx.enemyDx, a.y + bob, white);
    }
    ctx.globalAlpha = 1;
  }

  function drawHero() {
    const s = SPR.hero, ox = HERO.x + fx.heroDx, oy = HERO.y + Math.round(Math.sin(time * 2.4) * 1.5);
    sprite(s, ox, oy, fx.heroFlash > 0);
    glow(ox + 2 * s.u + 3, oy - 15 * s.u + 2, 12 + Math.sin(time * 5) * 3, 'rgba(76,201,255,0.8)');
  }

  function drawFx(dt) {
    // 참격
    for (const s of fx.slashes) {
      const k = s.life / s.max;
      const p = Math.min(1, (1 - k) * 3); // 그어지는 진행도
      const x2 = s.x1 + (s.x2 - s.x1) * p, y2 = s.y1 + (s.y2 - s.y1) * p;
      ctx.lineCap = 'round';
      ctx.globalAlpha = k;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.w * 2.5;
      ctx.globalAlpha = k * 0.35;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.globalAlpha = k;
      ctx.lineWidth = s.w;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, s.w / 3);
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineCap = 'butt';
      s.life -= dt;
    }
    fx.slashes = fx.slashes.filter((s) => s.life > 0);

    for (const r of fx.rings) {
      const k = r.life / r.max;
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = k;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r + (1 - k) * r.grow, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      r.life -= dt;
    }
    fx.rings = fx.rings.filter((r) => r.life > 0);

    // 네온 스파크
    for (const p of fx.parts) {
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    fx.parts = fx.parts.filter((p) => p.life > 0);

    // 갑옷 파편 (중력 + 바닥 튕김)
    for (const s of fx.shards) {
      s.vy += 900 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt; s.life -= dt;
      if (s.y > GROUND - 2) { s.y = GROUND - 2; s.vy *= -0.35; s.vx *= 0.6; s.vr *= 0.5; }
      ctx.save();
      ctx.globalAlpha = Math.min(1, s.life);
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.fillStyle = '#0b0912';
      ctx.fillRect(-s.w / 2 - 1, -s.h / 2 - 1, s.w + 2, s.h + 2);
      ctx.fillStyle = s.color;
      ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
      ctx.fillStyle = '#e8f2fb';
      ctx.fillRect(-s.w / 2, -s.h / 2, s.w, 2);
      ctx.restore();
    }
    fx.shards = fx.shards.filter((s) => s.life > 0);

    // 떠오르는 숫자
    ctx.textAlign = 'center';
    for (const t of fx.texts) {
      t.y -= 40 * dt; t.life -= dt;
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.font = `bold ${t.size}px ${FONT}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#0b0912';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    fx.texts = fx.texts.filter((t) => t.life > 0);
  }

  // 테이프 되감기 글리치: 화면을 가로 띠로 잘라 어긋나게 + 주사선
  function drawGlitch() {
    const k = fx.glitch / fx.glitchMax;
    for (let i = 0; i < 14; i++) {
      const y = Math.floor(Math.random() * H), h = 4 + Math.floor(Math.random() * 24);
      const dx = (Math.random() - 0.5) * 80 * k;
      ctx.drawImage(canvas, 0, y, W, h, dx, y, W, h);
    }
    ctx.fillStyle = `rgba(76,201,255,${0.08 * k})`;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = (time * 120) % 4; y < H; y += 4) ctx.fillRect(0, y, W, 1);
    ctx.font = `bold 34px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = Math.floor(time * 6) % 2 ? '#ffffff' : '#4cc9ff';
    ctx.fillText('◀◀ REWIND', W / 2, H / 2);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    fx.heroDx *= Math.pow(0.0008, dt);
    fx.enemyDx *= Math.pow(0.0008, dt);
    fx.enemyFlash -= dt; fx.heroFlash -= dt; fx.shieldFlash -= dt;
    fx.shake = Math.max(0, fx.shake - dt * 30);

    ctx.save();
    if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
    if (B) {
      const f = B.def.floor;
      if (!bgCache[f]) bgCache[f] = makeBg(f);
      ctx.drawImage(bgCache[f], 0, 0);
      if (f === 1) { drawTorches(); drawNumberLine(); }
      drawHero();
      drawEnemy();
      if (f === 2 && fx.enemyAlpha > 0.05) { drawShield(); drawHeart(); }
      drawFx(dt);
    } else {
      ctx.fillStyle = '#0b0912';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();

    if (fx.flash) {
      ctx.globalAlpha = Math.max(0, fx.flash.life / fx.flash.max) * 0.6;
      ctx.fillStyle = fx.flash.color;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      fx.flash.life -= dt;
      if (fx.flash.life <= 0) fx.flash = null;
    }
    if (fx.glitch > 0) { drawGlitch(); fx.glitch -= dt; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ── 이펙트 생성기 ─────────────────────────────────────────
  function slash(x1, y1, x2, y2, color = '#bfefff', w = 6, life = 0.4) {
    fx.slashes.push({ x1, y1, x2, y2, color, w, life, max: life });
  }
  function burst(x, y, n, color, speed = 220, g = 260, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random());
      const life = 0.4 + Math.random() * 0.5;
      fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g, size, color, life, max: life });
    }
  }
  function text(x, y, str, color, size = 28) { fx.texts.push({ x, y, text: str, color, size, life: 1.1 }); }
  function ring(x, y, color, r = 6, grow = 60, life = 0.5) { fx.rings.push({ x, y, color, r, grow, life, max: life }); }
  // 수학 좌표 (x, y) 를 지나고 기울기 k 인 긴 참격
  function slopeSlash(px, py, k, color, half = 5) {
    const len = Math.hypot(1, k), dx = half / len, dy = (half * k) / len;
    const a = pl(px - dx, py - dy), b = pl(px + dx, py + dy);
    slash(a.x, a.y, b.x, b.y, color, 7, 0.55);
  }

  return {
    setBattle(b) { B = b; resetFx(); },
    enemyCenter,

    // 플레이어 공격 연출. kind 는 카드 id, params 는 문제 생성기의 params
    heroAttack(kind, params) {
      const c = enemyCenter();
      fx.heroDx = 70;
      const e = B && B.enemy;
      if (kind === 'segLen' && e.ctx) {
        slash(nl(e.ctx.a), NL_Y, nl(e.ctx.b), NL_Y, '#ffd166', 6, 0.5);
        slash(c.x - 50, c.y - 60, c.x + 50, c.y + 60, '#ffd166', 7);
      } else if (kind === 'dist') {
        slash(c.x - 80, c.y + 70, c.x + 80, c.y - 70, '#7df9ff', 8, 0.5);
        slash(c.x - 80, c.y - 10, c.x + 80, c.y - 10, '#7df9ff', 4, 0.4);
      } else if (kind === 'divide') {
        slash(HERO.x + 40, HERO.y - 60, c.x, c.y + 10, '#c792ff', 5, 0.35);
        ring(c.x, c.y + 10, '#c792ff', 6, 80);
      } else if (kind === 'perp' && e.ctx) {
        const m = e.ctx.m.n / e.ctx.m.d;
        slopeSlash(e.ctx.P.a, e.ctx.P.b, -1 / m, '#7df9ff', 6);
      } else if (kind === 'line' && e.ctx) {
        const k = params && params.k != null ? params.k : 1;
        slopeSlash(e.ctx.P.a, e.ctx.P.b, k, '#ff9df0', 6);
        const p = pl(e.ctx.P.a, e.ctx.P.b);
        ring(p.x, p.y, '#ff9df0', 8, 50);
      } else {
        slash(c.x - 45, c.y - 55, c.x + 45, c.y + 55, '#bfefff', 6);
        slash(c.x + 45, c.y - 55, c.x - 45, c.y + 55, '#bfefff', 6);
      }
    },
    enemyHit(dmg, note) {
      const c = enemyCenter();
      fx.enemyFlash = 0.12;
      fx.shake = Math.max(fx.shake, dmg >= 15 ? 14 : 7);
      burst(c.x, c.y, dmg >= 15 ? 36 : 18, note ? '#ffd166' : '#7df9ff');
      text(c.x + (Math.random() - 0.5) * 30, c.y - 40, String(dmg), note ? '#ffd166' : '#ffffff', dmg >= 15 ? 38 : 30);
      if (note) text(c.x, c.y - 80, note, '#ffd166', 16);
    },
    blocked(amount) {
      const c = enemyCenter();
      text(c.x, c.y - 20, `방어 −${amount}`, '#9fb4c7', 16);
    },
    armorShatter(plateIndex) {
      const a = enemyAnchor(), u = SPR.golem.u;
      const [x, y, w, h] = SPR.golem.plates[plateIndex][0];
      const cx = a.x + (x + w / 2) * u, cy = a.y + (y + h / 2) * u;
      for (let i = 0; i < 14; i++) {
        fx.shards.push({
          x: cx + (Math.random() - 0.5) * w * u, y: cy, vx: (Math.random() - 0.3) * 320, vy: -150 - Math.random() * 300,
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 20, w: 6 + Math.random() * 10, h: 4 + Math.random() * 6,
          color: Math.random() < 0.5 ? '#9fb4c7' : '#7d93a8', life: 2.2,
        });
      }
      burst(cx, cy, 30, '#d6e4f0', 300);
      fx.flash = { color: '#ffffff', life: 0.15, max: 0.15 };
      fx.shake = 18;
      text(cx, cy - 30, 'ARMOR BREAK!', '#d6e4f0', 22);
    },
    shieldShatter() {
      const s = shieldSegment(B.enemy.ctx);
      for (let i = 0; i < 18; i++) {
        const t = Math.random();
        fx.shards.push({
          x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t,
          vx: (Math.random() - 0.3) * 300, vy: -100 - Math.random() * 250, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 18,
          w: 6 + Math.random() * 8, h: 3 + Math.random() * 3, color: '#ffd166', life: 2,
        });
      }
      ring(s.foot.x, s.foot.y, '#ffffff', 4, 70, 0.4);
      fx.flash = { color: '#fff3c4', life: 0.15, max: 0.15 };
      fx.shake = 16;
      text(s.foot.x, s.foot.y - 30, '방패 파괴! (mm′ = −1)', '#fff3c4', 18);
    },
    shieldDeflect() { fx.shieldFlash = 0.15; },
    heroGuard(amount) {
      ring(HERO.x, HERO.y - 50, '#4cc9ff', 20, 30, 0.45);
      text(HERO.x, HERO.y - 110, `+${amount} 방어`, '#4cc9ff', 18);
    },
    fizzle() {
      burst(HERO.x + 20, HERO.y - 60, 14, '#6f68a8', 120, 100, 2);
      text(HERO.x + 20, HERO.y - 110, '수식 붕괴…', '#9a95c0', 16);
    },
    enemyAttack(dmg, blocked) {
      fx.enemyDx = -80;
      setTimeout(() => {
        fx.heroFlash = 0.12;
        fx.shake = Math.max(fx.shake, dmg >= 12 ? 14 : 8);
        burst(HERO.x, HERO.y - 50, 14, '#ff3355', 180);
        if (dmg > 0) text(HERO.x, HERO.y - 100, `−${dmg}`, '#ff6b81', 28);
        if (blocked > 0) text(HERO.x + 30, HERO.y - 70, `방어 ${blocked}`, '#4cc9ff', 15);
        if (dmg >= 12) fx.flash = { color: '#ff3355', life: 0.15, max: 0.15 };
      }, 120);
    },
    enemyBuff(label) {
      const c = enemyCenter();
      ring(c.x, c.y, '#9fb4c7', 20, 40, 0.5);
      text(c.x, c.y - 70, label, '#9fb4c7', 16);
    },
    enemyDeath() {
      const c = enemyCenter();
      for (let i = 0; i < 4; i++) setTimeout(() => burst(c.x + (Math.random() - 0.5) * 80, c.y + (Math.random() - 0.5) * 80, 40, i % 2 ? '#ffd166' : '#7df9ff', 320), i * 140);
      fx.flash = { color: '#ffffff', life: 0.3, max: 0.3 };
      fx.shake = 20;
      const start = performance.now();
      const fade = () => {
        fx.enemyAlpha = Math.max(0, 1 - (performance.now() - start) / 900);
        if (fx.enemyAlpha > 0) requestAnimationFrame(fade);
      };
      fade();
    },
    rewind(seconds = 1.6) { fx.glitch = seconds; fx.glitchMax = seconds; },
  };
};
