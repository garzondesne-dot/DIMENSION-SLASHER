// 캠프 · 공식의 공방: 모루 [재료] [연산] [재료] 에 올려 한 단계씩 연성한다.
// 재료 = 부품 가방의 부품 + 덱의 일반·매직 카드(재료로 쓰면 사라짐). 연산은 무한.
// 같은 카드를 직접 3번 만들면 숙련 → 레시피 도감에서 즉시 연성.
window.DS = window.DS || {};

DS.Forge = (function () {
  const $ = (s) => document.querySelector(s);
  const { pretty, esc } = DS.UI;
  let st = null; // { bag, deck, discovered:Set, mastery, floor, hint, onDepart }
  let slots = { a: null, op: null, b: null };
  let departArmed = false;

  const isMaterialCard = (id) => ['normal', 'magic'].includes(DS.Cards[id].tier);

  function open(state) {
    st = state;
    slots = { a: null, op: null, b: null };
    departArmed = false;
    $('#forge-msg').innerHTML = '';
    $('#forge-msg').className = 'forge-msg';
    render();
  }

  function render() {
    renderSlots();
    renderOps();
    renderBag();
    renderDeck();
    renderBook();
    $('#depart').textContent = `${st.nextTitle} ▶`;
  }

  // ── 표시 ─────────────────────────────────────────────────
  function tokenHtml(t) {
    if (t.kind === 'part') {
      const p = DS.Parts[t.id];
      return `<span class="psym math">${pretty(p.sym)}</span><span class="pname">${esc(p.name)}</span>`;
    }
    const c = DS.Cards[t.id];
    const sym = t.id === 'segLen' && t.axis === 'y' ? '|y₂ − y₁|' : c.formula;
    return `<span class="psym math">${pretty(sym)}</span><span class="pname">${esc(c.name)}${t.axis === 'y' ? ' (세로)' : ''}</span>`;
  }

  function renderSlots() {
    ['a', 'b'].forEach((k) => {
      const el = $(`.slot[data-k="${k}"]`), t = slots[k];
      el.innerHTML = t ? `<div class="part in-slot tok-${t.kind}${t.kind === 'card' ? ` tier-${DS.Cards[t.id].tier}` : ''}">${tokenHtml(t)}</div>`
        + (t.kind === 'card' && DS.Cards[t.id].axis ? '<button class="flip" title="가로 ↔ 세로">⇄ 축 바꾸기</button>' : '')
        : '<span class="slot-empty">재료</span>';
      el.classList.toggle('filled', !!t);
      el.onclick = (e) => {
        if (e.target.closest('.flip')) {
          t.axis = t.axis === 'y' ? 'x' : 'y';
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
      el.className = 'part op';
      el.innerHTML = `<span class="psym math">${pretty(o.sym)}</span><span class="pname">${esc(o.name)}</span><span class="pcount">∞</span>`;
      el.addEventListener('pointerdown', (e) => startDrag(e, { kind: 'op', id }, el));
      box.appendChild(el);
    });
  }

  function renderBag() {
    const box = $('#parts');
    box.innerHTML = '';
    const ids = Object.keys(DS.Parts).filter((id) => st.bag[id] > 0 || (!DS.Parts[id].mid && st.bag[id] != null));
    if (!ids.length) box.innerHTML = '<p class="muted">비어 있음</p>';
    ids.forEach((id) => {
      const n = st.bag[id] || 0;
      const el = document.createElement('div');
      el.className = 'part' + (n <= 0 ? ' empty' : '') + (DS.Parts[id].mid ? ' mid' : '');
      el.innerHTML = `${tokenHtml({ kind: 'part', id })}<span class="pcount">×${n}</span>`;
      if (n > 0) el.addEventListener('pointerdown', (e) => startDrag(e, { kind: 'part', id }, el));
      box.appendChild(el);
    });
  }

  function renderDeck() {
    const counts = {};
    st.deck.forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
    $('#deck-count').textContent = st.deck.length;
    const box = $('#deck');
    box.innerHTML = '';
    Object.keys(counts).forEach((id) => {
      const c = DS.Cards[id];
      const el = document.createElement('div');
      el.className = `deck-chip tier-${c.tier}` + (isMaterialCard(id) ? ' usable' : '');
      el.innerHTML = `<span class="tier-dot"></span>${esc(c.name)} ×${counts[id]}`;
      if (isMaterialCard(id)) el.addEventListener('pointerdown', (e) => startDrag(e, { kind: 'card', id, axis: 'x' }, el));
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
      if (!st.discovered.has(r.card)) {
        el.className = 'recipe unknown';
        el.innerHTML = `<div class="r-eq">??? → <b>???</b> <span class="tier-badge sm">${DS.Tiers[c.tier].name}</span></div><div class="r-lore">힌트: ${pretty(r.hint)}</div>`;
      } else {
        const mastered = n >= DS.Craft.MASTERY;
        const can = mastered && affordable(r.quick);
        el.className = `recipe known tier-${c.tier}`;
        el.innerHTML = `<div class="r-eq">${pretty(r.chain)} → <b>${esc(c.name)}</b> <span class="tier-badge sm">${DS.Tiers[c.tier].name}</span></div>`
          + `<div class="r-lore math">${pretty(r.lore)}</div>`
          + `<div class="r-mastery">${mastered ? '<b>숙련 완료</b>' : `숙련 ${n} / ${DS.Craft.MASTERY} (직접 연성)`}`
          + (mastered ? ` <button class="btn small quick"${can ? '' : ' disabled'}>⚡ 즉시 연성</button>` : '') + '</div>';
        const q = el.querySelector('.quick');
        if (q) q.addEventListener('click', () => quickCraft(r));
      }
      box.appendChild(el);
    });
  }

  // ── 슬롯 조작 ─────────────────────────────────────────────
  function take(t) {
    if (t.kind === 'part') { if (!(st.bag[t.id] > 0)) return false; st.bag[t.id]--; return true; }
    const k = st.deck.indexOf(t.id);
    if (k < 0) return false;
    st.deck.splice(k, 1);
    return true;
  }
  function giveBack(t) {
    if (!t) return;
    if (t.kind === 'part') st.bag[t.id] = (st.bag[t.id] || 0) + 1;
    else st.deck.push(t.id);
  }
  function place(t, where) {
    if (t.kind === 'op') {
      slots.op = t.id;
    } else {
      const k = where && where !== 'op' ? where : (!slots.a ? 'a' : !slots.b ? 'b' : null);
      if (!k) { toast('재료 칸이 가득 찼어요. 슬롯을 눌러 빼세요.'); return; }
      if (!take(t)) return;
      giveBack(slots[k]);
      slots[k] = { ...t };
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
  function addOutput(out) {
    if (out.kind === 'card') st.deck.push(out.id);
    else st.bag[out.id] = (st.bag[out.id] || 0) + 1;
  }

  function forge() {
    const res = DS.Craft.match(slots.op, slots.a, slots.b);
    const msg = $('#forge-msg'), anvil = $('.anvil');
    anvil.classList.remove('flash', 'shake');
    void anvil.offsetWidth; // 애니메이션 재시작
    if (res.ok) {
      slots.a = slots.b = null; // 재료는 소모
      slots.op = null;
      addOutput(res.out);
      DS.Sound.forge();
      anvil.classList.add('flash');
      msg.className = 'forge-msg ok';
      if (res.out.kind === 'card') {
        const id = res.out.id, c = DS.Cards[id], r = DS.Craft.BOOK.find((x) => x.card === id);
        const isNew = !st.discovered.has(id);
        st.discovered.add(id);
        st.mastery[id] = (st.mastery[id] || 0) + 1;
        const n = st.mastery[id];
        const masteryNote = n === DS.Craft.MASTERY ? '<br><b>숙련 완료!</b> 이제 레시피 도감에서 즉시 연성할 수 있어요.'
          : n < DS.Craft.MASTERY ? ` (숙련 ${n}/${DS.Craft.MASTERY})` : '';
        msg.innerHTML = `<div class="forged card tier-${c.tier}"><span class="cost">${c.cost}</span><span class="tier-badge">${DS.Tiers[c.tier].name}</span>`
          + `<span class="cname">${esc(c.name)}</span><span class="formula math">${pretty(c.formula)}</span></div>`
          + `<p><b>${isNew ? '새 레시피 발견!' : '연성 성공!'}</b> ${r ? pretty(r.lore) : ''}${masteryNote}</p>`;
      } else {
        const p = DS.Parts[res.out.id];
        msg.innerHTML = `<p><b>중간 부품 완성:</b> <span class="math">${pretty(p.sym)}</span> — 부품 가방에 들어갔어요. 다음 단계로 이어서 연성하세요.</p>`;
      }
    } else {
      giveBack(slots.a); giveBack(slots.b);
      slots.a = slots.b = null;
      DS.Sound.wrong();
      anvil.classList.add('shake');
      msg.className = 'forge-msg ng';
      msg.innerHTML = `<p><b>연성 실패</b> — 재료는 돌려받았어요.<br>${pretty(res.msg)}</p>`;
    }
    departArmed = false;
    render();
  }

  function affordable(q) {
    for (const [id, n] of Object.entries(q.parts || {})) if ((st.bag[id] || 0) < n) return false;
    for (const [id, n] of Object.entries(q.cards || {})) if (st.deck.filter((x) => x === id).length < n) return false;
    return true;
  }
  function quickCraft(r) {
    if (!affordable(r.quick)) return;
    for (const [id, n] of Object.entries(r.quick.parts || {})) st.bag[id] -= n;
    for (const [id, n] of Object.entries(r.quick.cards || {})) for (let i = 0; i < n; i++) st.deck.splice(st.deck.indexOf(id), 1);
    st.deck.push(r.card);
    DS.Sound.forge();
    const msg = $('#forge-msg');
    msg.className = 'forge-msg ok';
    msg.innerHTML = `<p><b>⚡ 즉시 연성:</b> ${esc(DS.Cards[r.card].name)} 한 장이 덱에 들어갔어요.</p>`;
    render();
  }

  function depart() {
    // 재료 칸에 남은 것은 돌려받는다
    giveBack(slots.a); giveBack(slots.b);
    slots = { a: null, op: null, b: null };
    if (st.needTools && !st.needTools.every((id) => st.deck.includes(id)) && !departArmed) {
      departArmed = true;
      toast('다음 몬스터를 풀 도구가 덱에 부족할 수 있어요. 그래도 가려면 한 번 더 누르세요.', 3000);
      render();
      return;
    }
    st.onDepart();
  }

  function toast(m, ms) { DS.UI.toast(m, ms); }

  function bind() {
    $('#forge-btn').addEventListener('click', forge);
    $('#depart').addEventListener('click', depart);
  }

  return { open, bind };
})();
