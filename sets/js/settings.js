// 설정 (⚙): 기기에 저장되는 켜고 끄기 항목. 목록과 기본값은 data.js 의 DS.SettingDefs
//  - 치트 모드: 무적·결계 무시·즉시 승리·층 이동·정답 표시 (테스트·시연용)
window.DS = window.DS || {};

DS.Settings = (function () {
  const KEY = 'dimension-slasher-sets-settings';
  let cur = {};
  try { cur = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { cur = {}; }
  const listeners = [];
  const get = (k) => (cur[k] != null ? cur[k] : DS.SettingDefs[k] ? DS.SettingDefs[k].def : false); // 번외편에 없는 항목(치트·조준 등)은 꺼짐
  function set(k, v) {
    cur[k] = !!v;
    try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) { /* 저장이 막혀도 이번 실행에는 적용 */ }
    listeners.forEach((f) => f(k, !!v));
  }
  const onChange = (f) => listeners.push(f);

  // 설정 창
  function open() {
    const el = document.createElement('div');
    el.className = 'cine choice settings-panel';
    const rows = Object.entries(DS.SettingDefs).map(([k, d]) => `<label class="set-row${k === 'cheat' ? ' cheat' : ''}">
      <input type="checkbox" data-k="${k}"${get(k) ? ' checked' : ''}><span><b>${d.name}</b><small>${d.desc}</small></span></label>`).join('');
    const can = supported();
    el.innerHTML = `<div class="choice-box"><p class="ch-title">⚙ 설정</p>${rows}
      <p class="vib-state">진동: ${can ? '이 기기에서 지원해요' : '이 기기(브라우저)는 웹 진동을 지원하지 않아요 (iPhone Safari 등)'}</p>
      <div class="teacher-row"><b>👩‍🏫 교사 코드</b><small>선생님만: 문제풀이모드 (모든 카드 · 체력 1 아래로 안 떨어짐)</small>
        <span><input class="t-code" type="password" inputmode="numeric" maxlength="6" placeholder="····"><button class="btn small t-go">적용</button></span><small class="t-msg"></small></div>
      <div class="ch-opts"><button class="btn vib-test"${can ? '' : ' disabled'}>📳 진동 테스트</button><button class="btn primary close">닫기</button></div></div>`;
    el.querySelectorAll('input').forEach((i) => i.addEventListener('change', () => set(i.dataset.k, i.checked)));
    const t = el.querySelector('.vib-test');
    if (t) t.addEventListener('click', () => { try { navigator.vibrate([60, 40, 60, 40, 120]); } catch (e) { /* 무시 */ } });
    el.querySelector('.close').addEventListener('click', () => el.remove());
    el.querySelector('.t-go').addEventListener('click', () => {
      const r = DS.Settings.onTeacherCode ? DS.Settings.onTeacherCode(el.querySelector('.t-code').value) : '사용할 수 없어요.';
      el.querySelector('.t-msg').textContent = r === 'ok' ? '✅ 문제풀이모드가 켜졌어요. 다음 전투부터 적용돼요.' : `❌ ${r}`;
    });
    el.addEventListener('click', (e) => { if (e.target === el) el.remove(); });
    document.body.appendChild(el);
  }

  // 진동: 폰에서만 (지원하지 않는 기기는 조용히 무시). 안드로이드 크롬은 화면을 한 번 누른 뒤부터 울린다
  const supported = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  function vibrate(pattern) {
    if (!get('vibrate') || !supported()) return;
    try { navigator.vibrate(pattern); } catch (e) { /* 무시 */ }
  }

  return { get, set, onChange, open, vibrate, supported };
})();
