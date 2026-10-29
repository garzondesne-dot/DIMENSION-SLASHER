// 카드 한 장의 표시 (전투 손패 · 캠프 보관함 · 덱 구성이 함께 쓴다)
window.DS = window.DS || {};

DS.UI.cardInner = function (c, opt = {}) {
  const { pretty, esc } = DS.UI;
  const d = DS.Cards[c.id], K = DS.CardKit;
  const crit = K.critOf(c);
  const parts = [];
  if (opt.battle) parts.push('<span class="cost">1</span>');
  parts.push(`<span class="tier-badge">${DS.Tiers[d.tier].name}</span>`);
  parts.push(`<span class="cname">${esc(d.name)}${d.axisName && c.axis === 'y' ? ` <small>(${esc(K.axisLabel(c))})</small>` : ''}</span>`);
  parts.push(`<span class="formula math">${pretty(K.formula(c))}</span>`);
  parts.push(`<span class="stats"><b class="atk">⚔${c.atk}</b><b class="def">🛡${c.def}</b></span>`);
  const tags = [];
  if (c.scan) tags.push('<span class="scan-tag">🔍스캔</span>');
  c.affixes.forEach(([k, v]) => tags.push(`<span class="affix">${esc(DS.Affixes[k].text(v))}</span>`));
  if (crit.rate > 0) tags.push(`<span class="crit">치명 ${Math.round(crit.rate * 100)}%·×${crit.mult.toFixed(2).replace(/0$/, '')}</span>`);
  if (d.tool) tags.push('<span class="tag">풀이 도구</span>');
  if (c.temp) tags.push('<span class="temp">임시</span>');
  if (c.locked) tags.push('<span class="lock">🔒잠금</span>');
  parts.push(`<span class="tags">${tags.join('')}</span>`);
  return parts.join('');
};
