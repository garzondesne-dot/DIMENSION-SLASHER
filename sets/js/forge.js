// 캠프: [대장간] 탭과 [덱 구성] 탭
//  대장간: 모루 [재료] [연산] [재료]. 재료 = 부품 가방 + 보관함 카드(잠긴 카드 제외). 연산과 m′은 무한.
//          카드 결과는 매번 수치를 새로 굴린다. 같은 카드를 직접 3번 만들면 숙련 → 즉시 연성.
//          보관함은 카드 종류별 묶음으로 보인다 (칸 순서 고정, 누르면 덱 밖·수치 낮은 카드부터, ▾로 펼쳐 직접 고르기)
//  덱 구성: 보관함 ↔ 덱 이동, 잠금, 분해(소재 절반 회수), 덱 규칙 검사 — 카드를 낱장으로 비교
//  첫 연성 튜토리얼: 캠페인 첫 캠프에서 한 번, 눌러야 할 곳만 밝혀 [x₁] − [x₂] → 차이를 함께 만든다
//  레어: 이름별 1장, 재료로 써도 보관함에 남음, 이미 있는 레어를 다시 연성하면 기존/새 카드 중 하나를 고름
//  조합법 창: DS.GUIDE 가 켜졌을 때만 (v0.2.2 기본은 꺼짐). 안내 문구는 Craft.BOOK.guide, 테스트로 검증
//  v1.0 테스트판: 차원(대단원)마다 연산·부품·레시피가 따로 보인다. 지난 차원 카드는 [📜 지난 차원 서고]에서 꺼내 쓴다.
//                 묶음 보기는 설정에서 켜고 끔(기본 낱장). [🎒 유물·물약] 탭에서 유물 착용(3칸).
window.DS = window.DS || {};

DS.Forge = (function () {
  const $ = (s) => document.querySelector(s);
  const { pretty, esc } = DS.UI;
  const K = DS.CardKit;
  let st = null; // { bag, cards, deckUids:Set, discovered:Set, mastery, floor, dim, relics, equipped, potions, crystals, nextTitle, onDepart, ... }
  let archOpen = false;
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
    if (st.tutorial) startTutorial(st.tutorial);
  }
  function setTab(t) {
    tab = t;
    document.querySelectorAll('.camp-tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    $('#tab-forge').classList.toggle('hidden', t !== 'forge');
    $('#tab-deck').classList.toggle('hidden', t !== 'deck');
    $('#tab-gear').classList.toggle('hidden', t !== 'gear');
    render();
  }

  const active = () => st.cards.filter((c) => !c.arch);
  const deckCards = () => st.cards.filter((c) => st.deckUids.has(c.uid) && !c.arch);
  const sorted = (list) => list.slice().sort((a, b) => (TIER_RANK[DS.Cards[b.id].tier] - TIER_RANK[DS.Cards[a.id].tier])
    || ((b.atk + b.def) - (a.atk + a.def)));

  function render() {
    const chk = K.checkDeck(deckCards(), st.dim);
    $('#camp-cheat').classList.toggle('hidden', !DS.Settings.get('cheat'));
    $('#deck-rule-mini').innerHTML = chk.ok ? '<span class="ok">덱 규칙 ✓</span>' : '<span class="ng">덱 규칙 ✗</span>';
    $('#depart').textContent = `${st.nextTitle} ▶`;
    if (tab === 'forge') { renderSlots(); renderOps(); renderBag(); renderStore(); renderArchive(); renderBook(); } else if (tab === 'deck') renderDeckTab(chk); else renderGear();
    tutCheck();
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
      if (o.dims && !o.dims.includes(st.dim)) return; // 차원마다 다른 연산
      if (o.floor && st.floor < o.floor) return; // 대입·비교는 3층부터
      const el = document.createElement('div');
      el.className = 'part op' + (o.locked ? ' locked' : '');
      el.dataset.op = id;
      el.innerHTML = `<span class="psym math">${pretty(o.sym)}</span><span class="pname">${esc(o.name)}</span>${o.locked ? '<span class="pcount">🔒</span>' : ''}`;
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
      if (p.dim !== st.dim) return false;
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
  const pickStack = (id) => active().filter((c) => c.id === id && !c.locked).sort(byUse)[0] || null;
  const cardTok = (c) => ({ kind: 'card', id: c.id, axis: c.axis, uid: c.uid });

  function renderStore() {
    const box = $('#store');
    box.innerHTML = '';
    const act = active();
    $('#store-count').textContent = act.length;
    box.classList.toggle('singles', !DS.Settings.get('stack'));
    if (!DS.Settings.get('stack')) { renderSingles(box, act); return; }
    const ids = STACK_ORDER.filter((id) => act.some((c) => c.id === id));
    if (!ids.length) box.innerHTML = '<p class="muted">카드가 없어요</p>';
    if (openStack && !ids.includes(openStack)) openStack = null;
    ids.forEach((id) => {
      const d = DS.Cards[id], list = act.filter((c) => c.id === id);
      const inDeck = list.filter((c) => st.deckUids.has(c.uid)).length, ys = list.filter((c) => c.axis === 'y').length;
      const usable = list.some((c) => !c.locked);
      const el = document.createElement('div');
      el.className = `stack tier-${d.tier}` + (usable ? ' usable' : ' locked-card') + (id === lastForgedId ? ' just-forged' : '') + (id === openStack ? ' open' : '');
      el.dataset.card = id;
      el.innerHTML = `<span class="tier-badge">${DS.Tiers[d.tier].name}</span><span class="cname">${esc(d.name)}</span>`
        + `<span class="formula math">${pretty(d.formula)}</span><span class="s-count">×${list.length}</span>`
        + `<span class="s-meta">덱 ${inDeck}${ys ? ` · ⇄세로 ${ys}` : ''}</span><button class="s-open" title="펼쳐서 고르기">${id === openStack ? '▴' : '▾'}</button>`;
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
      act.filter((c) => c.id === openStack).sort(byUse).forEach((c) => {
        const row = document.createElement('div');
        row.className = 'sl-row' + (c.locked ? ' locked-card' : '');
        row.innerHTML = `<b class="atk">⚔${c.atk}</b> <b class="def">🛡${c.def}</b>${c.scan ? ' 🔍' : ''}${c.axis === 'y' ? ' <span class="sl-tag">세로</span>' : ''}`
          + `${c.affixes.map(([k, v]) => ` <span class="affix">${esc(DS.Affixes[k].text(v))}</span>`).join('')}`
          + `${st.deckUids.has(c.uid) ? ' <span class="sl-tag deck">덱</span>' : ''}${c.locked ? ' 🔒' : ''}`;
        if (!c.locked) row.addEventListener('pointerdown', (e) => startDrag(e, cardTok(c), row));
        wrap.appendChild(row);
      });
      box.appendChild(wrap);
    }
  }

  // 낱장 보기 (설정에서 묶음 보기를 끈 경우, 기본): 카드 한 장 = 한 칸, 누르면 그 카드가 모루에
  function renderSingles(box, act) {
    if (!act.length) { box.innerHTML = '<p class="muted">카드가 없어요</p>'; return; }
    const order = (c) => STACK_ORDER.indexOf(c.id);
    act.slice().sort((a, b) => order(a) - order(b) || ((a.atk + a.def) - (b.atk + b.def))).forEach((c) => {
      const el = miniCard(c, (c.locked ? 'locked-card' : 'usable') + (c.id === lastForgedId ? ' just-forged' : ''));
      el.dataset.card = c.id;
      el.dataset.uid = c.uid;
      if (st.deckUids.has(c.uid)) el.insertAdjacentHTML('beforeend', '<span class="in-deck">덱</span>');
      el.addEventListener('pointerdown', (e) => {
        if (c.locked) { toast('잠긴 카드예요. 덱 구성 탭에서 잠금을 풀 수 있어요.'); return; }
        startDrag(e, cardTok(c), el);
      });
      box.appendChild(el);
    });
  }

  // 지난 차원 서고: 다른 차원의 카드. [꺼내기]로 이번 차원의 보관함으로 옮긴다 (재료·덱에 쓸 수 있음)
  function renderArchive() {
    const box = $('#archive');
    const arch = st.cards.filter((c) => c.arch);
    $('#archive-wrap').classList.toggle('hidden', !arch.length);
    $('#archive-count').textContent = arch.length;
    box.innerHTML = '';
    $('#archive-toggle').textContent = archOpen ? '접기 ▴' : '펼치기 ▾';
    if (!archOpen) return;
    const order = (c) => STACK_ORDER.indexOf(c.id);
    arch.slice().sort((a, b) => (DS.Cards[a.id].dim - DS.Cards[b.id].dim) || order(a) - order(b)).forEach((c) => {
      const wrap = document.createElement('div');
      wrap.className = 'deck-item';
      wrap.appendChild(miniCard(c));
      const b = document.createElement('button');
      b.className = 'btn small';
      b.textContent = `◀ 꺼내기 (${DS.Dims[DS.Cards[c.id].dim].short})`;
      b.onclick = () => { c.arch = false; DS.Sound.clank(); toast(`${DS.Cards[c.id].name}을(를) 서고에서 꺼냈어요. 재료나 덱에 쓸 수 있어요.`); render(); };
      wrap.appendChild(b);
      box.appendChild(wrap);
    });
  }

  // 유물·물약 탭: 유물은 착용 칸 3개 (훈장은 칸을 차지하지 않음)
  function renderGear() {
    const R = DS.Relics, eq = st.equipped;
    const slotsUsed = eq.filter((r) => !R[r].medal).length;
    $('#gear-slots').textContent = `${slotsUsed} / ${DS.RELIC_SLOTS}`;
    $('#gear-crystals').textContent = st.crystals();
    const box = $('#relic-list');
    box.innerHTML = st.relics.length ? '' : '<p class="muted">아직 유물이 없어요. 보물상자·엘리트·상점에서 얻을 수 있어요.</p>';
    st.relics.forEach((id) => {
      const r = R[id], on = eq.includes(id);
      const el = document.createElement('div');
      el.className = 'relic' + (on ? ' on' : '') + (r.medal ? ' medal' : '');
      el.innerHTML = `<span class="r-icon">${r.icon}</span><span class="r-txt"><b>${esc(r.name)}</b><small>${esc(r.desc)}</small></span>`
        + (r.medal ? '<span class="muted small">항상 적용</span>' : `<button class="btn small">${on ? '벗기' : '착용'}</button>`);
      const b = el.querySelector('button');
      if (b) b.onclick = () => {
        if (on) eq.splice(eq.indexOf(id), 1);
        else if (slotsUsed >= DS.RELIC_SLOTS) { toast(`유물 착용 칸은 ${DS.RELIC_SLOTS}개예요. 하나를 벗고 착용하세요.`); return; }
        else eq.push(id);
        DS.Sound.clank();
        render();
      };
      box.appendChild(el);
    });
    const pb = $('#potion-list');
    pb.innerHTML = st.potions.length ? st.potions.map((id) => `<span class="potion-chip" title="${esc(DS.Potions[id].desc)}">${DS.Potions[id].icon} ${esc(DS.Potions[id].name)}</span>`).join('')
      : '<p class="muted">물약이 없어요. 전투 중 기력 없이 쓸 수 있어요 (최대 3개).</p>';
  }

  function renderBook() {
    const box = $('#recipes');
    box.innerHTML = '';
    DS.Craft.BOOK.filter((r) => r.dim === st.dim && r.floor <= st.floor).forEach((r) => {
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
    const deck = sorted(deckCards()), store = sorted(active().filter((c) => !st.deckUids.has(c.uid)));
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
    if (K.isRare(c) || DS.Cards[c.id].keep) return { kind: 'card', id: c.id, axis: c.axis, uid: c.uid, card: c, keep: true }; // 레어·기초 개념 카드는 보관함에 그대로
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
    if (old && old.arch) old.arch = false; // 서고에 있던 레어는 꺼내서 비교
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

  let busyForge = false;
  async function forge() {
    if (busyForge) return;
    const tok = (t) => t && (t.kind === 'part' ? { kind: 'part', id: t.id } : { kind: 'card', id: t.id, axis: t.axis });
    const res = DS.Craft.match(slots.op, tok(slots.a), tok(slots.b));
    const msg = $('#forge-msg'), anvil = $('.anvil');
    anvil.classList.remove('flash', 'shake');
    void anvil.offsetWidth; // 애니메이션 재시작
    // 번외편: 카드를 처음 만들 때 한 번, 반짝이며 예제가 뜬다. 맞혀야 연성 완성 (틀리면 재료를 돌려받고 다른 예제로 다시)
    if (res.ok && res.out.kind === 'card' && !st.discovered.has(res.out.id) && DS.SetGen.example(res.out.id)) {
      busyForge = true;
      anvil.classList.add('spark');
      DS.Sound.magic();
      msg.className = 'forge-msg ok';
      msg.innerHTML = `<p><b>✨ 새 개념의 빛!</b> 예제를 풀면 <b>${esc(DS.Cards[res.out.id].name)}</b> 카드가 완성된다.</p>`;
      await new Promise((r) => setTimeout(r, 700));
      const ok = await DS.Quiz.ask(DS.Cards[res.out.id], DS.SetGen.example(res.out.id), { tag: '✨ 연성 예제' });
      anvil.classList.remove('spark');
      busyForge = false;
      if (st.onExample) st.onExample(res.out.id, ok);
      if (!ok) {
        giveBack(slots.a); giveBack(slots.b);
        slots = { a: null, op: null, b: null };
        msg.className = 'forge-msg ng';
        msg.innerHTML = '<p><b>아직 개념이 흐릿하다…</b> 재료는 돌려받았어요. 해설을 떠올리며 다시 연성하면 <b>숫자가 바뀐 예제</b>가 나와요.</p>';
        if (st.onForge) st.onForge(false, res.out.id);
        render();
        if (tut) tutGo(Math.max(0, TUT.findIndex((x) => x.start))); // 튜토리얼 중이면 연성 첫 단계부터 다시
        return;
      }
    }
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
        if (tut) tutForged = true;
        msg.innerHTML = `<p><b>${isNew ? '✨ 새 레시피 발견!' : '✨ 연성 성공!'}</b> ${cardLabel(c)}${masteryNote}`
          + (K.isRare(c) ? '<br><span class="rare-note">레어: 이름별로 한 장 · 재료로 써도 사라지지 않아요</span>' : '')
          + `${st.deckUids.has(c.uid) ? '' : '<br><span class="ng-note">덱이 가득 차서 보관함에 들어갔어요. 덱 구성 탭에서 바꿔 넣으세요.</span>'}</p>`;
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
    if (st.onForge) st.onForge(res.ok, res.ok && res.out ? res.out.id : '');
    render();
  }

  // 즉시 연성: 보관함(덱 밖) 카드부터, 수치가 낮은 것부터 재료로 쓴다
  function pickCards(id, n) {
    const pool = active().filter((c) => c.id === id && !c.locked)
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
      if (DS.Cards[id].tier === 'rare' || DS.Cards[id].keep) continue; // 레어·기초 개념 카드 재료는 사라지지 않음
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
    const miss = (st.need || []).filter((id) => !st.discovered.has(id));
    if (miss.length) {
      toast(`이번 캠프의 새 카드를 먼저 연성하세요: ${miss.map((id) => DS.Cards[id].name).join(', ')} (레시피 도감의 힌트 참고)`, 3600);
      render();
      return;
    }
    const chk = K.checkDeck(deckCards(), st.dim);
    if (!chk.ok) {
      toast(`덱 규칙을 맞춰야 출발할 수 있어요: ${chk.rows.filter((r) => !r.ok).map((r) => r.label).join(', ')}`, 3200);
      setTab('deck');
      return;
    }
    st.onDepart();
  }

  function toast(m, ms) { DS.UI.toast(m, ms); }
  const cardLabel = (c) => `<span class="cl">${esc(DS.Cards[c.id].name)}${c.axis === 'y' ? '(세로)' : ''} <b class="atk">⚔${c.atk}</b> <b class="def">🛡${c.def}</b>${c.scan ? ' 🔍' : ''}</span>`;

  // ── 조합법 창 (베타 한정) ─────────────────────────────────
  const tokName = (k, slotKey) => {
    const [kind, rest] = k.split(':');
    const [id, axis] = rest.split('@');
    if (kind === 'part') return DS.Parts[id].name;
    return DS.Cards[id].name + (DS.Cards[id].axis ? (axis === 'y' ? ' ⇄세로' : ' 가로') : '');
  };
  function guideStep([a, op, b, out, n], i) {
    const o = DS.Ops[op];
    const lhs = a ? `[${esc(tokName(a, 'a'))}] ${pretty(o.sym)} [${esc(tokName(b, 'b'))}]`
      : `[${esc(tokName(b, 'a'))}] 에 ${pretty(o.sym)} (${esc(o.name)})`;
    const flip = [a, b].includes('card:diff@y') ? // 가로 차이 카드를 세로로 뒤집어 쓰는 단계만 안내
      ' <span class="muted small">← 모루 위에서 ⇄ 로 세로로 뒤집기</span>' : '';
    return `<li><span class="g-no">${'①②③④⑤⑥⑦'[i]}</span> ${lhs} → <b>${esc(tokName(out))}</b>${n ? ` <span class="g-times">×${n}장</span>` : ''}${flip}</li>`;
  }
  function openGuide() {
    if (!DS.GUIDE || !st) return;
    if (st.onGuide) st.onGuide();
    $('#guide-list').innerHTML = DS.Craft.BOOK.map((r) => {
      const c = DS.Cards[r.card];
      const later = r.floor > st.floor ? ` <span class="g-later">${r.floor}층부터</span>` : '';
      return `<div class="g-item tier-${c.tier}"><p class="g-name"><span class="tier-badge sm">${DS.Tiers[c.tier].name}</span> <b>${esc(c.name)}</b> <span class="math muted">${pretty(c.formula)}</span>${later}</p>`
        + `<ol class="g-steps">${r.guide.map(guideStep).join('')}</ol></div>`;
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
    $('#archive-toggle').addEventListener('click', () => { archOpen = !archOpen; render(); });
    $('#cheat-parts').addEventListener('click', () => {
      Object.entries(DS.Parts).forEach(([id, p]) => { if (p.dim === st.dim && !p.mid && !p.inf) st.bag[id] = (st.bag[id] || 0) + 5; });
      toast('치트: 이번 차원 부품 +5'); render();
    });
    $('#cheat-recipes').addEventListener('click', () => {
      DS.Craft.BOOK.forEach((r) => { if (r.dim === st.dim) { st.discovered.add(r.card); st.mastery[r.card] = Math.max(st.mastery[r.card] || 0, DS.Craft.MASTERY); } });
      toast('치트: 이번 차원 레시피 발견 + 숙련 (즉시 연성 가능)'); render();
    });
    document.querySelectorAll('.camp-tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  }

  // ── 첫 연성 튜토리얼 ─────────────────────────────────────
  // 화면을 어둡게 하고 눌러야 할 곳만 구멍을 내 밝힌다 (구멍 밖은 투명한 벽 4장이 막음)
  let tut = null, tutForged = false, tutRaf = 0;
  // 번외편: 캠프(층)마다 처음 들어올 때 한 번. 연성대 · 연산 · 부품 · 예제 · 덱 · 출발을 차례로 안내
  const STEP = (text, target, done, next) => ({ text, target, done, next });
  const P = (id) => () => $(`#parts [data-part="${id}"]`), O = (id) => () => $(`#ops [data-op="${id}"]`);
  const TUTS = {
    1: [
      STEP('대장간에 온 걸 환영해!\n여기서 수학 기호를 조합해 "개념 카드"를 벼려.\n카드가 있어야 몬스터(문제)를 풀 수 있어.', null, null, '시작'),
      { ...STEP('먼저 [원소]를 눌러 모루 왼쪽 칸에 올려.', P('elem'), () => slotHas('elem')), start: true },
      STEP('∈ (속한다) 를 눌러 가운데에 올려.', O('in'), () => slots.op === 'in'),
      STEP('[집합 A] 를 눌러 오른쪽 칸에 올려.\n∈ 의 왼쪽은 원소, 오른쪽은 집합!', P('setA'), () => slotHas('elem') && slotHas('setA') && slots.op === 'in'),
      STEP('⚒ 연성! 새 카드는 처음 한 번 예제가 반짝 떠. 맞히면 카드 완성!', () => $('#forge-btn'), () => tutForged),
      STEP('소속 판정 카드 완성! 만든 카드는 자동으로 덱에 들어가.\n순서나 자리가 틀리면 연성이 안 되고, 무엇이 틀렸는지 알려 줄 거야.', () => $('#store'), null, '좋아!'),
      STEP('이번엔 혼자 해 봐: n( ) 를 [집합 A] 에 씌우면 "원소의 개수" 카드!\n막히면 아래 레시피 도감의 힌트를 봐.', O('count'), null, '해 볼게'),
      STEP('두 카드를 다 만들면 [출발] 버튼으로 전투에 나가.\n몬스터가 잠겨 있으면 선생님이 알려 주는 해금 코드를 넣어.', () => $('#depart'), null, '알겠어!'),
    ],
    2: [
      STEP('2페이즈: 집합과 집합 사이의 관계 ⊂ 를 벼릴 차례야.\n순서가 바뀌면 뜻도 바뀌니까 왼쪽·오른쪽을 잘 봐!', null, null, '시작'),
      { ...STEP('[집합 A] 를 눌러 왼쪽 칸에 올려.', P('setA'), () => slots.a && slots.a.id === 'setA'), start: true },
      STEP('⊂ (부분집합) 를 가운데에.', O('sub'), () => slots.op === 'sub'),
      STEP('[집합 B] 를 오른쪽 칸에.', P('setB'), () => slots.b && slots.b.id === 'setB'),
      STEP('⚒ 연성! 예제를 풀면 부분집합 카드 완성.', () => $('#forge-btn'), () => tutForged),
      STEP('원소와 집합 사이는 ∈, 집합과 집합 사이는 ⊂.\n준비되면 출발!', () => $('#depart'), null, '좋아!'),
    ],
    3: [
      STEP('서로 같은 집합 = A ⊂ B 이고 B ⊂ A.\n먼저 반대 방향 "B ⊂ A" 를 부품으로 만들자.', null, null, '시작'),
      { ...STEP('[집합 B] 를 왼쪽 칸에.', P('setB'), () => slots.a && slots.a.id === 'setB'), start: true },
      STEP('⊂ 를 가운데에.', O('sub'), () => slots.op === 'sub'),
      STEP('[집합 A] 를 오른쪽 칸에.', P('setA'), () => slots.b && slots.b.id === 'setA'),
      STEP('⚒ 연성! B ⊂ A 부품이 가방에 들어가.', () => $('#forge-btn'), () => (st.bag.subBA || 0) > 0),
      STEP('이제 보관함의 [부분집합] 카드 + "이고" + [B ⊂ A] 부품 → "서로 같은 집합"!', O('and'), null, '해 볼게'),
      STEP('진부분집합은 반대 방향이 ⊄ 일 때: [B] ⊄ [A] 를 만든 뒤 "이고"로 이어 봐.\n두 카드를 다 만들면 출발!', () => $('#depart'), null, '알겠어!'),
    ],
    4: [
      STEP('3페이즈 · 형성평가 필드!\n여기부터는 선생님 도움 없이 혼자 클리어하는 거야.', null, null, '좋아'),
      STEP('원소마다 "넣는다 · 뺀다" 두 갈래. [2] ^ [원소의 개수] 로 2ⁿ 을 벼려 봐.\n나머지 카드(2ⁿ⁻ᵖ, 2ⁿ⁻q, 2ⁿ⁻ᵖ⁻q)는 도감 힌트로!', O('pow'), null, '해 볼게'),
    ],
  };
  let TUT = TUTS[1];
  const slotHas = (id) => [slots.a, slots.b].some((t) => t && t.kind === 'part' && t.id === id);

  function startTutorial(floor) {
    TUT = TUTS[floor] || [];
    if (!TUT.length) return;
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
    el.style.display = !$('#quiz').classList.contains('hidden') || document.querySelector('.cine') ? 'none' : ''; // 예제·연출 중에는 숨김
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

  return { open, bind, tutorialActive: () => !!tut };
})();
