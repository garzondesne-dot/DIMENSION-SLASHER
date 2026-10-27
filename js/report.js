// 결과 보내기 (베타 테스트): 학년·반·번호 + 플레이 기록 + 설문(재미, 수학 느낌, 한줄평)을 선생님 구글 시트로 전송
//  - 전송: DS.REPORT_URL (Apps Script 웹 앱)에 POST. 서버가 없으면·실패하면 결과 코드만 보여 준다
//  - 결과 코드는 항상 보여 준다 (방화벽 등으로 전송이 안 될 때 사진·복사로 제출)
//  - 이름은 받지 않는다
window.DS = window.DS || {};

DS.Report = (function () {
  const $ = (s) => document.querySelector(s);
  const KEY = 'dimension-slasher-student';
  let answers = { fun: 0, math: 0 };
  let collect = null; // () => 플레이 기록 객체 (main.js가 정함)

  function student() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function saveStudent(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* 저장 못 해도 진행 */ }
  }
  // 타이틀 입력칸 ↔ 저장값
  function readForm() {
    return { grade: $('#sf-grade').value, cls: $('#sf-class').value.trim(), num: $('#sf-num').value.trim() };
  }
  function fillForm() {
    const s = student();
    $('#sf-grade').value = s.grade || '';
    $('#sf-class').value = s.cls || '';
    $('#sf-num').value = s.num || '';
  }
  // 게임 시작 전에 확인: 다 채웠으면 저장하고 true
  function ensureStudent() {
    const s = readForm();
    const ok = s.grade && Number(s.cls) >= 1 && Number(s.num) >= 1;
    document.querySelector('.student-form').classList.toggle('need', !ok);
    if (!ok) { DS.UI.toast('학년 · 반 · 번호를 먼저 입력해 주세요.'); return false; }
    saveStudent(s);
    return true;
  }
  const who = (s) => `${s.grade || '?'}학년 ${s.cls || '?'}반 ${s.num || '?'}번`;

  function rateRow(el) {
    const k = el.dataset.k;
    el.innerHTML = [1, 2, 3, 4, 5].map((v) => `<button class="btn rate-btn" data-v="${v}">${v}</button>`).join('')
      + '<span class="rate-ends muted small">1 아니요 · 5 매우 그래요</span>';
    el.querySelectorAll('.rate-btn').forEach((b) => b.addEventListener('click', () => {
      answers[k] = Number(b.dataset.v);
      el.querySelectorAll('.rate-btn').forEach((x) => x.classList.toggle('on', x === b));
    }));
  }

  function open() {
    const rec = collect && collect();
    if (!rec) { DS.UI.toast('아직 플레이 기록이 없어요. 한 판 해 보고 보내 주세요.'); return; }
    answers = { fun: 0, math: 0 };
    document.querySelectorAll('#report .rate').forEach(rateRow);
    $('#report-comment').value = '';
    $('#report-who').textContent = `${who(student())} · ${rec.mode} · ${rec.reached}`;
    $('#report-form').classList.remove('hidden');
    $('#report-done').classList.add('hidden');
    $('#report-send').disabled = false;
    $('#report').classList.remove('hidden');
  }

  // 시트 한 줄 (열 이름 = 키). 키 순서가 시트의 열 순서가 된다
  function payload(rec) {
    const s = student();
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date();
    return {
      전송시각: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
      학년: s.grade || '', 반: s.cls || '', 번호: s.num || '',
      버전: DS.VERSION, 모드: rec.mode, 최고도달: rec.reached, 해결몬스터: rec.cleared,
      되감기: rec.rewinds, 푼문제: rec.asked, 정답: rec.correct,
      정답률: rec.asked ? Math.round((100 * rec.correct) / rec.asked) : 0,
      해결단계: rec.steps, 맞지않는도구: rec.wrongTools, 긴급연성: rec.emergencies,
      튜토리얼: rec.tutorial, 연성성공: rec.forgeOK, 연성실패: rec.forgeFails,
      플레이분: rec.minutes, 재미: answers.fun || '', 수학느낌: answers.math || '',
      한줄평: $('#report-comment').value.trim().slice(0, 300),
    };
  }
  // 사진·복사용 짧은 결과 코드
  const code = (p) => [`${p.학년}-${p.반}-${p.번호}`, p.모드, `도달 ${p.최고도달}`, `몬스터 ${p.해결몬스터}`,
    `정답 ${p.정답}/${p.푼문제}`, `단계 ${p.해결단계}`, `튜토리얼 ${p.튜토리얼}`, `연성 ${p.연성성공}/${p.연성실패}실패`,
    `되감기 ${p.되감기}`, `${p.플레이분}분`, `재미 ${p.재미 || '-'}`, `수학 ${p.수학느낌 || '-'}`, p.전송시각, p.버전].join(' | ')
    + (p.한줄평 ? `\n💬 ${p.한줄평}` : '');

  async function send() {
    const rec = collect && collect();
    if (!rec) return;
    if (!answers.fun || !answers.math) { DS.UI.toast('두 질문에 점수를 골라 주세요.'); return; }
    $('#report-send').disabled = true;
    const p = payload(rec);
    let status;
    if (!DS.REPORT_URL) status = '전송 주소가 설정되지 않은 버전이에요. 아래 결과 코드를 선생님께 보여 주세요.';
    else {
      try {
        // Apps Script는 다른 출처의 응답을 읽을 수 없게 하므로(no-cors) 네트워크 오류만 실패로 판단
        await fetch(DS.REPORT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(p) });
        status = '✅ 선생님께 전송했어요! 고마워요.';
      } catch (e) {
        status = '⚠ 전송하지 못했어요 (인터넷·학교 방화벽 확인). 아래 결과 코드를 선생님께 보여 주세요.';
      }
    }
    if (DS.Report.onSent) DS.Report.onSent(p);
    $('#report-status').textContent = status;
    $('#report-code').textContent = code(p);
    $('#report-form').classList.add('hidden');
    $('#report-done').classList.remove('hidden');
  }

  function bind() {
    fillForm();
    ['#sf-grade', '#sf-class', '#sf-num'].forEach((s) => $(s).addEventListener('change', () => saveStudent(readForm())));
    $('#report-send').addEventListener('click', send);
    $('#report-close').addEventListener('click', () => $('#report').classList.add('hidden'));
    $('#report-copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText($('#report-code').textContent); DS.UI.toast('복사했어요'); } catch (e) { DS.UI.toast('길게 눌러 직접 복사해 주세요'); }
    });
  }
  const setCollector = (fn) => { collect = fn; };

  return { bind, open, ensureStudent, student, setCollector, payload, code, KEY };
})();
