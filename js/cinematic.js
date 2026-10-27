// 연출 오버레이: 페이즈 배너, 기억 복원(카드 지급), 전투 중 유니크 연성, 만화 컷인, 5초 QTE
window.DS = window.DS || {};

DS.Cinematic = (function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const { pretty, esc } = DS.UI;

  function layer(cls, html) {
    const el = document.createElement('div');
    el.className = `cine ${cls}`;
    el.innerHTML = html;
    document.body.appendChild(el);
    return el;
  }
  const cardHtml = (id) => {
    const c = DS.Cards[id];
    return `<div class="card tier-${c.tier}"><span class="tier-badge">${DS.Tiers[c.tier].name}</span>`
      + `<span class="cname">${esc(c.name)}</span><span class="formula math">${pretty(c.formula || '')}</span></div>`;
  };

  // 페이즈 전환 배너 (기다리지 않아도 됨)
  async function banner(text) {
    const el = layer('banner', `<div>${esc(text)}</div>`);
    DS.Sound.whoosh();
    await wait(1600);
    el.remove();
  }

  // 기억 복원: 최종보스 체험판에서 풀이 단계에 필요한 카드를 손에 쥐여 준다
  async function grant(id) {
    const el = layer('grant', `<p>기억 복원</p>${cardHtml(id)}`);
    DS.Sound.magic();
    await wait(1100);
    el.classList.add('out');
    await wait(300);
    el.remove();
  }

  // 전투 중 유니크 연성: 레어 두 장이 합쳐져 유니크가 된다 (레어는 사라지지 않음)
  async function forge(fromIds, outId) {
    const el = layer('forge-battle', `<p class="fb-title">전투 중 각성 연성</p>
      <div class="fb-row"><div class="fb-in l">${cardHtml(fromIds[0])}</div><span class="fb-plus">+</span>
      <div class="fb-in r">${cardHtml(fromIds[1])}</div></div>
      <div class="fb-out">${cardHtml(outId)}</div>
      <p class="fb-note">레어 카드는 사라지지 않는다 · 유니크는 이 전투에서만 존재한다</p>`);
    DS.Sound.forge();
    await wait(900);
    el.classList.add('merge');
    DS.Sound.armorBreak();
    await wait(1300);
    el.remove();
  }

  // 만화 컷인: 흑백 집중선 + 푸른 안광 + 기술명
  async function cutin({ title, sub }) {
    const el = layer('cutin', `<div class="cut-band"><div class="cut-eye"><i></i></div>
      <div class="cut-text"><b>${esc(title)}</b><span class="math">${pretty(sub || '')}</span></div></div>`);
    DS.Sound.whoosh();
    await wait(1250);
    DS.Sound.slash();
    el.classList.add('out');
    await wait(250);
    el.remove();
  }

  // 5초 QTE: 정답이면 true, 오답·시간 초과면 false
  function qte(prob, seconds = 5) {
    return new Promise((resolve) => {
      const el = layer('qte', `<div class="qte-box">
        <p class="qte-title">QTE · 심장 타격</p>
        <p class="qte-q math">${pretty(prob.question)}</p>
        <div class="qte-timer"><i></i></div>
        <div class="qte-choices">${prob.choices.map((c, i) => `<button class="choice" data-i="${i}"><span class="no">${i + 1}</span><span class="math">${pretty(c)}</span></button>`).join('')}</div>
      </div>`);
      const bar = el.querySelector('.qte-timer i');
      const start = performance.now();
      let done = false;
      const beat = setInterval(() => DS.Sound.heartbeat(), 600);
      DS.Sound.heartbeat();
      const finish = (ok) => {
        if (done) return;
        done = true;
        clearInterval(beat);
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', onKey);
        el.classList.add(ok ? 'ok' : 'ng');
        if (ok) DS.Sound.correct(); else DS.Sound.wrong();
        setTimeout(() => { el.remove(); resolve(ok); }, ok ? 500 : 700);
      };
      let raf = 0;
      const tick = () => {
        const left = Math.max(0, 1 - (performance.now() - start) / (seconds * 1000));
        bar.style.width = left * 100 + '%';
        if (left <= 0) finish(false);
        else raf = requestAnimationFrame(tick);
      };
      tick();
      el.querySelectorAll('.choice').forEach((b) => b.addEventListener('click', () => {
        const i = Number(b.dataset.i);
        b.classList.add(i === prob.answerIndex ? 'right' : 'wrong');
        finish(i === prob.answerIndex);
      }));
      const onKey = (e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= 4) el.querySelectorAll('.choice')[n - 1].click();
      };
      window.addEventListener('keydown', onKey);
    });
  }

  // 선택지 창: 고른 버튼의 번호를 돌려준다
  function choice(title, desc, options) {
    return new Promise((resolve) => {
      const el = layer('choice', `<div class="choice-box"><p class="ch-title">${esc(title)}</p>
        <p class="ch-desc">${esc(desc)}</p>
        <div class="ch-opts">${options.map((o, i) => `<button class="btn${i === 0 ? ' primary' : ''}" data-i="${i}">${esc(o)}</button>`).join('')}</div></div>`);
      el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { el.remove(); resolve(Number(b.dataset.i)); }));
    });
  }

  return { banner, grant, forge, cutin, qte, choice };
})();
