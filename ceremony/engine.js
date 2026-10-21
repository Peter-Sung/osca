/* Deterministic 60 fps timeline shared by live playback and future video export. */
(function (root) {
  'use strict';
  const STAGES = [
    { key: 'magok', name: '마곡', title: '마곡사옥', subtitle: '첫 번째 사옥의 선택' },
    { key: 'sangam', name: '상암', title: '상암사옥', subtitle: '두 번째 사옥의 선택' },
    { key: 'yongsan', name: '용산', title: '용산사옥', subtitle: '오프라인 집계의 완성' },
    { key: 'online', name: '온라인', title: '온라인 투표', subtitle: '시간을 따라, 한 표씩' }
  ];
  const sum = a => a.reduce((n, x) => n + x, 0);
  const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
  const ease = p => p * p * (3 - 2 * p);

  function createEngine(data, config) {
    const cache = new Map();
    const houses = config.order;
    const events = data.online.map((e, i) => ({ house: e[0], candidate: e[1], time: e[2], sourceIndex: i }))
      .sort((a, b) => a.time - b.time || a.sourceIndex - b.sourceIndex);
    if (!events.length) throw new Error('온라인 투표 기록이 없습니다.');
    for (const e of events) {
      if (!houses.includes(e.house) || !Number.isInteger(e.candidate) || e.candidate < 1 || e.candidate > config.houses[e.house].candidates.length || !Number.isFinite(e.time)) throw new Error('투표 데이터 형식을 확인해 주세요.');
    }
    for (const stage of STAGES.slice(0, 3)) for (const h of houses) {
      const a = data.offline[stage.key]?.[h];
      if (!a || a.length !== config.houses[h].candidates.length || a.some(n => !Number.isInteger(n) || n < 0)) throw new Error('오프라인 데이터 형식을 확인해 주세요.');
    }

    // All houses share this clock. Equal timestamps are revealed together.
    const groups = [];
    for (const e of events) {
      let g = groups[groups.length - 1];
      if (!g || g.time !== e.time) { g = { time: e.time, events: [] }; groups.push(g); }
      g.events.push(e);
    }
    let weight = 0;
    groups.forEach((g, i) => {
      const gap = i ? (g.time - groups[i - 1].time) / 1000 : 1;
      // Compress empty time; give the final chronological third more screen time.
      g.baseWeight = (1 + Math.min(gap, 180) / 30) * (i / groups.length >= 2 / 3 ? 1.6 : 1);
      weight += g.baseWeight;
    });
    // Give a new leading tie or lead change a readable beat. This pause in the
    // common clock applies to EVERY house, never to a candidate's own votes.
    const baseWeight = weight, live = Object.fromEntries(houses.map(h => [h, before(h, 3)]));
    const lastLeads = Object.fromEntries(houses.map(h => [h, leadSet(live[h])]));
    const unique = Object.fromEntries(houses.map(h => [h, lastLeads[h].length === 1 ? lastLeads[h][0] : null]));
    function leadSet(v) { const max = Math.max(...v); return v.map((n, i) => n === max ? i : -1).filter(i => i >= 0); }
    let pendingHold = 0; weight = 0;
    for (const g of groups) {
      weight += g.baseWeight + pendingHold; pendingHold = 0; g.weight = weight;
      for (const e of g.events) live[e.house][e.candidate - 1]++;
      for (const h of houses) {
        const leads = leadSet(live[h]);
        if (leads.length > 1 && lastLeads[h].length === 1) pendingHold = Math.max(pendingHold, baseWeight * .03);
        if (leads.length === 1) {
          if (unique[h] !== null && unique[h] !== leads[0]) pendingHold = Math.max(pendingHold, baseWeight * .018);
          unique[h] = leads[0];
        }
        lastLeads[h] = leads;
      }
    }
    for (const g of groups) g.u = g.weight / weight;

    function before(h, stage) {
      const a = config.houses[h].candidates.map(() => 0);
      for (let s = 0; s < Math.min(stage, 3); s++) data.offline[STAGES[s].key][h].forEach((n, i) => { a[i] += n; });
      return a;
    }
    function final(h) {
      const v = before(h, 3);
      for (const e of events) if (e.house === h) v[e.candidate - 1]++;
      return v;
    }
    function buildFrames(h, stage) {
      const key = h + stage;
      if (cache.has(key)) return cache.get(key);
      const duration = config.durations[stage];
      const length = Math.round(duration * 60);
      const base = before(h, stage);
      const values = base.slice();
      let order = values.map((_, i) => i).sort((a, b) => values[b] - values[a] || a - b);
      const y = values.map((_, i) => order.indexOf(i));
      let scale = Math.max(1, ...values) * 1.13;
      let groupIndex = 0, houseVotes = 0, previousLeader = null, change = null;
      const frames = [];
      for (let f = 0; f <= length; f++) {
        const p = f / length, t = f / 60;
        let clock = events[0].time;
        if (stage < 3) {
          const part = data.offline[STAGES[stage].key][h];
          part.forEach((n, i) => { values[i] = base[i] + Math.floor(n * ease(p) + 1e-8); });
        } else {
          while (groupIndex < groups.length && groups[groupIndex].u <= p + 1e-10) {
            for (const e of groups[groupIndex].events) if (e.house === h) { values[e.candidate - 1]++; houseVotes++; }
            groupIndex++;
          }
          const prev = groupIndex ? groups[groupIndex - 1] : { time: events[0].time, u: 0 };
          const next = groups[groupIndex] || prev;
          clock = prev.time + (next.time - prev.time) * clamp((p - prev.u) / (next.u - prev.u || 1));
        }
        // Stable ordering preserves positions on a tie. Rank labels remain equal.
        order.sort((a, b) => values[b] - values[a]);
        const ranks = values.map(v => 1 + values.filter(x => x > v).length);
        const high = Math.max(...values), leaders = values.map((v, i) => v === high && high > 0 ? i : -1).filter(i => i >= 0);
        if (leaders.length === 1) {
          if (previousLeader !== null && previousLeader !== leaders[0]) change = { time: t, candidate: leaders[0] };
          previousLeader = leaders[0];
        }
        const smooth = 1 - Math.exp(-1 / (60 * .16));
        for (let i = 0; i < y.length; i++) y[i] += (order.indexOf(i) - y[i]) * smooth;
        const targetScale = Math.max(high * 1.13, 80);
        scale += (targetScale - scale) * .07;
        if (f === 0) scale = targetScale;
        if (f === length) { for (let i = 0; i < y.length; i++) y[i] = order.indexOf(i); scale = targetScale; }
        frames.push({ values: values.slice(), y: y.slice(), ranks, order: order.slice(), leaders, total: sum(values), scale, clock, houseVotes, progress: p, change, time: t });
      }
      cache.set(key, frames);
      return frames;
    }
    function sample(h, stage, time) {
      const frames = buildFrames(h, stage);
      return frames[Math.min(frames.length - 1, Math.max(0, Math.floor(time * 60 + 1e-7)))];
    }
    function standings(h) {
      const v = final(h);
      return v.map((votes, index) => ({ index, votes, rank: 1 + v.filter(n => n > votes).length })).sort((a, b) => b.votes - a.votes || a.index - b.index);
    }
    return { stages: STAGES, groups, events, before, final, sample, frames: buildFrames, standings, sum, clamp, total: sum(houses.flatMap(final)) };
  }
  root.OSCAEngine = { create: createEngine, stages: STAGES };
  if (typeof module !== 'undefined') module.exports = root.OSCAEngine;
})(typeof window !== 'undefined' ? window : globalThis);
