(() => {
  'use strict';
  const { managers, seasons, bets } = window.FFB_DATA;
  const COLORS = { Con: '#e5383b', Davs: '#4cc9f0', Cuffe: '#f8961e', Steve: '#c77dff', Joyce: '#80ed99' };
  const NUMBER = Object.fromEntries(managers.map((m, i) => [m, i + 1]));
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => n == null ? '–' : Math.round(n).toLocaleString('en-GB');
  const fmtRank = (n) => n == null ? '–' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'k' : fmt(n);
  const kit = (m) => `<span class="kit" style="background:${COLORS[m]}">${NUMBER[m]}</span>`;

  /* ---------- derived data ---------- */
  // Table for one season, positions by points, ties broken by better overall rank.
  function table(season) {
    const rows = managers
      .filter((m) => season.points[m] != null)
      .map((m) => ({ m, pts: season.points[m], rank: season.rank[m] }))
      .sort((a, b) => b.pts - a.pts || (a.rank ?? Infinity) - (b.rank ?? Infinity));
    rows.forEach((r, i) => (r.pos = i + 1));
    return rows;
  }
  const tables = seasons.map((s) => ({ season: s.season, rows: table(s) }));
  // Titles and wooden spoons only count from the first official season; earlier years are shown for the record.
  const FIRST_OFFICIAL = '2017/2018';
  const isOfficial = (season) => season >= FIRST_OFFICIAL;
  const champs = tables.map((t) => (isOfficial(t.season) ? t.rows[0]?.m : null));
  const spoons = tables.map((t) => (isOfficial(t.season) && t.rows.length > 1 ? t.rows[t.rows.length - 1].m : null));

  const stats = managers.map((m) => {
    const rec = tables.map((t) => t.rows.find((r) => r.m === m)).filter(Boolean);
    const pts = rec.map((r) => r.pts), ranks = rec.map((r) => r.rank).filter((x) => x != null);
    const avg = pts.reduce((a, b) => a + b, 0) / pts.length;
    return {
      m, seasons: rec.length,
      titles: champs.filter((c) => c === m).length,
      spoons: spoons.filter((c) => c === m).length,
      total: pts.reduce((a, b) => a + b, 0), avg,
      best: Math.max(...pts), worst: Math.min(...pts),
      bestRank: Math.min(...ranks), avgRank: ranks.reduce((a, b) => a + b, 0) / ranks.length,
      sd: Math.sqrt(pts.reduce((a, b) => a + (b - avg) ** 2, 0) / pts.length),
    };
  });

  /* ---------- tooltip ---------- */
  const tip = $('#tip');
  function showTip(html, x, y) { tip.innerHTML = html; tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.hidden = false; }
  const hideTip = () => (tip.hidden = true);

  /* ---------- hero scoreboard ---------- */
  $('#scoreboard').innerHTML = [...stats].sort((a, b) => b.titles - a.titles || b.avg - a.avg).map((s) =>
    `<div class="sb-cell"><div class="n">${s.titles}</div><div class="l">${esc(s.m)}</div><div class="s">${s.titles === 1 ? 'title' : 'titles'} · ${s.seasons} seasons</div></div>`).join('');

  /* ---------- season table ---------- */
  let current = tables.length - 1;
  const tabs = $('#seasonTabs');
  tabs.innerHTML = tables.map((t, i) => `<button role="tab" data-i="${i}" aria-selected="${i === current}">${esc(t.season)}</button>`).join('');
  tabs.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { current = +b.dataset.i; renderSeason(); } });
  function renderSeason() {
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', +b.dataset.i === current));
    const rows = tables[current].rows, lead = rows[0]?.pts, off = isOfficial(tables[current].season);
    $('#seasonNote').hidden = off;
    $('#seasonTable').innerHTML = `<thead><tr><th>Pos</th><th>Manager</th><th>Pts</th><th>Gap</th><th>Overall rank</th></tr></thead><tbody>` +
      rows.map((r) => `<tr class="${r.pos === 1 ? 'p1' : r.pos === 2 ? 'p2' : r.pos === 3 ? 'p3' : ''} ${off && r.pos === rows.length && rows.length > 1 ? 'last' : ''}">
        <td class="pos">${r.pos}</td>
        <td class="mgr">${kit(r.m)}${esc(r.m)}${off && r.pos === 1 ? '<span class="trophy" title="Champion">🏆</span>' : ''}${off && r.pos === rows.length && rows.length > 1 ? '<span class="card-y" title="Wooden spoon"></span>' : ''}</td>
        <td class="pts">${fmt(r.pts)}</td>
        <td class="gap">${r.pos === 1 ? '—' : '−' + (lead - r.pts)}</td>
        <td>${fmt(r.rank)}</td></tr>`).join('') + '</tbody>';
  }
  renderSeason();

  /* ---------- all-time table ---------- */
  const cols = [
    ['m', 'Manager', (s) => `${kit(s.m)}${esc(s.m)}`, 'mgr'],
    ['seasons', 'P', (s) => s.seasons],
    ['titles', '🏆', (s) => s.titles],
    ['spoons', '🥄', (s) => s.spoons],
    ['avg', 'Avg Pts', (s) => fmt(s.avg), 'pts'],
    ['total', 'Total', (s) => fmt(s.total)],
    ['best', 'Best', (s) => fmt(s.best)],
    ['worst', 'Worst', (s) => fmt(s.worst)],
    ['bestRank', 'Best Rank', (s) => fmt(s.bestRank)],
    ['avgRank', 'Avg Rank', (s) => fmt(s.avgRank)],
    ['form', 'Form', (s) => formStrip(s.m)],
  ];
  const lowerIsBetter = new Set(['m', 'worst_', 'bestRank', 'avgRank']);
  let sortKey = 'avg', asc = false;
  function formStrip(m) {
    return '<span class="form">' + tables.slice(-6).map((t) => {
      const r = t.rows.find((x) => x.m === m);
      if (!r) return '<i class="x" title="Did not play"></i>';
      const c = !isOfficial(t.season) ? '' : r.pos === 1 ? 'w' : r.pos === t.rows.length && t.rows.length > 1 ? 'l' : 'm';
      return `<i class="${c}" title="${esc(t.season)}: ${r.pos}${['st', 'nd', 'rd'][r.pos - 1] || 'th'}"></i>`;
    }).join('') + '</span>';
  }
  function renderAll() {
    const list = [...stats].sort((a, b) => {
      const d = sortKey === 'm' ? a.m.localeCompare(b.m) : sortKey === 'form' ? 0 : a[sortKey] - b[sortKey];
      return (asc ? d : -d) || b.avg - a.avg;
    });
    $('#allTable').innerHTML = `<thead><tr><th>#</th>${cols.map(([k, l]) => `<th ${k === 'form' ? '' : `data-k="${k}"`} class="${k === sortKey ? 'sorted' + (asc ? ' asc' : '') : ''}">${l}</th>`).join('')}</tr></thead><tbody>` +
      list.map((s, i) => `<tr class="${i === 0 ? 'p1' : ''}"><td class="pos">${i + 1}</td>${cols.map(([, , f, c]) => `<td class="${c || ''}">${f(s)}</td>`).join('')}</tr>`).join('') + '</tbody>';
  }
  $('#allTable').addEventListener('click', (e) => {
    const th = e.target.closest('th[data-k]'); if (!th) return;
    const k = th.dataset.k;
    if (k === sortKey) asc = !asc; else { sortKey = k; asc = lowerIsBetter.has(k); }
    renderAll();
  });
  renderAll();

  /* ---------- records ---------- */
  const flat = tables.flatMap((t) => t.rows.map((r) => ({ ...r, season: t.season })));
  const by = (f, dir = 1) => flat.filter((r) => f(r) != null).sort((a, b) => dir * (f(a) - f(b)))[0];
  const margins = tables.filter((t) => isOfficial(t.season) && t.rows.length > 1).map((t) => ({ season: t.season, m: t.rows[0].m, gap: t.rows[0].pts - t.rows[1].pts, second: t.rows[1].m }));
  const widest = [...margins].sort((a, b) => b.gap - a.gap)[0], tightest = [...margins].sort((a, b) => a.gap - b.gap)[0];
  const steady = [...stats].filter((s) => s.seasons >= 8).sort((a, b) => a.sd - b.sd)[0];
  const hi = by((r) => r.pts, -1), lo = by((r) => r.pts), br = by((r) => r.rank), wr = by((r) => r.rank, -1);
  const recs = [
    ['Highest score', fmt(hi.pts), `${hi.m} · ${hi.season}`],
    ['Lowest score', fmt(lo.pts), `${lo.m} · ${lo.season}`],
    ['Best world rank', fmt(br.rank), `${br.m} · ${br.season}`],
    ['Worst world rank', fmt(wr.rank), `${wr.m} · ${wr.season}`],
    ['Biggest title margin', '+' + widest.gap, `${widest.m} · ${widest.season}`],
    ['Tightest title race', tightest.gap === 0 ? 'Dead heat' : '+' + tightest.gap, `${tightest.m} over ${tightest.second} · ${tightest.season}${tightest.gap === 0 ? ' (rank tie-break)' : ''}`],
    ['Mr Consistent', '±' + Math.round(steady.sd), `${steady.m} (std. dev. of points)`],
  ];
  $('#records').innerHTML = recs.map(([l, v, w]) => `<div class="rec"><div class="l">${l}</div><div class="v">${v}</div><div class="w">${esc(w)}</div></div>`).join('');

  /* ---------- charts ---------- */
  const active = new Set(managers);
  $('#chips').innerHTML = managers.map((m) => `<button class="chip" data-m="${m}" aria-pressed="true"><span class="dot" style="background:${COLORS[m]}"></span>${esc(m)}</button>`).join('');
  $('#chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    const m = b.dataset.m;
    if (active.has(m)) { if (active.size > 1) active.delete(m); } else active.add(m);
    b.setAttribute('aria-pressed', active.has(m));
    drawCharts();
  });

  function lineChart(el, { value, y0, y1, ticks, label, valueFmt }) {
    const W = 520, H = 300, L = 46, R = 12, T = 12, B = 34, n = seasons.length;
    const x = (i) => L + (i * (W - L - R)) / (n - 1), y = (v) => T + ((y1 - value.scale(v)) / (y1 - y0)) * (H - T - B);
    let g = ticks.map((t) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${label(t)}</text>`).join('');
    g += seasons.map((s, i) => `<text x="${x(i)}" y="${H - 12}" text-anchor="middle">${s.season.slice(2, 4)}/${s.season.slice(7)}</text>`).join('');
    managers.filter((m) => active.has(m)).forEach((m) => {
      let d = '', dots = '', pen = false;
      seasons.forEach((s, i) => {
        const v = value.get(s, m);
        if (v == null) { pen = false; return; }
        d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true;
        dots += `<circle class="hit" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="5" fill="${COLORS[m]}" stroke="#062613" stroke-width="2" data-tip="<b>${esc(m)}</b> · ${esc(s.season)}<br>${valueFmt(v, s, m)}" tabindex="0"/>`;
      });
      g += `<path d="${d}" fill="none" stroke="${COLORS[m]}" stroke-width="2.5" stroke-linejoin="round"/>${dots}`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Line chart">${g}</svg>`;
  }
  function drawCharts() {
    lineChart($('#ptsChart'), {
      value: { scale: (v) => v, get: (s, m) => s.points[m] }, y0: 1400, y1: 2700,
      ticks: [1400, 1600, 1800, 2000, 2200, 2400, 2600], label: (t) => t,
      valueFmt: (v) => `${fmt(v)} pts`,
    });
    lineChart($('#rankChart'), {
      value: { scale: (v) => 7 - Math.log10(v), get: (s, m) => s.rank[m] }, y0: 0, y1: 3,
      ticks: [1e4, 1e5, 1e6], label: (t) => fmtRank(t),
      valueFmt: (v, s, m) => `World rank ${fmt(v)}`,
    });
  }
  document.addEventListener('mouseover', (e) => { const c = e.target.closest('[data-tip]'); if (c) { const r = c.getBoundingClientRect(); showTip(c.dataset.tip, r.left + r.width / 2, r.top); } });
  document.addEventListener('mouseout', (e) => { if (e.target.closest('[data-tip]')) hideTip(); });
  document.addEventListener('focusin', (e) => { const c = e.target.closest?.('[data-tip]'); if (c) { const r = c.getBoundingClientRect(); showTip(c.dataset.tip, r.left + r.width / 2, r.top); } });
  document.addEventListener('focusout', hideTip);
  document.addEventListener('click', (e) => { const c = e.target.closest('[data-tip]'); if (c) { const r = c.getBoundingClientRect(); showTip(c.dataset.tip, r.left + r.width / 2, r.top); } else hideTip(); });
  drawCharts();

  /* ---------- head to head ---------- */
  const selA = $('#h2hA'), selB = $('#h2hB');
  [selA, selB].forEach((s) => (s.innerHTML = managers.map((m) => `<option>${esc(m)}</option>`).join('')));
  selA.value = 'Con'; selB.value = 'Davs';
  function renderH2H() {
    const a = selA.value, b = selB.value, out = $('#h2hOut');
    if (a === b) { out.innerHTML = '<p class="empty">Pick two different managers. Nobody plays themselves (apart from Joyce, probably).</p>'; return; }
    const games = seasons.filter((s) => s.points[a] != null && s.points[b] != null).map((s) => ({ season: s.season, pa: s.points[a], pb: s.points[b], ra: s.rank[a], rb: s.rank[b] }));
    const res = games.map((g) => g.pa !== g.pb ? Math.sign(g.pa - g.pb) : Math.sign(g.rb - g.ra));
    const wa = res.filter((r) => r > 0).length, wb = res.filter((r) => r < 0).length;
    const diff = games.reduce((t, g) => t + g.pa - g.pb, 0);
    const bigA = [...games].sort((x, y) => (y.pa - y.pb) - (x.pa - x.pb))[0], bigB = [...games].sort((x, y) => (x.pa - x.pb) - (y.pa - y.pb))[0];
    const side = (m, w) => `<div><div class="who">${kit(m)}${esc(m)}</div><div class="big" style="color:${w ? COLORS[m] : 'var(--chalk)'}">${w ? wa : wb}</div></div>`;
    out.innerHTML = `<div class="h2h-score">${side(a, 1)}<div class="dash">–</div>${side(b, 0)}</div>
      <div class="h2h-stats"><span>Seasons together: <b>${games.length}</b></span>
      <span>${esc(diff >= 0 ? a : b)} leads on points by <b>${fmt(Math.abs(diff))}</b> (avg ${(Math.abs(diff) / games.length).toFixed(0)}/season)</span>
      <span>Biggest ${esc(a)} win: <b>${bigA.pa > bigA.pb ? '+' + (bigA.pa - bigA.pb) + ' (' + bigA.season + ')' : 'none'}</b></span>
      <span>Biggest ${esc(b)} win: <b>${bigB.pb > bigB.pa ? '+' + (bigB.pb - bigB.pa) + ' (' + bigB.season + ')' : 'none'}</b></span></div>
      <div class="dueling">${games.map((g, i) => {
        const tot = g.pa + g.pb, wA = res[i] > 0;
        return `<div class="duel"><span class="y">${esc(g.season.slice(2))}</span><div class="bars">
          <div style="width:${(g.pa / tot) * 100}%;background:${COLORS[a]};opacity:${wA ? 1 : .55}">${fmt(g.pa)}</div>
          <div style="width:${(g.pb / tot) * 100}%;background:${COLORS[b]};opacity:${wA ? .55 : 1}">${fmt(g.pb)}</div></div>
          <span class="gapv">${g.pa === g.pb ? 'level' : (wA ? esc(a) : esc(b)) + ' +' + Math.abs(g.pa - g.pb)}</span></div>`;
      }).join('')}</div>
      <p class="note">Level on points? Better overall rank takes the win. Bright bar = winner.</p>`;
  }
  selA.addEventListener('change', renderH2H); selB.addEventListener('change', renderH2H);
  renderH2H();

  /* ---------- hall of fame ---------- */
  $('#fameGrid').innerHTML = tables.filter((t) => isOfficial(t.season)).reverse().map((t) => {
    const w = t.rows[0], l = t.rows[t.rows.length - 1];
    const bestRank = [...t.rows].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))[0];
    const row = (ic, tt, r, v) => `<div class="frow"><span class="ic">${ic}</span><div><div class="t">${tt}</div><div class="n">${kit(r.m)}${esc(r.m)}</div></div><span class="p">${v}</span></div>`;
    return `<div class="fcard"><div class="s">${esc(t.season)}</div>${row('🏆', 'Champion', w, fmt(w.pts))}${t.rows.length > 1 ? row('🥄', 'Wooden spoon', l, fmt(l.pts)) : ''}${row('🌍', 'Best world rank', bestRank, fmtRank(bestRank.rank))}</div>`;
  }).join('');

  /* ---------- bets ---------- */
  let status = 'all';
  const who = $('#betWho'), q = $('#betSearch');
  who.innerHTML = '<option value="">Everyone</option>' + managers.map((m) => `<option>${esc(m)}</option>`).join('');
  $('#betStatus').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    status = b.dataset.v;
    $('#betStatus').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    renderBets();
  });
  who.addEventListener('change', renderBets); q.addEventListener('input', renderBets);
  function renderBets() {
    const term = q.value.trim().toLowerCase();
    const list = bets.filter((b) => (status === 'all' || (status === 'live') === b.active) && (!who.value || b.a === who.value || b.b === who.value) &&
      (!term || (b.bet + b.stake + b.a + b.b).toLowerCase().includes(term)));
    $('#betList').innerHTML = list.length ? list.map((b) => `<article class="bet ${b.active ? 'live' : ''}"><span class="tag">${b.active ? 'Live' : 'Settled'}</span>
      <div class="m">${esc(b.a)} <em>vs</em> ${esc(b.b)}</div><p class="what">${esc(b.bet)}</p><div class="stake">Stake: ${esc(b.stake)}</div></article>`).join('')
      : '<p class="empty">No bets match. Nobody’s that confident.</p>';
  }
  renderBets();
})();
