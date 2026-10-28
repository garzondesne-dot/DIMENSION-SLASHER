// 화면 흐름
//  캠페인 (v1.0 테스트판, 1~10층): 캠프 → 잡몹 → 갈림길(보물상자·상점·이벤트·엘리트) → 캠프 → … → 보스
//    차원(대단원)이 바뀌면 지난 차원 카드는 서고로, 새 차원의 기본 카드 6장을 받는다
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
    const cards = Array.from({ length: DS.Progress.startBasic }, () => K.roll('diff'));
    G = {
      relics: [], equipped: [], potions: ['heal'], crystals: 0, practice: {}, dims: new Set([1]),
      node: 0,
      maxNode: 0, // 최고 도달 위치 (결과 보내기)
      loop: 1,
      cards, // 보관함 (덱 포함 모든 카드)
      deckUids: new Set(cards.map((c) => c.uid)),
      bag: {},
      discovered: new Set(['diff']),
      mastery: {},
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
    onPractice: (id, ok) => { s.practice = (s.practice || 0) + 1; if (ok) s.practiceOK = (s.practiceOK || 0) + 1; },
    onPotion: () => { s.potions = (s.potions || 0) + 1; },
  });

  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
    if (id === 'screen-title') refreshTitle();
  }
  function refreshTitle() {
    $('#cheat-floor').classList.toggle('hidden', !DS.Settings.get('cheat'));
    $('#btn-continue').classList.toggle('hidden', !DS.Save.compatible());
    $('#save-note').textContent = DS.Save.has() && !DS.Save.compatible() ? '이전 버전의 저장은 이어할 수 없어요. 새로 시작해 주세요.' : '';
  }
  function addParts(parts) {
    Object.entries(parts || {}).forEach(([k, v]) => { G.bag[k] = (G.bag[k] || 0) + v; });
  }
  const nodes = DS.Progress.nodes;
  const prevCamp = (i) => { for (let k = i - 1; k >= 0; k--) if (nodes[k].type === 'camp') return k; return 0; };

  function goto(i) {
    G.node = i;
    G.maxNode = Math.max(G.maxNode || 0, i);
    lastMode = 'campaign';
    const n = nodes[i];
    if (n.type === 'camp') {
      const dim = DS.floorDim(n.floor);
      if (!G.dims.has(dim)) {
        const supply = enterDim(dim);
        DS.Rooms.dimIntro(dim, supply, () => enterCamp(n, i));
        return;
      }
      enterCamp(n, i);
    } else if (n.type === 'battle') startBattle(n, i);
    else if (n.type === 'fork') enterFork(n, i);
    else showClear();
  }

  // 차원 이동: 지난 차원 카드는 서고로(덱에서 빠짐), 새 차원의 기본 카드 6장, 차원을 잇는 카드 보급(서고)
  function enterDim(dim) {
    G.dims.add(dim);
    G.cards.forEach((c) => { if (DS.Cards[c.id].dim !== dim) { c.arch = true; G.deckUids.delete(c.uid); } });
    const basic = DS.Dims[dim].basic;
    for (let k = 0; k < DS.Progress.startBasic; k++) { const c = K.roll(basic); G.cards.push(c); G.deckUids.add(c.uid); }
    G.discovered.add(basic);
    const sup = DS.Progress.dimSupply[dim] || {};
    Object.entries(sup).forEach(([id, n]) => { for (let k = 0; k < n; k++) { const c = K.roll(id); c.arch = true; G.cards.push(c); } });
    return Object.entries(sup).map(([id, n]) => `${DS.Cards[id].name} ×${n}`).join(', ');
  }

  // 갈림길: 곁방 하나를 고른 뒤 다음 노드(캠프)로
  function enterFork(n, i) {
    DS.Save.write(G);
    const next = () => goto(i + 1);
    const dim = DS.floorDim(n.floor);
    DS.Rooms.fork(G, n, (o) => {
      if (o === 'skip') next();
      else if (o === 'chest') DS.Rooms.chest(G, dim, next);
      else if (o === 'shop') DS.Rooms.shop(G, dim, next);
      else if (o === 'event') DS.Rooms.event(G, dim, next);
      else if (o.startsWith('elite:')) startElite(n, i, o.slice(6));
    });
  }
  function startElite(n, i, monster) {
    const def = DS.Monsters[monster];
    const key = `e${i}`;
    const problem = G.problems[key] || (G.problems[key] = def.makeProblem());
    show('screen-battle');
    DS.Battle.start({
      def, problem, deck: G.cards.filter((c) => G.deckUids.has(c.uid) && !c.arch), loop: G.loop, mastery: G.mastery,
      title: `${DS.Progress.floors[n.floor].title} · 엘리트`, relics: G.equipped, potions: G.potions, practice: G.practice,
      grantAll: DS.Progress.floors[n.floor].grantAll,
      ...statHooks(G.stats),
      onWin: () => {
        const id = DS.Rooms.grantRelic(G);
        G.crystals += DS.Balance.crystals.elite;
        G.stats.elites = (G.stats.elites || 0) + 1;
        DS.Save.write(G, i + 1);
        $('#reward-title').textContent = `[엘리트] ${def.name} 격파!`;
        $('#reward-desc').innerHTML = `고난도 스테이지를 해냈다. 유물: ${id ? `${DS.Relics[id].icon} <b>${esc(DS.Relics[id].name)}</b> — ${esc(DS.Relics[id].desc)}` : '모두 모음 (◆ 30)'} · ◆ +${DS.Balance.crystals.elite}`;
        $('#reward-parts').innerHTML = '';
        $('#reward-next').textContent = '';
        $('#reward-go').textContent = '캠프로 ▶';
        $('#reward-go').onclick = () => goto(i + 1);
        show('screen-reward');
      },
      onLose: (how) => { G.loop++; if (how === 'camp') goto(i + 1); else startElite(n, i, monster); },
      onRetreat: () => goto(i + 1), // 엘리트는 선택 스테이지: 후퇴하면 포기하고 캠프로
    });
  }

  // 캠프에는 다음 상대·문제를 보여 주지 않는다 (조우해야 알 수 있음). 층의 단원 범위만 표시.
  function enterCamp(n, i) {
    if (!G.granted.has(i)) { addParts(n.parts); G.granted.add(i); }
    DS.Save.write(G);
    const fl = DS.Progress.floors[n.floor];
    $('#camp-sub').textContent = fl.title;
    $('#camp-next').innerHTML = `<span class="dim-chip" style="border-color:${DS.Dims[fl.dim].color}">${esc(DS.Dims[fl.dim].name)}</span> <b>범위:</b> ${esc(fl.unit)} <span class="muted">· ◆ ${G.crystals}</span>`;
    DS.Forge.open({
      bag: G.bag, cards: G.cards, deckUids: G.deckUids, discovered: G.discovered, mastery: G.mastery, floor: n.floor, dim: fl.dim,
      relics: G.relics, equipped: G.equipped, potions: G.potions, crystals: () => G.crystals,
      nextTitle: '다음 전투로 출발',
      onForge: (ok) => { if (ok) G.stats.forgeOK = (G.stats.forgeOK || 0) + 1; else G.stats.forgeFails = (G.stats.forgeFails || 0) + 1; },
      onGuide: () => { G.stats.guideViews = (G.stats.guideViews || 0) + 1; },
      tutorial: i === 0 && !G.tutorial, // 캠페인 첫 캠프에서 한 번
      onTutorial: (r) => { G.tutorial = r; DS.Save.write(G); },
      onDepart: () => goto(i + 1),
    });
    show('screen-camp');
  }

  function startBattle(n, i) {
    const def = DS.Monsters[n.monster];
    const problem = G.problems[i] || (G.problems[i] = def.makeProblem());
    DS.Save.write(G, prevCamp(i)); // 덱 구성·문제 숫자 저장. 전투 중에 닫으면 직전 캠프에서 이어 함
    show('screen-battle');
    DS.Battle.start({
      def, problem, deck: G.cards.filter((c) => G.deckUids.has(c.uid) && !c.arch), loop: G.loop, mastery: G.mastery,
      title: DS.Progress.floors[n.floor].title, relics: G.equipped, potions: G.potions, practice: G.practice,
      grantAll: DS.Progress.floors[n.floor].grantAll,
      ...statHooks(G.stats),
      onWin: () => afterWin(n, i),
      onLose: (how) => { G.loop++; if (how === 'camp') goto(prevCamp(i)); else startBattle(n, i); },
      onRetreat: () => goto(prevCamp(i)),
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
    if (n.unlock) G.discovered.add(n.unlock); // 중간보스 보상: 각성 레시피 해금
    const boss = !!(n.medal || n.unlock || nodes[i + 1].floor !== n.floor || nodes[i + 1].type === 'clear');
    const gain = boss ? DS.Balance.crystals.boss : DS.Balance.crystals.mob;
    G.crystals += gain;
    if (n.medal && !G.relics.includes(n.medal)) { G.relics.push(n.medal); G.equipped.push(n.medal); } // 차원 최종보스: 훈장
    DS.Save.write(G, i + 1);
    const next = nodes[i + 1];
    $('#reward-title').textContent = `${def.name} 해결!`;
    const lines = [];
    if (n.unlock) lines.push(`각성 레시피 해금: ${esc(DS.Cards[n.unlock].name)} [d ± r]. 최종보스와의 결전에서 다시 깨어난다.`);
    if (n.medal) lines.push(`${DS.Relics[n.medal].icon} <b>${esc(DS.Relics[n.medal].name)}</b> 획득! ${esc(DS.Relics[n.medal].desc)}`);
    if (n.reward) lines.push('문제를 푼 자리에서 새로운 기억의 부품을 얻었다.');
    lines.push(`◆ 기억 결정 +${gain}`);
    $('#reward-desc').innerHTML = lines.join('<br>');
    $('#reward-parts').innerHTML = n.reward ? partChips(n.reward) : '';
    $('#reward-next').textContent = next.type === 'clear' ? '' : next.type === 'fork' ? '다음: 갈림길' : `다음: ${DS.Progress.floors[next.floor].title}`;
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
      + (s.practice ? `<tr><th>연습 문제</th><td>${s.practiceOK || 0} / ${s.practice}</td></tr>` : '')
      + (s.forgeOK != null ? `<tr><th>연성</th><td>성공 ${s.forgeOK || 0}번 · 실패 ${s.forgeFails || 0}번</td></tr>` : '')
      + (DS.GUIDE ? `<tr><th>조합법 열람</th><td>${s.guideViews || 0}번</td></tr>` : '');
  }

  function showClear() {
    $('#clear-stats').innerHTML = statRows(G.stats, G.loop) + `<tr><th>보유 카드</th><td>${G.cards.length}장 (덱 ${G.deckUids.size}장)</td></tr>`
      + `<tr><th>유물</th><td>${G.relics.map((r) => DS.Relics[r].icon).join(' ') || '-'}</td></tr><tr><th>보물상자 · 엘리트</th><td>${G.stats.chests || 0}개 · ${G.stats.elites || 0}번</td></tr>`;
    $('#clear-medals').innerHTML = ['medal1', 'medal2', 'medal3'].map((m) => (G.relics.includes(m) ? `<span title="${esc(DS.Relics[m].name)}">${DS.Relics[m].icon}</span>` : '')).join(' ');
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
    document.querySelectorAll('.btn-settings').forEach((b) => b.addEventListener('click', () => DS.Settings.open()));
    DS.Settings.onChange(() => { refreshTitle(); const w = $('#btn-cheat-win'); if (w) w.classList.toggle('hidden', !DS.Settings.get('cheat')); if ($('#screen-camp').classList.contains('active')) $('#camp-cheat').classList.toggle('hidden', !DS.Settings.get('cheat')); });
    $('#cheat-floor-sel').innerHTML = Object.entries(DS.Progress.floors).map(([f, fl]) => `<option value="${f}">${esc(fl.title)} (${DS.Dims[fl.dim].short})</option>`).join('');
    $('#cheat-floor-go').addEventListener('click', () => {
      if (!DS.Report.ensureStudent()) return;
      DS.Sound.unlock();
      jumpTo(Number($('#cheat-floor-sel').value));
    });
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

  // 치트: 층 이동. 그 층 첫 캠프까지의 부품·보상·훈장을 받고, 앞 층의 도구 카드를 한 장씩 보관함에 넣는다
  function jumpTo(floor) {
    DS.Save.clear();
    newGame();
    G.tutorial = 'skipped';
    const target = nodes.findIndex((n) => n.type === 'camp' && n.floor === floor);
    const dim = DS.floorDim(floor);
    for (let k = 0; k < target; k++) {
      const n = nodes[k];
      if (n.type === 'camp' && n.parts && DS.floorDim(n.floor) === dim) { addParts(n.parts); G.granted.add(k); }
      if (n.type === 'camp') G.granted.add(k);
      if (n.type === 'battle' && n.reward && DS.floorDim(n.floor) === dim) addParts(n.reward);
      if (n.type === 'battle' && n.medal) { G.relics.push(n.medal); G.equipped.push(n.medal); }
      if (n.type === 'battle' && n.unlock) G.discovered.add(n.unlock);
    }
    for (let d = 2; d <= dim; d++) enterDim(d);
    DS.Craft.BOOK.forEach((r) => {
      if (r.dim < dim || (r.dim === dim && r.floor < floor)) {
        const c = K.roll(r.card);
        if (r.dim < dim) c.arch = true;
        G.cards.push(c);
        G.discovered.add(r.card);
      }
    });
    G.crystals = 40;
    G.maxNode = target;
    DS.UI.toast(`치트: ${DS.Progress.floors[floor].title}(으)로 이동. 앞 층의 도구 카드를 한 장씩 받았다.`, 3000);
    goto(target);
  }

  // ── 결과 보내기용 기록 ─────────────────────────────────────
  function campaignRecord(g) {
    const n = nodes[g.maxNode] || nodes[0];
    const reached = n.type === 'clear' ? '10층 클리어' : n.type === 'battle' ? DS.Monsters[n.monster].name : `${DS.Progress.floors[n.floor].title.split(' · ')[0]} ${n.type === 'fork' ? '갈림길' : '캠프'}`;
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
  $('#beta-badge').classList.toggle('hidden', !DS.BETA || DS.TEST);
  $('#beta-note').classList.toggle('hidden', !DS.BETA);
  DS.TitleBg($('#title-bg'), () => $('#screen-title').classList.contains('active'));

  newGame();
  bind();
  refreshTitle();
})();
