// 서비스 워커: 앱 설치(PWA)와 오프라인 실행
//  - 게임 파일(같은 주소): 네트워크 먼저 → 실패하면 저장해 둔 것 (인터넷이 되면 항상 최신 버전)
//  - 글꼴(CDN): 저장해 둔 것 먼저 → 없으면 받아서 저장
//  - 결과 보내기(POST)는 건드리지 않는다
// 새 버전을 낼 때 CACHE 이름을 DS.VERSION 과 맞춘다 (tests/game.test.js 가 확인)
const CACHE = 'ds-v0.3.1';
const CORE = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
  './js/mathgen.js', './js/data.js', './js/craft.js', './js/cards.js', './js/monsters.js', './js/audio.js', './js/quiz.js',
  './js/cardview.js', './js/challenge.js', './js/cinematic.js', './js/scene.js', './js/save.js', './js/report.js',
  './js/forge.js', './js/battle.js', './js/titlebg.js', './js/pwa.js', './js/main.js',
];
const FONT_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ds-') && k !== CACHE && k !== 'ds-fonts').map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html'))));
  } else if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open('ds-fonts').then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
      c.put(req, res.clone());
      return res;
    }))));
  }
});
