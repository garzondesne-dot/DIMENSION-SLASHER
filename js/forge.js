// 캠프: [대장간] 탭과 [덱 구성] 탭
//  대장간: 모루 [재료] [연산] [재료]. 재료 = 부품 가방 + 보관함 카드(잠긴 카드 제외). 연산과 m′은 무한.
//          카드 결과는 매번 수치를 새로 굴린다. 같은 카드를 직접 3번 만들면 숙련 → 즉시 연성.
//  덱 구성: 보관함 ↔ 덱 이동, 잠금, 분해(소재 절반 회수), 덱 규칙 검사
window.DS = window.DS || {};

DS.Forge = (function () {
  const $ = (s) => document.querySelector(s);
  const { pretty, esc } = DS.UI;
  const K = DS.CardKit;
  let st = null; // { bag, cards, deckUids:Set, discovered:Set, mastery, floor, nextTitle, onDepart }
  let slots = { a: null, op: null, b: null };
  let tab = 'forge';
  const TIER_RANK = { basic: 0, normal: 1, magic: 2, rare: 3, unique: 4, special: 5 };

  function open(state) {
    st = state;
    slots = { a: null, op: null, b: null };
    $('#forge-msg').innerHTML = '';
    $('#forge-msg').className = 'forge-msg';
    setTab('forge');
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
  }

  // ── 표시 ─────────────────────────────────────────────────
  function partHtml(id) {
    const p = DS.Parts[id];
    return `<span class="psym math">${pretty(p.sym)}</span><span class="pname">${esc(p.name)}</span>`;
  }
  function miniCard(c, extraCls = '') {
    const el = document.createElement('div');
    el.className = `card mini tier-${DS.Cards[c.id].tier} ${extraCls}`;
    el.innerHTML = DS.UI.cardInner(c);
    return el;
  }

  function renderSlots() {
    ['a', 'b'].forEach((k) => {
      const el = $(`.slot[data-k="${k}"]`), t = slots[k];
      el.innerHTML = '';
      el.classList.toggle('filled', !!t);
      if (!t) el.innerHTML = '<span class="slot-empty">재료</span>';
      else if (t.kind === 'part') el.innerHTML = `<div class="part in-slot">${partHtml(t.id)}</div>`;
      else {
        el.appendChild(miniCard(t.card));
        if (DS.Cards[t.id].axis) el.insertAdjacentHTML('beforeend', '<button class="flip" title="가로 ↔ 세로">⇄ 축 바꾸기</button>');
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
    opEl.onclick = () => { slots.op = null; render(); };
    $('#forge-btn').disabled = !slots.op || (!slots.a && !slots.b);
  }

  function renderOps() {
    const box = $('#ops');
    box.innerHTML = '';
    Object.entries(DS.Ops).forEach(([id, o]) => {
      const el = document.createElement('div');
      el.className = 'part op' + (o.locked ? ' locked' : '');
      el.innerHTML = `<span class="psym math">${pretty(o.sym)}</span><span class="pname">${esc(o.name)}</span><span class="pcount">${o.locked ? '🔒' : '∞'}</span>`;
      if (o.locked) el.title = o.locked;
      el.addEventListener('pointerdown', (e) => startDrag(e, { kind: 'op', id }, el));
      box.appendChild(el);
    });
  }

  function renderBag() {
    const box = $('#parts');
    box.innerHTML = '';
    const ids = Object.keys(DS.Parts).filter((id) => {
      const p = DS.Parts[id];
      if (p.inf) return st.floor >= 2;
      return (st.bag[id] || 0) > 0 || (!p.mid && st.bag[id] != null);
    });
    ids.forEach((id) => {
      const p = DS.Parts[id], n = p.inf ? Infinity : (st.bag[id] || 0);
      const el = document.createElement('div');
      el.className = 'part' + (n <= 0 ? ' empty' : '') + (p.mid ? ' mid' : '') + (p.inf ? ' inf' : '');
      el.innerHTML = `${partHtml(id)}<span class="pcount">${p.inf ? '∞' : `×${n}`}</span>`;
      if (n > 0) el.addEventListener('pointerdown', (e) => startDrag(e, { kind: 'part', id }, el));
      box.appendChild(el);
    });
  }

  function renderStore() {
    const box = $('#store');
    box.innerHTML = '';
    const list = sorted(st.cards);
    $('#store-count').textContent = list.length;
    if (!list.length) box.innerHTML = '<p class="muted">카드가 없어요</p>';
    list.forEach((c) => {
      const inDeck = st.deckUids.has(c.uid);
      const el = miniCard(c, (c.locked ? 'locked-card' : 'usable') + (inDeck ? ' in-deck' : ''));
      if (inDeck) el.insertAdjacentHTML('beforeend', '<span class="deck-flag">덱</span>');
      if (!c.locked) el.addEventListener('pointerdown', (e) => startDrag(e, { kind: 'card', id: c.id, axis: c.axis, uid: c.uid }, el));
      box.appendChild(el);
    });
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
    const txt = Object.entries(refund).map(([id, n]) => `${DS.Parts[id].name} ${n}`).join(', ') || '없음';
    const idx = await DS.Cinematic.choice('분해', `${DS.Cards[c.id].name} (⚔${c.atk} 🛡${c.def})을(를) 분해하고 ${txt}을(를) 돌려받을까요?`, ['분해한다', '취소']);
    if (idx !== 0) return;
    st.cards.splice(st.cards.indexOf(c), 1);
    st.deckUids.delete(c.uid);
    Object.entries(refund).forEach(([id, n]) => { st.bag[id] = (st.bag[id] || 0) + n; });
    DS.Sound.armorBreak();
    toast(`분해 완료: ${txt} 회수`);
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
    st.cards.splice(st.cards.indexOf(c), 1);
    const wasInDeck = st.deckUids.delete(c.uid);
    return { kind: 'card', id: c.id, axis: c.axis, uid: c.uid, card: c, wasInDeck };
  }
  function giveBack(t) {
    if (!t) return;
    if (t.kind === 'part') { if (!DS.Parts[t.id].inf) st.bag[t.id] = (st.bag[t.id] || 0) + 1; return; }
    st.cards.push(t.card);
    if (t.wasInDeck) st.deckUids.add(t.uid);
  }
  function place(t, where) {
    if (t.kind === 'op') {
      if (DS.Ops[t.id].locked) { toast(`${DS.Ops[t.id].name} 연산은 ${DS.Ops[t.id].locked}.`); return; }
      slots.op = t.id;
    } else {
      const k = where && where !== 'op' ? where : (!slots.a ? 'a' : !slots.b ? 'b' : null);
      if (!k) { toast('재료 칸이 가득 찼어요. 슬롯을 눌러 빼세요.'); return; }
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

  function startDrag(e, t, src) {
    e.preventDefault();
    DS.Sound.unlock();
    const sx = e.clientX, sy = e.clientY;
    let moved = false, ghost = null, over = null;
    const move = (ev) => {
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
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
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
    window.addEventListener('pointercancel', up);
  }

  // ── 연성 ─────────────────────────────────────────────────
  function addCard(id, axis) {
    const c = K.roll(id, axis || 'x');
    st.cards.push(c);
    // 덱에 자리가 있으면 바로 넣어 준다
    const deck = deckCards();
    if (deck.length < DS.DeckRules.max && !(K.isMagic(c) && deck.filter(K.isMagic).length >= DS.DeckRules.maxMagic)) st.deckUids.add(c.uid);
    return c;
  }

  function forge() {
    const tok = (t) => t && (t.kind === 'part' ? { kind: 'part', id: t.id } : { kind: 'card', id: t.id, axis: t.axis });
    const res = DS.Craft.match(slots.op, tok(slots.a), tok(slots.b));
    const msg = $('#forge-msg'), anvil = $('.anvil');
    anvil.classList.remove('flash', 'shake');
    void anvil.offsetWidth; // 애니메이션 재시작
    if (res.ok) {
      slots = { a: null, op: null, b: null }; // 재료는 소모
      DS.Sound.forge();
      anvil.classList.add('flash');
      msg.className = 'forge-msg ok';
      if (res.out.kind === 'card') {
        const c = addCard(res.out.id, res.out.axis), r = DS.Craft.book(c.id);
        const isNew = !st.discovered.has(c.id);
        st.discovered.add(c.id);
        st.mastery[c.id] = (st.mastery[c.id] || 0) + 1;
        const n = st.mastery[c.id];
        const masteryNote = n === DS.Craft.MASTERY ? '<br><b>숙련 완료!</b> 레시피 도감에서 즉시 연성할 수 있어요.'
          : n < DS.Craft.MASTERY ? ` (숙련 ${n}/${DS.Craft.MASTERY})` : '';
        msg.innerHTML = '';
        msg.appendChild(miniCard(c, 'forged'));
        msg.insertAdjacentHTML('beforeend', `<p><b>${isNew ? '새 레시피 발견!' : '연성 성공!'}</b> ${r ? pretty(r.lore) : ''}${masteryNote}`
          + `${st.deckUids.has(c.uid) ? '' : '<br><span class="muted">덱이 가득 차서 보관함에 들어갔어요. 덱 구성 탭에서 바꿔 넣으세요.</span>'}</p>`);
      } else {
        st.bag[res.out.id] = (st.bag[res.out.id] || 0) + 1;
        const p = DS.Parts[res.out.id];
        msg.innerHTML = `<p><b>부품 완성:</b> <span class="math">${pretty(p.sym)}</span> (${esc(p.name)}) — 부품 가방에 들어갔어요. 이어서 연성하세요.</p>`;
      }
    } else {
      giveBack(slots.a); giveBack(slots.b);
      slots = { a: null, op: slots.op, b: null };
      DS.Sound.wrong();
      anvil.classList.add('shake');
      msg.className = 'forge-msg ng';
      msg.innerHTML = `<p><b>연성 실패</b> — 재료는 돌려받았어요.<br>${pretty(res.msg)}</p>`;
    }
    render();
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
  function quickCraft(r) {
    if (!affordable(r.quick)) return;
    for (const [id, n] of Object.entries(r.quick.parts || {})) st.bag[id] -= n;
    for (const [id, n] of Object.entries(r.quick.cards || {})) {
      pickCards(id, n).forEach((c) => { st.cards.splice(st.cards.indexOf(c), 1); st.deckUids.delete(c.uid); });
    }
    const c = addCard(r.card, 'x');
    DS.Sound.forge();
    const msg = $('#forge-msg');
    msg.className = 'forge-msg ok';
    msg.innerHTML = '';
    msg.appendChild(miniCard(c, 'forged'));
    msg.insertAdjacentHTML('beforeend', `<p><b>⚡ 즉시 연성:</b> ${esc(DS.Cards[r.card].name)}</p>`);
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

  function bind() {
    $('#forge-btn').addEventListener('click', forge);
    $('#depart').addEventListener('click', depart);
    document.querySelectorAll('.camp-tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  }

  return { open, bind };
})();
