// 번외편 「포함의 결계」 화면 흐름 (50분 수업)
//  1페이즈 전시학습 → 2페이즈 ① 부분집합 → ② 같은 집합 → 3페이즈 형성평가 필드 (중간보스 2ⁿ의 수호자)
//  - 몬스터·필드에 자물쇠(lock): 선생님이 알려 주는 해금 코드(DS.Codes, 날마다 바뀜)를 넣어야 들어간다 → 먼저 치고 나가는 학생이 없게
//  - 캠프의 새 카드(need)를 연성해야 출발. 카드는 처음 만들 때 한 번 예제를 풀어야 완성 (forge.js)
//  - 문제풀이모드: 선생님이 학생 폰 ⚙ 에 교사 코드를 넣으면 모든 카드 + 체력 1 아래로 안 떨어짐 (자물쇠는 그대로)
//  - 세이브: 캠프 입장·출발·승리 직후 자동 저장, 진행 기록은 DS.Track 에 쌓인다 (2차: 실시간 전송)
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

  const newStats = () => ({ asked: 0, correct: 0, steps: 0, crits: 0, wrongTools: 0, emergencies: 0, forgeOK: 0, forgeFails: 0, examples: 0, examplesOK: 0, guideViews: 0, playSec: 0 });
  let G;
  const nodes = DS.Progress.nodes;
  const battles = nodes.map((n, i) => (n.type === 'battle' ? i : -1)).filter((i) => i >= 0);
  const craftable = DS.Craft.BOOK.map((r) => r.card);
  function newGame() {
    const cards = Array.from({ length: DS.Progress.startBasic }, () => K.roll('member'));
    G = {
      relics: [], equipped: [], potions: [], crystals: 0, practice: {}, dims: new Set([2]),
      node: 0, maxNode: 0, loop: 1,
      cards, deckUids: new Set(cards.map((c) => c.uid)),
      bag: {}, discovered: new Set(['member']), mastery: {}, granted: new Set(), problems: {},
      stats: newStats(), opened: new Set(), wins: [], solveMode: false, tuts: [],
    };
  }
  const track = (type, data = {}) => DS.Track.log(type, { node: G ? G.node : 0, ...data });
  const statHooks = (s) => ({
    onAnswer: (ok) => { s.asked++; if (ok) s.correct++; track('answer', { ok, monster: curMonster() }); },
    onStep: () => { s.steps++; track('step', { monster: curMonster() }); },
    onCrit: () => { s.crits++; },
    onWrongTool: () => { s.wrongTools++; track('wrongTool', { monster: curMonster() }); },
    onEmergency: () => { s.emergencies++; },
  });
  const curMonster = () => { const n = nodes[G.node]; return n && n.monster ? n.monster : ''; };

  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
    if (id === 'screen-title') refreshTitle();
    updateBadge();
  }
  function refreshTitle() {
    $('#btn-continue').classList.toggle('hidden', !DS.Save.compatible());
    $('#save-note').textContent = DS.Save.has() && !DS.Save.compatible() ? '이전 버전의 저장은 이어할 수 없어요. 새로 시작해 주세요.' : '';
  }
  function addParts(parts) {
    Object.entries(parts || {}).forEach(([k, v]) => { G.bag[k] = (G.bag[k] || 0) + v; });
  }
  const prevCamp = (i) => { for (let k = i - 1; k >= 0; k--) if (nodes[k].type === 'camp') return k; return 0; };

  // ── 진행 배지: 화면 위쪽에 크게 (선생님이 돌아다니며 한눈에) ──────────
  function updateBadge() {
    if (!G) return;
    const won = (G.wins || []).length, made = craftable.filter((id) => G.discovered.has(id)).length;
    const n = nodes[G.node] || {};
    const phase = n.floor ? DS.Progress.floors[n.floor].title.split(' · ')[0] : '';
    const dots = battles.map((i) => `<i class="${G.wins.includes(i) ? 'on' : i === G.node ? 'cur' : ''}"></i>`).join('');
    document.querySelectorAll('.progress-badge').forEach((b) => {
      b.innerHTML = `<span class="pb-phase">${esc(phase)}</span><span class="pb-dots">${dots}</span>`
        + `<span class="pb-num">몬스터 <b>${won}/${battles.length}</b> · 연성 <b>${made}/${craftable.length}</b></span>`
        + (G.solveMode ? '<span class="pb-solve">문제풀이모드</span>' : '');
    });
  }

  function goto(i) {
    G.node = i;
    G.maxNode = Math.max(G.maxNode || 0, i);
    const n = nodes[i];
    if (n.lock && !G.opened.has(n.lock)) { showLock(n, i); return; }
    if (n.type === 'camp') enterCamp(n, i);
    else if (n.type === 'battle') startBattle(n, i);
    else showClear();
  }

  // ── 자물쇠: 선생님 신호(해금 코드)를 기다린다 ─────────────────
  function showLock(n, i) {
    DS.Save.write(G);
    track('wait', { lock: n.lock });
    const isField = n.type === 'camp';
    $('#lock-title').textContent = isField ? '🔒 형성평가 필드' : '🔒 다음 몬스터';
    $('#lock-desc').textContent = isField
      ? '여기부터는 선생님 도움 없이 혼자 한 층을 클리어해요. 선생님이 시작 신호와 코드를 알려 줄 거예요.'
      : '선생님이 설명을 마치면 해금 코드를 알려 줄 거예요. 코드를 넣으면 몬스터가 나타나요.';
    $('#lock-sheet').innerHTML = n.sheet ? `📝 기다리는 동안: <b>${esc(n.sheet)}</b>` : '📝 기다리는 동안: 학습지의 빈칸을 채워 보자';
    $('#lock-input').value = '';
    $('#lock-msg').textContent = '';
    $('#lock-back').classList.toggle('hidden', i === 0 || isField);
    $('#lock-go').onclick = () => {
      const v = $('#lock-input').value;
      if (DS.Codes.check(n.lock, v)) {
        G.opened.add(n.lock);
        DS.Sound.forge();
        track('unlock', { lock: n.lock });
        DS.Save.write(G);
        DS.UI.toast('🔓 해금! 출발!', 1600);
        goto(i);
      } else {
        DS.Sound.wrong();
        $('#lock-box').classList.remove('shake'); void $('#lock-box').offsetWidth; $('#lock-box').classList.add('shake');
        $('#lock-msg').textContent = '코드가 달라요. 선생님이 알려 준 숫자를 다시 확인해요.';
      }
    };
    $('#lock-back').onclick = () => goto(prevCamp(i));
    show('screen-lock');
    setTimeout(() => $('#lock-input').focus(), 200);
  }

  function enterCamp(n, i) {
    if (!G.granted.has(i)) { addParts(n.parts); G.granted.add(i); }
    DS.Save.write(G);
    const fl = DS.Progress.floors[n.floor];
    $('#camp-sub').textContent = fl.title;
    $('#camp-next').innerHTML = `<b>범위:</b> ${esc(fl.unit)}`
      + (n.need ? `<br><b>이번 캠프의 새 카드:</b> ${n.need.map((id) => `<span class="need-chip${G.discovered.has(id) ? ' ok' : ''}">${G.discovered.has(id) ? '✓ ' : ''}${esc(DS.Cards[id].name)}</span>`).join(' ')}` : '');
    const firstTime = !G.tuts.includes(n.floor);
    DS.Forge.open({
      bag: G.bag, cards: G.cards, deckUids: G.deckUids, discovered: G.discovered, mastery: G.mastery, floor: n.floor, dim: 2,
      relics: G.relics, equipped: G.equipped, potions: G.potions, crystals: () => 0, need: n.need,
      nextTitle: '다음 전투로 출발',
      onForge: (ok, id) => {
        if (ok) G.stats.forgeOK++; else G.stats.forgeFails++;
        track('craft', { ok, card: id });
        enterCampChips(n);
        updateBadge();
      },
      onExample: (id, ok) => { G.stats.examples++; if (ok) G.stats.examplesOK++; track('example', { card: id, ok }); },
      tutorial: firstTime && !G.solveMode ? n.floor : 0,
      onTutorial: (r) => { if (!G.tuts.includes(n.floor)) G.tuts.push(n.floor); G.tutorial = r; DS.Save.write(G); },
      onDepart: () => { DS.Save.write(G); goto(i + 1); },
    });
    show('screen-camp');
  }
  function enterCampChips(n) {
    if (!n.need) return;
    $('#camp-next').querySelectorAll('.need-chip').forEach((el, k) => {
      const id = n.need[k];
      el.classList.toggle('ok', G.discovered.has(id));
      el.textContent = `${G.discovered.has(id) ? '✓ ' : ''}${DS.Cards[id].name}`;
    });
  }

  // ── 전투 안내 (처음 한 번): 문제 스캔 → 공격 → 결계 보호막 → 풀이 카드 ─────
  const BATTLE_TIPS = [
    ['⚔ 전투 안내 1/4 · 몬스터 = 문제', '위쪽 [문제] 창에 문제 조각이 보여요. 처음엔 일부만 보이니 🔍 스캔이 붙은 카드(원소 확인 등)를 내서 문제를 밝혀요.'],
    ['⚔ 전투 안내 2/4 · 카드 내기', '아래 손패의 카드를 누르면 기력 1을 쓰고 ⚔ 공격 + 🛡 방어 + 🔍 스캔이 한 번에 일어나요. 기력을 다 쓰면 [턴 종료].'],
    ['⚔ 전투 안내 3/4 · 결계 보호막', '몬스터 체력바의 노란 선(문턱)에 닿으면 공격이 막혀요. 이때는 그 단계를 푸는 풀이 카드(예: 소속 판정)를 내서 문제를 맞혀야 결계가 깨져요. 풀이 카드는 손으로 날아와요!'],
    ['⚔ 전투 안내 4/4 · 쓰러져도 괜찮아', '체력이 0 이 되면 시간이 되감겨 같은 문제에 다시 도전해요. 벌은 없어요. 막히면 손을 들어 선생님을 불러요!'],
  ];
  async function battleTips() {
    for (const [t, d] of BATTLE_TIPS) await DS.Cinematic.choice(t, d, ['다음 ▶']);
  }

  async function startBattle(n, i) {
    const def = DS.Monsters[n.monster];
    const problem = G.problems[i] || (G.problems[i] = def.makeProblem());
    DS.Save.write(G, prevCamp(i));
    show('screen-battle');
    if (!G.battleTips && !G.solveMode) { G.battleTips = true; await battleTips(); }
    track('battle', { monster: n.monster });
    DS.Battle.start({
      def, problem, deck: deckForBattle(), loop: G.loop, mastery: G.mastery,
      title: DS.Progress.floors[n.floor].title, relics: [], potions: [], practice: {}, solveMode: G.solveMode,
      ...statHooks(G.stats),
      onWin: () => afterWin(n, i),
      onLose: (how) => { G.loop++; track('lose', { monster: n.monster }); if (how === 'camp') goto(prevCamp(i)); else startBattle(n, i); },
      onRetreat: () => goto(prevCamp(i)),
    });
    updateBadge();
  }
  // 덱: 문제풀이모드면 모든 풀이 카드를 한 장씩 더 (전투에서만)
  function deckForBattle() {
    const deck = G.cards.filter((c) => G.deckUids.has(c.uid));
    if (!G.solveMode) return deck;
    const have = new Set(deck.map((c) => c.id));
    craftable.forEach((id) => { if (!have.has(id)) deck.push(K.roll(id, 'x', { temp: true })); });
    return deck;
  }

  function afterWin(n, i) {
    const def = DS.Monsters[n.monster];
    if (!G.wins.includes(i)) G.wins.push(i);
    track('win', { monster: n.monster });
    DS.Save.write(G, i + 1);
    const next = nodes[i + 1];
    $('#reward-title').textContent = `${def.name} 해결!`;
    const left = battles.filter((k) => !G.wins.includes(k)).length;
    $('#reward-desc').innerHTML = `⭐ 문제를 풀어 결계를 깼다! 남은 몬스터 ${left}마리`
      + (n.sheet && !n.solo ? `<br><span class="muted">📝 ${esc(n.sheet)} 에 오늘 푼 내용을 정리해 두자.</span>` : '');
    $('#reward-parts').innerHTML = '';
    $('#reward-next').textContent = next.type === 'clear' ? '' : next.lock && !G.opened.has(next.lock) ? '다음: 🔒 선생님 신호를 기다려요' : `다음: ${DS.Progress.floors[next.floor].title}`;
    $('#reward-go').textContent = next.type === 'clear' ? '결과 보기 ▶' : next.type === 'camp' ? '캠프로 ▶' : '다음 몬스터로 ▶';
    $('#reward-go').onclick = () => goto(i + 1);
    show('screen-reward');
  }

  function statRows(s) {
    const rate = s.asked ? Math.round((100 * s.correct) / s.asked) : 0;
    return `
      <tr><th>푼 문제</th><td>${s.asked}문제 (정답률 ${rate}%)</td></tr>
      <tr><th>깨뜨린 결계</th><td>${s.steps}단계</td></tr>
      <tr><th>연성 예제</th><td>${s.examplesOK || 0} / ${s.examples || 0}</td></tr>
      <tr><th>연성</th><td>성공 ${s.forgeOK || 0}번 · 실패 ${s.forgeFails || 0}번</td></tr>
      <tr><th>되감기</th><td>${G.loop - 1}번</td></tr>`;
  }
  function showClear() {
    track('clear');
    DS.Save.write(G);
    const s = G.stats, rate = s.asked ? s.correct / s.asked : 0;
    const title = G.solveMode ? '포함의 견습생' : rate >= 0.85 ? '포함의 대마법사' : rate >= 0.6 ? '포함의 마법사' : '포함의 수련생';
    $('#clear-title').textContent = `칭호: ${title}`;
    $('#clear-stats').innerHTML = statRows(s);
    show('screen-clear');
  }

  // ── 문제풀이모드: 교사 코드 (⚙ 설정) ───────────────────────
  DS.Settings.onTeacherCode = (v) => {
    if (!DS.Codes.check('solve', v)) return '코드가 달라요.';
    if (!G) newGame();
    G.solveMode = true;
    craftable.forEach((id) => {
      G.discovered.add(id);
      if (!G.cards.some((c) => c.id === id)) { const c = K.roll(id); G.cards.push(c); G.deckUids.add(c.uid); }
    });
    track('solveMode');
    DS.Save.write(G);
    updateBadge();
    return 'ok';
  };

  function bind() {
    DS.Forge.bind();
    DS.Battle.bind();
    $('#btn-start').addEventListener('click', async () => {
      if (!DS.Report.ensureStudent()) return;
      DS.Sound.unlock();
      if (DS.Save.has()) {
        const idx = await DS.Cinematic.choice('새로 시작', '저장된 진행을 지우고 처음부터 시작할까요?', ['지우고 새로 시작', '취소']);
        if (idx !== 0) return;
        DS.Save.clear();
      }
      newGame();
      track('start');
      show('screen-story');
    });
    $('#btn-continue').addEventListener('click', () => {
      if (!DS.Report.ensureStudent()) return;
      DS.Sound.unlock();
      const g = DS.Save.read();
      if (!g) { refreshTitle(); return; }
      G = { ...g, wins: g.wins || [], tuts: g.tuts || [] };
      goto(G.node);
    });
    DS.Report.bind();
    DS.Report.setCollector(collectReport);
    document.querySelectorAll('#btn-report-title, #btn-report-camp, .report-btn').forEach((b) => b.addEventListener('click', () => DS.Report.open()));
    $('#btn-story').addEventListener('click', () => goto(0));
    document.querySelectorAll('.btn-settings').forEach((b) => b.addEventListener('click', () => DS.Settings.open()));
    $('#btn-restart').addEventListener('click', () => { newGame(); show('screen-title'); });
    $('#lock-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#lock-go').click(); });
    document.querySelectorAll('.mute').forEach((b) => b.addEventListener('click', () => {
      const m = DS.Sound.toggle();
      document.querySelectorAll('.mute').forEach((x) => { x.textContent = m ? '소리 끔' : '소리 켬'; });
    }));
    window.addEventListener('keydown', (e) => {
      if (document.querySelector('.cine.qte, .cine.choice')) return;
      const quizOpen = !$('#quiz').classList.contains('hidden');
      if (quizOpen) {
        if (e.key === 'Enter' && !$('#quiz-next').classList.contains('hidden')) $('#quiz-next').click();
        return;
      }
      if ((e.key === 'e' || e.key === 'E') && $('#screen-battle').classList.contains('active')) $('#end-turn').click();
    });
  }

  // ── 결과 보내기용 기록 ─────────────────────────────────────
  function record(g) {
    const n = nodes[g.maxNode] || nodes[0];
    const reached = n.type === 'clear' ? '번외편 클리어' : n.type === 'battle' ? DS.Monsters[n.monster].name : `${DS.Progress.floors[n.floor].title} 캠프`;
    const s = g.stats || {};
    return {
      mode: '번외편 포함의 결계' + (g.solveMode ? ' (문제풀이모드)' : ''), reached, cleared: (g.wins || []).length, rewinds: g.loop - 1, tutorial: '-',
      asked: s.asked || 0, correct: s.correct || 0, steps: s.steps || 0, wrongTools: s.wrongTools || 0, emergencies: 0,
      forgeOK: s.forgeOK || 0, forgeFails: s.forgeFails || 0, guideViews: 0, minutes: Math.round((s.playSec || 0) / 60),
    };
  }
  function collectReport() {
    if (G && G.node) return record(G);
    const saved = DS.Save.read();
    return saved ? record({ ...saved, wins: saved.wins || [] }) : null;
  }
  setInterval(() => {
    if (document.hidden || $('#screen-title').classList.contains('active') || !G) return;
    G.stats.playSec = (G.stats.playSec || 0) + 5;
  }, 5000);

  // ── 타이틀 ───────────────────────────────────────────────
  $('#ver-label').textContent = `· ${DS.VERSION}`;
  DS.TitleBg($('#title-bg'), () => $('#screen-title').classList.contains('active'));

  newGame();
  bind();
  refreshTitle();
  // 실시간 진행 기록: 새 Code.gs 가 배포돼 있으면 몇 초마다 선생님 시트로. 1분마다 살아 있음 신호(지금 화면)
  DS.Track.start(() => ({ solve: !!(G && G.solveMode) }));
  setInterval(() => {
    if (document.hidden || !G || $('#screen-title').classList.contains('active')) return;
    const scr = (document.querySelector('.screen.active') || {}).id || '';
    track('alive', { monster: curMonster(), lock: scr === 'screen-lock' ? (nodes[G.node] || {}).lock : '', card: scr.replace('screen-', '') });
  }, 60000);
  DS.Game = { state: () => G, goto: (i) => goto(i) }; // 자동 플레이 테스트용
})();
