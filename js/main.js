// 화면 흐름
//  캠페인: 캠프 → 잡몹 → 캠프 → 보스 (1층, 2층) → 클리어
//  최종보스 체험판: 41쪽 11번 단독 전투 (필요한 카드는 기억 복원으로 지급)
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
      node: 0,
      loop: 1,
      deck: DS.Progress.startDeck.slice(),
      bag: {},
      discovered: new Set(),
      mastery: {},
      granted: new Set(), // 부품을 이미 받은 노드
      problems: {}, // 노드별 문제 (되감기 후에도 같은 문제)
      stats: { asked: 0, correct: 0, steps: 0, crits: 0, wrongTools: 0 },
    };
  }
  const statHooks = () => ({
    onAnswer: (ok) => { G.stats.asked++; if (ok) G.stats.correct++; },
    onStep: () => { G.stats.steps++; },
    onCrit: () => { G.stats.crits++; },
    onWrongTool: () => { G.stats.wrongTools++; },
  });

  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
  }
  function addParts(parts) {
    Object.entries(parts || {}).forEach(([k, v]) => { G.bag[k] = (G.bag[k] || 0) + v; });
  }
  const nodes = DS.Progress.nodes;

  function goto(i) {
    G.node = i;
    const n = nodes[i];
    if (n.type === 'camp') enterCamp(n, i);
    else if (n.type === 'battle') startBattle(n, i);
    else showClear();
  }

  function enterCamp(n, i) {
    if (!G.granted.has(i)) { addParts(n.parts); G.granted.add(i); }
    const next = nodes[i + 1];
    const mon = DS.Monsters[next.monster];
    $('#camp-sub').textContent = `${DS.Progress.floors[n.floor].title} — ${DS.Progress.floors[n.floor].unit}`;
    $('#camp-next').innerHTML = `<b>다음 상대: ${esc(mon.name)}</b> (풀이 ${mon.gates.length}단계)<br><span class="muted">${esc(mon.campHint)}</span>`;
    const problem = G.problems[i + 1] || (G.problems[i + 1] = mon.makeProblem());
    DS.Forge.open({
      bag: G.bag, deck: G.deck, discovered: G.discovered, mastery: G.mastery, floor: n.floor,
      nextTitle: `${mon.name}에게 출발`,
      needTools: problem.steps.map((s) => s.tool).filter(Boolean),
      onDepart: () => goto(i + 1),
    });
    show('screen-camp');
  }

  function startBattle(n, i) {
    const def = DS.Monsters[n.monster];
    const problem = G.problems[i] || (G.problems[i] = def.makeProblem());
    show('screen-battle');
    DS.Battle.start({
      def, problem, deck: G.deck.slice(), loop: G.loop,
      title: DS.Progress.floors[n.floor].title,
      ...statHooks(),
      onWin: () => afterWin(n, i),
      onLose: () => { G.loop++; startBattle(n, i); },
    });
  }

  function partChips(parts) {
    return Object.entries(parts).map(([id, k]) => {
      const p = DS.Parts[id];
      return `<div class="part"><span class="psym math">${pretty(p.sym)}</span><span class="pname">${esc(p.name)}</span><span class="pcount">×${k}</span></div>`;
    }).join('');
  }

  function afterWin(n, i) {
    const def = DS.Monsters[n.monster];
    if (n.reward) addParts(n.reward);
    const next = nodes[i + 1];
    $('#reward-title').textContent = `${def.name} 해결!`;
    $('#reward-desc').textContent = n.reward ? '문제를 푼 자리에서 새로운 기억의 부품을 얻었다.' : '';
    $('#reward-parts').innerHTML = n.reward ? partChips(n.reward) : '';
    $('#reward-next').textContent = next.type === 'clear' ? '' : `다음: ${DS.Progress.floors[next.floor].title}`;
    $('#reward-go').textContent = next.type === 'clear' ? '결과 보기 ▶' : '캠프로 ▶';
    $('#reward-go').onclick = () => goto(i + 1);
    show('screen-reward');
  }

  function statRows(s, loops) {
    const rate = s.asked ? Math.round((100 * s.correct) / s.asked) : 0;
    return `
      <tr><th>푼 문제</th><td>${s.asked}문제 (정답률 ${rate}%)</td></tr>
      <tr><th>해결한 풀이 단계</th><td>${s.steps}단계</td></tr>
      <tr><th>맞지 않는 도구 시도</th><td>${s.wrongTools}번</td></tr>
      <tr><th>크리티컬</th><td>${s.crits}번</td></tr>
      <tr><th>되감기</th><td>${loops - 1}번 (LOOP ${String(loops).padStart(3, '0')})</td></tr>`;
  }

  function showClear() {
    $('#clear-stats').innerHTML = statRows(G.stats, G.loop) + `<tr><th>최종 덱</th><td>${G.deck.length}장</td></tr>`;
    show('screen-clear');
  }

  // ── 최종보스 체험판 ───────────────────────────────────────
  let T = null;
  function startTrial(keepProblem) {
    if (!keepProblem) T = { loop: 1, problem: DS.Monsters.finalBoss.makeProblem(), stats: { asked: 0, correct: 0, steps: 0, crits: 0, wrongTools: 0 } };
    show('screen-battle');
    const hooksFor = (s) => ({
      onAnswer: (ok) => { s.asked++; if (ok) s.correct++; },
      onStep: () => { s.steps++; },
      onCrit: () => { s.crits++; },
      onWrongTool: () => { s.wrongTools++; },
    });
    DS.Battle.start({
      def: DS.Monsters.finalBoss, problem: T.problem, deck: DS.Progress.trialDeck.slice(), loop: T.loop,
      title: '최종보스 체험판', trial: true,
      ...hooksFor(T.stats),
      onWin: () => {
        $('#trial-stats').innerHTML = statRows(T.stats, T.loop);
        show('screen-trial-clear');
      },
      onLose: () => { T.loop++; startTrial(true); },
    });
  }

  function bind() {
    DS.Forge.bind();
    DS.Battle.bind();
    $('#btn-start').addEventListener('click', () => { DS.Sound.unlock(); newGame(); show('screen-story'); });
    $('#btn-trial').addEventListener('click', () => { DS.Sound.unlock(); startTrial(false); });
    $('#btn-story').addEventListener('click', () => goto(0));
    $('#btn-restart').addEventListener('click', () => { newGame(); show('screen-title'); });
    $('#btn-clear-trial').addEventListener('click', () => startTrial(false));
    $('#btn-trial-again').addEventListener('click', () => startTrial(false));
    $('#btn-trial-title').addEventListener('click', () => show('screen-title'));
    document.querySelectorAll('.mute').forEach((b) => b.addEventListener('click', () => {
      const m = DS.Sound.toggle();
      document.querySelectorAll('.mute').forEach((x) => { x.textContent = m ? '소리 끔' : '소리 켬'; });
    }));
    // 키보드: 문제 창에서 1~4로 선택, Enter로 계속 / 전투 중 E로 턴 종료
    window.addEventListener('keydown', (e) => {
      if (document.querySelector('.cine.qte')) return; // QTE 는 자체 처리
      const quizOpen = !$('#quiz').classList.contains('hidden');
      if (quizOpen) {
        const k = Number(e.key);
        if (k >= 1 && k <= 4) { const b = document.querySelectorAll('#quiz-choices .choice')[k - 1]; if (b) b.click(); }
        if (e.key === 'Enter' && !$('#quiz-next').classList.contains('hidden')) $('#quiz-next').click();
        return;
      }
      if ((e.key === 'e' || e.key === 'E') && $('#screen-battle').classList.contains('active')) $('#end-turn').click();
    });
  }

  newGame();
  bind();
})();
