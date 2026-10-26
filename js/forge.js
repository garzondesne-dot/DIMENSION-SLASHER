// 캠프 · 공식의 공방: 부품 3개를 모루 슬롯에 올려 상위 공식 카드를 연성한다.
// 드래그(마우스/터치)와 탭(첫 빈 슬롯에 놓기) 둘 다 지원. 틀린 조합은 부품을 잃지 않고 개념 피드백만 준다.
window.DS = window.DS || {};

DS.Forge = (function () {
  const $ = (s) => document.querySelector(s);
  const { pretty, esc } = DS.UI;
  let st = null; // { inv, deck, discovered:Set, floor, onDepart }
  let slots = [null, null, null];
  let departArmed = false;

  function open(state) {
    st = state;
    slots = [null, null, null];
    departArmed = false;
    $('#forge-msg').innerHTML = '';
    $('#forge-msg').className = 'forge-msg';
    render();
  }

  function render() {
    renderSlots();
    renderInv();
    renderBook();
    renderDeck();
    const info = DS.Progress.floors[st.floor];
    $('#depart').textContent = `${info.title} 출발 ▶`;
  }

  function partHtml(id) {
    const p = DS.Parts[id];
    return `<span class="psym math">${pretty(p.sym)}</span><span class="pname">${esc(p.name)}</span>`;
  }

  function renderSlots() {
    document.querySelectorAll('.slot').forEach((el, i) => {
      el.innerHTML = slots[i] ? `<div class="part in-slot">${partHtml(slots[i])}</div>` : '<span class="slot-empty">부품</span>';
      el.classList.toggle('filled', !!slots[i]);
      el.onclick = () => unslot(i);
    });
    $('#forge-btn').disabled = slots.some((s) => !s);
  }

  function renderInv() {
    const box = $('#parts');
    box.innerHTML = '';
    Object.keys(st.inv).forEach((id) => {
      const n = st.inv[id];
      const el = document.createElement('div');
      el.className = 'part' + (n <= 0 ? ' empty' : '');
      el.innerHTML = `${partHtml(id)}<span class="pcount">×${n}</span>`;
      if (n > 0) el.addEventListener('pointerdown', (e) => startDrag(e, id, el));
      box.appendChild(el);
    });
  }

  function renderBook() {
    const box = $('#recipes');
    box.innerHTML = DS.Recipes.filter((r) => r.floor <= st.floor).map((r) => {
      const card = DS.Cards[r.id];
      if (st.discovered.has(r.id)) {
        const parts = r.parts.map((p) => esc(DS.Parts[p].name)).join(' + ');
        return `<div class="recipe known t${card.tier}"><div class="r-eq">${parts} → <b>${esc(card.name)}</b></div>`
          + `<div class="r-lore math">${pretty(r.lore)}</div></div>`;
      }
      return `<div class="recipe unknown"><div class="r-eq">??? + ??? + ??? → <b>???</b></div>`
        + `<div class="r-lore">힌트: ${pretty(r.hint)}</div></div>`;
    }).join('');
  }

  function renderDeck() {
    const counts = {};
    st.deck.forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
    $('#deck-count').textContent = st.deck.length;
    $('#deck').innerHTML = Object.keys(counts).map((id) => {
      const c = DS.Cards[id];
      return `<span class="deck-chip t${c.tier}">${esc(c.name)} ×${counts[id]}</span>`;
    }).join('');
  }

  // ── 슬롯 조작 ─────────────────────────────────────────────
  function placeAt(i, id) {
    if (st.inv[id] <= 0) return;
    if (slots[i]) st.inv[slots[i]]++;
    slots[i] = id;
    st.inv[id]--;
    DS.Sound.clank();
    render();
  }
  function placeFirstEmpty(id) {
    const i = slots.indexOf(null);
    if (i === -1) { toast('모루가 가득 찼어요. 슬롯을 눌러 부품을 빼세요.'); return; }
    placeAt(i, id);
  }
  function unslot(i) {
    if (!slots[i]) return;
    st.inv[slots[i]]++;
    slots[i] = null;
    render();
  }

  // 포인터 드래그: 고스트를 띄우고, 놓은 위치의 슬롯을 찾는다. 거의 안 움직였으면 탭으로 처리.
  function startDrag(e, id, src) {
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
      if (!moved) { placeFirstEmpty(id); return; }
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const slot = el && el.closest('.slot');
      if (slot) placeAt(Number(slot.dataset.i), id);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  // ── 연성 ─────────────────────────────────────────────────
  const keyOf = (ids) => ids.slice().sort().join('|');

  function forge() {
    if (slots.some((s) => !s)) return;
    const key = keyOf(slots);
    const r = DS.Recipes.find((x) => x.floor <= st.floor && keyOf(x.parts) === key);
    const msg = $('#forge-msg'), anvil = $('.anvil');
    anvil.classList.remove('flash', 'shake');
    void anvil.offsetWidth; // 애니메이션 재시작
    if (r) {
      const card = DS.Cards[r.id];
      st.deck.push(r.id);
      const isNew = !st.discovered.has(r.id);
      st.discovered.add(r.id);
      slots = [null, null, null];
      DS.Sound.forge();
      anvil.classList.add('flash');
      msg.className = 'forge-msg ok';
      msg.innerHTML = `<div class="forged card t${card.tier}"><span class="cost">${card.cost}</span>`
        + `<span class="cname">${esc(card.name)}</span><span class="formula math">${pretty(card.formula)}</span>`
        + `<span class="cdesc">${esc(card.desc)}</span></div>`
        + `<p><b>${isNew ? '새 레시피 발견!' : '연성 성공!'}</b> ${pretty(r.lore)}</p>`;
    } else {
      slots.forEach((id) => { st.inv[id]++; });
      slots = [null, null, null];
      DS.Sound.wrong();
      anvil.classList.add('shake');
      msg.className = 'forge-msg ng';
      msg.innerHTML = `<p><b>연성 실패</b> — 부품은 돌려받았어요.<br>${pretty(DS.ForgeMistakes[key] || '이 조합으로는 공식이 되지 않아요. 레시피 도감의 힌트를 보세요.')}</p>`;
    }
    departArmed = false;
    render();
  }

  function depart() {
    const hasFloorCard = st.deck.some((id) => DS.Cards[id].tier === st.floor);
    if (!hasFloorCard && !departArmed) {
      departArmed = true;
      toast('이번 층 공식 카드가 없어요! 그래도 가려면 한 번 더 누르세요.');
      return;
    }
    st.onDepart();
  }

  function toast(m) { DS.UI.toast(m); }

  function bind() {
    $('#forge-btn').addEventListener('click', forge);
    $('#depart').addEventListener('click', depart);
  }

  return { open, bind };
})();
