// 화면 흐름
//  캠페인: 캠프 → 잡몹 → 캠프 → 보스 (1층, 2층) → 클리어
//  최종보스 체험판: 41쪽 11번 단독 전투 (필요한 카드는 기억 복원으로 지급)
//  세이브: 캠페인만 자동 저장 (캠프 입장·출발·승리 직후), 타이틀의 [이어하기]로 저장된 캠프에서 시작
window.DS = window.DS || {};

(function () {
  const $ = (s) => document.querySelector(s);
  const { esc, pretty } = DS.UI;
  const K = DS.CardKit;

  let toastTimer = null;
  DS.UI.toast = function (msg, ms = 2200) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  };

  const newStats = () => ({ asked: 0, correct: 0, steps: 0, crits: 0, wrongTools: 0, emergencies: 0, forgeOK: 0, forgeFails: 0, guideViews: 0, playSec: 0 });
  let lastMode = null; // 결과 보내기에 쓸 최근 모드: 'campaign' | 'trial'
  let G;
  function newGame() {
    const cards = Array.from({ length: DS.Progress.startDiff }, () => K.roll('diff'));
    G = {
      node: 0,
      maxNode: 0, // 최고 도달 위치 (결과 보내기)
      loop: 1,
      cards, // 보관함 (덱 포함 모든 카드)
      deckUids: new Set(cards.map((c) => c.uid)),
      bag: {},
      discovered: new Set(['diff']),
      mastery: {},
      unlocked: new Set(), // 발견한 연산 (², √)
      granted: new Set(), // 부품을 이미 받은 노드
      problems: {}, // 노드별 문제 (되감기·후퇴 후에도 같은 문제)
      stats: newStats(),
    };
  }
  const statHooks = (s) => ({
    onAnswer: (ok) => { s.asked++; if (ok) s.correct++; },
    onStep: () => { s.steps++; },
    onCrit: () => { s.crits++; },
    onWrongTool: () => { s.wrongTools++; },
    onEmergency: () => { s.emergencies++; },
  });

  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
    if (id === 'screen-title') refreshTitle();
  }
  function refreshTitle() {
    $('#btn-continue').classList.toggle('hidden', !DS.Save.compatible());
    $('#save-note').textContent = DS.Save.has() && !DS.Save.compatible() ? '이전 버전의 저장은 이어할 수 없어요. 새로 시작해 주세요.' : '';
  }
  function addParts(parts) {
    Object.entries(parts || {}).forEach(([k, v]) => { G.bag[k] = (G.bag[k] || 0) + v; });
  }
  const nodes = DS.Progress.nodes;
  // 아직 못 찾은 연산을 자동 해금 (벌 없음): 골렘 입장 때 √, 2층 입장 때 ² (Promise)
  async function autoUnlock(n) {
    const miss = (n.autoOps || []).filter((op) => !G.unlocked.has(op));
    if (!miss.length) return;
    miss.forEach((op) => G.unlocked.add(op));
    DS.Save.write(G);
    const names = miss.map((op) => `${DS.Ops[op].sym} ${DS.Ops[op].name}`).join(', ');
    await DS.Cinematic.choice(`🔓 ${names} 연산을 깨달았다!`,
      (miss.includes('root') ? '√ 는 제곱을 되돌린다: 3² = 9 이니까 √9 = 3. ' : '')
      + (miss.includes('sq') ? '² 는 같은 것을 두 번 곱하는 것: 3 × 3 = 3². ' : '')
      + '이제 대장간에서 바로 쓸 수 있다.', ['좋아!']);
  }

  function goto(i) {
    G.node = i;
    G.maxNode = Math.max(G.maxNode || 0, i);
    lastMode = 'campaign';
    const n = nodes[i];
    if (n.type === 'camp') enterCamp(n, i);
    else if (n.type === 'battle') startBattle(n, i);
    else showClear();
  }

  // 캠프에는 다음 상대·문제를 보여 주지 않는다 (조우해야 알 수 있음). 층의 단원 범위만 표시.
  function enterCamp(n, i) {
    if (!G.granted.has(i)) {
      addParts(n.parts);
      // 받는 카드 (원 (일반형) 등): 보관함에만 넣는다 (재료용)
      Object.entries(n.cards || {}).forEach(([id, k]) => { for (let j = 0; j < k; j++) G.cards.push(K.roll(id)); });
      G.granted.add(i);
    }
    DS.Save.write(G);
    const fl = DS.Progress.floors[n.floor];
    $('#camp-sub').textContent = fl.title;
    $('#camp-next').innerHTML = `<b>범위:</b> ${esc(fl.unit)} <span class="muted">· 문제는 조우해야 알 수 있다</span>`;
    DS.Forge.open({
      bag: G.bag, cards: G.cards, deckUids: G.deckUids, discovered: G.discovered, mastery: G.mastery, floor: n.floor,
      unlocked: G.unlocked, guideOps: !!n.guide,
      onUnlock: () => DS.Save.write(G),
      nextTitle: '다음 전투로 출발',
      onForge: (ok) => { if (ok) G.stats.forgeOK = (G.stats.forgeOK || 0) + 1; else G.stats.forgeFails = (G.stats.forgeFails || 0) + 1; },
      onGuide: () => { G.stats.guideViews = (G.stats.guideViews || 0) + 1; },
      tutorial: i === 0 && !G.tutorial, // 캠페인 첫 캠프에서 한 번
      onTutorial: (r) => { G.tutorial = r; DS.Save.write(G); },
      onDepart: () => goto(i + 1),
    });
    show('screen-camp');
    autoUnlock(n).then(() => { if (n.autoOps) DS.Forge.refresh(); });
  }

  async function startBattle(n, i) {
    await autoUnlock(n);
    const def = DS.Monsters[n.monster];
    const problem = G.problems[i] || (G.problems[i] = def.makeProblem());
    DS.Save.write(G, i - 1); // 덱 구성·문제 숫자 저장. 전투 중에 닫으면 직전 캠프에서 이어 함
    show('screen-battle');
    DS.Battle.start({
      def, problem, deck: G.cards.filter((c) => G.deckUids.has(c.uid)), loop: G.loop, mastery: G.mastery,
      title: DS.Progress.floors[n.floor].title,
      ...statHooks(G.stats),
      onWin: () => afterWin(n, i),
      onLose: (how) => { G.loop++; if (how === 'camp') goto(i - 1); else startBattle(n, i); },
      onRetreat: () => goto(i - 1),
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
    // ² 를 아직 못 찾았으면 차이(가로) 카드 2장 + 힌트 (1층 부담 분산)
    const nudge = n.nudge === 'sq' && !G.unlocked.has('sq');
    if (nudge) for (let j = 0; j < 2; j++) G.cards.push(K.roll('diff', 'x'));
    if (n.unlock) G.discovered.add(n.unlock); // 중간보스 보상: 각성 레시피 해금
    DS.Save.write(G, i + 1);
    const next = nodes[i + 1];
    $('#reward-title').textContent = `${def.name} 해결!`;
    $('#reward-desc').textContent = n.unlock
      ? `각성 레시피 해금: ${DS.Cards[n.unlock].name} [d ± r]. 최종보스와의 결전에서 다시 깨어난다.`
      : n.reward ? '문제를 푼 자리에서 새로운 기억의 부품을 얻었다.' : '';
    if (nudge) $('#reward-desc').textContent += ' 보너스: 차이 카드 2장. 💡 같은 차이 카드 두 장을 곱하기(×)로 모루에 올려 보면…?';
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
      <tr><th>긴급 연성</th><td>${s.emergencies}번</td></tr>
      <tr><th>되감기</th><td>${loops - 1}번 (LOOP ${String(loops).padStart(3, '0')})</td></tr>`
      + (s.forgeOK != null ? `<tr><th>연성</th><td>성공 ${s.forgeOK || 0}번 · 실패 ${s.forgeFails || 0}번</td></tr>` : '')
      + (DS.GUIDE ? `<tr><th>조합법 열람</th><td>${s.guideViews || 0}번</td></tr>` : '');
  }

  function showClear() {
    $('#clear-stats').innerHTML = statRows(G.stats, G.loop) + `<tr><th>보유 카드</th><td>${G.cards.length}장 (덱 ${G.deckUids.size}장)</td></tr>`;
    show('screen-clear');
  }

  // ── 최종보스 체험판 ───────────────────────────────────────
  let T = null;
  function startTrial(keep) {
    if (!keep) {
      T = {
        loop: 1, problem: DS.Monsters.finalBoss.makeProblem(), stats: newStats(),
        deck: Array.from({ length: DS.Progress.trialDiff }, () => K.roll('diff')),
        cleared: false,
      };
    }
    lastMode = 'trial';
    show('screen-battle');
    DS.Battle.start({
      def: DS.Monsters.finalBoss, problem: T.problem, deck: T.deck, loop: T.loop,
      title: '최종보스 체험판', trial: true,
      ...statHooks(T.stats),
      onWin: () => {
        T.cleared = true;
        $('#trial-stats').innerHTML = statRows(T.stats, T.loop);
        show('screen-trial-clear');
      },
      onLose: (how) => { T.loop++; if (how === 'camp') show('screen-title'); else startTrial(true); },
      onRetreat: () => show('screen-title'),
    });
  }

  function bind() {
    DS.Forge.bind();
    DS.Battle.bind();
    $('#btn-start').addEventListener('click', async () => {
      if (!DS.Report.ensureStudent()) return;
      DS.Sound.unlock();
      if (DS.Save.has()) {
        const idx = await DS.Cinematic.choice('새로 시작', '저장된 캠페인 진행을 지우고 처음부터 시작할까요?', ['지우고 새로 시작', '취소']);
        if (idx !== 0) return;
        DS.Save.clear();
      }
      newGame();
      show('screen-story');
    });
    $('#btn-continue').addEventListener('click', () => {
      if (!DS.Report.ensureStudent()) return;
      DS.Sound.unlock();
      const g = DS.Save.read();
      if (!g) { refreshTitle(); return; }
      G = g;
      goto(G.node);
    });
    $('#btn-trial').addEventListener('click', () => { if (!DS.Report.ensureStudent()) return; DS.Sound.unlock(); startTrial(false); });
    DS.Report.bind();
    DS.Report.setCollector(collectReport);
    document.querySelectorAll('#btn-report-title, #btn-report-camp, .report-btn').forEach((b) => b.addEventListener('click', () => DS.Report.open()));
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
      if (document.querySelector('.cine.qte, .cine.choice')) return; // 자체 처리
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

  // ── 결과 보내기용 기록 ─────────────────────────────────────
  function campaignRecord(g) {
    const n = nodes[g.maxNode] || nodes[0];
    const reached = n.type === 'clear' ? '4층 클리어' : n.type === 'battle' ? DS.Monsters[n.monster].name : `${DS.Progress.floors[n.floor].title.split(' · ')[0]} 캠프`;
    const cleared = nodes.filter((x, i) => x.type === 'battle' && i < g.maxNode).length;
    const tutorial = g.tutorial === 'done' ? '완료' : g.tutorial === 'skipped' ? '건너뜀' : '-';
    return { mode: '캠페인', reached, cleared, rewinds: g.loop - 1, tutorial, ...statsRec(g.stats) };
  }
  function statsRec(s) {
    return {
      asked: s.asked || 0, correct: s.correct || 0, steps: s.steps || 0, wrongTools: s.wrongTools || 0, emergencies: s.emergencies || 0,
      forgeOK: s.forgeOK || 0, forgeFails: s.forgeFails || 0, guideViews: s.guideViews || 0, minutes: Math.round((s.playSec || 0) / 60),
    };
  }
  function collectReport() {
    if (lastMode === 'trial' && T) {
      return { mode: '최종보스 체험판', reached: T.cleared ? '체험판 클리어' : `${T.stats.steps}단계 해결`, cleared: T.cleared ? 1 : 0, rewinds: T.loop - 1, tutorial: '-', ...statsRec(T.stats) };
    }
    if (lastMode === 'campaign') return campaignRecord(G);
    const saved = DS.Save.read(); // 새로 연 화면: 저장된 캠페인 기록
    return saved ? campaignRecord(saved) : null;
  }
  // 플레이 시간: 타이틀이 아닌 화면에 있는 동안 5초마다 적립 (화면이 숨겨져 있으면 세지 않음)
  setInterval(() => {
    if (document.hidden || $('#screen-title').classList.contains('active')) return;
    const s = lastMode === 'trial' ? T && T.stats : lastMode === 'campaign' ? G.stats : null;
    if (s) s.playSec = (s.playSec || 0) + 5;
  }, 5000);

  // ── 타이틀 화면 ───────────────────────────────────────────
  $('#ver-label').textContent = `· ${DS.VERSION}`;
  $('#beta-badge').classList.toggle('hidden', !DS.BETA);
  $('#beta-note').classList.toggle('hidden', !DS.BETA);
  DS.TitleBg($('#title-bg'), () => $('#screen-title').classList.contains('active'));

  newGame();
  bind();
  DS.PWA.init();
  refreshTitle();
})();
