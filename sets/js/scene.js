// 전투 장면 캔버스 렌더러: 픽셀 블록 스프라이트 + 몬스터 문제의 그림(수직선/좌표평면) + 이펙트
// 그림 요소는 풀이 단계(stepIdx)에 따라 나타나거나 바뀐다. 기울기·거리는 실제 비율 그대로 그린다.
window.DS = window.DS || {};

DS.Scene = function (canvas) {
  const W = 640, H = 360;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const FONT = '"Galmuri11", "Galmuri14", monospace';

  const GROUND = 292;
  const HERO = { x: 96, y: GROUND };
  const NL_Y = 328;
  const nl = (v) => 320 + v * 27;

  let B = null; // 전투 상태 (battle.js 가 넘겨줌)
  let shoulder = false; // 숄더뷰: 주인공은 캔버스 밖(등 뒤)에 따로 그린다
  let map = null; // 좌표평면 → 캔버스 변환
  const bgCache = {};
  const fx = {};
  function resetFx() {
    Object.assign(fx, {
      slashes: [], parts: [], shards: [], texts: [], rings: [], traces: [], scanT: 0, venn: null,
      shake: 0, flash: null, glitch: 0, glitchMax: 1, hitstop: 0, slowmo: false,
      heroDx: 0, enemyDx: 0, enemyFlash: 0, heroFlash: 0, enemyAlpha: 1, shieldFlash: 0,
    });
  }
  resetFx();

  // 좌표평면 보기 영역을 캔버스 (180~620, 15~285) 안에 같은 축척으로 맞춘다
  function makeMap(view) {
    const U = Math.min(440 / (view.x1 - view.x0), 270 / (view.y1 - view.y0));
    const ox = 400 - ((view.x0 + view.x1) / 2) * U;
    const oy = 150 + ((view.y0 + view.y1) / 2) * U;
    return { U, ox, oy, view, P: (x, y) => ({ x: ox + x * U, y: oy - y * U }) };
  }
  const pl = (x, y) => map.P(x, y);

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
    slime: {
      u: 5,
      body: [[-7, -8, 14, 8, '#3fa58b'], [-5, -11, 10, 3, '#3fa58b'], [-3, -13, 6, 2, '#3fa58b']],
      detail: [
        [-5, -11, 10, 1, '#6fe0bf'], [-3, -13, 6, 1, '#6fe0bf'], [-4, -7, 2, 2, '#0b0912'], [2, -7, 2, 2, '#0b0912'],
        [-5, -10, 2, 1, '#e6fff7'], [-1, -4, 2, 1, '#0b0912'], [-7, -2, 14, 2, '#2e7f6a'],
      ],
    },
    bat: {
      u: 5,
      body: [
        [-4, -8, 8, 7, '#5e3f8c'], [-4, -10, 2, 2, '#5e3f8c'], [2, -10, 2, 2, '#5e3f8c'],
        [-13, -7, 9, 3, '#4a3270'], [-11, -9, 5, 2, '#4a3270'], [4, -7, 9, 3, '#4a3270'], [6, -9, 5, 2, '#4a3270'],
      ],
      detail: [
        [-3, -6, 2, 1, '#ffd166'], [1, -6, 2, 1, '#ffd166'], [-1, -3, 1, 1, '#ffffff'],
        [-12, -6, 7, 1, '#6b4a9c'], [5, -6, 7, 1, '#6b4a9c'],
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
    boss: {
      u: 5,
      body: [
        [-6, -8, 4, 8, '#231c38'], [2, -8, 4, 8, '#231c38'],
        [-15, -25, 4, 13, '#3b2f5c'], [11, -25, 4, 13, '#3b2f5c'],
        [-11, -28, 22, 20, '#3b2f5c'], [-12, -10, 24, 3, '#2e2449'],
        [-14, -29, 6, 4, '#4a3b70'], [8, -29, 6, 4, '#4a3b70'],
        [-5, -36, 10, 8, '#4a3b70'],
        [-5, -39, 2, 3, '#e8b04a'], [-1, -40, 2, 4, '#e8b04a'], [3, -39, 2, 3, '#e8b04a'],
      ],
      detail: [
        [-3, -33, 2, 1, '#ff3355'], [1, -33, 2, 1, '#ff3355'], [-5, -36, 10, 1, '#6a5896'],
        [-11, -28, 1, 20, '#5e4b8c'], [10, -28, 1, 20, '#5e4b8c'], [-14, -29, 6, 1, '#6a5896'], [8, -29, 6, 1, '#6a5896'],
      ],
    },
  };
  // 3·4층 (v0.3): 수선 거미, 가면 원령, 고리 정령, 궤도 유성, 접선 기사, 원환의 수문장
  Object.assign(SPR, {
    spider: {
      u: 5,
      body: [
        [-5, -9, 10, 7, '#3b2a4a'], [-3, -12, 6, 3, '#4a3560'],
        [-12, -8, 7, 1, '#2a1e36'], [-13, -7, 1, 5, '#2a1e36'], [-11, -5, 6, 1, '#2a1e36'], [-12, -4, 1, 4, '#2a1e36'],
        [5, -8, 7, 1, '#2a1e36'], [12, -7, 1, 5, '#2a1e36'], [5, -5, 6, 1, '#2a1e36'], [11, -4, 1, 4, '#2a1e36'],
        [0, -26, 1, 14, '#cfcbe6'],
      ],
      detail: [
        [-3, -11, 2, 1, '#ff3355'], [1, -11, 2, 1, '#ff3355'], [-2, -10, 1, 1, '#ff3355'], [1, -10, 1, 1, '#ff3355'],
        [-4, -7, 8, 1, '#6a4a8a'], [-1, -5, 2, 2, '#c792ff'],
      ],
    },
    mask: {
      u: 5,
      body: [
        [-6, -20, 12, 16, '#d8d4ea'], [-8, -6, 4, 6, '#d8d4ea'], [4, -6, 4, 6, '#d8d4ea'], [-2, -4, 4, 4, '#d8d4ea'],
        [-5, -18, 10, 8, '#f4ead0'],
      ],
      detail: [
        [-4, -16, 3, 2, '#0b0912'], [1, -16, 3, 2, '#0b0912'], [-1, -12, 2, 1, '#c0392b'],
        [-5, -18, 10, 1, '#e8b04a'], [-6, -9, 12, 1, '#a9a4c4'], [-3, -14, 1, 1, '#ff9df0'], [3, -14, 1, 1, '#ff9df0'],
      ],
    },
    ringSpirit: {
      u: 5,
      body: [
        [-4, -26, 8, 2, '#8a62c8'], [4, -24, 2, 2, '#8a62c8'], [6, -22, 2, 8, '#8a62c8'], [4, -14, 2, 2, '#8a62c8'],
        [-4, -12, 8, 2, '#8a62c8'], [-6, -14, 2, 2, '#8a62c8'], [-8, -22, 2, 8, '#8a62c8'], [-6, -24, 2, 2, '#8a62c8'],
        [-2, -21, 4, 4, '#2a1e46'],
      ],
      detail: [
        [-4, -26, 8, 1, '#c792ff'], [6, -22, 1, 8, '#c792ff'], [-1, -20, 2, 2, '#ffd166'],
        [-12, -19, 4, 1, '#4cc9ff'], [8, -19, 4, 1, '#ff8c3a'],
      ],
    },
    meteor: {
      u: 5,
      body: [
        [-5, -14, 10, 9, '#6b4a3a'], [-3, -16, 6, 2, '#6b4a3a'], [-3, -5, 6, 2, '#6b4a3a'],
        [5, -18, 4, 4, '#ff8c3a'], [8, -22, 4, 4, '#ff6b2a'], [11, -26, 3, 3, '#ffd166'],
      ],
      detail: [
        [-3, -12, 3, 2, '#4a3226'], [1, -9, 2, 2, '#4a3226'], [-4, -14, 2, 1, '#8c6a52'],
        [-2, -11, 1, 1, '#ffd166'], [2, -12, 1, 1, '#ffd166'], [6, -17, 2, 2, '#ffd166'],
      ],
    },
    knight: {
      u: 6,
      body: [
        [-4, -6, 3, 6, '#3a3f52'], [1, -6, 3, 6, '#3a3f52'],
        [-5, -16, 10, 10, '#5a6480'], [-4, -22, 8, 6, '#6a7494'],
        [-11, -17, 5, 9, '#c0b090'], [6, -26, 1, 18, '#e0e6f0'], [5, -12, 3, 1, '#e8b04a'],
      ],
      detail: [
        [-4, -20, 8, 1, '#141020'], [-2, -20, 4, 1, '#7df9ff'], [-5, -16, 10, 1, '#8a94b6'], [-1, -14, 2, 6, '#c0392b'],
        [-10, -15, 3, 5, '#8a7a5a'], [-9, -13, 1, 1, '#ffd166'], [6, -26, 1, 1, '#ffffff'], [-1, -24, 2, 2, '#c0392b'],
      ],
    },
    gatekeeper: {
      u: 6,
      body: [
        [-6, -8, 4, 8, '#2a2440'], [2, -8, 4, 8, '#2a2440'],
        [-9, -24, 18, 16, '#3e3466'], [-5, -30, 10, 6, '#4a3e78'],
        [-15, -27, 3, 2, '#c792ff'], [-17, -25, 2, 10, '#c792ff'], [-15, -15, 3, 2, '#c792ff'],
        [12, -27, 3, 2, '#c792ff'], [15, -25, 2, 10, '#c792ff'], [12, -15, 3, 2, '#c792ff'],
      ],
      detail: [
        [-3, -28, 2, 1, '#ff3355'], [1, -28, 2, 1, '#ff3355'], [-9, -24, 18, 1, '#6a5ca0'],
        [-2, -19, 4, 4, '#ffd166'], [-1, -18, 2, 2, '#fff3c4'], [-9, -12, 18, 1, '#2a2440'],
      ],
    },
  });
  const ANCHOR = {
    slime: { x: 520, y: GROUND, cx: 0, cy: -30 },
    bat: { x: 520, y: GROUND - 80, cx: 0, cy: -25 },
    golem: { x: 520, y: GROUND, cx: 0, cy: -90 },
    beast: { x: 530, y: GROUND, cx: -20, cy: -60 },
    boss: { x: 548, y: GROUND, cx: 0, cy: -95 },
    spider: { x: 520, y: GROUND - 60, cx: 0, cy: -35 },
    mask: { x: 520, y: GROUND - 20, cx: 0, cy: -60 },
    ringSpirit: { x: 525, y: GROUND - 40, cx: 0, cy: -95 },
    meteor: { x: 520, y: GROUND - 90, cx: 0, cy: -50 },
    knight: { x: 520, y: GROUND, cx: 0, cy: -80 },
    gatekeeper: { x: 535, y: GROUND, cx: 0, cy: -110 },
  };
  // v1.0 테스트판: 새 몬스터는 기존 몸체의 색을 돌려 만든다 (hue 회전 각도)
  const VARIANTS = {
    archer: ['knight', 110], shiftWraith: ['mask', 170], mirrorWraith: ['mask', 250], mirrorLord: ['gatekeeper', 190],
    mirrorHound: ['beast', 150], setSlime: ['slime', 80], complGhost: ['mask', 40], vennGolem: ['golem', 100],
    negShade: ['spider', 290], counterKnight: ['knight', 25], contraWarden: ['gatekeeper', 80],
    valSlime: ['slime', 260], chimera: ['beast', 300], inverseWitch: ['ringSpirit', 300], asymGhost: ['ringSpirit', 140],
    rootSnake: ['meteor', 95], asymKing: ['boss', 190], centroid: ['golem', 35], bisector: ['knight', 200],
    billiard: ['meteor', 200], bikeClub: ['bat', 120], bijection: ['ringSpirit', 40],
    // 번외편 포함의 결계
    belongSlime: ['slime', 80], emptyGhost: ['mask', 200], unitGolem: ['golem', 100], includeKnight: ['knight', 200],
    mirrorTwins: ['mask', 250], collector: ['spider', 120], mixCrab: ['spider', 30], mixWisp: ['meteor', 260],
    mixKnight: ['knight', 60], powerGuardian: ['gatekeeper', 140],
  };
  function hueShift(hex, deg) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (d < 0.04) return hex; // 회색·흰색·검은색은 그대로
    const sat = d / (1 - Math.abs(2 * l - 1));
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + deg + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * sat, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
  }
  const recolor = (list, deg) => list.map(([x, y, w, h, c]) => [x, y, w, h, hueShift(c, deg)]);
  Object.entries(VARIANTS).forEach(([name, [base, deg]]) => {
    const b = SPR[base];
    SPR[name] = { ...b, base, body: recolor(b.body, deg), detail: recolor(b.detail, deg), plates: b.plates && b.plates.map((pl) => recolor(pl, deg)) };
    ANCHOR[name] = ANCHOR[base];
  });
  const baseOf = (kind) => (SPR[kind] && SPR[kind].base) || kind;

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
  function pixelHeart(x, y, u, color = '#ff3355') {
    ctx.fillStyle = color;
    for (const [a, b, w, h] of [[-3, -2, 2, 2], [1, -2, 2, 2], [-4, -1, 8, 2], [-3, 1, 6, 1], [-2, 2, 4, 1], [-1, 3, 2, 1]]) {
      ctx.fillRect(x + a * u, y + b * u, w * u, h * u);
    }
  }

  // ── 배경 ─────────────────────────────────────────────────
  function makeBg() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const fig = B.prob.figure;
    g.fillStyle = '#0f0d1a';
    g.fillRect(0, 0, W, H);
    if (fig.kind === 'venn') {
      for (let i = 0; i < 90; i++) {
        g.fillStyle = `rgba(160,150,220,${0.05 + Math.random() * 0.12})`;
        g.fillRect(Math.random() * W, Math.random() * GROUND, 2, 2);
      }
    } else if (fig.kind === 'numberline') {
      for (let row = 0; row < 14; row++) {
        const off = row % 2 ? 0 : 20;
        for (let col = -1; col < 18; col++) {
          const v = 22 + Math.floor(Math.random() * 10);
          g.fillStyle = `rgb(${v},${v - 4},${v + 10})`;
          g.fillRect(col * 40 + off + 1, row * 21 + 1, 38, 19);
        }
      }
    } else {
      const { U, ox, oy } = map;
      g.strokeStyle = '#211d3d';
      g.lineWidth = 1;
      const GU = U < 8 ? U * 10 : U; // 큰 좌표는 10칸 단위 격자
      for (let x = ((ox % GU) + GU) % GU; x < W; x += GU) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, GROUND); g.stroke(); }
      for (let y = ((oy % GU) + GU) % GU; y < GROUND; y += GU) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
      g.strokeStyle = '#4b4580';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, oy); g.lineTo(W, oy); g.stroke();
      g.beginPath(); g.moveTo(ox, 0); g.lineTo(ox, GROUND); g.stroke();
      g.fillStyle = '#6f68a8';
      g.font = `11px ${FONT}`;
      g.textAlign = 'center';
      const xmin = Math.ceil(-ox / U), xmax = Math.floor((W - ox) / U);
      const step = U < 8 ? 20 : U < 26 ? 2 : 1;
      for (let i = xmin; i <= xmax; i++) if (i && i % step === 0) g.fillText(String(i).replace('-', '−'), ox + i * U, oy + 14);
      g.textAlign = 'right';
      const ymin = Math.ceil((oy - GROUND) / U), ymax = Math.floor(oy / U);
      for (let i = ymin; i <= ymax; i++) if (i && i % step === 0) g.fillText(String(i).replace('-', '−'), ox - 5, oy - i * U + 4);
    }
    g.fillStyle = '#1a1526';
    g.fillRect(0, GROUND, W, H - GROUND);
    g.fillStyle = '#2c2440';
    g.fillRect(0, GROUND, W, 3);
    return c;
  }

  // ── 문제 그림 ─────────────────────────────────────────────
  const visible = (el) => B.stepIdx >= (el.from || 0) && (el.until == null || B.stepIdx < el.until)
    && (el.scan == null || B.revealed >= el.scan);

  function strokeLine(a, b, color, w, opt = {}) {
    ctx.lineCap = 'round';
    if (opt.dash) ctx.setLineDash(opt.dash);
    if (opt.glow) {
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = color;
      ctx.lineWidth = w * 3.5;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = 'butt';
  }
  function labelAt(p, text, color, dx = 8, dy = -8) {
    ctx.font = `bold 12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0b0912';
    ctx.strokeText(text, p.x + dx, p.y + dy);
    ctx.fillStyle = color;
    ctx.fillText(text, p.x + dx, p.y + dy);
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
    const pts = B.prob.figure.points;
    if (pts.length === 2) {
      const xa = nl(pts[0].x), xb = nl(pts[1].x);
      ctx.fillStyle = B.stepIdx >= 1 ? 'rgba(125,249,255,0.45)' : 'rgba(232,176,74,0.25)';
      ctx.fillRect(Math.min(xa, xb), NL_Y - 4, Math.abs(xb - xa), 8);
    }
    for (const p of pts) {
      const x = nl(p.x);
      glow(x, NL_Y, 16, p.color, 0.5);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.moveTo(x, NL_Y - 4); ctx.lineTo(x - 6, NL_Y - 14); ctx.lineTo(x + 6, NL_Y - 14); ctx.fill();
      ctx.font = `bold 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(`${p.label}(${String(p.x).replace('-', '−')})`, x, NL_Y - 18);
    }
  }

  function drawPlane() {
    const v = map.view;
    for (const el of B.prob.figure.els) {
      if (!visible(el)) continue;
      if (el.t === 'line') {
        const a = pl(v.x0 - 2, el.m * (v.x0 - 2) + el.n), b = pl(v.x1 + 2, el.m * (v.x1 + 2) + el.n);
        if (el.style === 'dashed') strokeLine(a, b, el.color, 2, { dash: [6, 6] });
        else if (el.style === 'barrier') {
          const f = 0.7 + Math.sin(time * 9) * 0.3;
          ctx.globalAlpha = f;
          strokeLine(a, b, el.color, 5, { glow: true });
          ctx.globalAlpha = 1;
        } else if (el.style === 'laser') {
          strokeLine(a, b, el.color, 5 + Math.sin(time * 20), { glow: true });
          strokeLine(a, b, '#ffffff', 1.5);
        } else strokeLine(a, b, el.color, 3, { glow: el.glow });
      } else if (el.t === 'seg') {
        strokeLine(pl(el.x1, el.y1), pl(el.x2, el.y2), el.color, el.glow ? 4 : 3, { glow: el.glow, dash: el.dashed ? [5, 5] : null });
      } else if (el.t === 'circle') {
        const c = pl(el.cx, el.cy);
        ctx.strokeStyle = el.color;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 10;
        ctx.beginPath(); ctx.arc(c.x, c.y, el.r * map.U, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(c.x, c.y, el.r * map.U, 0, Math.PI * 2); ctx.stroke();
      } else if (el.t === 'pt') {
        const p = pl(el.x, el.y);
        glow(p.x, p.y, 14, el.color, 0.45);
        ctx.fillStyle = el.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
        labelAt(p, el.label, el.color);
      } else if (el.t === 'label') {
        labelAt(pl(el.x, el.y), el.text, el.color, 0, 0);
      } else if (el.t === 'curve') {
        drawCurve(el.f, el.color, el.glow !== false);
        if (el.asym) drawAsym(el.asym[0], el.asym[1], el.color);
      } else if (el.t === 'asym') {
        drawAsym(el.x, el.y, el.color, true);
      } else if (el.t === 'tri') {
        const ps = el.pts.map(([x, y]) => pl(x, y));
        ctx.fillStyle = 'rgba(255,209,102,0.15)';
        ctx.beginPath(); ps.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill();
        for (let i = 0; i < 3; i++) strokeLine(ps[i], ps[(i + 1) % 3], el.color, 3, { glow: true });
      } else if (el.t === 'shield') {
        const s = shieldSegment(el);
        strokeLine(s.a, s.b, fx.shieldFlash > 0 ? '#ffffff' : '#ffd166', 6, { glow: true });
        strokeLine(s.a, s.b, '#fff3c4', 2);
      } else if (el.t === 'heart') {
        const p = pl(el.x, el.y);
        const beat = 1 + Math.max(0, Math.sin(time * 6)) * 0.25;
        glow(p.x, p.y, (B.stepIdx >= 2 ? 34 : 24) * beat, 'rgba(255,51,85,0.6)');
        pixelHeart(p.x, p.y, 2 * beat);
        if (el.labelScan == null || B.revealed >= el.labelScan) labelAt(p, el.label, '#ffd0da', 12, -10);
      }
    }
  }

  // 함수의 그래프: 화면 폭을 따라 점을 찍고, 값이 없거나(NaN) 크게 튀면(점근선) 선을 끊는다
  function drawCurve(f, color, withGlow) {
    const v = map.view, span = (v.y1 - v.y0) * 3;
    const pass = (lw, col, alpha) => {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let pen = false, prev = null;
      for (let px = 0; px <= W; px += 2) {
        const x = (px - map.ox) / map.U, y = f(x);
        if (!Number.isFinite(y) || Math.abs(y - (v.y0 + v.y1) / 2) > span || (prev != null && Math.abs(y - prev) > span / 2)) { pen = false; prev = Number.isFinite(y) ? y : null; continue; }
        const p = pl(x, y);
        if (pen) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
        pen = true; prev = y;
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    if (withGlow) pass(9, color, 0.25);
    pass(3, color, 1);
  }
  function drawAsym(px, qy, color, label) {
    const v = map.view;
    strokeLine(pl(px, v.y0 - 2), pl(px, v.y1 + 2), color, 1.5, { dash: [5, 6] });
    strokeLine(pl(v.x0 - 2, qy), pl(v.x1 + 2, qy), color, 1.5, { dash: [5, 6] });
    if (label) {
      labelAt(pl(px, v.y1 - 0.6), `x = ${String(px).replace('-', '−')}`, color, 4, 0);
      labelAt(pl(v.x0 + 0.3, qy), `y = ${String(qy).replace('-', '−')}`, color, 0, -6);
    }
  }

  // ── 벤 다이어그램 (Ⅱ 집합과 명제) ─────────────────────────
  // 전체집합 U(사각형) 안에 A, B 두 원. 원소는 속한 영역에 놓고, 단계마다 영역을 칠한다.
  const VENN = { x: 168, y: 26, w: 300, h: 250 };
  function vennLayout(fig) {
    if (fig.single) return { A: { x: 300, y: 152, r: 78 }, B: null };
    if (fig.subset) return { A: { x: 300, y: 165, r: 46 }, B: { x: 318, y: 150, r: 100 } };
    return { A: { x: 268, y: 152, r: 78 }, B: { x: 368, y: 152, r: 78 } };
  }
  let shadeCv = null;
  function vennShade(fig, op, color, alpha) {
    const L = vennLayout(fig);
    if (!shadeCv) { shadeCv = document.createElement('canvas'); shadeCv.width = W; shadeCv.height = H; }
    const g = shadeCv.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    g.fillStyle = color;
    const circ = (c) => { g.beginPath(); g.arc(c.x, c.y, c.r, 0, Math.PI * 2); g.fill(); };
    const out = (c) => { if (!c) return; g.globalCompositeOperation = 'destination-out'; circ(c); g.globalCompositeOperation = 'source-over'; };
    const rect = () => g.fillRect(VENN.x, VENN.y, VENN.w, VENN.h);
    const A = L.A, Bc = L.B;
    if (op === 'cap' && Bc) { circ(A); g.globalCompositeOperation = 'destination-in'; circ(Bc); }
    else if (op === 'cap') circ(A);
    else if (op === 'cup') { circ(A); if (Bc) circ(Bc); }
    else if (op === 'diff') { circ(A); out(Bc); }
    else if (op === 'rdiff' && Bc) { circ(Bc); out(A); }
    else if (op === 'complA') { rect(); out(A); }
    else if (op === 'complB') { rect(); out(Bc); }
    else if (op === 'cupC') { rect(); out(A); out(Bc); }
    else if (op === 'capC') {
      rect();
      g.save(); g.beginPath(); g.arc(A.x, A.y, A.r, 0, Math.PI * 2); g.clip();
      g.globalCompositeOperation = 'destination-out'; if (Bc) circ(Bc); else circ(A);
      g.restore();
    }
    g.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
    ctx.drawImage(shadeCv, 0, 0);
    ctx.globalAlpha = 1;
  }
  function vennRegionPos(fig, inA, inB, k) {
    const L = vennLayout(fig);
    let ax, ay;
    if (fig.subset) {
      if (inA) { ax = L.A.x; ay = L.A.y; } else if (inB) { ax = L.B.x + 50; ay = L.B.y - 45; } else { ax = VENN.x + 30; ay = VENN.y + 30; }
    } else if (inA && inB) { ax = (L.A.x + L.B.x) / 2; ay = L.A.y; }
    else if (inA) { ax = L.A.x - (L.B ? 30 : 0); ay = L.A.y; }
    else if (inB) { ax = L.B.x + 30; ay = L.B.y; }
    else { ax = VENN.x + 26; ay = VENN.y + 26; return { x: ax + (k % 6) * 30 + (k >= 6 ? 15 : 0), y: k >= 6 ? VENN.y + VENN.h - 18 : ay }; }
    const col = k % 2, row = Math.floor(k / 2);
    return { x: ax - 12 + col * 26, y: ay - 26 + row * 22 };
  }
  function drawVenn() {
    const fig = B.prob.figure, L = vennLayout(fig);
    const shown = fig.scan == null || B.revealed >= fig.scan;
    // 단계에 따라 칠하기
    for (const sh of fig.shades || []) {
      if (B.stepIdx >= (sh.from || 0) && (sh.until == null || B.stepIdx < sh.until) && shown) vennShade(fig, sh.op, '#7df9ff', 0.22);
    }
    if (fx.venn && fx.venn.life > 0) vennShade(fig, fx.venn.op, '#ffd166', 0.5 * (fx.venn.life / fx.venn.max));
    ctx.strokeStyle = '#6f68a8';
    ctx.lineWidth = 2;
    if (fig.U) {
      ctx.strokeRect(VENN.x, VENN.y, VENN.w, VENN.h);
      labelAt({ x: VENN.x + 4, y: VENN.y + 16 }, fig.counts && fig.counts.U != null && shown ? `U  n(U) = ${fig.counts.U}` : 'U', '#9a95c0', 0, 0);
    }
    const names = fig.names || ['A', 'B'];
    const circle = (c, color, name) => {
      ctx.strokeStyle = color; ctx.globalAlpha = 0.3; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.stroke();
      labelAt({ x: c.x - c.r * 0.75, y: c.y - c.r * 0.75 }, name, color, -6, 0);
    };
    circle(L.A, '#4cc9ff', names[0]);
    if (L.B) circle(L.B, '#ff8c3a', names[1]);
    if (!shown) {
      labelAt({ x: 290, y: 150 }, '???', '#6f68a8', -12, 4);
      return;
    }
    if (fig.counts) {
      if (fig.counts.A != null) labelAt({ x: L.A.x - 60, y: L.A.y + L.A.r + 20 }, `n(${names[0]}) = ${fig.counts.A}`, '#4cc9ff', 0, 0);
      if (L.B && fig.counts.B != null) labelAt({ x: L.B.x - 10, y: L.B.y + L.B.r + 20 }, `n(${names[1]}) = ${fig.counts.B}`, '#ff8c3a', 0, 0);
    }
    for (const cl of fig.countLabel || []) if (B.stepIdx >= cl.from) labelAt({ x: VENN.x + 8, y: VENN.y + VENN.h - 10 - 18 * (fig.countLabel.indexOf(cl)) }, cl.text, '#7df9ff', 0, 0);
    const A = fig.A || [], Bs = fig.B || [];
    const all = [...new Set([...A, ...Bs, ...(Array.isArray(fig.U) ? fig.U : [])])];
    const counters = {};
    ctx.font = `bold 13px ${FONT}`;
    for (const e of all) {
      const inA = A.includes(e), inB = Bs.includes(e), key = `${inA}${inB}`;
      const k = counters[key] = (counters[key] || 0) + 1;
      const p = vennRegionPos(fig, inA, inB, k - 1);
      labelAt(p, String(e).replace('-', '−'), inA && inB ? '#ffd166' : inA ? '#bfe9ff' : inB ? '#ffd0a8' : '#9a95c0', 0, 0);
    }
  }

  // 방패: 방패 직선 위에서 심장의 수선의 발을 중심으로 한 선분
  function shieldSegment(el, half = 2.6) {
    const m = el.m;
    const t = (el.px + m * (el.py - el.n)) / (1 + m * m);
    const fy = m * t + el.n;
    const len = Math.hypot(1, m), dx = half / len, dy = (half * m) / len;
    return { a: pl(t - dx, fy - dy), b: pl(t + dx, fy + dy), foot: pl(t, fy) };
  }

  // ── 스프라이트 그리기 ─────────────────────────────────────
  function anchor() { return ANCHOR[B.def.sprite]; }
  function enemyCenter() {
    const a = anchor();
    return { x: a.x + a.cx, y: a.y + a.cy };
  }
  function drawEnemy() {
    const a = anchor(), kind = baseOf(B.def.sprite), s = SPR[B.def.sprite];
    const white = fx.enemyFlash > 0;
    const fly = ['bat', 'meteor', 'ringSpirit', 'spider'].includes(kind); // 떠 있는 몬스터는 더 크게 흔들림
    const bob = Math.round(Math.sin(time * (fly ? 6 : 2)) * (fly ? 5 : 2));
    const ox = a.x + fx.enemyDx, oy = a.y + bob;
    ctx.globalAlpha = fx.enemyAlpha;
    sprite(s, ox, oy, white);
    if (kind === 'golem') {
      const exposed = B.stepIdx >= 2;
      glow(ox, oy - 13 * s.u, exposed ? 46 : 28, `rgba(255,140,58,${0.6 + Math.sin(time * 4) * 0.3})`);
      blocks([[-2, -15, 4, 4, '#ff8c3a'], [-1, -14, 2, 2, '#ffe08a']], ox, oy, s.u, white, false);
      if (B.stepIdx < 1) for (let i = 0; i < 3; i++) blocks(s.plates[i], ox, oy, s.u, white, true);
    } else if (kind === 'boss') {
      const hx = ox, hy = oy - 19 * s.u;
      const beat = 1 + Math.max(0, Math.sin(time * 6)) * 0.3;
      glow(hx, hy, (B.stepIdx >= 4 ? 60 : 30) * beat, 'rgba(255,51,85,0.7)');
      pixelHeart(hx, hy, (B.stepIdx >= 4 ? 4 : 3) * beat);
      if (B.stepIdx < 4) {
        for (let k = 0; k < 8; k++) {
          const ang = (k * Math.PI) / 4, px = hx + Math.cos(ang) * 30, py = hy + Math.sin(ang) * 30;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(ang + Math.PI / 2);
          ctx.fillStyle = white ? '#fff' : '#0b0912';
          ctx.fillRect(-12, -7, 24, 14);
          ctx.fillStyle = white ? '#fff' : '#9fb4c7';
          ctx.fillRect(-10, -5, 20, 10);
          ctx.fillStyle = '#d6e4f0';
          ctx.fillRect(-10, -5, 20, 2);
          ctx.restore();
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  function drawHero() {
    const s = SPR.hero, ox = HERO.x + fx.heroDx, oy = HERO.y + Math.round(Math.sin(time * 2.4) * 1.5);
    sprite(s, ox, oy, fx.heroFlash > 0);
    glow(ox + 2 * s.u + 3, oy - 15 * s.u + 2, 12 + Math.sin(time * 5) * 3, 'rgba(76,201,255,0.8)');
  }

  // ── 이펙트 ───────────────────────────────────────────────
  function drawFx(dt) {
    for (const t of fx.traces) { // 유니크 사용 흔적: 전투 내내 남는 참격 자국
      ctx.globalAlpha = 0.35 + Math.sin(time * 3) * 0.1;
      strokeLine(t.a, t.b, t.color, 4, { glow: true });
      ctx.globalAlpha = 1;
    }
    if (fx.scanT > 0) { // 스캔 광선: 화면을 위에서 아래로 훑는다
      const y = (1 - fx.scanT / 0.6) * GROUND;
      const g = ctx.createLinearGradient(0, y - 30, 0, y + 4);
      g.addColorStop(0, 'rgba(125,249,255,0)');
      g.addColorStop(1, 'rgba(125,249,255,0.45)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 30, W, 34);
      ctx.fillStyle = '#7df9ff';
      ctx.fillRect(0, y + 2, W, 2);
      fx.scanT -= dt;
    }
    for (const s of fx.slashes) {
      const k = s.life / s.max;
      const p = Math.min(1, (1 - k) * 3);
      const x2 = s.x1 + (s.x2 - s.x1) * p, y2 = s.y1 + (s.y2 - s.y1) * p;
      ctx.globalAlpha = k;
      strokeLine({ x: s.x1, y: s.y1 }, { x: x2, y: y2 }, s.color, s.w, { glow: true });
      strokeLine({ x: s.x1, y: s.y1 }, { x: x2, y: y2 }, '#ffffff', Math.max(1, s.w / 3));
      ctx.globalAlpha = 1;
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

    for (const p of fx.parts) {
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    fx.parts = fx.parts.filter((p) => p.life > 0);

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

  function drawGlitch() {
    const k = fx.glitch / fx.glitchMax;
    for (let i = 0; i < 14; i++) {
      const y = Math.floor(Math.random() * H), h = 4 + Math.floor(Math.random() * 24);
      ctx.drawImage(canvas, 0, y, W, h, (Math.random() - 0.5) * 80 * k, y, W, h);
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

  let time = 0, last = performance.now();
  function frame(now) {
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (fx.hitstop > 0) { fx.hitstop -= dt; dt = 0; } // 크리티컬 순간 정지
    if (fx.slowmo) dt *= 0.25;
    time += dt;
    fx.heroDx *= Math.pow(0.0008, dt);
    fx.enemyDx *= Math.pow(0.0008, dt);
    fx.enemyFlash -= dt; fx.heroFlash -= dt; fx.shieldFlash -= dt;
    fx.shake = Math.max(0, fx.shake - dt * 30);

    ctx.save();
    if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
    if (B) {
      const key = B.def.sprite + (B.prob.figure.kind);
      if (!bgCache[key]) bgCache[key] = makeBg();
      ctx.drawImage(bgCache[key], 0, 0);
      if (!shoulder) drawHero();
      drawEnemy();
      if (B.prob.figure.kind === 'numberline') drawNumberLine();
      else if (B.prob.figure.kind === 'venn') { if (fx.enemyAlpha > 0.05) drawVenn(); }
      else if (fx.enemyAlpha > 0.05) drawPlane();
      if (fx.venn) fx.venn.life -= dt;
      drawFx(dt);
    } else {
      ctx.fillStyle = '#0b0912';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
    if (fx.slowmo) {
      const g = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, 380);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(60,0,20,0.7)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (fx.flash) {
      ctx.globalAlpha = Math.max(0, fx.flash.life / fx.flash.max) * 0.6;
      ctx.fillStyle = fx.flash.color;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      fx.flash.life -= Math.max(dt, 0.016);
      if (fx.flash.life <= 0) fx.flash = null;
    }
    if (fx.glitch > 0) { drawGlitch(); fx.glitch -= Math.max(dt, 0.016); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function slash(x1, y1, x2, y2, color = '#bfefff', w = 6, life = 0.45) {
    fx.slashes.push({ x1, y1, x2, y2, color, w, life, max: life });
  }
  function burst(x, y, n, color, speed = 220, g = 260, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random());
      const life = 0.4 + Math.random() * 0.5;
      fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g, size, color, life, max: life });
    }
  }
  function text(x, y, str, color, size = 28) { fx.texts.push({ x, y, text: str, color, size, life: 1.2 }); }
  function ring(x, y, color, r = 6, grow = 60, life = 0.6) { fx.rings.push({ x, y, color, r, grow, life, max: life }); }
  function shards(cx, cy, n, spread, colors) {
    for (let i = 0; i < n; i++) {
      fx.shards.push({
        x: cx + (Math.random() - 0.5) * spread, y: cy, vx: (Math.random() - 0.3) * 340, vy: -150 - Math.random() * 300,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 20, w: 6 + Math.random() * 10, h: 4 + Math.random() * 6,
        color: colors[i % colors.length], life: 2.2,
      });
    }
  }
  const toCanvas = (x, y) => (B.prob.figure.kind === 'numberline' ? { x: nl(x), y: NL_Y } : map ? pl(x, y) : enemyCenter());

  function shatter(kind) {
    const a = anchor();
    if (kind === 'golemArmor') {
      const u = SPR.golem.u;
      for (const plate of SPR[B.def.sprite].plates || SPR.golem.plates) {
        const [x, y, w] = plate[0];
        shards(a.x + (x + w / 2) * u, a.y + y * u, 8, w * u, ['#9fb4c7', '#7d93a8']);
      }
      text(a.x, a.y - 150, 'ARMOR BREAK!', '#d6e4f0', 22);
    } else if (kind === 'shield') {
      const el = B.prob.figure.els.find((e) => e.t === 'shield');
      const s = shieldSegment(el);
      for (let i = 0; i < 18; i++) {
        const t = Math.random();
        fx.shards.push({
          x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t, vx: (Math.random() - 0.3) * 300, vy: -100 - Math.random() * 250,
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 18, w: 6 + Math.random() * 8, h: 3 + Math.random() * 3, color: '#ffd166', life: 2,
        });
      }
      ring(s.foot.x, s.foot.y, '#ffffff', 4, 70, 0.4);
    } else if (kind === 'ring') { // 원환·방패가 고리 모양으로 부서짐
      const c = enemyCenter();
      for (let k = 0; k < 12; k++) {
        const ang = (k * Math.PI) / 6;
        shards(c.x + Math.cos(ang) * 45, c.y + Math.sin(ang) * 45, 2, 8, ['#c792ff', '#d6e4f0']);
      }
      text(c.x, c.y - 90, 'BREAK!', '#d6e4f0', 22);
    } else if (kind === 'octagon') {
      const hy = a.y - 19 * 5;
      for (let k = 0; k < 8; k++) {
        const ang = (k * Math.PI) / 4;
        shards(a.x + Math.cos(ang) * 30, hy + Math.sin(ang) * 30, 4, 10, ['#9fb4c7', '#d6e4f0']);
      }
      burst(a.x, hy, 60, '#ff3355', 380);
    }
    fx.flash = { color: '#ffffff', life: 0.18, max: 0.18 };
    fx.shake = 18;
  }

  return {
    setBattle(b) {
      B = b;
      resetFx();
      map = b.prob.figure.kind === 'plane' ? makeMap(b.prob.figure.view) : null;
      Object.keys(bgCache).forEach((k) => delete bgCache[k]);
    },
    enemyCenter,

    heroStrike() {
      const c = enemyCenter();
      fx.heroDx = 70;
      slash(c.x - 45, c.y - 55, c.x + 45, c.y + 55, '#bfefff', 6);
      slash(c.x + 45, c.y - 55, c.x - 45, c.y + 55, '#bfefff', 6);
    },
    // 풀이 단계 성공 연출: 문제 그림 위에서 실제 좌표대로 벤다
    stepFx(f = {}) {
      fx.heroDx = 70;
      const color = f.color || '#ffd166';
      if (f.venn) fx.venn = { op: f.venn, life: 1.2, max: 1.2 };
      if (f.nslash) slash(nl(f.nslash[0]), NL_Y, nl(f.nslash[1]), NL_Y, '#7df9ff', 7, 0.6);
      if (f.slash) {
        const a = toCanvas(f.slash[0], f.slash[1]), b = toCanvas(f.slash[2], f.slash[3]);
        slash(a.x, a.y, b.x, b.y, color, 8, 0.7);
        if (f.trace) fx.traces.push({ a, b, color: '#7df9ff' });
      }
      if (f.ring) {
        const p = toCanvas(f.ring[0], f.ring[1]);
        ring(p.x, p.y, '#ffffff', f.ringR && map ? f.ringR * map.U : 6, f.ringR ? 10 : 70, 0.7);
      }
      if (f.triSlash) {
        const t = B.prob.figure.els.find((e) => e.t === 'tri');
        const ps = t.pts.map(([x, y]) => pl(x, y));
        for (let i = 0; i < 3; i++) slash(ps[i].x, ps[i].y, ps[(i + 1) % 3].x, ps[(i + 1) % 3].y, '#ffd166', 6, 0.8);
      }
      if (f.xslash) {
        const c = enemyCenter();
        slash(c.x - 110, c.y - 110, c.x + 110, c.y + 110, '#7df9ff', 10, 0.8);
        slash(c.x + 110, c.y - 110, c.x - 110, c.y + 110, '#7df9ff', 10, 0.8);
        if (f.trace) {
          fx.traces.push({ a: { x: c.x - 110, y: c.y - 110 }, b: { x: c.x + 110, y: c.y + 110 }, color: '#7df9ff' });
          fx.traces.push({ a: { x: c.x + 110, y: c.y - 110 }, b: { x: c.x - 110, y: c.y + 110 }, color: '#7df9ff' });
        }
      }
      if (f.shatter) shatter(f.shatter);
      if (f.finisher) {
        const c = enemyCenter();
        for (let i = 0; i < 6; i++) {
          const ang = (i * Math.PI) / 3;
          slash(c.x - Math.cos(ang) * 160, c.y - Math.sin(ang) * 160, c.x + Math.cos(ang) * 160, c.y + Math.sin(ang) * 160, '#ffd166', 9, 0.9);
        }
        fx.flash = { color: '#ffffff', life: 0.4, max: 0.4 };
        fx.shake = 24;
      }
    },
    enemyHit(dmg, note, crit) {
      const c = enemyCenter();
      fx.enemyFlash = 0.12;
      fx.shake = Math.max(fx.shake, crit ? 20 : dmg >= 12 ? 12 : 6);
      burst(c.x, c.y, crit ? 50 : dmg >= 12 ? 30 : 16, crit ? '#ffd166' : '#7df9ff', crit ? 360 : 220);
      if (crit) {
        fx.hitstop = 0.14;
        fx.flash = { color: '#ffd166', life: 0.2, max: 0.2 };
        text(c.x, c.y - 70, 'CRITICAL!', '#ffd166', 30);
      }
      text(c.x + (Math.random() - 0.5) * 30, c.y - 30, String(dmg), crit ? '#ffd166' : '#ffffff', crit ? 44 : dmg >= 12 ? 36 : 30);
      if (note) text(c.x, c.y - 100, note, '#ffd166', 15);
    },
    gateLock() {
      const c = enemyCenter();
      ring(c.x, c.y, '#ffd166', 30, 20, 0.5);
      text(c.x, c.y - 120, '결계 보호막! 풀이가 필요하다', '#ffd166', 16);
      fx.shieldFlash = 0.15;
    },
    blocked(amount) {
      const c = enemyCenter();
      text(c.x, c.y - 10, `방어 −${amount}`, '#9fb4c7', 16);
    },
    heroGuard(amount) {
      ring(HERO.x, HERO.y - 50, '#4cc9ff', 20, 30, 0.45);
      text(HERO.x, HERO.y - 110, `+${amount} 방어`, '#4cc9ff', 18);
    },
    fizzle() {
      burst(HERO.x + 20, HERO.y - 60, 14, '#6f68a8', 120, 100, 2);
      text(HERO.x + 30, HERO.y - 110, '수식 붕괴…', '#9a95c0', 16);
    },
    wrongTool() {
      ring(HERO.x + 20, HERO.y - 60, '#9a95c0', 10, 30, 0.4);
      text(HERO.x + 40, HERO.y - 110, '맞지 않는 도구', '#9a95c0', 15);
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
      text(c.x, c.y - 90, label, '#9fb4c7', 16);
    },
    note(str, color = '#ffd166') {
      const c = enemyCenter();
      text(c.x - 60, c.y - 140, str, color, 17);
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
    setSlowmo(on) { fx.slowmo = on; },
    setShoulder(on) { shoulder = !!on; },
    heroSprite: () => SPR.hero,
    scanFx() {
      fx.scanT = 0.6;
      const c = enemyCenter();
      text(c.x, c.y - 130, 'SCAN', '#7df9ff', 18);
    },
    rewind(seconds = 1.6) { fx.glitch = seconds; fx.glitchMax = seconds; },
  };
};
