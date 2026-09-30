// 임시 투표의 저장·중복 제한·이동 순서와 실패 처리를 검증합니다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const voteStore = require("./vote-store.js");

function memoryStorage(initial = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_, next) => { value = next; },
  };
}

test("방과 후보를 저장하고 새로 읽어도 유지한다", () => {
  const storage = memoryStorage();
  const { saved, votes } = voteStore.save(storage, "S", 4);
  assert.equal(saved, true);
  assert.equal(votes.S.candidate, 4);
  assert.ok(Number.isFinite(Date.parse(votes.S.votedAt)));
  assert.deepEqual(voteStore.read(storage), votes);
});

test("다른 후보로 재투표해도 최초 투표와 시간이 유지된다", () => {
  const storage = memoryStorage();
  const first = voteStore.save(storage, "O", 2);
  const duplicate = voteStore.save(storage, "O", 3);
  assert.equal(duplicate.saved, false);
  assert.deepEqual(duplicate.votes, first.votes);
  assert.deepEqual(voteStore.read(storage), first.votes);
});

test("A부터 투표해도 O→S→C→A 전체 순서에서 미투표 방을 찾는다", () => {
  const storage = memoryStorage();
  assert.equal(voteStore.nextHouse(voteStore.read(storage)), "O");
  for (const [house, expected] of [["A", "O"], ["O", "S"], ["S", "C"], ["C", undefined]]) {
    const { votes } = voteStore.save(storage, house, 1);
    assert.equal(voteStore.nextHouse(votes), expected);
  }
});

test("저장 실패를 성공으로 반환하지 않고 기존 투표를 보존한다", () => {
  const storage = memoryStorage();
  voteStore.save(storage, "C", 2);
  storage.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.throws(() => voteStore.save(storage, "O", 1), /QuotaExceededError/);
  assert.equal(voteStore.read(storage).O, undefined);
  assert.equal(voteStore.read(storage).C.candidate, 2);
});

test("알 수 없는 방과 범위 밖 후보는 저장하지 않는다", () => {
  const storage = memoryStorage();
  for (const [house, candidate] of [["X", 1], ["O", 4], ["S", 5], ["A", 0], ["C", 1.5]]) {
    assert.throws(() => voteStore.save(storage, house, candidate));
  }
  assert.deepEqual(voteStore.read(storage), {});
});

test("비정상 저장 후보는 제외하되 유효한 투표는 유지한다", () => {
  const storage = memoryStorage(JSON.stringify({ O: { candidate: 2 }, S: { candidate: 9 }, X: { candidate: 1 } }));
  assert.equal(voteStore.read(storage).O.candidate, 2);
  assert.equal(voteStore.read(storage).S, undefined);
  assert.equal(voteStore.read(storage).X, undefined);
});

test("손상되거나 접근이 차단된 저장소는 기존 데이터를 덮어쓰지 않는다", () => {
  for (const value of ["broken", "null", "[]"]) {
    const storage = memoryStorage(value);
    assert.throws(() => voteStore.save(storage, "O", 1));
    assert.equal(storage.getItem(), value);
  }
  assert.throws(() => voteStore.read({ getItem() { throw new Error("SecurityError"); } }), /SecurityError/);
});

test("초기화는 OSCA 투표만 지우며 이후 최초 투표를 다시 허용한다", () => {
  const data = new Map([["other-app", "유지할 데이터"]]);
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
  voteStore.save(storage, "O", 2);
  voteStore.save(storage, "S", 4);
  voteStore.reset(storage);
  assert.equal(data.get("other-app"), "유지할 데이터");
  assert.equal(data.has(voteStore.key), false);
  assert.deepEqual(voteStore.read(storage), {});
  assert.equal(voteStore.nextHouse(voteStore.read(storage)), "O");
  assert.equal(voteStore.save(storage, "O", 3).saved, true);
  assert.equal(voteStore.read(storage).O.candidate, 3);
});

test("초기화 실패 시 오류를 반환하고 기존 투표가 남는다", () => {
  const storage = memoryStorage();
  voteStore.save(storage, "A", 2);
  storage.removeItem = () => { throw new Error("SecurityError"); };
  assert.throws(() => voteStore.reset(storage), /SecurityError/);
  assert.equal(voteStore.read(storage).A.candidate, 2);
});
