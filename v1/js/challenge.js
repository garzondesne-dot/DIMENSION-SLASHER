// 도전 처리기: 전투는 "이 풀이 단계를 맞혔나?"만 묻고, 어떤 방식으로 묻는지는 여기서 정한다.
//  - 4지선다 (기본)
//  - 조준 (v1.0 테스트판): 답이 점이면 좌표판을 눌러 조준 → 빗나가면 같은 문제를 4지선다로 (확정안: 조준 먼저, 막히면 4지선다)
window.DS = window.DS || {};

DS.Challenge = (function () {
  const { pretty } = DS.UI;
  const neg = (v) => String(Math.round(v * 100) / 100).replace('-', '−');

  function aim(card, prob) {
    DS.Challenge.lastAim = prob; // 자동 플레이 테스트용
    return new Promise((resolve) => {
      const a = prob.aim, step = a.step || 1;
      const el = document.createElement('div');
      el.className = 'cine aim';
      el.innerHTML = `<div class="aim-box">
        <p class="aim-head"><b>🎯 조준 · ${card.name}</b></p>
        <p class="aim-q math">${pretty(prob.question)}</p>
        <canvas width="480" height="320"></canvas>
        <p class="aim-read">좌표판을 눌러 ${a.label || '답'}의 위치를 조준하세요</p>
        <div class="aim-btns"><button class="btn primary fire" disabled>🎯 발사</button><button class="btn small skip">4지선다로 풀기</button></div>
      </div>`;
      document.body.appendChild(el);
      const cv = el.querySelector('canvas');
      const d = { ...prob.diagram, extent: [[a.x, a.y]] };
      let pick = null;
      const draw = () => {
        DS.Diagram.draw(cv, d);
        if (!pick) return;
        const m = DS.Diagram.lastMap, g = cv.getContext('2d');
        const p = m.P(pick.x, pick.y);
        g.strokeStyle = '#ff3355'; g.lineWidth = 2;
        g.beginPath(); g.arc(p.x, p.y, 12, 0, Math.PI * 2); g.moveTo(p.x - 18, p.y); g.lineTo(p.x + 18, p.y); g.moveTo(p.x, p.y - 18); g.lineTo(p.x, p.y + 18); g.stroke();
      };
      draw();
      const at = (ev) => {
        const r = cv.getBoundingClientRect(), m = DS.Diagram.lastMap;
        const px = ((ev.clientX - r.left) / r.width) * cv.width, py = ((ev.clientY - r.top) / r.height) * cv.height;
        const x = m.cx + (px - m.W / 2) / m.u, y = m.cy - (py - m.H / 2) / m.u;
        return { x: Math.round(x / step) * step, y: Math.round(y / step) * step };
      };
      cv.addEventListener('pointerdown', (ev) => {
        pick = at(ev);
        DS.Sound.clank();
        el.querySelector('.aim-read').innerHTML = `조준점: <b>(${neg(pick.x)}, ${neg(pick.y)})</b>`;
        el.querySelector('.fire').disabled = false;
        draw();
      });
      const done = (r) => { el.remove(); resolve(r); };
      el.querySelector('.fire').addEventListener('click', () => {
        const hit = Math.abs(pick.x - a.x) < 1e-6 && Math.abs(pick.y - a.y) < 1e-6;
        if (hit) { DS.Sound.correct(); el.classList.add('ok'); setTimeout(() => done('hit'), 450); }
        else { DS.Sound.wrong(); el.classList.add('ng'); el.querySelector('.aim-read').innerHTML = '빗나갔다! 같은 문제를 4지선다로 풀어 보자'; setTimeout(() => done('miss'), 900); }
      });
      el.querySelector('.skip').addEventListener('click', () => done('skip'));
    });
  }

  async function resolve(card, prob, opt) {
    const canAim = DS.Settings.get('aim') && prob.aim && prob.diagram && prob.diagram.type === 'plane';
    if (canAim) {
      const r = await aim(card, prob);
      if (r === 'hit') return true;
    }
    return DS.Quiz.ask(card, prob, opt);
  }

  return { resolve, aim };
})();
