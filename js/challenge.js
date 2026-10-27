// 도전 처리기: 전투는 "이 풀이 단계를 맞혔나?"만 묻고, 어떤 방식으로 묻는지는 여기서 정한다.
// V0.2는 4지선다만 연결한다. V0.3 조준 시스템은 이 자리에 끼우고, 빼면 다시 4지선다로 돌아온다.
window.DS = window.DS || {};

DS.Challenge = {
  resolve(card, prob) {
    return DS.Quiz.ask(card, prob);
  },
};
