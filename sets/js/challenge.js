// 도전 처리기: 전투는 "이 풀이 단계를 맞혔나?"만 묻고, 어떤 방식으로 묻는지는 문제 형식(DS.Quiz)이 정한다.
window.DS = window.DS || {};

DS.Challenge = {
  resolve(card, prob, opt) {
    return DS.Quiz.ask(card, prob, opt);
  },
};
