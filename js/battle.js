// 턴제 카드 전투: 드로우 → 카드 사용(공식 카드는 문제 풀이) → 턴 종료 → 적 행동
// 플레이어가 쓰러지면 게임오버 대신 테이프 되감기로 같은 층을 처음부터 다시 한다(소프트 리트라이).
window.DS = window.DS || {};

DS.Battle = (function () {
  const $ = (s) => document.querySelector(s);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const { pretty, esc } = DS.UI;
  const num = (v) => DS.MathGen.num(v);

  const HAND_SIZE = 5, MAX_ENERGY = 3, PLAYER_HP = 50;
  let B = null, scene = null, busy = false, hooks = {};

  function start(opts) {
    hooks = opts;
    const def = DS.Enemies[opts.enemyId];
    B = {
      def,
      player: { hp: PLAYER_HP, max: PLAYER_HP, block: 0 },
      energy: MAX_ENERGY,
      draw: DS.MathGen.shuffle(opts.deck), hand: [], discard: [],
      turn: 0,
      enemy: { hp: def.maxHp, max: def.maxHp, block: 0, armor: def.armor || 0, shieldUp: !!def.shield, intent: 0, ctx: null },
    };
    if (!scene) scene = DS.Scene($('#stage'));
    scene.setBattle(B);
    $('#b-floor').textContent = opts.floorInfo.title;
    $('#b-loop').textContent = 'LOOP ' + String(opts.loop).padStart(3, '0');
    $('#b-rule').textContent = def.rule;
    busy = false;
    startTurn();
    DS.UI.toast(def.intro, 3200);
  }

  function startTurn() {
    B.turn++;
    B.player.block = 0;
    B.energy = MAX_ENERGY;
    B.def.roll(B.enemy);
    drawCards(HAND_SIZE);
    render();
  }

  function drawCards(n) {
    for (let i = 0; i < n; i++) {
      if (!B.draw.length) {
        if (!B.discard.length) break;
        B.draw = DS.MathGen.shuffle(B.discard);
        B.discard = [];
      }
      B.hand.push(B.draw.pop());
    }
  }

  // ── 화면 갱신 ─────────────────────────────────────────────
  function intentHtml(it) {
    if (it.kind === 'fortify') return `<span class="intent buff">▲ ${esc(it.label)}</span>`;
    let s = `<span class="intent atk">⚔ ${it.v}</span> ${esc(it.label)}`;
    if (it.block) s += ` <span class="intent buff">+방어 ${it.block}</span>`;
    return s;
  }

  function ctxHtml() {
    const c = B.enemy.ctx;
    if (!c) return '';
    if (B.def.floor === 1) {
      return `수직선 위 팔의 좌표 <b class="ca">A(${num(c.a)})</b> · <b class="cb">B(${num(c.b)})</b>`;
    }
    return `방패 <b class="cs math">${pretty(DS.MathGen.lineStr(c.m, c.n))}</b> · 심장 <b class="cp">P(${num(c.P.a)}, ${num(c.P.b)})</b>`;
  }

  function render() {
    const e = B.enemy, p = B.player, def = B.def;
    $('#e-name').textContent = def.name;
    $('#e-hpfill').style.width = (100 * e.hp) / e.max + '%';
    $('#e-hptext').textContent = `${e.hp} / ${e.max}`;
    const chips = [];
    if (e.block) chips.push(`<span class="chip block">방어 ${e.block}</span>`);
    if (def.armor) chips.push(`<span class="chip armor${e.armor ? '' : ' off'}">철갑 ${'■'.repeat(e.armor)}${'□'.repeat(def.armor - e.armor)}</span>`);
    if (def.shield) chips.push(`<span class="chip shield${e.shieldUp ? '' : ' off'}">${e.shieldUp ? '방패 전개' : '방패 파괴됨'}</span>`);
    $('#e-status').innerHTML = chips.join('');
    $('#e-intent').innerHTML = e.hp > 0 ? '다음 행동: ' + intentHtml(def.intents[e.intent % def.intents.length]) : '';
    $('#e-ctx').innerHTML = ctxHtml();

    $('#p-hpfill').style.width = (100 * p.hp) / p.max + '%';
    $('#p-hptext').textContent = `${p.hp} / ${p.max}`;
    $('#p-block').textContent = p.block ? `방어 ${p.block}` : '';
    $('#p-energy').innerHTML = '<i class="on"></i>'.repeat(B.energy) + '<i></i>'.repeat(MAX_ENERGY - B.energy);
    $('#p-piles').textContent = `덱 ${B.draw.length} · 버림 ${B.discard.length}`;

    const hand = $('#hand');
    hand.innerHTML = '';
    B.hand.forEach((id, i) => hand.appendChild(cardEl(id, i)));
    $('#end-turn').disabled = busy;
  }

  function cardEl(id, i) {
    const c = DS.Cards[id];
    const el = document.createElement('button');
    el.className = `card t${c.tier}`;
    if (c.cost > B.energy || busy) el.classList.add('dim');
    el.innerHTML = `<span class="cost">${c.cost}</span><span class="cname">${esc(c.name)}</span>`
      + (c.formula ? `<span class="formula math">${pretty(c.formula)}</span>` : '')
      + `<span class="cdesc">${esc(c.desc)}</span>`
      + (c.math ? '<span class="tag">수식</span>' : '');
    el.addEventListener('click', () => play(i));
    return el;
  }

  // ── 카드 사용 ─────────────────────────────────────────────
  async function play(i) {
    if (busy || !B) return;
    const id = B.hand[i], c = DS.Cards[id];
    if (c.cost > B.energy) { DS.UI.toast('기력이 부족하다'); DS.Sound.wrong(); return; }
    busy = true;
    DS.Sound.card();
    B.energy -= c.cost;
    B.hand.splice(i, 1);
    render();

    let ok = true, prob = null;
    if (c.math) {
      prob = DS.MathGen.gen[c.math](B.enemy.ctx || {});
      ok = await DS.Quiz.ask(c, prob);
      if (hooks.onAnswer) hooks.onAnswer(ok);
    }
    if (ok) await resolve(id, c, prob);
    else { scene.fizzle(); await wait(400); }
    B.discard.push(id);

    if (B.enemy.hp <= 0) { await victory(); return; }
    busy = false;
    render();
  }

  async function resolve(id, c, prob) {
    const e = B.enemy, eff = c.effect, S = DS.Sound;
    if (c.math) S.magic();

    if (eff.block) {
      B.player.block += eff.block;
      S.block();
      scene.heroGuard(eff.block);
      render();
      await wait(300);
      return;
    }

    scene.heroAttack(id, prob && prob.params);
    S.slash();
    await wait(160);

    if (eff.armorBreak && e.armor > 0) {
      e.armor -= 1;
      scene.armorShatter(e.armor);
      S.armorBreak();
      render();
      await wait(250);
    }
    if (eff.shieldBreak && e.shieldUp) {
      e.shieldUp = false;
      scene.shieldShatter();
      S.shieldBreak();
      render();
      await wait(250);
    }

    let d = eff.dmg, note = '';
    if (!c.math && e.armor > 0) { d = Math.max(1, Math.floor(d / 2)); note = '철갑에 막힘 ½'; }
    if (B.def.shield && e.shieldUp && !eff.pierce) { d = Math.max(1, Math.floor(d / 2)); note = '방패에 막힘 ½'; scene.shieldDeflect(); }
    const absorbed = Math.min(e.block, d);
    e.block -= absorbed;
    d -= absorbed;
    e.hp = Math.max(0, e.hp - d);
    S.hit();
    scene.enemyHit(d, note);
    if (absorbed) scene.blocked(absorbed);
    render();
    await wait(350);
  }

  // ── 적 턴 ────────────────────────────────────────────────
  async function endTurn() {
    if (busy || !B) return;
    busy = true;
    B.discard.push(...B.hand);
    B.hand = [];
    render();
    await wait(350);

    const e = B.enemy, def = B.def, p = B.player;
    const it = def.intents[e.intent % def.intents.length];
    e.block = 0;
    if (it.kind === 'fortify') {
      const before = e.armor;
      e.armor = Math.min(def.armor, e.armor + it.v);
      e.block += it.block;
      DS.Sound.block();
      scene.enemyBuff(e.armor > before ? `철갑 수복! +방어 ${it.block}` : `방어 +${it.block}`);
    } else {
      if (it.block) e.block += it.block;
      let dmg = it.v;
      const blocked = Math.min(p.block, dmg);
      p.block -= blocked;
      dmg -= blocked;
      p.hp = Math.max(0, p.hp - dmg);
      DS.Sound.enemyAtk();
      scene.enemyAttack(dmg, blocked);
      if (dmg > 0) setTimeout(() => DS.Sound.hurt(), 120);
    }
    e.intent++;
    render();
    await wait(750);

    if (p.hp <= 0) { await rewind(); return; }
    startTurn();
    busy = false;
    render();
  }

  async function rewind() {
    DS.Sound.rewind();
    scene.rewind(1.6);
    DS.UI.toast('쓰러졌다… 시간이 되감긴다', 1600);
    await wait(1700);
    hooks.onLose();
  }

  async function victory() {
    render();
    scene.enemyDeath();
    DS.Sound.victory();
    await wait(1500);
    hooks.onWin();
  }

  function bind() {
    $('#end-turn').addEventListener('click', endTurn);
  }

  return { start, bind };
})();
