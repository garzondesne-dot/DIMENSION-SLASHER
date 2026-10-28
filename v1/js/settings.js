// 설정 (⚙): 기기에 저장되는 켜고 끄기 항목. 목록과 기본값은 data.js 의 DS.SettingDefs
//  - 치트 모드: 무적·결계 무시·즉시 승리·층 이동·정답 표시 (테스트·시연용)
window.DS = window.DS || {};

DS.Settings = (function () {
  const KEY = 'dimension-slasher-v1test-settings';
  let cur = {};
  try { cur = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { cur = {}; }
  const listeners = [];
  const get = (k) => (cur[k] != null ? cur[k] : DS.SettingDefs[k].def);
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
    el.innerHTML = `<div class="choice-box"><p class="ch-title">⚙ 설정</p>${rows}<div class="ch-opts"><button class="btn primary">닫기</button></div></div>`;
    el.querySelectorAll('input').forEach((i) => i.addEventListener('change', () => set(i.dataset.k, i.checked)));
    el.querySelector('button').addEventListener('click', () => el.remove());
    el.addEventListener('click', (e) => { if (e.target === el) el.remove(); });
    document.body.appendChild(el);
  }

  // 진동: 폰에서만 (지원하지 않는 기기는 조용히 무시)
  function vibrate(pattern) {
    if (!get('vibrate') || !navigator.vibrate) return;
    try { navigator.vibrate(pattern); } catch (e) { /* 무시 */ }
  }

  return { get, set, onChange, open, vibrate };
})();
