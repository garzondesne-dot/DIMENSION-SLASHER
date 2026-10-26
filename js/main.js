// 화면 흐름: 타이틀 → 프롤로그 → 캠프(1) → 1층 골렘 → 전리품 → 캠프(2) → 2층 방패 거수 → 클리어
window.DS = window.DS || {};

(function () {
  const $ = (s) => document.querySelector(s);
  const { esc, pretty } = DS.UI;

  let toastTimer = null;
  DS.UI.toast = function (msg, ms = 2200) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  };

  let G;
  function newGame() {
    G = {
      loop: 1,
      deck: DS.Progress.startDeck.slice(),
      inv: {},
      granted: new Set(), // 부품을 이미 받은 캠프
      discovered: new Set(),
      stats: { asked: 0, correct: 0 },
    };
  }

  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
  }

  function addParts(parts) {
    Object.entries(parts).forEach(([k, v]) => { G.inv[k] = (G.inv[k] || 0) + v; });
  }

  function enterCamp(floor) {
    if (!G.granted.has(floor)) {
      addParts(DS.Progress.campParts[floor]);
      G.granted.add(floor);
    }
    const info = DS.Progress.floors[floor];
    $('#camp-sub').textContent = `다음: ${info.title} — ${info.unit}`;
    DS.Forge.open({
      inv: G.inv, deck: G.deck, discovered: G.discovered, floor,
      onDepart: () => startBattle(floor),
    });
    show('screen-camp');
  }

  function startBattle(floor) {
    const info = DS.Progress.floors[floor];
    show('screen-battle');
    DS.Battle.start({
      enemyId: info.enemy,
      deck: G.deck.slice(),
      floorInfo: info,
      loop: G.loop,
      onAnswer: (ok) => { G.stats.asked++; if (ok) G.stats.correct++; },
      onWin: () => afterWin(floor),
      onLose: () => { G.loop++; startBattle(floor); },
    });
  }

  function partChips(parts) {
    return Object.entries(parts).map(([id, n]) => {
      const p = DS.Parts[id];
      return `<div class="part"><span class="psym math">${pretty(p.sym)}</span><span class="pname">${esc(p.name)}</span><span class="pcount">×${n}</span></div>`;
    }).join('');
  }

  function afterWin(floor) {
    const def = DS.Enemies[DS.Progress.floors[floor].enemy];
    if (floor < DS.Progress.lastFloor) {
      const next = DS.Progress.floors[floor + 1];
      $('#reward-title').textContent = `${def.name} 격파!`;
      $('#reward-parts').innerHTML = partChips(DS.Progress.campParts[floor + 1]);
      $('#reward-next').textContent = `다음 층: ${next.title} — ${next.unit}`;
      $('#reward-go').onclick = () => enterCamp(floor + 1);
      show('screen-reward');
      return;
    }
    const { asked, correct } = G.stats;
    const rate = asked ? Math.round((100 * correct) / asked) : 0;
    $('#clear-stats').innerHTML = `
      <tr><th>푼 문제</th><td>${asked}문제</td></tr>
      <tr><th>정답</th><td>${correct}문제 (정답률 ${rate}%)</td></tr>
      <tr><th>되감기</th><td>${G.loop - 1}번 (LOOP ${String(G.loop).padStart(3, '0')})</td></tr>
      <tr><th>최종 덱</th><td>${G.deck.length}장</td></tr>`;
    show('screen-clear');
  }

  function bind() {
    DS.Forge.bind();
    DS.Battle.bind();
    $('#btn-start').addEventListener('click', () => { DS.Sound.unlock(); newGame(); show('screen-story'); });
    $('#btn-story').addEventListener('click', () => enterCamp(1));
    $('#btn-restart').addEventListener('click', () => { newGame(); show('screen-title'); });
    document.querySelectorAll('.mute').forEach((b) => b.addEventListener('click', () => {
      const m = DS.Sound.toggle();
      document.querySelectorAll('.mute').forEach((x) => { x.textContent = m ? '소리 끔' : '소리 켬'; });
    }));
    // 키보드: 문제 창에서 1~4로 선택, Enter로 계속 / 전투 중 E로 턴 종료
    window.addEventListener('keydown', (e) => {
      const quizOpen = !$('#quiz').classList.contains('hidden');
      if (quizOpen) {
        const n = Number(e.key);
        if (n >= 1 && n <= 4) { const b = document.querySelectorAll('#quiz-choices .choice')[n - 1]; if (b) b.click(); }
        if (e.key === 'Enter' && !$('#quiz-next').classList.contains('hidden')) $('#quiz-next').click();
        return;
      }
      if ((e.key === 'e' || e.key === 'E') && $('#screen-battle').classList.contains('active')) $('#end-turn').click();
    });
  }

  newGame();
  bind();
})();
