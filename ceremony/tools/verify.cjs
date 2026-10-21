const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['config.js', 'votes.js', 'engine.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox);
const config = JSON.parse(JSON.stringify(sandbox.window.OSCA_CONFIG));
const data = JSON.parse(JSON.stringify(sandbox.window.OSCA_VOTES));
const engine = sandbox.window.OSCAEngine.create(data, config);
const plain = value => JSON.parse(JSON.stringify(value));
const expected = { O: [820, 656, 434], S: [476, 491, 414, 525], C: [628, 653, 610], A: [685, 486, 712] };

test('valid candidates, exact final counts, excluded 12 votes and ceremony order', () => {
  assert.deepEqual(config.order, ['O', 'S', 'C', 'A']);
  assert.equal(engine.total, 7590);
  assert.equal(data.online.length, 1534);
  assert.equal(data.excluded.reduce((n, e) => n + e.votes, 0), 12);
  for (const h of config.order) assert.deepEqual(plain(engine.final(h)), expected[h]);
});
test('every frame is monotone, integer-valued, correctly ranked, and ends at exact source totals', () => {
  for (const h of config.order) {
    let previous = config.houses[h].candidates.map(() => 0);
    for (let s = 0; s < 4; s++) {
      const frames = engine.frames(h, s);
      for (const f of frames) {
        f.values.forEach((v, i) => { assert.ok(Number.isInteger(v) && v >= previous[i]); assert.equal(f.ranks[i], 1 + f.values.filter(x => x > v).length); });
        assert.equal(f.total, f.values.reduce((n, v) => n + v, 0));
        previous = plain(f.values);
      }
      assert.deepEqual(previous, s < 3 ? plain(engine.before(h, s + 1)) : expected[h]);
    }
  }
});
test('same online clock for all houses and chronological prefix counts at every frame', () => {
  for (let frameIndex = 0; frameIndex <= config.durations[3] * 60; frameIndex++) {
    let clock;
    for (const h of config.order) {
      const f = engine.frames(h, 3)[frameIndex];
      if (clock === undefined) clock = f.clock; else assert.equal(f.clock, clock);
      const expectedPrefix = plain(engine.before(h, 3));
      for (const g of engine.groups) if (g.u <= f.progress + 1e-10) for (const e of g.events) if (e.house === h) expectedPrefix[e.candidate - 1]++;
      assert.deepEqual(plain(f.values), expectedPrefix);
    }
  }
});
test('A reverses twice; O and S retain the unique lead after initial growth', () => {
  assert.deepEqual([0, 1, 2, 3].map(s => engine.sample('A', s, config.durations[s]).leaders[0] + 1), [3, 1, 3, 3]);
  for (const [h, winner] of [['O', 0], ['S', 3]]) for (let s = 0; s < 4; s++) for (const f of engine.frames(h, s)) if (f.leaders.length === 1) assert.equal(f.leaders[0], winner);
});
test('C online exposes 620:620 tie, then actual 621:620 reversal', () => {
  const frames = engine.frames('C', 3);
  const tie = frames.filter(f => f.values[0] === 620 && f.values[1] === 620);
  assert.ok(tie.length >= 60, 'The actual tie must remain readable for at least one second.');
  tie.forEach(f => assert.deepEqual(plain(f.leaders), [0, 1]));
  const reversal = frames.find(f => f.values[1] > f.values[0]);
  assert.deepEqual(plain(reversal.values), [620, 621, 593]);
  console.log('C tie screen time:', (tie.length / 60).toFixed(2), 'seconds; reversal at:', reversal.time.toFixed(2), 'seconds of 45');
});
test('no network URLs in runtime assets; all HTML/CSS dependencies are present locally', () => {
  const files = ['index.html', 'ceremony.css', 'config.js', 'votes.js', 'engine.js', 'render.js', 'player.js'];
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(!/https?:\/\//.test(source), file + ' uses a remote resource');
    for (const match of source.matchAll(/(?:src|href)=["']([^"']+)["']|url\(['"]?([^)'" ]+)/g)) {
      const relative = match[1] || match[2];
      if (relative.startsWith('#')) continue;
      assert.ok(fs.existsSync(path.join(root, relative.split('?')[0])), 'Missing ' + relative);
    }
  }
});
