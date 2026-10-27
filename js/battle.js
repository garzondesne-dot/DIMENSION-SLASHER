// 턴제 전투: 몬스터 = 문제. 풀이 도구 카드를 맞는 단계에 써야 문턱이 깨지고 영구 패널티가 걸린다.
// 공격 카드는 문턱을 넘지 못한다 → 모든 단계를 풀어야 쓰러뜨릴 수 있다.
// 쓰러지면 게임오버 대신 테이프 되감기로 같은 문제에 재도전한다(소프트 리트라이).
window.DS = window.DS || {};

DS.Battle = (function () {
  const $ = (s) => document.querySelector(s);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const { pretty, esc } = DS.UI;
  const toast = (m, ms) => DS.UI.toast(m, ms);

  const HAND_SIZE = 5, MAX_ENERGY = 3, PLAYER_HP = 50;
  const CIRCLED = '①②③④⑤⑥⑦⑧';
  let B = null, scene = null, busy = false, hooks = {};

  const curStep = () => B.prob.steps[B.stepIdx];
  const gateFloor = () => (B.stepIdx < B.prob.steps.length ? B.def.gates[B.stepIdx] : 0);

  function start(opts) {
    hooks = opts;
    const def = opts.def;
    B = {
      def, prob: opts.problem, trial: !!opts.trial,
      stepIdx: 0, mult: def.startMult, atkDown: 0, phaseShown: -1, forged: false,
      player: { hp: PLAYER_HP, max: PLAYER_HP, block: 0 },
      energy: MAX_ENERGY,
      draw: DS.MathGen.shuffle(opts.deck), hand: [], discard: [],
      turn: 0,
      enemy: { hp: def.maxHp, max: def.maxHp, block: 0, intent: 0 },
    };
    if (!scene) scene = DS.Scene($('#stage'));
    scene.setBattle(B);
    $('#b-floor').textContent = opts.title;
    $('#b-loop').textContent = 'LOOP ' + String(opts.loop).padStart(3, '0');
    busy = true;
    render();
    toast(def.intro, 3000);
    (async () => {
      await checkPhase();
      await startTurn();
    })();
  }

  async function startTurn() {
    busy = true;
    B.turn++;
    B.player.block = 0;
    B.energy = MAX_ENERGY;
    drawCards(HAND_SIZE);
    render();
    await ensureTool();
    busy = false;
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

  // 최종보스 체험판: 지금 단계의 도구를 손에 쥐여 준다 (기억 복원 / 전투 중 연성)
  async function ensureTool() {
    const step = curStep();
    if (!B.trial || !step || !step.grant || B.hand.includes(step.tool)) return;
    [B.draw, B.discard].forEach((pile) => { const k = pile.indexOf(step.tool); if (k >= 0) pile.splice(k, 1); });
    if (step.forge && !B.forged) {
      B.forged = true;
      await DS.Cinematic.forge(step.forge.from, step.tool);
    } else {
      await DS.Cinematic.grant(step.tool);
    }
    B.hand.push(step.tool);
    render();
  }

  async function checkPhase() {
    const ph = B.def.phases;
    if (!ph) return;
    let idx = 0;
    ph.forEach((p, i) => { if (B.stepIdx >= p.from) idx = i; });
    if (idx !== B.phaseShown) {
      B.phaseShown = idx;
      await DS.Cinematic.banner(ph[idx].title);
    }
  }

  // ── 화면 갱신 ─────────────────────────────────────────────
  function statusChips() {
    const e = B.enemy, chips = [];
    if (B.mult < 1) chips.push(`<span class="chip armor">방어막: 받는 피해 ½</span>`);
    if (B.mult > 1) chips.push(`<span class="chip weak">약점 노출: 받는 피해 ×${B.mult}</span>`);
    if (B.atkDown) chips.push(`<span class="chip down">공격 −${B.atkDown}</span>`);
    if (e.block) chips.push(`<span class="chip block">방어 ${e.block}</span>`);
    return chips.join('');
  }

  function render() {
    const e = B.enemy, p = B.player, def = B.def, steps = B.prob.steps;
    $('#prob-text').innerHTML = pretty(B.prob.text);
    $('#prob-steps').innerHTML = steps.map((s, i) => {
      const st = i < B.stepIdx ? 'done' : i === B.stepIdx ? 'cur' : 'todo';
      return `<span class="step ${st}">${CIRCLED[i]}</span>`;
    }).join('');
    const step = curStep();
    $('#prob-goal').innerHTML = step ? `다음 단계: <b>${pretty(step.goal)}</b>` : '<b class="ok">모든 단계 해결! 공격으로 마무리하라</b>';

    $('#e-name').textContent = def.name;
    $('#e-hpfill').style.width = (100 * e.hp) / e.max + '%';
    $('#e-hptext').textContent = `${e.hp} / ${e.max}`;
    $('#e-gates').innerHTML = def.gates.map((g, i) => (i < B.stepIdx || g <= 0 ? ''
      : `<i class="gate${i === B.stepIdx ? ' cur' : ''}" style="left:${(100 * g) / e.max}%" title="문턱 ${i + 1}"></i>`)).join('');
    $('#e-status').innerHTML = statusChips();
    const it = def.intents[e.intent % def.intents.length];
    const v = Math.max(0, it.v - B.atkDown);
    $('#e-intent').innerHTML = e.hp > 0
      ? `다음 행동: <span class="intent atk">⚔ ${v}</span> ${esc(it.label)}${it.block ? ` <span class="intent buff">+방어 ${it.block}</span>` : ''}` : '';

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
    el.className = `card tier-${c.tier}`;
    if (c.cost > B.energy || busy) el.classList.add('dim');
    el.innerHTML = `<span class="cost">${c.cost}</span>`
      + (c.tier !== 'basic' ? `<span class="tier-badge">${DS.Tiers[c.tier].name}</span>` : '')
      + `<span class="cname">${esc(c.name)}</span>`
      + (c.formula ? `<span class="formula math">${pretty(c.formula)}</span>` : '')
      + `<span class="cdesc">${esc(c.desc)}</span>`
      + (c.tier !== 'basic' ? '<span class="tag">풀이 도구</span>' : '');
    el.addEventListener('click', () => play(i));
    return el;
  }

  // ── 카드 사용 ─────────────────────────────────────────────
  async function play(i) {
    if (busy || !B) return;
    const id = B.hand[i], c = DS.Cards[id];
    if (c.tier !== 'basic') {
      const st = curStep();
      if (!st || st.qte) { toast('문제는 이미 다 풀었다. 공격으로 마무리하자!'); return; }
    }
    if (c.cost > B.energy) { toast('기력이 부족하다'); DS.Sound.wrong(); return; }
    busy = true;
    DS.Sound.card();
    B.energy -= c.cost;

    if (c.tier === 'basic') {
      B.hand.splice(i, 1);
      B.discard.push(id);
      render();
      if (c.effect.block) {
        B.player.block += c.effect.block;
        DS.Sound.block();
        scene.heroGuard(c.effect.block);
        await wait(250);
      } else {
        scene.heroStrike();
        DS.Sound.slash();
        await wait(150);
        await dealDamage(c.effect.dmg, {});
      }
    } else {
      const step = curStep();
      if (id !== step.tool) {
        // 맞지 않는 도구: 기력은 쓰지만 카드는 손에 남는다
        const later = B.prob.steps.findIndex((s, j) => j > B.stepIdx && s.tool === id);
        scene.wrongTool();
        DS.Sound.wrong();
        toast(later >= 0 ? `그 도구는 나중 단계에 필요해요. 지금 목표: ${step.goal}`
          : `이 도구로는 지금 단계를 풀 수 없어요. 목표: ${step.goal}`, 2800);
        if (hooks.onWrongTool) hooks.onWrongTool();
      } else {
        B.hand.splice(i, 1);
        render();
        const prob = step.challenge();
        const ok = await DS.Challenge.resolve(c, prob);
        if (hooks.onAnswer) hooks.onAnswer(ok);
        B.discard.push(id);
        if (ok) await solveStep(c, step);
        else { scene.fizzle(); await wait(400); }
      }
    }
    if (B.enemy.hp <= 0) { await victory(); return; }
    busy = false;
    render();
  }

  async function solveStep(c, step) {
    const S = DS.Sound;
    S.magic();
    if (step.cutin) await DS.Cinematic.cutin(step.cutin);
    scene.stepFx(step.fx);
    S.slash();
    if (step.fx && step.fx.shatter) (step.fx.shatter === 'shield' ? S.shieldBreak : S.armorBreak)();
    const pen = step.penalty;
    if (pen.mult != null) B.mult = pen.mult;
    if (pen.atkDown) B.atkDown += pen.atkDown;
    B.stepIdx++;
    if (hooks.onStep) hooks.onStep();
    scene.note(pen.label);
    render();
    await wait(350);

    // 크리티컬: 매직 이상 도구로 풀었을 때 확률적으로 터진다
    const t = DS.Tiers[c.tier];
    const crit = !!t.crit && Math.random() < t.crit;
    if (crit && hooks.onCrit) hooks.onCrit();
    await dealDamage(step.dmg * (crit ? t.critMult : 1), { crit });

    await checkPhase();
    if (step.then === 'qte') await runQTE();
    else await ensureTool();
  }

  // 피해: 몬스터 상태 배율 → 방어 → 문턱(다음 미해결 단계의 체력선 아래로는 못 내려감)
  async function dealDamage(raw, { crit }) {
    const e = B.enemy;
    let d = Math.max(1, Math.round(raw * B.mult));
    const absorbed = Math.min(e.block, d);
    e.block -= absorbed;
    d -= absorbed;
    const floor = gateFloor();
    let locked = false;
    if (e.hp - d < floor) { d = Math.max(0, e.hp - floor); locked = true; }
    e.hp -= d;
    DS.Sound.hit();
    if (crit) DS.Sound.crit();
    scene.enemyHit(d, '', crit);
    if (absorbed) scene.blocked(absorbed);
    if (locked && floor > 0) {
      scene.gateLock();
      toast(`문턱에 막혔다! 다음 단계: ${curStep().goal}`, 2600);
    }
    render();
    await wait(380);
  }

  // 5초 QTE: 틀리거나 시간 초과면 3초 전으로 되감기 후 즉시 재도전
  async function runQTE() {
    const step = curStep();
    scene.setSlowmo(true);
    for (;;) {
      const ok = await DS.Cinematic.qte(step.challenge(), 5);
      if (hooks.onAnswer) hooks.onAnswer(ok);
      if (ok) break;
      scene.setSlowmo(false);
      DS.Sound.rewind();
      scene.rewind(1.2);
      toast('◀◀ 3초 전으로 되감기… 다시!', 1400);
      await wait(1400);
      scene.setSlowmo(true);
    }
    scene.setSlowmo(false);
    B.stepIdx++;
    if (hooks.onStep) hooks.onStep();
    scene.stepFx(step.fx);
    DS.Sound.armorBreak();
    scene.note(step.penalty.label, '#ffffff');
    B.enemy.hp = 0;
    render();
    await wait(600);
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
    if (it.block) e.block += it.block;
    let dmg = Math.max(0, it.v - B.atkDown);
    const blocked = Math.min(p.block, dmg);
    p.block -= blocked;
    dmg -= blocked;
    p.hp = Math.max(0, p.hp - dmg);
    DS.Sound.enemyAtk();
    scene.enemyAttack(dmg, blocked);
    if (dmg > 0) setTimeout(() => DS.Sound.hurt(), 120);
    e.intent++;
    render();
    await wait(750);

    if (p.hp <= 0) { await rewind(); return; }
    await startTurn();
  }

  async function rewind() {
    DS.Sound.rewind();
    scene.rewind(1.6);
    toast('쓰러졌다… 시간이 되감긴다. 같은 문제에 다시 도전!', 1800);
    await wait(1700);
    hooks.onLose();
  }

  async function victory() {
    busy = true;
    render();
    scene.enemyDeath();
    DS.Sound.victory();
    await wait(1500);
    hooks.onWin();
  }

  function bind() {
    $('#end-turn').addEventListener('click', endTurn);
  }

  // 자동 플레이 테스트용 읽기 전용 조회
  function state() {
    if (!B) return null;
    const s = curStep();
    return { busy, stepIdx: B.stepIdx, tool: s ? s.tool : null, qte: !!(s && s.qte), hand: B.hand.slice(), energy: B.energy, hp: B.enemy.hp, floor: gateFloor() };
  }

  return { start, bind, state };
})();
