// 캠프: [대장간] 탭과 [덱 구성] 탭
//  대장간: 모루 [재료] [연산] [재료]. 재료 = 부품 가방 + 보관함 카드(잠긴 카드 제외). 연산과 m′은 무한.
//          카드 결과는 매번 수치를 새로 굴린다. 같은 카드를 직접 3번 만들면 숙련 → 즉시 연성.
//          보관함은 카드 종류별 묶음으로 보인다 (칸 순서 고정, 누르면 덱 밖·수치 낮은 카드부터, ▾로 펼쳐 직접 고르기)
//  덱 구성: 보관함 ↔ 덱 이동, 잠금, 분해(소재 절반 회수), 덱 규칙 검사 — 카드를 낱장으로 비교
//  첫 연성 튜토리얼: 캠페인 첫 캠프에서 한 번, 눌러야 할 곳만 밝혀 [x₁] − [x₂] → 차이를 함께 만든다
//  레어: 이름별 1장, 재료로 써도 보관함에 남음, 이미 있는 레어를 다시 연성하면 기존/새 카드 중 하나를 고름
//  조합법 창: DS.GUIDE 가 켜졌을 때만 (v0.2.2 기본은 꺼짐). 안내 문구는 Craft.BOOK.guide, 테스트로 검증
//  발견형 연산 (v0.3.2): ² 는 같은 것끼리 × 를 시도하면, √ 는 ² 를 모루에 올렸다가 눌러 꺼내면 영구 해금 (st.unlocked)
//  영(零)의 결정: [x 조각]·[y 조각]과 함께 모루에 오르면 a² − a² · b² − b² 로 변신해 보인다
window.DS = window.DS || {};

DS.Forge = (function () {
  const $ = (s) => document.querySelector(s);
  const { pretty, esc } = DS.UI;
  const K = DS.CardKit;
  let st = null; // { bag, cards, deckUids:Set, discovered:Set, mastery, unlocked:Set, floor, nextTitle, onDepart, onForge?, onGuide?, onUnlock?, tutorial?, onTutorial?, guideOps? }
  let lastForgedId = null; // 방금 연성한 카드 종류 (보관함 묶음이 반짝임)
  let openStack = null; // ▾로 펼친 묶음 (카드 종류)
  // 묶음 칸 순서: 연성 순서로 고정해 카드가 생기거나 사라져도 칸이 움직이지 않게
  const STACK_ORDER = [...new Set([...DS.Craft.BOOK.map((r) => r.card), ...Object.keys(DS.Cards)])];
  let slots = { a: null, op: null, b: null };
  let tab = 'forge';
  const TIER_RANK = { basic: 0, normal: 1, magic: 2, rare: 3, unique: 4, special: 5 };

  function open(state) {
    st = state;
    lastForgedId = null;
    openStack = null;
    slots = { a: null, op: null, b: null };
    $('#forge-msg').innerHTML = '';
    $('#forge-msg').className = 'forge-msg';
    setTab('forge');
    if (st.tutorial) startTutorial();
    else if (st.guideOps) opsGuide();
  }
  const isFound = (op) => !DS.Ops[op].discover || st.unlocked.has(op);
  // 골렘 직전 캠프: 아직 못 찾은 연산을 단계별로 안내 (² → √)
  function opsGuide() {
    const msg = $('#forge-msg');
    const t = !isFound('sq') ? '💡 같은 차이 카드 두 장을 곱하기(×)로 모루에 올려 보자. 무언가를 발견할지도…'
      : !isFound('root') ? '💡 대각선 거리를 재려면 제곱을 되돌리는 연산이 필요해. ² 를 모루에 올렸다가 다시 눌러 꺼내 보자.' : '';
    if (!t) return;
    msg.className = 'forge-msg';
    msg.innerHTML = `<p>${pretty(t)}</p>`;
  }
  // 연산 발견: 영구 해금 + 연출
  async function unlockOp(op) {
    if (isFound(op)) return;
    st.unlocked.add(op);
    if (st.onUnlock) st.onUnlock(op);
    DS.Sound.forge();
    render();
    const text = op === 'sq' ? '같은 것을 두 번 곱하는 걸 한 번에! 이제 카드 한 장에 ² 를 씌우면 된다.'
      : '²를 꺼내는 순간, 되돌리는 힘을 깨달았다! 제곱을 되돌린다: 3² = 9 이니까 √9 = 3';
    await DS.Cinematic.choice(`🔓 ${DS.Ops[op].sym} ${DS.Ops[op].name} 연산을 발견했다!`, text, ['좋아!']);
  }
  function setTab(t) {
    tab = t;
    document.querySelectorAll('.camp-tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    $('#tab-forge').classList.toggle('hidden', t !== 'forge');
    $('#tab-deck').classList.toggle('hidden', t !== 'deck');
    render();
  }

  const deckCards = () => st.cards.filter((c) => st.deckUids.has(c.uid));
  const sorted = (list) => list.slice().sort((a, b) => (TIER_RANK[DS.Cards[b.id].tier] - TIER_RANK[DS.Cards[a.id].tier])
    || ((b.atk + b.def) - (a.atk + a.def)));

  function render() {
    const chk = K.checkDeck(deckCards());
    $('#deck-rule-mini').innerHTML = chk.ok ? '<span class="ok">덱 규칙 ✓</span>' : '<span class="ng">덱 규칙 ✗</span>';
    $('#depart').textContent = `${st.nextTitle} ▶`;
    if (tab === 'forge') { renderSlots(); renderOps(); renderBag(); renderStore(); renderBook(); } else renderDeckTab(chk);
    tutCheck();
  }

  // ── 표시 ─────────────────────────────────────────────────
  function partHtml(id) {
    const p = DS.Parts[id];
    return `<span class="psym math${p.sym.length > 7 ? ' long' : ''}">${pretty(p.sym)}</span><span class="pname">${esc(p.name)}</span>`;
  }
  function miniCard(c, extraCls = '') {
    const el = document.createElement('div');
    el.className = `card mini tier-${DS.Cards[c.id].tier} ${extraCls}`;
    el.innerHTML = DS.UI.cardInner(c);
    return el;
  }

  // 반대쪽 칸에 x 조각·y 조각이 있으면 0 이 변신한 모습
  function zeroForm(k) {
    const o = slots[k === 'a' ? 'b' : 'a'];
    if (!o || o.kind !== 'part') return '';
    return o.id === 'xPart' ? 'a² − a²' : o.id === 'yPart' ? 'b² − b²' : '';
  }

  function renderSlots() {
    ['a', 'b'].forEach((k) => {
      const el = $(`.slot[data-k="${k}"]`), t = slots[k];
      el.innerHTML = '';
      el.classList.toggle('filled', !!t);
      if (!t) el.innerHTML = '<span class="slot-empty">재료</span>';
      else if (t.kind === 'part' && t.id === 'zero' && zeroForm(k)) {
        // 짝을 만난 0 은 a² − a² (b² − b²) 로 변신해 보인다
        el.innerHTML = `<div class="part in-slot zero-on"><span class="psym math">${pretty(zeroForm(k))}</span><span class="pname">0 의 변신</span></div>`;
      } else if (t.kind === 'part') el.innerHTML = `<div class="part in-slot">${partHtml(t.id)}</div>`;
      else {
        el.appendChild(miniCard(t.card));
        const d = DS.Cards[t.id];
        if (d.axis) {
          const lab = d.axisName ? `⇄ ${d.axisName[t.axis === 'y' ? 0 : 1]}으로` : '⇄ 축 바꾸기';
          el.insertAdjacentHTML('beforeend', `<button class="flip" title="${d.axisName ? d.axisName.join(' ↔ ') : '가로 ↔ 세로'}">${lab}</button>`);
        }
      }
      el.onclick = (e) => {
        if (e.target.closest('.flip')) {
          t.axis = t.axis === 'y' ? 'x' : 'y';
          t.card = { ...t.card, axis: t.axis };
          DS.Sound.clank();
          renderSlots();
          return;
        }
        unslot(k);
      };
    });
    const opEl = $('.slot[data-k="op"]');
    opEl.innerHTML = slots.op ? `<span class="op-sym math">${pretty(DS.Ops[slots.op].sym)}</span>` : '<span class="slot-empty">연산</span>';
    opEl.classList.toggle('filled', !!slots.op);
    opEl.onclick = () => {
      const was = slots.op;
      slots.op = null;
      render();
      if (was === 'sq' && isFound('sq')) unlockOp('root'); // ² 를 넣었다가 꺼내기 = 되돌리기 → √
    };
    $('#forge-btn').disabled = !slots.op || (!slots.a && !slots.b);
  }

  function renderOps() {
    const box = $('#ops');
    box.innerHTML = '';
    Object.entries(DS.Ops).forEach(([id, o]) => {
      if (o.floor && st.floor < o.floor) return; // 대입·비교·식 분해는 3층부터
      const hidden = !isFound(id); // 아직 발견하지 못한 연산: 보이되 잠김
      const el = document.createElement('div');
      el.className = 'part op' + (o.locked || hidden ? ' locked' : '');
      el.dataset.op = id;
      el.innerHTML = `<span class="psym math">${pretty(o.sym)}</span><span class="pname">${esc(hidden ? '???' : o.name)}</span>${o.locked || hidden ? '<span class="pcount">🔒</span>' : ''}`;
      if (o.locked) el.title = o.locked;
      if (hidden) el.title = o.hint;
      el.addEventListener('pointerdown', (e) => startDrag(e, { kind: 'op', id }, el));
      box.appendChild(el);
    });
  }

  function renderBag() {
    const box = $('#parts');
    box.innerHTML = '';
    const ids = Object.keys(DS.Parts).filter((id) => {
      const p = DS.Parts[id];
      if (p.inf) return st.floor >= (p.floor || 2);
      return (st.bag[id] || 0) > 0 || (!p.mid && st.bag[id] != null);
    });
    ids.forEach((id) => {
      const p = DS.Parts[id], n = p.inf ? Infinity : (st.bag[id] || 0);
      const el = document.createElement('div');
      el.className = 'part' + (n <= 0 ? ' empty' : '') + (p.mid ? ' mid' : '') + (p.inf ? ' inf' : '');
      el.dataset.part = id;
      el.innerHTML = `${partHtml(id)}<span class="pcount">${p.inf ? '∞' : `×${n}`}</span>`;
      if (n > 0) el.addEventListener('pointerdown', (e) => startDrag(e, { kind: 'part', id }, el));
      box.appendChild(el);
    });
  }

  // 묶음에서 누르면 올라가는 카드: 잠기지 않은 것 중 덱 밖 → 수치(공+방) 낮은 순 (즉시 연성과 같은 규칙)
  const byUse = (a, b) => (st.deckUids.has(a.uid) - st.deckUids.has(b.uid)) || ((a.atk + a.def) - (b.atk + b.def));
  const pickStack = (id) => st.cards.filter((c) => c.id === id && !c.locked).sort(byUse)[0] || null;
  const cardTok = (c) => ({ kind: 'card', id: c.id, axis: c.axis, uid: c.uid });

  function renderStore() {
    const box = $('#store');
    box.innerHTML = '';
    $('#store-count').textContent = st.cards.length;
    const ids = STACK_ORDER.filter((id) => st.cards.some((c) => c.id === id));
    if (!ids.length) box.innerHTML = '<p class="muted">카드가 없어요</p>';
    if (openStack && !ids.includes(openStack)) openStack = null;
    ids.forEach((id) => {
      const d = DS.Cards[id], list = st.cards.filter((c) => c.id === id);
      const inDeck = list.filter((c) => st.deckUids.has(c.uid)).length, ys = list.filter((c) => c.axis === 'y').length;
      const usable = list.some((c) => !c.locked);
      const el = document.createElement('div');
      el.className = `stack tier-${d.tier}` + (usable ? ' usable' : ' locked-card') + (id === lastForgedId ? ' just-forged' : '') + (id === openStack ? ' open' : '');
      el.dataset.card = id;
      el.innerHTML = `<span class="tier-badge">${DS.Tiers[d.tier].name}</span><span class="cname">${esc(d.name)}</span>`
        + `<span class="formula math">${pretty(d.formula)}</span><span class="s-count">×${list.length}</span>`
        + `<span class="s-meta">덱 ${inDeck}${ys ? ` · ⇄${d.axisName ? d.axisName[1] : '세로'} ${ys}` : ''}</span><button class="s-open" title="펼쳐서 고르기">${id === openStack ? '▴' : '▾'}</button>`;
      const btn = el.querySelector('.s-open');
      btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      btn.addEventListener('click', (e) => { e.stopPropagation(); openStack = openStack === id ? null : id; render(); });
      el.addEventListener('pointerdown', (e) => {
        const c = pickStack(id);
        if (!c) { toast('잠긴 카드뿐이에요. 덱 구성 탭에서 잠금을 풀 수 있어요.'); return; }
        startDrag(e, cardTok(c), el);
      });
      box.appendChild(el);
    });
    // 펼친 묶음: 한 줄짜리 목록에서 원하는 카드를 직접 고른다
    if (openStack) {
      const d = DS.Cards[openStack];
      const wrap = document.createElement('div');
      wrap.className = 'stack-list';
      wrap.innerHTML = `<p class="sl-title">${esc(d.name)} — 직접 골라 올리기 <span class="muted small">재료로 쓸 때 수치는 결과에 영향 없음</span></p>`;
      st.cards.filter((c) => c.id === openStack).sort(byUse).forEach((c) => {
        const row = document.createElement('div');
        row.className = 'sl-row' + (c.locked ? ' locked-card' : '');
        row.innerHTML = `<b class="atk">⚔${c.atk}</b> <b class="def">🛡${c.def}</b>${c.scan ? ' 🔍' : ''}${c.axis === 'y' ? ` <span class="sl-tag">${esc(K.axisLabel(c))}</span>` : ''}`
          + `${c.affixes.map(([k, v]) => ` <span class="affix">${esc(DS.Affixes[k].text(v))}</span>`).join('')}`
          + `${st.deckUids.has(c.uid) ? ' <span class="sl-tag deck">덱</span>' : ''}${c.locked ? ' 🔒' : ''}`;
        if (!c.locked) row.addEventListener('pointerdown', (e) => startDrag(e, cardTok(c), row));
        wrap.appendChild(row);
      });
      box.appendChild(wrap);
    }
  }

  function renderBook() {
    const box = $('#recipes');
    box.innerHTML = '';
    DS.Craft.BOOK.filter((r) => r.floor <= st.floor).forEach((r) => {
      const c = DS.Cards[r.card];
      const n = st.mastery[r.card] || 0;
      const el = document.createElement('div');
      const [lo, hi] = K.statRange(r.card);
      if (!st.discovered.has(r.card)) {
        el.className = 'recipe unknown';
        el.innerHTML = `<div class="r-eq">??? → <b>???</b> <span class="tier-badge sm">${DS.Tiers[c.tier].name}</span></div><div class="r-lore">힌트: ${pretty(r.hint)}</div>`;
      } else {
        const mastered = n >= DS.Craft.MASTERY;
        const can = mastered && affordable(r.quick);
        el.className = `recipe known tier-${c.tier}`;
        el.innerHTML = `<div class="r-eq">${pretty(r.chain)} → <b>${esc(c.name)}</b> <span class="tier-badge sm">${DS.Tiers[c.tier].name}</span> <span class="r-range">공+방 ${lo}~${hi}</span></div>`
          + `<div class="r-lore math">${pretty(r.lore)}</div>`
          + (r.alt ? `<div class="r-eq r-alt"><span class="tier-badge sm">다른 길</span> ${pretty(r.alt.chain)}</div><div class="r-lore math">${pretty(r.alt.lore)}</div>` : '')
          + `<div class="r-mastery">${mastered ? '<b>숙련 완료</b>' : `숙련 ${n} / ${DS.Craft.MASTERY} (직접 연성)`}`
          + (mastered ? ` <button class="btn small quick"${can ? '' : ' disabled'}>⚡ 즉시 연성</button>` : '')
          + (mastered && r.emergency.length ? ' <span class="muted small">전투 중 긴급 연성 가능</span>' : '') + '</div>';
        const q = el.querySelector('.quick');
        if (q) q.addEventListener('click', () => quickCraft(r));
      }
      box.appendChild(el);
    });
  }

  // ── 덱 구성 탭 ───────────────────────────────────────────
  function renderDeckTab(chk) {
    $('#deck-rules').innerHTML = chk.rows.map((r) => `<span class="${r.ok ? 'ok' : 'ng'}">${r.ok ? '✓' : '✗'} ${esc(r.label)}</span>`).join('');
    const deck = sorted(deckCards()), store = sorted(st.cards.filter((c) => !st.deckUids.has(c.uid)));
    $('#deck-count').textContent = deck.length;
    $('#store2-count').textContent = store.length;
    fillList($('#deck-list'), deck, true);
    fillList($('#store-list'), store, false);
  }
  function fillList(box, list, inDeck) {
    box.innerHTML = '';
    if (!list.length) box.innerHTML = '<p class="muted">비어 있음</p>';
    list.forEach((c) => {
      const wrap = document.createElement('div');
      wrap.className = 'deck-item';
      wrap.appendChild(miniCard(c, c.locked ? 'locked-card' : ''));
      const btns = document.createElement('div');
      btns.className = 'deck-btns';
      btns.innerHTML = `<button class="btn small mv">${inDeck ? '빼기 ▶' : '◀ 넣기'}</button>`
        + `<button class="btn small lk">${c.locked ? '🔓' : '🔒'}</button>`
        + `<button class="btn small sv"${c.locked ? ' disabled' : ''}>분해</button>`;
      btns.querySelector('.mv').onclick = () => moveCard(c, !inDeck);
      btns.querySelector('.lk').onclick = () => { c.locked = !c.locked; DS.Sound.clank(); render(); };
      btns.querySelector('.sv').onclick = () => salvage(c);
      wrap.appendChild(btns);
      box.appendChild(wrap);
    });
  }
  function moveCard(c, toDeck) {
    if (toDeck) {
      const deck = deckCards();
      if (deck.length >= DS.DeckRules.max) { toast(`덱은 최대 ${DS.DeckRules.max}장이에요.`); return; }
      if (K.isMagic(c) && deck.filter(K.isMagic).length >= DS.DeckRules.maxMagic) { toast(`매직 카드는 덱에 최대 ${DS.DeckRules.maxMagic}장이에요.`); return; }
      st.deckUids.add(c.uid);
    } else st.deckUids.delete(c.uid);
    DS.Sound.clank();
    render();
  }
  async function salvage(c) {
    if (c.locked) return;
    const r = DS.Craft.book(c.id);
    const refund = r ? r.refund : {};
    const partName = (id) => (id === 'pt' ? '점' : DS.Parts[id].name);
    const txt = Object.entries(refund).map(([id, n]) => `${partName(id)} ${n}개`).join(', ') || '없음';
    const idx = await DS.Cinematic.choice('분해', `${DS.Cards[c.id].name} (⚔${c.atk} 🛡${c.def})을(를) 분해하고 ${txt}을(를) 돌려받을까요?`
      + (refund.pt ? ' (점은 x₁·x₂ 중 가방에 적은 쪽부터 돌아와요)' : ''), ['분해한다', '취소']);
    if (idx !== 0) return;
    st.cards.splice(st.cards.indexOf(c), 1);
    st.deckUids.delete(c.uid);
    const got = DS.Craft.refundParts(refund, st.bag);
    Object.entries(got).forEach(([id, n]) => { st.bag[id] = (st.bag[id] || 0) + n; });
    DS.Sound.armorBreak();
    toast(`분해 완료: ${Object.entries(got).map(([id, n]) => `${DS.Parts[id].name} ${n}개`).join(', ') || '없음'} 회수`);
    render();
  }

  // ── 슬롯 조작 ─────────────────────────────────────────────
  function take(t) {
    if (t.kind === 'part') {
      if (DS.Parts[t.id].inf) return { ...t };
      if (!(st.bag[t.id] > 0)) return null;
      st.bag[t.id]--;
      return { ...t };
    }
    const c = st.cards.find((x) => x.uid === t.uid);
    if (!c || c.locked) return null;
    if (K.isRare(c)) return { kind: 'card', id: c.id, axis: c.axis, uid: c.uid, card: c, keep: true }; // 레어는 보관함에 그대로
    st.cards.splice(st.cards.indexOf(c), 1);
    const wasInDeck = st.deckUids.delete(c.uid);
    return { kind: 'card', id: c.id, axis: c.axis, uid: c.uid, card: c, wasInDeck };
  }
  function giveBack(t) {
    if (!t) return;
    if (t.kind === 'part') { if (!DS.Parts[t.id].inf) st.bag[t.id] = (st.bag[t.id] || 0) + 1; return; }
    if (t.keep) return;
    st.cards.push(t.card);
    if (t.wasInDeck) st.deckUids.add(t.uid);
  }
  function place(t, where) {
    if (t.kind === 'op') {
      if (DS.Ops[t.id].locked) { toast(`${DS.Ops[t.id].name} 연산은 ${DS.Ops[t.id].locked}.`); return; }
      if (!isFound(t.id)) { toast(`🔒 아직 발견하지 못한 연산이에요. ${DS.Ops[t.id].hint}`, 3200); return; }
      slots.op = t.id;
    } else {
      const k = where && where !== 'op' ? where : (!slots.a ? 'a' : !slots.b ? 'b' : null);
      if (!k) { toast('재료 칸이 가득 찼어요. 슬롯을 눌러 빼세요.'); return; }
      if (t.uid && [slots.a, slots.b].some((x) => x && x.uid === t.uid)) { toast('그 레어 카드는 이미 모루에 있어요.'); return; }
      const got = take(t);
      if (!got) return;
      giveBack(slots[k]);
      slots[k] = got;
    }
    DS.Sound.clank();
    render();
  }
  function unslot(k) {
    if (!slots[k]) return;
    giveBack(slots[k]);
    slots[k] = null;
    render();
  }

  // 마우스: 누르기 = 올리기, 끌기 = 원하는 칸에 놓기
  // 터치(폰·패드): 누르기 = 올리기만. 손가락이 움직이면 화면 스크롤로 보고 아무것도 하지 않는다
  //               (끌기를 위해 스크롤을 막으면 재료 목록·보관함을 넘길 수 없음)
  function startDrag(e, t, src) {
    DS.Sound.unlock();
    const touch = e.pointerType && e.pointerType !== 'mouse';
    if (!touch) e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    let moved = false, ghost = null, over = null;
    const done = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
    const cancel = () => { done(); if (ghost) ghost.remove(); if (over) over.classList.remove('over'); };
    const move = (ev) => {
      if (touch) { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 10) cancel(); return; }
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) {
        moved = true;
        ghost = src.cloneNode(true);
        ghost.classList.add('drag-ghost');
        document.body.appendChild(ghost);
      }
      if (!moved) return;
      ghost.style.left = ev.clientX + 'px';
      ghost.style.top = ev.clientY + 'px';
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const slot = el && el.closest('.slot');
      if (over && over !== slot) over.classList.remove('over');
      over = slot;
      if (over) over.classList.add('over');
    };
    const up = (ev) => {
      done();
      if (ghost) ghost.remove();
      if (over) over.classList.remove('over');
      if (!moved) { place(t); return; }
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const slot = el && el.closest('.slot');
      if (!slot) return;
      const k = slot.dataset.k;
      if ((t.kind === 'op') !== (k === 'op')) { toast(t.kind === 'op' ? '연산은 가운데 칸에 올려요.' : '재료는 양쪽 칸에 올려요.'); return; }
      place(t, k);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  }

  // ── 연성 ─────────────────────────────────────────────────
  // 새 카드를 보관함에 넣는다. 레어가 이미 있으면 기존/새 카드 중 하나를 고른다 (Promise: 남은 카드)
  async function addCard(id, axis) {
    const c = K.roll(id, axis || 'x');
    const old = K.isRare(c) && st.cards.find((x) => x.id === id);
    if (old) {
      const desc = (x) => `⚔${x.atk} 🛡${x.def}${x.affixes.length ? ' · ' + x.affixes.map(([k, v]) => DS.Affixes[k].text(v)).join(', ') : ''}`;
      const idx = await DS.Cinematic.choice(`레어 재연성 · ${DS.Cards[id].name}`,
        '레어는 이름별로 한 장만 가질 수 있어요. 남길 카드를 고르세요. (재료는 이미 쓰였어요)',
        [`기존 카드 유지: ${desc(old)}`, `새 카드로 교체: ${desc(c)}`]);
      if (idx !== 1) return old;
      st.cards[st.cards.indexOf(old)] = c;
      if (st.deckUids.delete(old.uid)) st.deckUids.add(c.uid);
      return c;
    }
    st.cards.push(c);
    // 덱에 자리가 있으면 바로 넣어 준다
    const deck = deckCards();
    if (deck.length < DS.DeckRules.max && !(K.isMagic(c) && deck.filter(K.isMagic).length >= DS.DeckRules.maxMagic)) st.deckUids.add(c.uid);
    return c;
  }

  async function forge() {
    const tok = (t) => t && (t.kind === 'part' ? { kind: 'part', id: t.id } : { kind: 'card', id: t.id, axis: t.axis });
    const res = DS.Craft.match(slots.op, tok(slots.a), tok(slots.b), { unlocked: st.unlocked });
    const msg = $('#forge-msg'), anvil = $('.anvil');
    anvil.classList.remove('flash', 'shake');
    void anvil.offsetWidth; // 애니메이션 재시작
    if (res.ok) {
      slots = { a: null, op: null, b: null }; // 재료는 소모
      DS.Sound.forge();
      anvil.classList.add('flash');
      msg.className = 'forge-msg ok';
      if (res.out.kind === 'card') {
        const c = await addCard(res.out.id, res.out.axis), r = DS.Craft.book(c.id);
        const isNew = !st.discovered.has(c.id);
        st.discovered.add(c.id);
        st.mastery[c.id] = (st.mastery[c.id] || 0) + 1;
        const n = st.mastery[c.id];
        const masteryNote = n === DS.Craft.MASTERY ? ' <b>숙련 완료!</b> 즉시 연성 가능'
          : n < DS.Craft.MASTERY ? ` (숙련 ${n}/${DS.Craft.MASTERY})` : '';
        lastForgedId = c.id;
        if (tut && c.id === 'diff') tutForged = true;
        msg.innerHTML = `<p><b>${isNew ? '✨ 새 레시피 발견!' : '✨ 연성 성공!'}</b> ${cardLabel(c)}${masteryNote}`
          + (res.out.note ? `<br><span class="math">${pretty(res.out.note)}</span>` : '')
          + (K.isRare(c) ? '<br><span class="rare-note">레어: 이름별로 한 장 · 재료로 써도 사라지지 않아요</span>' : '')
          + `${st.deckUids.has(c.uid) ? '' : '<br><span class="ng-note">덱이 가득 차서 보관함에 들어갔어요. 덱 구성 탭에서 바꿔 넣으세요.</span>'}</p>`;
      } else {
        const ids = res.out.kind === 'parts' ? res.out.ids : [res.out.id];
        ids.forEach((id) => { st.bag[id] = (st.bag[id] || 0) + 1; });
        const what = ids.map((id) => `<span class="math">${pretty(DS.Parts[id].sym)}</span> (${esc(DS.Parts[id].name)})`).join(' + ');
        const note = res.out.note || DS.Craft.partNote(res.out.id, { unlocked: st.unlocked });
        msg.innerHTML = `<p><b>${ids.length > 1 ? '조각 완성' : '부품 완성'}:</b> ${what} — 부품 가방에 들어갔어요. 이어서 연성하세요.`
          + (note ? `<br><span class="math">${pretty(note)}</span>` : '') + '</p>';
      }
    } else {
      giveBack(slots.a); giveBack(slots.b);
      slots = { a: null, op: slots.op, b: null };
      DS.Sound.wrong();
      anvil.classList.add('shake');
      msg.className = 'forge-msg ng';
      msg.innerHTML = `<p><b>연성 실패</b> — 재료는 돌려받았어요.<br>${pretty(res.msg)}</p>`;
    }
    if (st.onForge) st.onForge(res.ok);
    render();
    if (res.sqTry) await unlockOp('sq'); // 같은 것끼리 곱하기를 시도 → ² 발견
  }

  // 즉시 연성: 보관함(덱 밖) 카드부터, 수치가 낮은 것부터 재료로 쓴다
  function pickCards(id, n) {
    const pool = st.cards.filter((c) => c.id === id && !c.locked)
      .sort((a, b) => (st.deckUids.has(a.uid) - st.deckUids.has(b.uid)) || ((a.atk + a.def) - (b.atk + b.def)));
    return pool.length >= n ? pool.slice(0, n) : null;
  }
  function affordable(q) {
    for (const [id, n] of Object.entries(q.parts || {})) if ((st.bag[id] || 0) < n) return false;
    for (const [id, n] of Object.entries(q.cards || {})) if (!pickCards(id, n)) return false;
    return true;
  }
  async function quickCraft(r) {
    if (!affordable(r.quick)) return;
    for (const [id, n] of Object.entries(r.quick.parts || {})) st.bag[id] -= n;
    for (const [id, n] of Object.entries(r.quick.cards || {})) {
      if (DS.Cards[id].tier === 'rare') continue; // 레어 재료는 사라지지 않음
      pickCards(id, n).forEach((c) => { st.cards.splice(st.cards.indexOf(c), 1); st.deckUids.delete(c.uid); });
    }
    const c = await addCard(r.card, 'x');
    DS.Sound.forge();
    lastForgedId = c.id;
    const msg = $('#forge-msg');
    msg.className = 'forge-msg ok';
    msg.innerHTML = `<p><b>⚡ 즉시 연성:</b> ${cardLabel(c)}</p>`;
    render();
  }

  function depart() {
    giveBack(slots.a); giveBack(slots.b);
    slots = { a: null, op: null, b: null };
    const chk = K.checkDeck(deckCards());
    if (!chk.ok) {
      toast(`덱 규칙을 맞춰야 출발할 수 있어요: ${chk.rows.filter((r) => !r.ok).map((r) => r.label).join(', ')}`, 3200);
      setTab('deck');
      return;
    }
    st.onDepart();
  }

  function toast(m, ms) { DS.UI.toast(m, ms); }
  const cardLabel = (c) => `<span class="cl">${esc(DS.Cards[c.id].name)}${c.axis === 'y' ? `(${esc(K.axisLabel(c))})` : ''} <b class="atk">⚔${c.atk}</b> <b class="def">🛡${c.def}</b>${c.scan ? ' 🔍' : ''}</span>`;

  // ── 조합법 창 (베타 한정) ─────────────────────────────────
  const tokName = (k, slotKey) => {
    const [kind, rest] = k.split(':');
    const [id, axis] = rest.split('@');
    if (kind === 'parts') return rest.split(',').map((x) => DS.Parts[x].name).join(' + ');
    if (kind === 'part') return DS.Parts[id].name;
    const d = DS.Cards[id];
    return d.name + (d.axis ? ` ${axis === 'y' ? '⇄' : ''}${K.axisLabel({ id, axis })}` : '');
  };
  function guideStep([a, op, b, out, n], i) {
    const o = DS.Ops[op];
    const lhs = a ? `[${esc(tokName(a, 'a'))}] ${pretty(o.sym)} [${esc(tokName(b, 'b'))}]`
      : `[${esc(tokName(b, 'a'))}] 에 ${pretty(o.sym)} (${esc(o.name)})`;
    const flip = [a, b].includes('card:diff@y') ? // 가로 차이 카드를 세로로 뒤집어 쓰는 단계만 안내
      ' <span class="muted small">← 모루 위에서 ⇄ 로 세로로 뒤집기</span>'
      : [a, b].includes('card:line@y') ? ' <span class="muted small">← 모루 위에서 ⇄ 로 일반형으로 뒤집기</span>' : '';
    return `<li><span class="g-no">${'①②③④⑤⑥⑦'[i]}</span> ${lhs} → <b>${esc(tokName(out))}</b>${n ? ` <span class="g-times">×${n}장</span>` : ''}${flip}</li>`;
  }
  function openGuide() {
    if (!DS.GUIDE || !st) return;
    if (st.onGuide) st.onGuide();
    $('#guide-list').innerHTML = DS.Craft.BOOK.map((r) => {
      const c = DS.Cards[r.card];
      const later = r.floor > st.floor ? ` <span class="g-later">${r.floor}층부터</span>` : '';
      return `<div class="g-item tier-${c.tier}"><p class="g-name"><span class="tier-badge sm">${DS.Tiers[c.tier].name}</span> <b>${esc(c.name)}</b> <span class="math muted">${pretty(c.formula)}</span>${later}</p>`
        + `<ol class="g-steps">${r.guide.map(guideStep).join('')}</ol>`
        + (r.alt ? `<p class="muted small">다른 길</p><ol class="g-steps">${r.alt.guide.map(guideStep).join('')}</ol>` : '') + '</div>';
    }).join('');
    $('#guide').classList.remove('hidden');
  }

  function bind() {
    $('#forge-btn').addEventListener('click', forge);
    $('#btn-guide').classList.toggle('hidden', !DS.GUIDE);
    $('#btn-guide').addEventListener('click', openGuide);
    $('#guide-close').addEventListener('click', () => $('#guide').classList.add('hidden'));
    $('#guide').addEventListener('click', (e) => { if (e.target.id === 'guide') $('#guide').classList.add('hidden'); });
    $('#depart').addEventListener('click', depart);
    document.querySelectorAll('.camp-tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  }

  // ── 첫 연성 튜토리얼 ─────────────────────────────────────
  // 화면을 어둡게 하고 눌러야 할 곳만 구멍을 내 밝힌다 (구멍 밖은 투명한 벽 4장이 막음)
  let tut = null, tutForged = false, tutRaf = 0;
  const TUT = [
    { text: '대장간에 온 걸 환영해!\n첫 공식을 함께 벼려 보자.', next: '시작' },
    { text: '점 x₁을 눌러 모루에 올려.', target: () => $('#parts [data-part="x1"]'), done: () => slotHas('x1') },
    { text: '빼기(−)를 눌러 가운데에 올려.', target: () => $('#ops [data-op="minus"]'), done: () => slots.op === 'minus' },
    { text: '점 x₂도 올려.', target: () => $('#parts [data-part="x2"]'), done: () => slotHas('x1') && slotHas('x2') && slots.op === 'minus' },
    { text: '⚒ 연성!', target: () => $('#forge-btn'), done: () => tutForged },
    { text: '차이 카드 완성! 두 점의 좌표를 빼면 x₂\u00a0−\u00a0x₁.\n이제부터는 스스로 조합을 찾아봐.\n막히면 아래 레시피 도감의 힌트를 보자.', target: () => $('#store [data-card="diff"]'), next: '좋아!' },
    // ² 발견 유도 (선택): 아직 못 찾았을 때만
    { text: '💡 하나 더!\n🔒 잠긴 연산은 직접 발견해야 열려.\n같은 카드 두 장을 곱하기(×)로 올려 보면 어떻게 될까?', target: () => $('#ops [data-op="sq"]'), next: '해 볼게!', skip: () => isFound('sq') },
  ];
  const slotHas = (id) => [slots.a, slots.b].some((t) => t && t.kind === 'part' && t.id === id);

  function startTutorial() {
    if ((st.bag.x1 || 0) < 1 || (st.bag.x2 || 0) < 1) return;
    tutForged = false;
    const el = document.createElement('div');
    el.className = 'tut';
    el.innerHTML = '<div class="tut-ring"></div><div class="tut-block" data-s="t"></div><div class="tut-block" data-s="b"></div>'
      + '<div class="tut-block" data-s="l"></div><div class="tut-block" data-s="r"></div>'
      + '<div class="tut-bubble"><p class="tut-text"></p><div class="tut-btns"><button class="btn primary small tut-next"></button><button class="btn small tut-skip">건너뛰기</button></div></div>';
    document.body.appendChild(el);
    tut = { el, step: -1 };
    el.querySelector('.tut-skip').addEventListener('click', () => endTutorial('skipped'));
    el.querySelector('.tut-next').addEventListener('click', () => tutGo(tut.step + 1));
    tutGo(0);
    const loop = () => { if (!tut) return; tutPlace(); tutRaf = requestAnimationFrame(loop); };
    tutRaf = requestAnimationFrame(loop);
  }
  function tutGo(i) {
    if (!tut) return;
    if (i >= TUT.length) { endTutorial('done'); return; }
    if (TUT[i].skip && TUT[i].skip()) { tutGo(i + 1); return; }
    tut.step = i;
    const s = TUT[i];
    tut.el.querySelector('.tut-text').textContent = s.text;
    const nb = tut.el.querySelector('.tut-next');
    nb.textContent = s.next || '';
    nb.classList.toggle('hidden', !s.next);
    const t = s.target && s.target();
    if (t) t.scrollIntoView({ block: 'center', behavior: 'smooth' });
    tutPlace();
  }
  function tutCheck() {
    if (!tut) return;
    const s = TUT[tut.step];
    if (s && s.done && s.done()) tutGo(tut.step + 1);
  }
  function tutPlace() {
    const s = TUT[tut.step], el = tut.el;
    const t = s && s.target && s.target();
    const ring = el.querySelector('.tut-ring'), bub = el.querySelector('.tut-bubble');
    const W = window.innerWidth, H = window.innerHeight;
    const set = (k, x, y, w, h) => Object.assign(el.querySelector(`.tut-block[data-s="${k}"]`).style, { left: x + 'px', top: y + 'px', width: Math.max(0, w) + 'px', height: Math.max(0, h) + 'px' });
    let r = t && t.getBoundingClientRect();
    if (!r || !r.width) {
      r = null;
      ring.style.display = 'none';
      set('t', 0, 0, W, H); set('b', 0, 0, 0, 0); set('l', 0, 0, 0, 0); set('r', 0, 0, 0, 0);
      el.classList.add('dim');
    } else {
      el.classList.remove('dim');
      const p = 6, x = r.left - p, y = r.top - p, w = r.width + 2 * p, h = r.height + 2 * p;
      Object.assign(ring.style, { display: 'block', left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
      set('t', 0, 0, W, y); set('b', 0, y + h, W, H - y - h); set('l', 0, y, x, h); set('r', x + w, y, W - x - w, h);
    }
    // 말풍선: 대상이 화면 위쪽이면 아래에, 아래쪽이면 위에
    const bw = Math.min(360, W - 32);
    bub.style.width = bw + 'px';
    bub.style.left = Math.max(16, Math.min(W - bw - 16, r ? r.left + r.width / 2 - bw / 2 : (W - bw) / 2)) + 'px';
    const bh = bub.offsetHeight;
    let top = !r ? (H - bh) / 2 : r.top + r.height / 2 < H / 2 ? r.bottom + 14 : r.top - bh - 14;
    bub.style.top = Math.max(8, Math.min(H - bh - 8, top)) + 'px';
  }
  function endTutorial(result) {
    if (!tut) return;
    cancelAnimationFrame(tutRaf);
    tut.el.remove();
    tut = null;
    if (st && st.onTutorial) st.onTutorial(result);
  }

  return { open, bind, refresh: () => { if (st) render(); }, tutorialActive: () => !!tut };
})();
