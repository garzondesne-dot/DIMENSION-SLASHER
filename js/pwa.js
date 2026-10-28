// 앱 설치(PWA): 서비스 워커 등록 + 타이틀의 [앱으로 설치] 버튼
//  - https(또는 localhost)로 열렸을 때만 등록 (파일로 열거나 Apps Script 안에서 열리면 아무것도 하지 않음)
//  - 크롬이 설치를 허락하면(beforeinstallprompt) 버튼이 나타난다. 이미 앱으로 실행 중이면 숨김
window.DS = window.DS || {};

DS.PWA = (function () {
  const $ = (s) => document.querySelector(s);
  let deferred = null;
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  function init() {
    const btn = $('#btn-install');
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !/googleusercontent|script\.google/.test(location.hostname)) {
      navigator.serviceWorker.register('./sw.js').catch(() => { /* 등록 실패해도 게임은 그대로 */ });
    }
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferred = e;
      if (!standalone()) btn.classList.remove('hidden');
    });
    btn.addEventListener('click', async () => {
      if (!deferred) return;
      deferred.prompt();
      await deferred.userChoice.catch(() => null);
      deferred = null;
      btn.classList.add('hidden');
    });
    window.addEventListener('appinstalled', () => {
      btn.classList.add('hidden');
      DS.UI.toast('앱으로 설치했어요! 홈 화면이나 앱 목록에서 열 수 있어요.');
    });
  }
  return { init, standalone };
})();
