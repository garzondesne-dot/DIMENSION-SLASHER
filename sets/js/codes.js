// 해금 코드 (서버 없이): 날짜 + 자물쇠 이름으로 숫자를 만든다 → 날마다 바뀜.
// 학생 게임(main.js)과 교사용 화면(teacher.html)이 같은 계산을 쓴다.
//  - m1~m6: 1·2페이즈 몬스터 (3자리), p3: 3페이즈 형성평가 필드 (3자리), solve: 문제풀이모드 (4자리)
window.DS = window.DS || {};

DS.Codes = (function () {
  const SALT = 'incl-barrier';
  const pad = (n) => String(n).padStart(2, '0');
  const day = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  // 32비트 FNV-1a 해시
  function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  const code = (key, d = day()) => (key === 'solve'
    ? String(1000 + (hash(`${d}|${key}|${SALT}`) % 9000))
    : String(100 + (hash(`${d}|${key}|${SALT}`) % 900)));
  // 오늘 또는 어제 코드면 통과 (자정 넘어 이어지는 수업 대비)
  function check(key, input) {
    const v = String(input || '').trim();
    const y = new Date(Date.now() - 864e5);
    return v === code(key) || v === code(key, day(y));
  }
  const LOCKS = [
    { key: 'm1', label: '1페이즈 · 소속 슬라임' },
    { key: 'm2', label: '1페이즈 · 공집합 유령' },
    { key: 'm3', label: '2페이즈 ① · 유닛 골렘' },
    { key: 'm4', label: '2페이즈 ① · 포함의 기사' },
    { key: 'm5', label: '2페이즈 ② · 거울 쌍둥이' },
    { key: 'm6', label: '2페이즈 ② · 부분집합 수집가' },
    { key: 'p3', label: '3페이즈 · 형성평가 필드 (한 번에 전부)' },
    { key: 'solve', label: '문제풀이모드 (학생 폰 ⚙ 에 입력)' },
  ];
  return { day, hash, code, check, LOCKS };
})();
