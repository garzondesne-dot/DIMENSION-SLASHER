// 턴제 전투: 몬스터 = 문제
//  - 문제는 조각으로 나뉘어 스캔 카드로 공개한다 (첫 턴 1조각 무료)
//  - 문턱 전에는 모든 카드가 공격·방어(+스캔)로 작동한다
//  - 문턱에서는 맞는 풀이 카드만 문턱을 깬다 (그 단계에 필요한 조각이 공개돼 있어야 함)
//  - 공격·크리티컬·옵션 효과는 문턱을 넘지 못한다
//  - 전투는 덱의 복사본으로 진행 → 긴급 연성·기억 복원 카드는 전투가 끝나면 사라지고 재료는 원래대로
//  - 적의 의도에 디버프가 붙으면 플레이어가 취약(받는 피해 ×1.5)·약화(카드 공격 ×0.75)에 걸린다 (풀이 피해는 약화 안 됨)
//  - 단계에 forge 가 있으면 전투 중 각성: 재료 레어 중 하나는 손에, 나머지는 덱에 있으면 유니크가 연성된다
window.DS = window.DS || {};

DS.Battle = (function () {
  const $ = (s) => document.querySelector(s);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const { pretty, esc } = DS.UI;
  const K = DS.CardKit;
  const toast = (m, ms) => DS.UI.toast(m, ms);
  // 진동 (v0.3.1): 폰에서 공격·방어·피격·풀이에 울림. 웹 진동을 지원하지 않는 기기(iPhone Safari 등)는 조용히 무시
  const vib = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* 무시 */ } };

  const HAND_SIZE = 5, MAX_ENERGY = 3, PLAYER_HP = 50, SAFETY_TURNS = 3;
  const CIRCLED = '①②③④⑤⑥⑦⑧';
  let B = null, scene = null, busy = false, holdMode = false, hooks = {};

  const curStep = () => B.prob.steps[B.stepIdx];
  const gateFloor = () => (B.stepIdx < B.prob.steps.length ? B.def.gates[B.stepIdx] : 0);
  const atGate = () => B.stepIdx < B.prob.steps.length && B.enemy.hp <= gateFloor();
  const needsMet = (step) => B.revealed >= (step.needs || 1);
  const cardDef = (c) => DS.Cards[c.id];

  function start(opts) {
    hooks = opts;
    const def = opts.def;
    B = {
      def, prob: opts.problem, trial: !!opts.trial, mastery: opts.mastery || {},
      stepIdx: 0, mult: def.startMult, atkDown: 0, phaseShown: -1, forged: false,
      revealed: 1, gateTurns: 0, emergencyUsed: false, holdUid: null,
      player: { hp: PLAYER_HP, max: PLAYER_HP, block: 0, vuln: 0, weak: 0 },
      energy: MAX_ENERGY,
      draw: DS.MathGen.shuffle(opts.deck.map((c) => ({ ...c, affixes: c.affixes.map((a) => a.slice()) }))),
      hand: [], discard: [], turn: 0,
      enemy: { hp: def.maxHp, max: def.maxHp, block: 0, intent: 0, vuln: null, weak: 0, bleed: null },
    };
    holdMode = false;
    if (!scene) scene = DS.Scene($('#stage'));
    scene.setBattle(B);
    $('#b-floor').textContent = opts.title;
    $('#b-loop').textContent = 'LOOP ' + String(opts.loop).padStart(3, '0');
    busy = true;
    render();
    toast(`${def.intro} 첫 문제 조각이 드러났다.`, 3000);
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
    B.emergencyUsed = false;
    B.holdUid = null; // 홀드는 한 번의 턴 종료만 버틴다
    const e = B.enemy;
    if (e.vuln && --e.vuln.turns <= 0) e.vuln = null;
    if (e.bleed) {
      await hitEnemy(e.bleed.dmg, { flat: true, note: '출혈' });
      if (--e.bleed.turns <= 0) e.bleed = null;
    }
    if (e.hp <= 0) { await victory(); return; }
    drawCards(HAND_SIZE);
    render();
    await ensureTool();
    await safetyNet();
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

  // 덱·버림 더미에서 같은 종류 카드를 꺼내거나, 없으면 임시 카드를 만든다
  function takeOrMake(id) {
    for (const pile of [B.draw, B.discard]) {
      const k = pile.findIndex((c) => c.id === id);
      if (k >= 0) return pile.splice(k, 1)[0];
    }
    return K.roll(id, 'x', { temp: true });
  }

  // 최종보스 체험판: 지금 단계의 도구를 손에 쥐여 준다 (기억 복원 / 전투 중 유니크 연성)
  async function ensureTool() {
    const step = curStep();
    if (!step || B.hand.some((c) => c.id === step.tool)) return;
    // 전투 중 각성 (유니크): 체험판은 바로, 캠페인은 재료 레어 하나는 손에·나머지는 덱에 있을 때
    if (step.forge && !B.forged) {
      const from = step.forge.from;
      const inHand = (id) => B.hand.some((c) => c.id === id);
      const inBattle = (id) => inHand(id) || B.draw.some((c) => c.id === id) || B.discard.some((c) => c.id === id);
      if (B.trial || (from.some(inHand) && from.every(inBattle))) {
        B.forged = true;
        await DS.Cinematic.forge(from, step.tool);
        B.hand.push(takeOrMake(step.tool));
        render();
        return;
      }
      if (!B.forgeHint) {
        B.forgeHint = true;
        toast(`${from.map((id) => DS.Cards[id].name).join(' + ')} 레어가 손과 덱에 있으면 전투 중에 각성할 수 있다…`, 3200);
      }
    }
    if (!B.trial || !step.grant) return;
    await DS.Cinematic.grant(step.tool);
    B.hand.push(takeOrMake(step.tool));
    render();
  }

  // 막힘 안전장치: 문턱에서 3턴 동안 진행이 없으면 필요한 조각 공개 + 풀이 카드 지급(이 전투에서만)
  async function safetyNet() {
    if (!atGate()) { B.gateTurns = 0; return; }
    B.gateTurns++;
    if (B.gateTurns < SAFETY_TURNS) return;
    const step = curStep();
    if (step.qte) return;
    B.gateTurns = 0;
    if (!needsMet(step)) B.revealed = step.needs;
    if (!B.hand.some((c) => c.id === step.tool)) {
      await DS.Cinematic.grant(step.tool);
      B.hand.push(takeOrMake(step.tool));
    }
    toast('기억 복원: 막혀 있던 단계의 실마리가 떠올랐다.', 2600);
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
    if (B.mult < 1) chips.push('<span class="chip armor">철갑: 받는 피해 ½</span>');
    if (B.mult > 1) chips.push(`<span class="chip weak">약점 노출: 받는 피해 ×${B.mult}</span>`);
    if (B.atkDown) chips.push(`<span class="chip down">공격 −${B.atkDown}</span>`);
    if (e.vuln) chips.push(`<span class="chip weak">취약 +${e.vuln.pct}%</span>`);
    if (e.weak) chips.push(`<span class="chip down">약화 −${e.weak}%</span>`);
    if (e.bleed) chips.push(`<span class="chip weak">출혈 ${e.bleed.dmg}×${e.bleed.turns}</span>`);
    if (e.block) chips.push(`<span class="chip block">방어 ${e.block}</span>`);
    return chips.join('');
  }

  function render() {
    const e = B.enemy, p = B.player, def = B.def, steps = B.prob.steps;
    const pieces = B.prob.pieces;
    $('#prob-text').innerHTML = pieces.map((t, i) => (i < B.revealed
      ? `<span class="piece">${pretty(t)}</span>` : '<span class="piece hidden-piece">???</span>')).join(' ');
    $('#prob-steps').innerHTML = steps.map((s, i) => {
      const st = i < B.stepIdx ? 'done' : i === B.stepIdx ? 'cur' : 'todo';
      return `<span class="step ${st}">${CIRCLED[i]}</span>`;
    }).join('') + `<span class="scan-count">🔍 ${B.revealed}/${pieces.length}</span>`;
    const step = curStep();
    let goal;
    if (!step) goal = '<b class="ok">모든 단계 해결! 공격으로 마무리하라</b>';
    else if (!needsMet(step)) goal = `다음 단계를 보려면 문제를 더 스캔하라 (<b>${B.revealed}/${step.needs}</b> 조각)`;
    else goal = `다음 단계: <b>${pretty(step.goal)}</b>`;
    if (step && atGate()) goal = `<span class="gate-alert">🛡 결계 보호막!</span> ${goal}`;
    $('#prob-goal').innerHTML = goal;

    $('#e-name').textContent = def.name;
    $('#e-hpfill').style.width = (100 * e.hp) / e.max + '%';
    $('#e-hptext').textContent = `${e.hp} / ${e.max}`;
    $('#e-gates').innerHTML = def.gates.map((g, i) => (i < B.stepIdx || g <= 0 ? ''
      : `<i class="gate${i === B.stepIdx ? ' cur' : ''}" style="left:${(100 * g) / e.max}%"></i>`)).join('');
    $('#e-status').innerHTML = statusChips();
    const it = def.intents[e.intent % def.intents.length];
    const v = enemyDamage(it);
    $('#e-intent').innerHTML = e.hp > 0
      ? `다음 행동: <span class="intent atk">⚔ ${v}</span> ${esc(it.label)}${it.block ? ` <span class="intent buff">+방어 ${it.block}</span>` : ''}`
        + (it.debuff && it.debuff.vuln ? ` <span class="intent debuff">+취약 ${it.debuff.vuln}턴</span>` : '')
        + (it.debuff && it.debuff.weak ? ` <span class="intent debuff">+약화 ${it.debuff.weak}턴</span>` : '') : '';

    $('#p-hpfill').style.width = (100 * p.hp) / p.max + '%';
    $('#p-hptext').textContent = `${p.hp} / ${p.max}`;
    $('#p-block').textContent = p.block ? `방어 ${p.block}` : '';
    $('#p-status').innerHTML = (p.vuln ? `<span class="chip weak">취약 ${p.vuln}턴</span>` : '')
      + (p.weak ? `<span class="chip down">약화 ${p.weak}턴</span>` : '');
    $('#p-energy').innerHTML = '<i class="on"></i>'.repeat(Math.min(B.energy, 6)) + '<i></i>'.repeat(Math.max(0, MAX_ENERGY - B.energy));
    $('#p-piles').textContent = `덱 ${B.draw.length} · 버림 ${B.discard.length}`;

    const hand = $('#hand');
    hand.innerHTML = '';
    B.hand.forEach((c, i) => hand.appendChild(cardEl(c, i)));
    $('#end-turn').disabled = busy;
    $('#btn-hold').disabled = busy || B.energy < 1;
    $('#btn-hold').classList.toggle('on', holdMode);
    $('#btn-emergency').disabled = busy || B.energy < 1 || B.emergencyUsed || !emergencyOptions().length;
    $('#btn-retreat').disabled = busy;
    $('#hold-hint').classList.toggle('hidden', !holdMode);
  }

  function cardEl(c, i) {
    const el = document.createElement('button');
    el.className = `card tier-${cardDef(c).tier}`;
    if (busy || (B.energy < 1 && !holdMode)) el.classList.add('dim');
    if (c.uid === B.holdUid) el.classList.add('held');
    el.innerHTML = DS.UI.cardInner(c, { battle: true });
    el.addEventListener('click', () => play(i));
    return el;
  }

  // ── 카드 사용 ─────────────────────────────────────────────
  async function play(i) {
    if (busy || !B) return;
    const card = B.hand[i], def = cardDef(card);
    if (holdMode) { await setHold(card); return; }
    const step = curStep(), gate = atGate();
    // 문턱에서 조각이 부족하면 풀이 카드는 맞든 틀리든 같은 메시지 (정답 떠보기 방지), 기력 소모 없음
    if (gate && def.tool && !needsMet(step)) {
      toast(`아직 문제를 다 파악하지 못했다. 스캔 카드로 문제를 더 밝혀라 (${B.revealed}/${step.needs})`, 2600);
      DS.Sound.wrong();
      return;
    }
    if (B.energy < 1) { toast('기력이 부족하다'); DS.Sound.wrong(); return; }
    busy = true;
    DS.Sound.card();
    B.energy -= 1;
    B.hand.splice(i, 1);
    if (card.uid === B.holdUid) B.holdUid = null;
    render();

    if (gate && def.tool && card.id === step.tool && !step.qte) {
      const prob = step.challenge();
      const ok = await DS.Challenge.resolve(def, prob);
      if (hooks.onAnswer) hooks.onAnswer(ok);
      if (ok) { vib([30, 30, 90]); await solveStep(card, step); }
      else { vib([150]); scene.fizzle(); await wait(400); }
    } else if (gate) {
      // 맞지 않는 카드: 공격은 튕기고 방어·스캔은 적용
      scene.wrongTool();
      vib([120, 60, 120]);
      DS.Sound.wrong();
      toast(def.tool ? `이 도구로는 지금 단계를 풀 수 없어요. 목표: ${step.goal}`
        : '결계 보호막! 공격은 튕겨 나간다. 이 단계를 푸는 풀이 카드가 필요하다.', 2600);
      if (hooks.onWrongTool && def.tool) hooks.onWrongTool();
      if (card.atk > 0) scene.gateLock();
      await guardAndScan(card);
    } else {
      await useCard(card);
    }
    B.discard.push(card);
    if (B.enemy.hp <= 0) { await victory(); return; }
    busy = false;
    render();
  }

  async function guardAndScan(card) {
    if (card.def > 0) {
      B.player.block += card.def;
      DS.Sound.block();
      vib(45);
      scene.heroGuard(card.def);
    }
    if (card.scan) await scan();
  }

  async function scan() {
    if (B.revealed >= B.prob.pieces.length) return;
    B.revealed++;
    DS.Sound.scan();
    scene.scanFx();
    render();
    await wait(250);
  }

  async function useCard(card) {
    if (card.atk > 0) {
      scene.heroStrike();
      DS.Sound.slash();
      vib(25);
      await wait(140);
      // 약화: 카드 공격만 ×0.75 (풀이 피해는 그대로)
      await hitEnemy(B.player.weak ? Math.max(1, Math.round(card.atk * 0.75)) : card.atk, { card });
    }
    await guardAndScan(card);
    // 행운의 적중·추가 드로우
    const lucky = K.affix(card, 'lucky'), more = K.affix(card, 'draw');
    if (lucky && Math.random() < lucky / 100) { B.energy++; scene.note('행운의 적중! 기력 +1', '#7df9ff'); }
    if (more && Math.random() < more / 100) { drawCards(1); scene.note('추가 드로우!', '#7df9ff'); }
  }

  // 피해 계산: 크리티컬 → 몬스터 배율(관통이면 ½ 무시) → 취약 → 분쇄 → 방어(관통이면 무시) → 문턱
  async function hitEnemy(base, { card, flat, note }) {
    const e = B.enemy;
    let dmg = base, crit = false;
    if (card) {
      const c = K.critOf(card);
      crit = c.rate > 0 && Math.random() < c.rate;
      if (crit) { dmg *= c.mult; if (hooks.onCrit) hooks.onCrit(); }
    }
    const pierce = card && K.affix(card, 'pierce') > 0;
    if (!flat) {
      if (B.mult > 1 || !pierce) dmg *= B.mult;
      if (e.vuln) dmg *= 1 + e.vuln.pct / 100;
      const crush = card ? K.affix(card, 'crush') : 0;
      if (crush) dmg += e.hp * (crush / 100) * (B.def.gates.length >= 2 ? 0.5 : 1);
    }
    let d = Math.max(1, Math.round(dmg));
    let absorbed = 0;
    if (!pierce && !flat) {
      absorbed = Math.min(e.block, d);
      e.block -= absorbed;
      d -= absorbed;
    }
    const floor = gateFloor();
    let locked = false;
    if (e.hp - d < floor) { d = Math.max(0, e.hp - floor); locked = true; }
    e.hp -= d;
    DS.Sound.hit();
    if (crit) { DS.Sound.crit(); vib([0, 30, 40, 70]); }
    scene.enemyHit(d, note || '', crit);
    if (absorbed) scene.blocked(absorbed);
    if (card) applyOnHit(card, d);
    if (locked && floor > 0) {
      scene.gateLock();
      toast('결계 보호막에 닿았다! 이제 풀이 카드로 이 단계를 풀어야 깨진다.', 2400);
    }
    render();
    await wait(330);
  }

  function applyOnHit(card, dealt) {
    const e = B.enemy, p = B.player;
    const leech = K.affix(card, 'leech'), counter = K.affix(card, 'counter');
    const vuln = K.affix(card, 'vuln'), weak = K.affix(card, 'weak'), bleed = K.affix(card, 'bleed');
    if (leech && dealt > 0) { const h = Math.max(1, Math.round((dealt * leech) / 100)); p.hp = Math.min(p.max, p.hp + h); scene.note(`흡혈 +${h}`, '#5ce1a5'); }
    if (counter) { p.block += counter; scene.heroGuard(counter); }
    if (vuln) e.vuln = { pct: vuln, turns: 2 };
    if (weak) e.weak = Math.max(e.weak, weak);
    if (bleed) e.bleed = { dmg: bleed, turns: 2 };
  }

  async function solveStep(card, step) {
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
    B.gateTurns = 0;
    if (hooks.onStep) hooks.onStep();
    scene.note(pen.label);
    render();
    await wait(350);
    await hitEnemy(step.dmg, { card });
    await checkPhase();
    if (step.then === 'qte') await runQTE();
    else await ensureTool();
  }

  // 5초 QTE: 틀리거나 시간 초과면 3초 전으로 되감기 후 즉시 재도전
  async function runQTE() {
    const step = curStep();
    if (!needsMet(step)) B.revealed = step.needs;
    render();
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

  // ── 홀드 · 긴급 연성 · 후퇴 ────────────────────────────────
  function toggleHold() {
    if (busy || B.energy < 1) return;
    holdMode = !holdMode;
    render();
  }
  async function setHold(card) {
    holdMode = false;
    if (B.energy < 1) { render(); return; }
    B.energy -= 1;
    B.holdUid = card.uid;
    DS.Sound.clank();
    toast(`📌 ${cardDef(card).name} 홀드: 턴이 끝나도 손에 남는다.`);
    render();
  }

  // 숙련된 레시피 중 손패로 만들 수 있는 것
  function emergencyOptions() {
    if (!B) return [];
    const out = [];
    for (const r of DS.Craft.BOOK) {
      if ((B.mastery[r.card] || 0) < DS.Craft.MASTERY) continue;
      for (const need of r.emergency) {
        const pick = pickFromHand(need);
        if (pick) { out.push({ card: r.card, pick, need }); break; }
      }
    }
    return out;
  }
  // 필요한 카드를 손패에서 고른다 (수치 합계가 낮은 것부터, 차이²는 가로·세로 한 장씩)
  function pickFromHand(need) {
    const chosen = [];
    for (const [id, n] of Object.entries(need)) {
      const pool = B.hand.filter((c) => c.id === id && !chosen.includes(c)).sort((a, b) => (a.atk + a.def) - (b.atk + b.def));
      if (id === 'diffSq') {
        const x = pool.find((c) => c.axis !== 'y'), y = pool.find((c) => c.axis === 'y');
        if (!x || !y) return null;
        chosen.push(x, y);
        continue;
      }
      if (pool.length < n) return null;
      chosen.push(...pool.slice(0, n));
    }
    return chosen;
  }
  async function emergency() {
    if (busy || B.energy < 1 || B.emergencyUsed) return;
    const opts = emergencyOptions();
    if (!opts.length) return;
    const idx = await DS.Cinematic.choice('⚡ 긴급 연성 (기력 1)',
      '손패를 바쳐 숙련된 공식을 즉시 연성한다. 전투가 끝나면 만든 카드는 사라지고 바친 카드는 돌아온다.',
      [...opts.map((o) => `${cardDef({ id: o.card }).name} ← ${o.pick.map((c) => cardDef(c).name).join(' + ')}`), '취소']);
    if (idx < 0 || idx >= opts.length) return;
    const o = opts[idx];
    B.energy -= 1;
    B.emergencyUsed = true;
    B.hand = B.hand.filter((c) => !o.pick.includes(c) || K.isRare(c)); // 레어 재료는 손에 남는다
    const made = K.roll(o.card, 'x', { temp: true });
    B.hand.push(made);
    DS.Sound.forge();
    scene.note(`긴급 연성: ${cardDef(made).name}`, '#ffd166');
    if (hooks.onEmergency) hooks.onEmergency();
    render();
  }
  async function retreat() {
    if (busy) return;
    const idx = await DS.Cinematic.choice('⛺ 후퇴', B.trial ? '타이틀로 돌아간다.' : '캠프로 돌아간다. 다시 오면 같은 문제, 몬스터 체력은 처음부터.', ['후퇴한다', '계속 싸운다']);
    if (idx !== 0) return;
    busy = true;
    hooks.onRetreat();
  }

  // ── 적 턴 ────────────────────────────────────────────────
  function enemyDamage(it) {
    const base = Math.max(0, it.v - B.atkDown);
    return Math.round(base * (1 - B.enemy.weak / 100) * (B.player.vuln ? 1.5 : 1)); // 플레이어 취약: ×1.5
  }
  async function endTurn() {
    if (busy || !B) return;
    busy = true;
    holdMode = false;
    const held = B.hand.filter((c) => c.uid === B.holdUid);
    B.discard.push(...B.hand.filter((c) => c.uid !== B.holdUid));
    B.hand = held;
    render();
    await wait(350);

    const e = B.enemy, def = B.def, p = B.player;
    const it = def.intents[e.intent % def.intents.length];
    e.block = 0;
    if (it.block) e.block += it.block;
    let dmg = enemyDamage(it);
    e.weak = 0;
    const blocked = Math.min(p.block, dmg);
    p.block -= blocked;
    dmg -= blocked;
    p.hp = Math.max(0, p.hp - dmg);
    DS.Sound.enemyAtk();
    if (dmg > 0) vib([60, 40, 60]);
    scene.enemyAttack(dmg, blocked);
    if (dmg > 0) setTimeout(() => DS.Sound.hurt(), 120);
    e.intent++;
    // 디버프 지속 턴 감소 → 이번 행동의 디버프 적용 (다음 적 행동까지 남아 있음)
    if (p.vuln) p.vuln--;
    if (p.weak) p.weak--;
    if (it.debuff) {
      if (it.debuff.vuln) { p.vuln = Math.max(p.vuln, it.debuff.vuln); scene.note('취약! 받는 피해 ×1.5', '#ff8fa3'); }
      if (it.debuff.weak) { p.weak = Math.max(p.weak, it.debuff.weak); scene.note('약화! 카드 공격 ×0.75', '#c9a7ff'); }
    }
    render();
    await wait(750);

    if (p.hp <= 0) { await fall(); return; }
    await startTurn();
  }

  // 쓰러짐: 되감기 연출 후 "같은 덱으로 재도전" / "캠프로 되감기"
  async function fall() {
    DS.Sound.rewind();
    scene.rewind(1.6);
    toast('쓰러졌다… 시간이 되감긴다.', 1600);
    await wait(1700);
    const idx = await DS.Cinematic.choice('◀◀ 되감기', '같은 문제에 다시 도전한다.',
      B.trial ? ['같은 덱으로 재도전', '타이틀로'] : ['같은 덱으로 재도전', '캠프로 되감기 (덱 수정)']);
    hooks.onLose(idx === 1 ? 'camp' : 'retry');
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
    $('#btn-hold').addEventListener('click', toggleHold);
    $('#btn-emergency').addEventListener('click', emergency);
    $('#btn-retreat').addEventListener('click', retreat);
  }

  // 자동 플레이 테스트용 읽기 전용 조회
  function state() {
    if (!B) return null;
    const s = curStep();
    return {
      busy, stepIdx: B.stepIdx, tool: s ? s.tool : null, qte: !!(s && s.qte), needs: s ? s.needs : 0,
      revealed: B.revealed, pieces: B.prob.pieces.length, atGate: atGate(), energy: B.energy,
      hp: B.enemy.hp, floor: gateFloor(), playerHp: B.player.hp, emergency: emergencyOptions().length, holdUid: B.holdUid,
      hand: B.hand.map((c) => ({ id: c.id, uid: c.uid, atk: c.atk, def: c.def, scan: c.scan, tool: !!cardDef(c).tool, temp: c.temp })),
    };
  }

  return { start, bind, state };
})();
