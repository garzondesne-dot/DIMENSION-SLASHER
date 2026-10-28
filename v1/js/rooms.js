// 갈림길(분기 맵)과 곁방: 보물상자(다이얼 자물쇠) · 상점 · 이벤트 · 차원 이동 안내
//  - 잡몹을 이기면 갈림길에서 한 곳을 골라 들른 뒤 캠프로 간다 (무엇을 골라도 벌은 없다)
//  - 보물상자: 주관식(정수) 문제의 답을 다이얼로 맞추면 "철컥" 열리고 유물이 나온다
//  - 엘리트: 고난도 선택 스테이지 (전투는 main.js 가 맡음), 이기면 유물
window.DS = window.DS || {};

DS.Rooms = (function () {
  const $ = (s) => document.querySelector(s);
  const { esc, pretty } = DS.UI;
  const toast = (m, ms) => DS.UI.toast(m, ms);
  const show = (id) => {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
  };

  const OPT = {
    chest: { icon: '🎁', name: '보물상자', desc: '자물쇠 문제(주관식)를 풀면 유물' },
    shop: { icon: '🛒', name: '상인', desc: '기억 결정 ◆으로 물약·부품·유물' },
    event: { icon: '❓', name: '떠도는 수학자', desc: '한 문제 풀면 선물' },
    elite: { icon: '💀', name: '엘리트', desc: '고난도 선택 스테이지 · 이기면 유물' },
  };
  const optInfo = (o) => (o.startsWith('elite:') ? { ...OPT.elite, monster: o.slice(6) } : OPT[o]);

  // 보상 유물: 아직 없는 일반 유물 중 무작위 (다 있으면 결정 30)
  function grantRelic(G) {
    const pool = Object.keys(DS.Relics).filter((id) => !DS.Relics[id].medal && !G.relics.includes(id));
    if (!pool.length) { G.crystals += 30; return null; }
    const id = DS.MathGen.pick(pool);
    G.relics.push(id);
    if (G.equipped.filter((r) => !DS.Relics[r].medal).length < DS.RELIC_SLOTS) G.equipped.push(id);
    return id;
  }
  const relicLine = (id) => (id ? `${DS.Relics[id].icon} <b>${esc(DS.Relics[id].name)}</b> — ${esc(DS.Relics[id].desc)}` : '유물을 모두 모았다! 대신 ◆ 30');
  function addPotion(G, id) {
    if (G.potions.length >= DS.MAX_POTIONS) return false;
    G.potions.push(id);
    return true;
  }

  // ── 갈림길 ───────────────────────────────────────────────
  function fork(G, node, onPick) {
    const fl = DS.Progress.floors[node.floor];
    $('#fork-floor').textContent = fl.title;
    // 층의 흐름: 캠프 → 잡몹 → [갈림길] → 캠프 → … → 보스
    const nodes = DS.Progress.nodes.filter((n) => n.floor === node.floor && n.type !== 'camp');
    $('#fork-map').innerHTML = nodes.map((n) => {
      if (n.type === 'fork') return `<span class="fm-node fork${n === node ? ' cur' : ''}">⑂</span>`;
      const m = DS.Monsters[n.monster];
      const done = DS.Progress.nodes.indexOf(n) < G.node;
      return `<span class="fm-node${done ? ' done' : ''}${n.medal ? ' boss' : ''}">${n.medal || n === nodes[nodes.length - 1] ? '👑' : '⚔'}<small>${esc(m.name)}</small></span>`;
    }).join('<i class="fm-line"></i>');
    const box = $('#fork-opts');
    box.innerHTML = '';
    node.options.forEach((o) => {
      const info = optInfo(o);
      const b = document.createElement('button');
      b.className = 'fork-opt' + (o.startsWith('elite') ? ' elite' : '');
      b.innerHTML = `<span class="fo-icon">${info.icon}</span><b>${esc(info.name)}</b><small>${esc(info.desc)}${info.monster ? `<br>${esc(DS.Monsters[info.monster].name)}` : ''}</small>`;
      b.onclick = () => { box.querySelectorAll('button').forEach((x) => { x.disabled = true; }); DS.Sound.clank(); onPick(o); };
      box.appendChild(b);
    });
    const skip = document.createElement('button');
    skip.className = 'fork-opt skip';
    skip.innerHTML = '<span class="fo-icon">⛺</span><b>바로 캠프로</b><small>곁방에 들르지 않는다</small>';
    skip.onclick = () => { box.querySelectorAll('button').forEach((x) => { x.disabled = true; }); onPick('skip'); };
    box.appendChild(skip);
    show('screen-fork');
  }

  // ── 보물상자 ─────────────────────────────────────────────
  // 다이얼: 부호(+/−) 1개 + 숫자 3개. ▲▼로 돌린다
  function chest(G, dim, onDone) {
    const q = DS.MathGen.chestQuestion(dim);
    DS.Rooms.lastChest = q; // 자동 플레이 테스트용
    let tries = 0;
    const dials = [0, 0, 0, 0]; // [부호(0:+,1:−), 백, 십, 일]
    $('#chest-q').innerHTML = pretty(q.question);
    $('#chest-box').className = 'chest-box';
    $('#chest-msg').innerHTML = DS.Settings.get('cheat') ? `<span class="cheat-mark">★ 치트: 번호 ${q.answer}</span>` : '';
    const cv = $('#chest-map');
    if (q.pts) {
      cv.classList.remove('hidden');
      DS.Diagram.draw(cv, { type: 'plane', points: q.pts.map(([x, y, label]) => ({ x, y, label })) });
    } else cv.classList.add('hidden');
    const box = $('#dials');
    const draw = () => {
      box.innerHTML = dials.map((v, k) => `<div class="dial${k === 0 ? ' sign' : ''}" data-k="${k}"><button class="up">▲</button><b>${k === 0 ? (v ? '−' : '+') : v}</b><button class="down">▼</button></div>`).join('');
      box.querySelectorAll('.dial').forEach((d) => {
        const k = Number(d.dataset.k), mod = k === 0 ? 2 : 10;
        d.querySelector('.up').onclick = () => { dials[k] = (dials[k] + 1) % mod; DS.Sound.clank(); draw(); };
        d.querySelector('.down').onclick = () => { dials[k] = (dials[k] + mod - 1) % mod; DS.Sound.clank(); draw(); };
      });
    };
    draw();
    const value = () => (dials[0] ? -1 : 1) * (dials[1] * 100 + dials[2] * 10 + dials[3]);
    $('#chest-open').disabled = false;
    $('#chest-open').onclick = () => {
      tries++;
      if (value() === q.answer) {
        $('#chest-open').disabled = true;
        DS.Sound.latch();
        $('#chest-box').classList.add('open');
        const id = grantRelic(G);
        G.crystals += 10;
        $('#chest-msg').innerHTML = `<b>철컥!</b> 상자가 열렸다.<br>${relicLine(id)} · ◆ +10`;
        if (G.stats) G.stats.chests = (G.stats.chests || 0) + 1;
        setTimeout(() => onDone(true), 2200);
      } else {
        DS.Sound.wrong();
        $('#chest-box').classList.remove('shake'); void $('#chest-box').offsetWidth; $('#chest-box').classList.add('shake');
        $('#chest-msg').innerHTML = `철컥… 안 열린다. (${value()}) ${tries >= 2 ? '💡 힌트를 눌러 볼까?' : '다시 계산해 보자.'}`;
      }
    };
    $('#chest-hint').onclick = () => {
      $('#chest-msg').innerHTML = `💡 ${pretty(q.solution).replace(/= ?−?\d+$/, '= ?')}`;
    };
    $('#chest-leave').onclick = () => onDone(false);
    show('screen-chest');
  }

  // ── 상점 ─────────────────────────────────────────────────
  function shop(G, dim, onDone) {
    const items = [];
    DS.MathGen.shuffle(Object.keys(DS.Potions)).slice(0, 3).forEach((id) => items.push({ kind: 'potion', id, price: DS.Potions[id].price, label: `${DS.Potions[id].icon} ${DS.Potions[id].name}`, desc: DS.Potions[id].desc }));
    const parts = Object.keys(DS.Parts).filter((id) => DS.Parts[id].dim === dim && !DS.Parts[id].mid && !DS.Parts[id].inf);
    items.push({ kind: 'parts', price: 12, label: '🧩 부품 꾸러미', desc: '이번 차원 부품을 2개씩', parts });
    const relicPool = Object.keys(DS.Relics).filter((id) => !DS.Relics[id].medal && !G.relics.includes(id));
    if (relicPool.length) { const id = DS.MathGen.pick(relicPool); items.push({ kind: 'relic', id, price: 55, label: `${DS.Relics[id].icon} ${DS.Relics[id].name}`, desc: DS.Relics[id].desc }); }
    const supply = Object.keys(DS.Progress.dimSupply[dim] || {});
    if (supply.length) { const id = DS.MathGen.pick(supply); items.push({ kind: 'card', id, price: 18, label: `📜 ${DS.Cards[id].name} 소환`, desc: '지난 차원 카드 한 장을 서고에 (차원을 잇는 레시피용)' }); }
    const render = () => {
      $('#shop-crystals').textContent = G.crystals;
      const box = $('#shop-items');
      box.innerHTML = '';
      items.forEach((it) => {
        const el = document.createElement('div');
        el.className = 'shop-item' + (it.sold ? ' sold' : '');
        el.innerHTML = `<span><b>${esc(it.label)}</b><small>${esc(it.desc)}</small></span><button class="btn small"${it.sold || G.crystals < it.price ? ' disabled' : ''}>${it.sold ? '판매 완료' : `◆ ${it.price}`}</button>`;
        el.querySelector('button').onclick = () => {
          if (it.sold || G.crystals < it.price) return;
          if (it.kind === 'potion' && !addPotion(G, it.id)) { toast(`물약은 최대 ${DS.MAX_POTIONS}개까지 가질 수 있어요.`); return; }
          if (it.kind === 'parts') it.parts.forEach((id) => { G.bag[id] = (G.bag[id] || 0) + 2; });
          if (it.kind === 'relic') { G.relics.push(it.id); if (G.equipped.filter((r) => !DS.Relics[r].medal).length < DS.RELIC_SLOTS) G.equipped.push(it.id); }
          if (it.kind === 'card') { const c = DS.CardKit.roll(it.id); c.arch = true; G.cards.push(c); }
          G.crystals -= it.price;
          it.sold = true;
          DS.Sound.coin();
          render();
        };
        box.appendChild(el);
      });
    };
    render();
    $('#shop-leave').onclick = () => onDone();
    show('screen-shop');
  }

  // ── 이벤트: 떠도는 수학자 (이번 차원의 연습 문제 하나) ───────────────
  async function event(G, dim, onDone) {
    const ids = DS.Craft.BOOK.filter((r) => r.dim === dim && DS.MathGen.PRACTICE[r.card] && r.floor <= (DS.Progress.nodes[G.node] || {}).floor).map((r) => r.card);
    const id = DS.MathGen.pick(ids.length ? ids : DS.Craft.BOOK.filter((r) => r.dim === dim && DS.MathGen.PRACTICE[r.card]).map((r) => r.card));
    await DS.Cinematic.choice('❓ 떠도는 수학자', '"풀어 볼 텐가? 맞히면 선물을 주지. 틀려도 괜찮아, 해설을 들려주마."', ['도전한다']);
    const ok = await DS.Quiz.ask(DS.Cards[id], DS.MathGen.PRACTICE[id](), { tag: '❓ 수학자의 문제' });
    if (ok) {
      const idx = await DS.Cinematic.choice('정답!', '"훌륭해. 무엇을 가져가겠나?"', ['물약 하나', '◆ 기억 결정 20']);
      if (idx === 0) {
        const p = DS.MathGen.pick(Object.keys(DS.Potions));
        if (addPotion(G, p)) toast(`${DS.Potions[p].icon} ${DS.Potions[p].name}을(를) 받았다.`);
        else { G.crystals += 20; toast('물약 가방이 가득 차서 ◆ 20을 받았다.'); }
      } else { G.crystals += 20; toast('◆ 20을 받았다.'); }
    } else {
      G.crystals += 5;
      toast('"아깝군. 해설을 기억해 두게." ◆ 5를 받았다.', 2600);
    }
    onDone();
  }

  // ── 차원 이동 안내 ───────────────────────────────────────
  const DIM_DESC = {
    2: '숫자와 도형의 세계를 지나, 모임과 논리의 세계로. 이 차원의 괴물은 집합과 명제로 이루어져 있다. 새 기본 카드 [원소 확인]을 받는다.',
    3: '모임과 논리를 지나, 대응과 변화의 세계로. 이 차원의 괴물은 함수와 그래프로 이루어져 있다. 새 기본 카드 [대응]을 받는다.',
  };
  function dimIntro(dim, supply, onGo) {
    $('#dim-title').textContent = `DIMENSION ${DS.Dims[dim].short} · ${DS.Dims[dim].name.slice(2)}`;
    $('#dim-desc').textContent = DIM_DESC[dim] || '';
    $('#dim-supply').textContent = supply ? `차원 이동 보급: ${supply} (서고)` : '';
    $('#dim-go').onclick = onGo;
    show('screen-dim');
  }

  return { fork, chest, shop, event, dimIntro, grantRelic, optInfo };
})();
