// 카드 인스턴스 (순수 로직): 디아블로식 랜덤 수치·옵션, 덱 규칙 검사
// 인스턴스: { uid, id, axis, atk, def, scan, affixes: [[key, value]], locked, temp }
window.DS = window.DS || {};

DS.CardKit = (function () {
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  let seq = 0;
  const uid = () => `c${Date.now().toString(36)}${(seq++).toString(36)}`;

  // 공격 + 방어 합계 범위 (투자 점수 + 2 ~ + 4)
  const statRange = (id) => [DS.Cards[id].score + 2, DS.Cards[id].score + 4];

  function rollAffixes(tier) {
    const n = DS.Tiers[tier].affixes;
    const keys = Object.keys(DS.Affixes);
    const out = [];
    while (out.length < n) {
      const k = keys[ri(0, keys.length - 1)];
      if (out.some(([x]) => x === k)) continue;
      const r = DS.Affixes[k].range;
      out.push([k, tier === 'rare' ? ri(r[2], r[3]) : ri(r[0], r[1])]);
    }
    return out;
  }

  // 연성할 때마다 새로 굴린다. 재료의 수치는 결과에 영향 없음.
  function roll(id, axis = 'x', opts = {}) {
    const c = DS.Cards[id];
    if (c.fixed) {
      return { uid: uid(), id, axis, atk: c.fixed.atk, def: c.fixed.def, scan: false, affixes: c.fixed.affixes.map((a) => a.slice()), locked: false, temp: !!opts.temp };
    }
    const [lo, hi] = statRange(id);
    const total = ri(lo, hi);
    const atk = ri(0, total);
    const scan = c.scan === 'always' || (c.scan === 'chance' && Math.random() < DS.SCAN_CHANCE);
    return { uid: uid(), id, axis, atk, def: total - atk, scan, affixes: rollAffixes(c.tier), locked: false, temp: !!opts.temp };
  }

  const affix = (card, key) => { const a = card.affixes.find(([k]) => k === key); return a ? a[1] : 0; };
  const critOf = (card) => {
    const t = DS.Tiers[DS.Cards[card.id].tier];
    return {
      rate: Math.min(1, t.crit + affix(card, 'critRate') / 100),
      mult: t.critMult + affix(card, 'critDmg') / 100,
    };
  };
  const formula = (card) => {
    const d = DS.Cards[card.id];
    if (card.axis !== 'y') return d.formula;
    return d.formulaY || d.formula.replace(/x₂ − x₁/g, 'y₂ − y₁');
  };
  // ⇄ 로 뒤집은 면의 이름 (차이 카드: 가로·세로, 직선의 방정식: 표준형·일반형)
  const axisLabel = (card) => {
    const d = DS.Cards[card.id];
    return d.axisName ? d.axisName[card.axis === 'y' ? 1 : 0] : (card.axis === 'y' ? '세로' : '가로');
  };
  const isScan = (card) => !!card.scan;
  const isMagic = (card) => DS.Cards[card.id].tier === 'magic';
  // 레어: 이름별로 한 장, 재료로 써도 사라지지 않음 (재연성하면 둘 중 하나를 고름)
  const isRare = (card) => DS.Cards[card.id].tier === 'rare';

  // 덱 규칙: 6~12장, 스캔 카드 4장 이상(그중 차이 카드 1장 이상), 매직 4장 이하
  function checkDeck(cards) {
    const R = DS.DeckRules;
    const n = cards.length;
    const scan = cards.filter(isScan).length;
    const diff = cards.filter((c) => c.id === 'diff').length;
    const magic = cards.filter(isMagic).length;
    const rows = [
      { ok: n >= R.min && n <= R.max, label: `덱 ${n}장 (${R.min}~${R.max})` },
      { ok: scan >= R.minScan, label: `스캔 카드 ${scan}/${R.minScan} 이상` },
      { ok: diff >= R.minDiff, label: `차이 카드 ${diff}/${R.minDiff} 이상` },
      { ok: magic <= R.maxMagic, label: `매직 ${magic}/${R.maxMagic} 이하` },
    ];
    return { ok: rows.every((r) => r.ok), rows };
  }

  return { roll, statRange, affix, critOf, formula, axisLabel, checkDeck, isScan, isMagic, isRare, uid };
})();
