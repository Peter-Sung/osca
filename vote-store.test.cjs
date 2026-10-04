// 입력 규칙과 DB 기준 로그인·투표·저장 실패 및 재시도 동작을 검증합니다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const store = require("./vote-store.js");
const user = { id: "11111111-1111-4111-8111-111111111111", phone: "01000009901", nickname: "검증계정" };
const record = { candidate: 2, votedAt: "2026-10-04T00:00:00Z" };
const found = (votes = {}) => ({ status: "found", user, votes });
const missing = { status: "missing", user: null, votes: {} };
const json = (data, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status }));
function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
}
const makeClient = (storage, fetchImpl) => store.createClient({ endpoint: "https://api.example.test", storage, fetchImpl });

test("전화번호 표기 정리와 닉네임 6자·선택·문자 제한", () => {
  assert.deepEqual(store.validateIdentity({ phone: "010 0000-9901", nickname: " 홍길동ABC " }), { phone: user.phone, nickname: "홍길동ABC" });
  assert.equal(store.validateIdentity({ phone: user.phone, nickname: "  " }).nickname, null);
  for (const phone of ["01100009901", "0100000990", "010000099011", "010A0009901", ""]) assert.throws(() => store.validateIdentity({ phone }));
  for (const nickname of ["ABCDEFG", "홍 길동", "이름!", "😀"]) assert.throws(() => store.validateIdentity({ phone: user.phone, nickname }));
});
test("하우스별 후보 범위와 다음 미투표 순서", () => {
  assert.equal(store.validVote("S", 4), true);
  for (const [h, c] of [["O", 4], ["A", 4], ["X", 1], ["C", 0], ["S", 1.5]]) assert.equal(store.validVote(h, c), false);
  const votes = { A: record };
  assert.equal(store.nextHouse(votes), "O");
  for (const [h, next] of [["O", "S"], ["S", "C"], ["C", undefined]]) { votes[h] = record; assert.equal(store.nextHouse(votes), next); }
});
test("로컬 사용자 없이 진입하면 기존 임시 투표만 폐기하고 DB 조회하지 않는다", async () => {
  const storage = memoryStorage({ [store.legacyKey]: JSON.stringify({ O: record }), other: "유지" });
  const client = makeClient(storage, () => { throw new Error("unexpected fetch"); });
  await client.restore();
  assert.equal(client.state.status, "guest");
  assert.deepEqual(client.state.votes, {});
  assert.equal(storage.data.has(store.legacyKey), false);
  assert.equal(storage.data.get("other"), "유지");
});
test("자동로그인은 전화번호만 비교하고 DB 닉네임과 투표를 복원한다", async () => {
  const storage = memoryStorage({ [store.key]: JSON.stringify({ ...user, nickname: "손상된 닉네임 정보" }) });
  const client = makeClient(storage, (_, options) => {
    assert.equal(JSON.parse(options.body).phone, user.phone);
    return json(found({ O: record }));
  });
  await client.restore();
  assert.equal(client.state.user.nickname, user.nickname);
  assert.equal(client.state.votes.O.candidate, 2);
  assert.deepEqual(JSON.parse(storage.getItem(store.key)), user);
  assert.equal(storage.data.size, 1);
});
test("DB 조회 실패는 로컬 정보를 유지하고 미확인 상태에서 재시도할 수 있다", async () => {
  const raw = JSON.stringify(user), storage = memoryStorage({ [store.key]: raw });
  let fail = true;
  const client = makeClient(storage, () => fail ? Promise.reject(new TypeError("offline")) : json(found()));
  await assert.rejects(client.restore(), /잠시 후/);
  assert.equal(storage.getItem(store.key), raw);
  assert.equal(client.state.status, "error");
  fail = false;
  await client.restore();
  assert.equal(client.state.status, "ready");
});
test("DB 조회 성공 후 사용자가 없으면 앱의 로컬 사용자만 삭제한다", async () => {
  const storage = memoryStorage({ [store.key]: JSON.stringify(user), other: "유지" });
  const client = makeClient(storage, () => json(missing));
  await client.restore();
  assert.equal(client.state.status, "guest");
  assert.equal(storage.getItem(store.key), null);
  assert.equal(storage.getItem("other"), "유지");
});
test("DB 응답을 해석할 수 없으면 친절한 재시도 안내와 로컬 정보를 유지한다", async () => {
  const raw = JSON.stringify(user), storage = memoryStorage({ [store.key]: raw });
  const client = makeClient(storage, () => new Response("<html>upstream failure</html>"));
  await assert.rejects(client.restore(), /잠시 후 다시 시도/);
  assert.equal(storage.getItem(store.key), raw);
  assert.equal(client.state.status, "error");
});
test("첫 투표의 신규 사용자 조회만으로 가입하거나 로그인 정보를 저장하지 않는다", async () => {
  const storage = memoryStorage();
  const client = makeClient(storage, () => json(missing));
  await client.lookup(user);
  assert.equal(client.state.user, null);
  assert.equal(storage.data.size, 0);
});
test("메인 가입 후 로컬에는 DB의 사용자만 저장하고 투표는 저장하지 않는다", async () => {
  const storage = memoryStorage();
  const client = makeClient(storage, () => json({ ...found(), status: "new" }));
  await client.login({ phone: user.phone, nickname: "새이름" });
  assert.deepEqual(JSON.parse(storage.getItem(store.key)), user);
  assert.deepEqual(client.state.votes, {});
});
test("최초 투표 성공은 사용자와 DB 결과를 반영하되 투표를 로컬에 남기지 않는다", async () => {
  const storage = memoryStorage();
  const client = makeClient(storage, (_, options) => {
    assert.equal(JSON.parse(options.body).userId, null);
    return json({ ...found({ O: record }), status: "saved" });
  });
  await client.vote({ phone: user.phone, nickname: user.nickname }, "O", 2);
  assert.equal(client.state.votes.O.candidate, 2);
  assert.equal(storage.data.size, 1);
  assert.equal(storage.getItem(store.legacyKey), null);
});
test("최초 투표 실패 후 조회에도 기록이 없으면 사용자와 투표를 성공 처리하지 않는다", async () => {
  const storage = memoryStorage();
  const client = makeClient(storage, (_, options) => JSON.parse(options.body).action === "vote"
    ? json({ message: "잠시 후 다시 시도해 주세요." }, 503) : json(missing));
  await assert.rejects(client.vote(user, "O", 2), /잠시 후/);
  assert.equal(client.state.user, null);
  assert.deepEqual(client.state.votes, {});
  assert.equal(storage.data.size, 0);
});
test("저장은 됐지만 응답이 끊기면 DB 재조회로 최초 투표를 복구한다", async () => {
  const storage = memoryStorage();
  const client = makeClient(storage, (_, options) => JSON.parse(options.body).action === "vote"
    ? Promise.reject(new TypeError("response lost")) : json(found({ C: record })));
  const result = await client.vote(user, "C", 1);
  assert.equal(result.recovered, true);
  assert.equal(result.status, "duplicate");
  assert.equal(client.state.votes.C.candidate, 2);
});
test("삭제된 사용자로 투표하면 새 사용자를 재생성하지 않고 로그인 정보를 정리한다", async () => {
  const storage = memoryStorage({ [store.key]: JSON.stringify(user) });
  const client = makeClient(storage, () => json(missing));
  const result = await client.vote(user, "O", 2);
  assert.equal(result.status, "missing");
  assert.equal(storage.getItem(store.key), null);
});
test("이전 자동로그인 응답이 새 로그인 결과를 덮어쓰지 않는다", async () => {
  const storage = memoryStorage({ [store.key]: JSON.stringify(user) });
  let finish;
  const second = { ...user, phone: "01000009902", nickname: "새계정" };
  const client = makeClient(storage, (_, options) => JSON.parse(options.body).action === "lookup"
    ? new Promise((resolve) => { finish = resolve; }) : json({ ...found(), user: second }));
  const restoring = client.restore();
  await client.login(second);
  finish(new Response(JSON.stringify(found())));
  await restoring;
  assert.equal(client.state.user.phone, second.phone);
});
test("로컬 저장이 제한돼도 DB 성공을 실패로 바꾸지 않고 현재 로그인은 유지한다", async () => {
  const storage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => {} };
  const client = makeClient(storage, () => json(found({ O: record })));
  await client.login(user);
  await client.restore();
  assert.equal(client.state.status, "ready");
  assert.match(client.state.storageWarning, /다음 방문/);
});
test("다른 전화번호나 잘못된 후보 결과를 받은 경우 로컬 사용자 정보를 유지한다", async () => {
  for (const data of [{ ...found(), user: { ...user, phone: "01000009902" } }, found({ O: { ...record, candidate: 4 } })]) {
    const raw = JSON.stringify(user), storage = memoryStorage({ [store.key]: raw });
    const client = makeClient(storage, () => json(data));
    await assert.rejects(client.restore());
    assert.equal(storage.getItem(store.key), raw);
    assert.equal(client.state.status, "error");
  }
});
