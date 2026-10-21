(function (root) {
  'use strict';
  const INK = '#f6f1f5', MUTED = '#a7a1b0', LINE = '#38313e';
  const COLORS = ['#fa629c', '#79c9ed', '#f1ce83', '#ae98f6'];
  const fmt = n => Math.round(n).toLocaleString('ko-KR');
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const clockFmt = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

  function createRenderer(canvas, engine, config) {
    const ctx = canvas.getContext('2d', { alpha: false });
    const W = 1920, H = 1080;
    function text(s, x, y, size = 24, weight = 400, color = INK, align = 'left', maxWidth) {
      ctx.font = `${weight} ${size}px A2Z, sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
      if (maxWidth) ctx.fillText(s, x, y, maxWidth); else ctx.fillText(s, x, y);
    }
    function fitText(s, x, y, size, min, weight, color, width, align = 'left') {
      while (size > min) { ctx.font = `${weight} ${size}px A2Z, sans-serif`; if (ctx.measureText(s).width <= width) break; size--; }
      text(s, x, y, size, weight, color, align, width);
    }
    function tracked(s, x, y, size, tracking, color = MUTED, weight = 500) {
      ctx.font = `${weight} ${size}px A2Z, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = color;
      for (const c of s) { ctx.fillText(c, x, y); x += ctx.measureText(c).width + tracking; }
    }
    function line(x1, y1, x2, y2, color = LINE, width = 1) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
    function rounded(x, y, w, h, r, fill) { if (w <= 0) return; ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
    function circle(x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    function bg(accent = '#ff4e9b') {
      ctx.fillStyle = '#0c0b11'; ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(1530, 250, 10, 1450, 370, 1200); g.addColorStop(0, accent + '19'); g.addColorStop(1, accent + '00'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const g2 = ctx.createRadialGradient(160, 1000, 1, 160, 1000, 700); g2.addColorStop(0, '#8b255b10'); g2.addColorStop(1, '#8b255b00'); ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
      for (let x = 80; x < W; x += 80) line(x, 0, x, H, '#ffffff02');
      for (let y = 40; y < H; y += 80) line(0, y, W, y, '#ffffff02');
      line(80, 118, 1840, 118, '#ffffff22');
      text('OSCA', 80, 84, 40, 900); tracked('INNOVATION AWARDS 2026', 238, 78, 14, 3, '#c3b6c4');
    }
    function footer(state, right = '한 표가 모여, 혁신의 주인공이 됩니다.') {
      line(80, 976, 1840, 976, '#ffffff22');
      tracked('THE REVEAL', 80, 1026, 15, 4, '#b6a0b2');
      text(right, 1840, 1026, 20, 400, MUTED, 'right');
    }
    function houseNav(h) {
      config.order.forEach((id, i) => { text(id, 1630 + i * 64, 82, 28, h === id ? 700 : 400, h === id ? config.houses[id].color : '#6d6173'); if (h === id) rounded(1629 + i * 64, 96, 22, 3, 1, config.houses[id].color); });
    }
    function opening() {
      bg(); tracked('CELEBRATING OUR NEXT CHAPTER', 86, 208, 17, 4, '#bd9aaf');
      const letters = ['O', 'S', 'C', 'A'];
      letters.forEach((h, i) => {
        ctx.font = '900 370px A2Z'; ctx.textAlign = 'left'; ctx.strokeStyle = config.houses[h].color + 'a6'; ctx.lineWidth = 2;
        const x = 75 + i * 442;
        if (i === 0) { ctx.fillStyle = '#f6eaf1'; ctx.fillText(h, x, 600); } else ctx.strokeText(h, x, 600);
        rounded(x + 8, 644, 42, 4, 2, config.houses[h].color);
        text(config.houses[h].title, x + 8, 694, 22, 500, '#c7bdcd');
      });
      text('모든 한 표가 모여,', 86, 824, 39, 400, '#c9becb');
      text('오늘의 주인공이 됩니다.', 86, 890, 53, 700);
      text('VOTE RESULTS', 1838, 862, 19, 500, '#c4a9ba', 'right');
      text('O  →  S  →  C  →  A', 1838, 908, 24, 600, '#f4e3ed', 'right');
      footer(null, 'OSCA 시상식 · 투표 결과 발표');
    }
    function intro(state) {
      const h = config.houses[state.house]; bg(h.color); houseNav(state.house);
      tracked('NOMINEES', 84, 209, 17, 4, h.color);
      fitText(h.title, 80, 313, 72, 52, 700, INK, 1300);
      text('당신이 선택한 혁신, 지금 공개합니다.', 84, 370, 27, 400, MUTED);
      ctx.save(); ctx.globalAlpha = .08; text(state.house, 1800, 890, 630, 900, h.color, 'right'); ctx.restore();
      const width = h.candidates.length === 4 ? 410 : 550;
      h.candidates.forEach((c, i) => {
        const x = 84 + i * (width + 26);
        line(x, 470, x + width, 470, COLORS[i] + 'aa', 3);
        text(String(i + 1).padStart(2, '0'), x, 562, 60, 900, COLORS[i]);
        fitText(c.name, x, 644, 44, 27, 700, INK, width - 10);
        fitText(c.description, x, 702, 23, 18, 400, '#beb2c4', width - 10);
      });
      text('마곡', 84, 873, 24, 500, '#f1e6ed'); text('→  상암  →  용산  →  온라인', 154, 873, 24, 400, '#95869d');
      footer(state, '후보 소개 · 집계 공개 대기');
    }
    function pipeline(state, frame) {
      const h = config.houses[state.house];
      const x0 = 84, y = 908, width = 280;
      engine.stages.forEach((s, i) => {
        const x = x0 + i * 312;
        rounded(x, y, width, 4, 2, '#ffffff18');
        const p = i < state.stage ? 1 : i === state.stage ? frame.progress : 0;
        rounded(x, y, width * p, 4, 2, i === state.stage ? h.color : '#9d819e');
        text(`${String(i + 1).padStart(2, '0')}  ${s.name}`, x, y + 39, 20, i === state.stage ? 600 : 400, i === state.stage ? INK : '#928497');
      });
      text(state.stage === 3 ? '시간순 누적 집계' : '사옥별 누적 집계', 1840, y + 33, 19, 500, '#b19eb5', 'right');
    }
    function race(state) {
      const h = config.houses[state.house], frame = engine.sample(state.house, state.stage, state.time);
      bg(h.color); houseNav(state.house);
      tracked(`${state.house}  /  ${h.title}`, 84, 183, 17, 2, h.color, 600);
      text(engine.stages[state.stage].title, 80, 276, 66, 700);
      text(state.stage === 3 ? clockFmt.format(frame.clock) + '  KST' : engine.stages[state.stage].subtitle, 84, 325, 26, 400, MUTED);
      text('누적 득표', 1838, 184, 19, 500, MUTED, 'right'); text(fmt(frame.total), 1790, 267, 64, 700, INK, 'right'); text('표', 1838, 267, 25, 400, MUTED, 'right');
      const change = frame.change && frame.time - frame.change.time < 2.6 && frame.time - frame.change.time >= 0;
      const tie = frame.leaders.length > 1;
      let message = frame.total === 0 ? '집계가 시작됩니다' : tie ? '공동 1위' : change ? '선두가 바뀌었습니다' : `1·2위 격차  ${fmt(frame.values[frame.order[0]] - frame.values[frame.order[1]])}표`;
      const messageColor = tie || change ? h.color : '#beb0c4';
      text(message, 1838, 325, 25, change || tie ? 700 : 500, messageColor, 'right');
      const plotX = 506, plotW = 1125, top = h.candidates.length === 4 ? 393 : 418, gap = h.candidates.length === 4 ? 111 : 143, barH = h.candidates.length === 4 ? 70 : 86;
      // Adaptive scale depends only on revealed votes, with a zero baseline.
      for (let j = 0; j <= 4; j++) { const x = plotX + j * plotW / 4; line(x, 374, x, 839, '#ffffff0c'); }
      text('0', plotX, 863, 15, 400, '#7e7187'); text('득표수 (표)', plotX + plotW, 863, 15, 400, '#8e8096', 'right');
      h.candidates.forEach((candidate, i) => {
        const y = top + frame.y[i] * gap;
        const leader = frame.leaders.includes(i), value = frame.values[i];
        const bW = Math.max(0, value / frame.scale * plotW);
        text(frame.total ? String(frame.ranks[i]).padStart(2, '0') : '—', 84, y + barH * .65, 34, 700, leader ? COLORS[i] : '#7d7185');
        circle(161, y + barH * .46, 5, COLORS[i]);
        fitText(candidate.name, 182, y + barH * .43, 32, 22, 700, INK, 296);
        fitText(candidate.description, 182, y + barH * .85, 17, 14, 400, '#9c8fa5', 296);
        rounded(plotX, y, plotW, barH, 4, '#ffffff04');
        if (bW > 0) {
          const gradient = ctx.createLinearGradient(plotX, y, plotX + bW, y); gradient.addColorStop(0, COLORS[i] + '95'); gradient.addColorStop(1, COLORS[i]);
          rounded(plotX, y, bW, barH, 4, gradient);
          if (leader) { ctx.save(); ctx.shadowBlur = 22; ctx.shadowColor = COLORS[i] + '66'; rounded(plotX + Math.max(0, bW - 3), y + 8, Math.min(bW, 3), barH - 16, 1, '#fff4'); ctx.restore(); }
        }
        text(fmt(value), plotX + bW + 23, y + barH * .67, 39, 700, leader ? '#fff7fc' : '#d4c8df');
      });
      pipeline(state, frame);
      const complete = frame.progress >= 1;
      footer(state, complete ? (state.stage === 3 ? '최종 집계 완료 · 수상 후보 공개 대기' : `${engine.stages[state.stage].name} 집계 완료 · 다음 공개 대기`) : state.playing ? (state.stage === 3 ? '온라인 투표 시간순 재생 · 투표 간 공백 압축' : '오프라인 집계 합산 중') : '잠시 멈춤 · 사회자 진행 중');
      return frame;
    }
    function confetti(t, accent) {
      const duration = 7;
      if (t >= duration) return;
      const colors = [accent, '#f3dba6', '#f5e5ef', '#b6a0ce'];
      ctx.save();
      for (let i = 0; i < 100; i++) {
        const seed = ((i * 127.1) % 97) / 97;
        const age = t - seed * .9;
        if (age < 0) continue;
        const x = ((i * 179.7) % 1920) + Math.sin(age * 1.4 + i) * 65;
        const y = -150 + age * (115 + (i % 7) * 26);
        ctx.globalAlpha = clamp((duration - t) / 1.4) * .7;
        ctx.save(); ctx.translate(x, y); ctx.rotate(age * (i % 2 ? 1 : -1) + i); ctx.fillStyle = colors[i % colors.length]; ctx.fillRect(-3, -8, 5 + i % 5, 12 + i % 10); ctx.restore();
      }
      ctx.restore();
    }
    function winner(state) {
      const h = config.houses[state.house], list = engine.standings(state.house), win = list[0], total = engine.sum(engine.final(state.house));
      bg(h.color); houseNav(state.house);
      const p = clamp(state.time / 1.4), opacity = 1 - Math.pow(1 - p, 3), shift = (1 - opacity) * 35;
      ctx.save(); ctx.globalAlpha = .07; text(state.house, 1810, 935, 770, 900, h.color, 'right'); ctx.restore();
      tracked(`${state.house}  /  ${h.title}`, 84, 192, 17, 2, h.color, 600);
      ctx.save(); ctx.globalAlpha = opacity; ctx.translate(0, shift);
      tracked('THE WINNER', 84, 325, 24, 7, h.color, 700);
      text('01', 73, 510, 180, 900, '#f6e8f0');
      fitText(h.candidates[win.index].name, 335, 501, 104, 54, 700, INK, 1440);
      fitText(h.candidates[win.index].description, 343, 570, 30, 22, 400, '#c6b6ce', 1370);
      line(84, 642, 1838, 642, h.color + '66');
      text('최종 득표', 88, 701, 22, 500, MUTED); text(fmt(win.votes), 82, 810, 92, 700); text('표', 310, 806, 29, 400, MUTED);
      text('득표율', 540, 701, 22, 500, MUTED); text((win.votes / total * 100).toFixed(1) + '%', 534, 805, 67, 600);
      text('함께 만든 혁신에 박수를 보냅니다.', 1838, 704, 27, 500, '#e3d1e4', 'right');
      text(`총 ${fmt(total)}표  ·  2위와 ${fmt(win.votes - list[1].votes)}표 차이`, 1838, 755, 22, 400, MUTED, 'right');
      const results = list.map(r => `${r.rank}위  ${h.candidates[r.index].name}  ${fmt(r.votes)}표`).join('     /     ');
      fitText(results, 88, 916, 24, 18, 400, '#b1a2ba', 1748);
      ctx.restore(); confetti(state.time, h.color); footer(state, 'CONGRATULATIONS · 수상을 축하합니다');
    }
    function finale(state) {
      bg(); tracked('OUR INNOVATION, OUR WINNERS', 84, 214, 17, 4, '#c69eb7');
      text('함께 만든 변화,', 80, 334, 76, 400, '#d5c4d5'); text('우리의 혁신은 계속됩니다.', 80, 434, 86, 700);
      config.order.forEach((house, i) => {
        const h = config.houses[house], win = engine.standings(house)[0], x = 84 + i * 445;
        line(x, 550, x + 405, 550, h.color, 3); text(house, x, 655, 74, 900, h.color);
        fitText(h.title, x, 710, 22, 18, 500, '#b9a9c1', 402);
        fitText(h.candidates[win.index].name, x, 796, 39, 25, 700, INK, 400);
        text(fmt(win.votes) + '표', x, 858, 30, 500, '#d0bfd8');
      }); footer(state, 'OSCA · 모든 참여자 여러분, 감사합니다');
    }
    function render(state) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
      let frame;
      if (state.scene === 'opening') opening(); else if (state.scene === 'intro') intro(state); else if (state.scene === 'race') frame = race(state); else if (state.scene === 'winner') winner(state); else finale(state);
      return frame;
    }
    return { render };
  }
  root.OSCARenderer = { create: createRenderer };
})(window);
