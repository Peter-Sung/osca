(async function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const isAudience = new URLSearchParams(location.search).has('screen');
  const sessionId = new URLSearchParams(location.search).get('session') || (window.crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()));
  const config = window.OSCA_CONFIG;
  const STORAGE_KEY = 'osca.ceremony.names.v1';
  const state = { scene: 'opening', house: 'O', stage: 0, time: 0, playing: false, speed: 1, sound: false };
  let ready = false, audience = null, lastTick = performance.now(), lastSent = 0, lastUi = 0, lastCue = '', lastLeader = null, lastChange = null, audio = null, toastTimer, confirmAction, channel = null, audiencePulse = 0;
  try { channel = new BroadcastChannel('osca-reveal-' + sessionId); } catch (_) { /* postMessage also works when file-origin channels are unavailable. */ }
  const screenUrl = new URL('index.html', location.href); screenUrl.searchParams.set('screen', '1'); screenUrl.searchParams.set('session', sessionId);
  $('audience-button').href = screenUrl.href;
  if (isAudience) document.body.classList.add('audience');
  function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5000); }
  function safeNames(names) {
    for (const h of config.order) config.houses[h].candidates.forEach((c, i) => {
      const s = names?.[h]?.[i]; if (typeof s === 'string' && s.trim()) c.name = s.trim().slice(0, 30);
    });
  }
  function namesSnapshot() { return Object.fromEntries(config.order.map(h => [h, config.houses[h].candidates.map(c => c.name)])); }
  try { safeNames(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch (_) { /* File mode storage is optional. */ }
  let engine, renderer;
  try {
    engine = window.OSCAEngine.create(window.OSCA_VOTES, config);
    if (engine.total !== 7590) throw new Error('예상 집계 7,590표와 데이터가 다릅니다.');
    await Promise.all([400, 500, 600, 700, 900].map(weight => document.fonts.load(`${weight} 30px A2Z`, 'OSCA 시상식 0123456789')));
    if (![400, 500, 600, 700, 900].every(weight => document.fonts.check(`${weight} 30px A2Z`, 'OSCA 시상식'))) throw new Error('에이투지체를 불러오지 못했습니다. fonts 폴더를 확인해 주세요.');
    renderer = window.OSCARenderer.create($('stage'), engine, config);
    ready = true; $('loading').hidden = true;
  } catch (error) {
    $('loading').textContent = '준비를 완료하지 못했습니다. ' + error.message;
    document.querySelector('.connection').textContent = '데이터·폰트 확인 필요';
    return;
  }

  function duration() { return state.scene === 'race' ? config.durations[state.stage] : state.scene === 'winner' ? 7 : 0; }
  function atEnd() { return state.time >= duration() - .001; }
  function canTick() { return ready && state.playing && !isAudience; }
  function startAudio() {
    if (!state.sound || isAudience) return;
    try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume().catch(() => {}); } catch (_) { toast('이 환경에서는 효과음을 재생할 수 없습니다.'); state.sound = false; }
  }
  function tone(kind) {
    if (!state.sound || !audio || audio.state !== 'running') return;
    const notes = kind === 'winner' ? [523.25, 659.25, 783.99, 1046.5] : kind === 'change' ? [587.33, 783.99] : kind === 'end' ? [440, 554.37] : [330];
    notes.forEach((frequency, i) => {
      const oscillator = audio.createOscillator(), gain = audio.createGain(), at = audio.currentTime + i * .13;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(kind === 'winner' ? .08 : .045, at + .025); gain.gain.exponentialRampToValueAtTime(.001, at + .38);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(at); oscillator.stop(at + .4);
    });
  }
  function cue() {
    if (state.scene === 'opening') return ['OPENING', '모든 준비가 끝나면 O 부문을 시작하세요.', 'O 부문 시작'];
    if (state.scene === 'intro') return [`${state.house} · NOMINEES`, '후보 소개 후 첫 번째 사옥의 결과를 공개하세요.', '마곡 집계 공개'];
    if (state.scene === 'finale') return ['FINALE', 'OSCA 시상이 모두 끝났습니다. 함께한 여러분께 감사드립니다.', '오프닝으로 돌아가기'];
    if (state.scene === 'winner') {
      const next = config.order[config.order.indexOf(state.house) + 1];
      return [`${state.house} · WINNER`, '축하 화면을 유지합니다. 시상이 끝나면 다음 장면을 열어 주세요.', next ? `${next} 부문으로 이동` : '전체 수상 결과'];
    }
    if (!atEnd()) return [`${state.house} · ${engine.stages[state.stage].name.toUpperCase()}`, state.playing ? '집계 중입니다. 구간이 끝나면 자동으로 멈춥니다.' : '재생이 멈춰 있습니다. 준비되면 이어서 공개하세요.', state.playing ? '집계 진행 중' : '집계 이어서 재생'];
    const lines = [
      '마곡 결과입니다. 사회자 멘트 후 상암 집계를 더합니다.',
      '상암까지의 누적 결과입니다. 다음은 용산입니다.',
      '오프라인 집계가 끝났습니다. 이제 온라인 표를 시간순으로 더합니다.',
      '최종 집계가 끝났습니다. 사회자 멘트 후 수상 후보를 공개하세요.'
    ];
    return [`${state.house} · 공개 대기`, lines[state.stage], state.stage === 3 ? '수상 후보 공개' : `${engine.stages[state.stage + 1].name} 집계 공개`];
  }
  function send(force = false) {
    if (isAudience || ((!audience || audience.closed) && !audiencePulse)) return;
    const now = performance.now(); if (!force && now - lastSent < 30) return; lastSent = now;
    const message = { type: 'osca-state-v1', state: { ...state }, names: namesSnapshot() };
    if (audience && !audience.closed) audience.postMessage(message, '*');
    channel?.postMessage(message);
  }
  function announce(text) { $('announcement').textContent = text; }
  function updateUi() {
    const [label, message, action] = cue();
    $('cue-label').textContent = label; $('cue-text').textContent = message; $('next-button').textContent = action; $('next-button').disabled = !ready || state.playing;
    $('pause-button').disabled = !duration() || atEnd(); $('pause-button').textContent = state.playing ? '일시정지' : '이어 재생';
    $('previous-button').disabled = state.scene === 'opening';
    $('seek').disabled = state.scene !== 'race'; $('seek').value = duration() ? Math.round(state.time / duration() * 1000) : 0;
    const timeText = v => `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(Math.floor(v % 60)).padStart(2, '0')}`;
    $('elapsed').textContent = timeText(state.time); $('duration').textContent = timeText(duration());
    $('sound-button').textContent = state.sound ? '효과음 켜짐' : '효과음 꺼짐'; $('sound-button').setAttribute('aria-pressed', String(state.sound));
    document.querySelectorAll('[data-house]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.house === state.house && !['opening', 'finale'].includes(state.scene))));
    const newCue = label + message; if (lastCue !== newCue) { lastCue = newCue; announce(message); }
  }
  function render(forceUi = false) {
    const frame = renderer.render(state);
    if (state.scene === 'race' && frame) {
      if (state.playing && frame.change && lastChange !== frame.change.time) { if (frame.time - frame.change.time < .4) tone('change'); lastChange = frame.change.time; }
      const leader = frame.leaders.length === 1 ? frame.leaders[0] : null;
      if (leader !== lastLeader && leader !== null) { lastLeader = leader; announce(`${config.houses[state.house].candidates[leader].name}, 현재 선두`); }
      if (forceUi || !state.playing) $('stage').setAttribute('aria-label', `${state.house} 부문 ${engine.stages[state.stage].name} 집계. ${frame.values.map((n, i) => `${config.houses[state.house].candidates[i].name} ${n}표`).join(', ')}`);
    } else $('stage').setAttribute('aria-label', state.scene === 'winner' ? `${state.house} 부문 수상 후보 ${config.houses[state.house].candidates[engine.standings(state.house)[0].index].name}` : state.scene === 'intro' ? `${state.house} 부문 후보 소개` : state.scene === 'finale' ? 'OSCA 전체 수상 결과' : 'OSCA 시상식 시작 화면');
    if (forceUi || performance.now() - lastUi > 100) { lastUi = performance.now(); updateUi(); }
    send(forceUi);
  }
  function setScene(scene, extras = {}) {
    Object.assign(state, { scene, time: 0, playing: false }, extras);
    lastTick = performance.now(); lastLeader = null; lastChange = null;
    render(true);
  }
  function play() { if (!duration() || atEnd()) return; startAudio(); state.playing = true; lastTick = performance.now(); render(true); }
  function pause() { state.playing = false; render(true); }
  function next() {
    if (state.playing || !ready) return;
    startAudio();
    if (state.scene === 'opening') setScene('intro', { house: 'O', stage: 0 });
    else if (state.scene === 'intro') { setScene('race', { stage: 0, playing: true }); tone('start'); }
    else if (state.scene === 'race') {
      if (!atEnd()) play();
      else if (state.stage < 3) { setScene('race', { stage: state.stage + 1, playing: true }); tone('start'); }
      else { setScene('winner', { playing: true }); tone('winner'); }
    } else if (state.scene === 'winner') {
      const h = config.order[config.order.indexOf(state.house) + 1];
      if (h) setScene('intro', { house: h, stage: 0 }); else setScene('finale');
    } else setScene('opening', { house: 'O', stage: 0 });
  }
  function previous() {
    if (state.scene === 'opening') return;
    if (state.scene === 'intro') {
      const h = config.order[config.order.indexOf(state.house) - 1];
      if (h) setScene('winner', { house: h, time: 7 }); else setScene('opening');
    } else if (state.scene === 'race') {
      if (state.stage > 0) setScene('race', { stage: state.stage - 1, time: config.durations[state.stage - 1] }); else setScene('intro');
    } else if (state.scene === 'winner') setScene('race', { stage: 3, time: config.durations[3] });
    else setScene('winner', { house: 'A', time: 7 });
  }
  function tick(now) {
    const delta = Math.max(0, (now - lastTick) / 1000); lastTick = now;
    if (!canTick()) return;
    state.time = Math.min(duration(), state.time + delta * state.speed);
    if (atEnd()) { state.time = duration(); state.playing = false; if (state.scene === 'race') tone('end'); }
    render(!state.playing);
  }
  function loop(now) {
    if (isAudience) {
      const message = { type: 'osca-pulse-v1' };
      if (window.opener && !window.opener.closed) window.opener.postMessage(message, '*');
      else channel?.postMessage(message);
    }
    else tick(now);
    requestAnimationFrame(loop);
  }
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('screen-frame').requestFullscreen(); }
    catch (_) { toast('전체화면을 열 수 없습니다. 브라우저의 F11 키를 사용해 주세요.'); }
  }
  function confirm(title, copy, action) {
    pause(); confirmAction = action; $('confirm-title').textContent = title; $('confirm-copy').textContent = copy; $('confirm-dialog').showModal();
  }
  $('confirm-ok').onclick = () => { $('confirm-dialog').close(); confirmAction?.(); confirmAction = null; };
  $('confirm-cancel').onclick = () => { $('confirm-dialog').close(); confirmAction = null; };
  $('next-button').onclick = next; $('pause-button').onclick = () => state.playing ? pause() : play(); $('previous-button').onclick = previous;
  $('fullscreen-button').onclick = fullscreen; $('screen-exit').onclick = fullscreen;
  $('restart-button').onclick = () => confirm('처음부터 다시 시작할까요?', '오프닝으로 돌아갑니다. 입력한 후보 이름은 유지됩니다.', () => setScene('opening', { house: 'O', stage: 0 }));
  document.querySelectorAll('[data-house]').forEach(button => {
    button.onclick = () => {
      const h = button.dataset.house;
      if (state.scene === 'opening') setScene('intro', { house: h, stage: 0 });
      else confirm(`${h} 부문으로 이동할까요?`, '선택한 부문의 후보 소개 화면부터 다시 시작합니다.', () => setScene('intro', { house: h, stage: 0 }));
    };
  });
  $('speed').onchange = () => { state.speed = Number($('speed').value); render(true); };
  $('seek').oninput = () => { if (state.scene !== 'race') return; state.playing = false; state.time = Number($('seek').value) / 1000 * duration(); lastChange = null; render(true); };
  $('sound-button').onclick = () => { state.sound = !state.sound; startAudio(); updateUi(); if (state.sound) tone('start'); };
  $('guide-button').onclick = () => { pause(); $('guide-dialog').showModal(); };
  document.querySelectorAll('[data-close]').forEach(b => { b.onclick = () => $(b.dataset.close).close(); });
  $('names-button').onclick = () => {
    pause(); const fields = $('name-fields'); fields.replaceChildren();
    for (const h of config.order) {
      const section = document.createElement('section'); section.className = 'name-group'; const title = document.createElement('h2'); title.textContent = `${h} · ${config.houses[h].title}`; section.append(title);
      config.houses[h].candidates.forEach((c, i) => { const label = document.createElement('label'); const n = document.createElement('span'); n.textContent = `${i + 1}번`; const input = document.createElement('input'); input.name = `${h}-${i}`; input.value = c.name; input.required = true; input.maxLength = 30; label.append(n, input); section.append(label); }); fields.append(section);
    }
    $('names-dialog').showModal();
  };
  function readNames() {
    const fields = new FormData($('names-form'));
    return Object.fromEntries(config.order.map(h => [h, config.houses[h].candidates.map((_, i) => String(fields.get(`${h}-${i}`) || '').trim())]));
  }
  $('names-form').onsubmit = event => {
    event.preventDefault(); const names = readNames();
    if (Object.values(names).flat().some(n => !n)) { toast('후보 이름을 모두 입력해 주세요.'); return; }
    safeNames(names); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(names)); } catch (_) { toast('브라우저 저장이 제한되어 이번 실행에만 이름을 적용했습니다.'); }
    $('names-dialog').close(); render(true);
  };
  $('export-names').onclick = () => {
    const names = readNames(); if (Object.values(names).flat().some(n => !n)) { toast('후보 이름을 모두 입력해 주세요.'); return; }
    const exported = JSON.parse(JSON.stringify(config));
    for (const h of config.order) exported.houses[h].candidates.forEach((c, i) => { c.name = names[h][i]; });
    const blob = new Blob(['window.OSCA_CONFIG = ' + JSON.stringify(exported, null, 2) + ';\n'], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'config.js'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('다른 PC에서 사용하려면 저장한 config.js로 행사 폴더의 같은 파일을 교체하세요.');
  };
  $('audience-button').onclick = event => {
    event.preventDefault();
    if (audience && !audience.closed) { audience.focus(); send(true); return; }
    audience = window.open(screenUrl.href, 'OSCA_AUDIENCE', 'popup,width=1280,height=720');
    if (!audience) toast('송출 창이 차단되었습니다. 이 페이지의 팝업을 허용해 주세요.');
    else toast('송출 창을 행사장 모니터로 옮긴 뒤 F를 눌러 전체화면으로 전환하세요.');
  };
  function receive(message) {
    if (isAudience) {
      if (message?.type !== 'osca-state-v1') return;
      safeNames(message.names); Object.assign(state, message.state); renderer.render(state);
      $('stage').setAttribute('aria-label', `${state.house} 부문 · ${state.scene === 'race' ? engine.stages[state.stage].name + ' 집계' : state.scene === 'winner' ? '수상 후보' : 'OSCA 시상식'}`);
    } else {
      if (message?.type === 'osca-ready-v1') { audiencePulse = performance.now(); send(true); }
      if (message?.type === 'osca-pulse-v1') { audiencePulse = performance.now(); if (document.hidden) tick(performance.now()); }
      if (message?.type === 'osca-key-v1') handleKey(message.key);
    }
  }
  window.addEventListener('message', event => {
    if (event.source === (isAudience ? window.opener : audience) && event.source) receive(event.data);
  });
  if (channel) channel.onmessage = event => receive(event.data);
  function handleKey(key) {
    if (key === 'f' || key === 'F') { fullscreen(); return; }
    if (document.querySelector('dialog[open]')) return;
    if (key === 'ArrowRight' || key === 'PageDown' || key === 'Enter') next();
    else if (key === ' ') { if (state.playing) pause(); else if (duration() && !atEnd()) play(); else next(); }
    else if (key === 'ArrowLeft' || key === 'PageUp') previous();
    else if (key === '?') { pause(); $('guide-dialog').showModal(); }
  }
  document.addEventListener('keydown', event => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target.matches('input,select,textarea') || document.querySelector('dialog[open]')) return;
    if (![' ', 'Enter', 'ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', 'f', 'F', '?'].includes(event.key)) return;
    // Space always controls playback, including after clicking a button.
    // Enter retains native button activation to avoid a double action.
    if (event.target.matches('button') && event.key === 'Enter') return;
    event.preventDefault();
    if (isAudience && !['f', 'F'].includes(event.key)) {
      const message = { type: 'osca-key-v1', key: event.key };
      if (window.opener && !window.opener.closed) window.opener.postMessage(message, '*'); else channel?.postMessage(message);
    }
    else handleKey(event.key);
  });
  document.addEventListener('visibilitychange', () => {
    if (!isAudience && document.hidden && (!audience || audience.closed) && performance.now() - audiencePulse > 1500 && state.playing) pause();
    lastTick = performance.now();
  });
  window.addEventListener('beforeunload', () => { if (audience && !audience.closed) audience.close(); });

  // Deterministic frame API for local recording, QA, and the next MP4 phase.
  // It does not request or transmit data and uses the same rendering path.
  window.OSCAPlayback = {
    ready: true,
    getState: () => ({ ...state }),
    getTotals: () => Object.fromEntries(config.order.map(h => [h, engine.final(h)])),
    renderAt: (house, stage, seconds) => {
      if (!config.order.includes(house) || !Number.isInteger(stage) || stage < 0 || stage > 3 || !Number.isFinite(seconds)) throw new Error('Invalid frame request');
      setScene('race', { house, stage, time: Math.max(0, Math.min(config.durations[stage], seconds)) });
      return engine.sample(house, stage, state.time);
    },
    renderWinner: (house, seconds = 7) => { if (!config.order.includes(house)) throw new Error('Invalid house'); setScene('winner', { house, time: Math.max(0, Math.min(7, seconds)) }); },
    reset: () => setScene('opening', { house: 'O', stage: 0 })
  };
  render(true);
  if (isAudience) {
    if (window.opener && !window.opener.closed) window.opener.postMessage({ type: 'osca-ready-v1' }, '*');
    else if (new URLSearchParams(location.search).has('session') && channel) channel.postMessage({ type: 'osca-ready-v1' });
    else toast('운영 화면에서 ‘송출 창’을 눌러 열어 주세요.');
  }
  requestAnimationFrame(loop);
})();
