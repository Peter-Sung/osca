// 전용 API의 입력 차단·비밀 키 사용·실패 응답과 CORS를 검증합니다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "./supabase/functions/osca-api/handler.mjs";
const request = (body, method = "POST") => new Request("https://api.example.test", {
  method, ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
});
test("잘못된 입력은 DB에 전달하지 않는다", async () => {
  const handler = createHandler({ url: "https://db.example.test", secretKey: "sb_secret_test", fetchImpl: () => { throw new Error("unexpected DB call"); } });
  const valid = { action: "vote", phone: "01000009901", house: "O", candidate: 2 };
  for (const body of [null, [], { ...valid, phone: "01100009901" }, { ...valid, nickname: "특수!" }, { ...valid, nickname: "ABCDEFG" }, { ...valid, candidate: 4 }, { ...valid, userId: "sql injection" }, { ...valid, action: "delete" }]) {
    assert.equal((await handler(request(body))).status, 400);
  }
});
test("전화번호와 닉네임을 정리하고 새 비밀 키는 apikey 헤더에만 둔다", async () => {
  let called = false;
  const handler = createHandler({ url: "https://db.example.test", secretKey: "sb_secret_test", fetchImpl: async (url, options) => {
    called = true;
    assert.equal(url, "https://db.example.test/rest/v1/rpc/osca_dispatch");
    assert.equal(options.headers.apikey, "sb_secret_test");
    assert.equal(options.headers.Authorization, undefined);
    const body = JSON.parse(options.body);
    assert.equal(body.p_phone, "01000009901");
    assert.equal(body.p_nickname, "홍길동ABC");
    assert.equal(body.p_user_id, null);
    return new Response(JSON.stringify({ status: "missing", user: null, votes: {} }));
  } });
  const response = await handler(request({ action: "lookup", phone: "010 0000-9901", nickname: " 홍길동ABC " }));
  assert.equal(response.status, 200);
  assert.equal(called, true);
  assert.equal(JSON.stringify(await response.json()).includes("sb_secret"), false);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});
test("브라우저 사전 요청과 잘못된 메서드를 처리한다", async () => {
  const handler = createHandler({});
  const options = await handler(request(null, "OPTIONS"));
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal((await handler(request(null, "GET"))).status, 405);
});
test("연결 준비 전에는 저장 성공 대신 재시도 안내를 제공한다", async () => {
  const response = await createHandler({})(request({ action: "login", phone: "01000009901" }));
  assert.equal(response.status, 503);
  assert.match((await response.json()).message, /잠시 후/);
});
test("DB 내부 오류 내용은 노출하지 않고 친절한 실패 안내를 제공한다", async () => {
  const handler = createHandler({ url: "https://db.example.test", secretKey: "sb_secret_test", fetchImpl: async () => new Response(JSON.stringify({ code: "42501", message: "private details" }), { status: 403 }) });
  const response = await handler(request({ action: "login", phone: "01000009901" }));
  assert.equal(response.status, 503);
  const body = await response.text();
  assert.match(body, /잠시 후/);
  assert.equal(body.includes("private details"), false);
});
test("네트워크 예외를 저장 실패로 전달한다", async () => {
  const handler = createHandler({ url: "https://db.example.test", secretKey: "sb_secret_test", fetchImpl: async () => { throw new TypeError("offline"); } });
  assert.equal((await handler(request({ action: "vote", phone: "01000009901", house: "S", candidate: 4 }))).status, 503);
});
