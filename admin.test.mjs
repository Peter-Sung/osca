// 관리자 인증·서버 쿠키·출처 검사·오류 응답의 보안 경계를 검증합니다.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { createAdminHandler } from "./supabase/functions/osca-admin/handler.mjs";
import { createAdminProxy } from "./admin-proxy.mjs";
const token = "a".repeat(64), expiresAt = "2050-01-01T00:00:00Z";
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const req = (data, headers = {}) => new Request("https://example.test/admin", {
  method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(data) });
const handler = (fetchImpl) => createAdminHandler({ url: "https://db.test", secretKey: "sb_secret_test", fetchImpl });
async function withProxy(fetchImpl, callback) {
  const proxy = createAdminProxy({ endpoint: "https://edge.test/admin", fetchImpl });
  const server = createServer(proxy);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try { await callback(url); }
  finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
}
const post = (url, action, body = {}, headers = {}) => fetch(`${url}/wic_admin/api/${action}`, {
  method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
test("관리자 세션 없이 대시보드·검색·삭제·로그아웃은 DB에 전달되지 않는다", async () => {
  const run = handler(() => { throw new Error("unexpected RPC"); });
  for (const action of ["dashboard", "session", "users", "logout"]) assert.equal((await run(req({ action }))).status, 401);
  assert.equal((await run(req({ action: "delete", userId: "00000000-0000-4000-8000-000000000001", expected: {} }))).status, 401);
});
test("브라우저 직접 호출과 잘못된 입력을 서버에서 차단한다", async () => {
  const run = handler(() => { throw new Error("unexpected RPC"); });
  assert.equal((await run(req({ action: "login", password: "test-pass" }, { Origin: "https://evil.test" }))).status, 403);
  assert.equal((await run(req({ action: "login", password: "x".repeat(65) }))).status, 400);
  assert.equal((await run(req({ action: "delete", userId: "bad", expected: {} }))).status, 400);
  assert.equal((await run(req({ action: "users", page: 0 }))).status, 400);
});
test("로그인 토큰은 무작위로 발급하고 DB에는 SHA-256 해시만 전달한다", async () => {
  let stored;
  const run = handler((url, options) => {
    assert.match(url, /osca_admin_login$/); stored = JSON.parse(options.body);
    assert.equal(options.headers.apikey, "sb_secret_test"); assert.equal(options.headers.Authorization, undefined);
    return json({ status: "ok", expiresAt });
  });
  const data = await (await run(req({ action: "login", password: "test-pass" }))).json();
  assert.match(data.token, /^[0-9a-f]{64}$/);
  assert.equal(stored.p_token_hash, createHash("sha256").update(data.token).digest("hex"));
  assert.equal(stored.p_password, "test-pass");
});
test("유효한 관리자 토큰도 DB 만료 검사와 삭제 대상 스냅샷 확인을 통과해야 한다", async () => {
  const expected = { O: { candidate: 2, votedAt: "2026-10-04T00:00:00+00:00" } };
  const run = handler((_, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.p_token_hash, createHash("sha256").update(token).digest("hex"));
    assert.deepEqual(body.p_expected, expected); return json({ status: "conflict" });
  });
  const response = await run(req({ action: "delete", userId: "00000000-0000-4000-8000-000000000001", expected }, { Authorization: `Bearer ${token}` }));
  assert.equal(response.status, 409); assert.match((await response.json()).message, /변경/);
});
test("로그인 시도 제한과 DB 오류는 내부 정보 없이 전달한다", async () => {
  assert.equal((await handler(() => json({ status: "limited" }))(req({ action: "login", password: "test-pass" }))).status, 429);
  const response = await handler(() => json({ secret: "private" }, 500))(req({ action: "login", password: "test-pass" }));
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private/);
});
test("중계 서버는 비인증 요청·다른 출처·JSON 이외 요청을 전달하지 않는다", async () => {
  await withProxy(() => { throw new Error("unexpected upstream"); }, async (url) => {
    assert.equal((await post(url, "dashboard")).status, 401);
    assert.equal((await post(url, "login", {}, { Origin: "https://evil.test" })).status, 403);
    assert.equal((await post(url, "login", {}, { "Content-Type": "text/plain" })).status, 415);
  });
});
test("관리자 로그인 토큰은 HttpOnly 쿠키로만 보관하고 브라우저 JSON에는 노출하지 않는다", async () => {
  await withProxy(() => json({ token, expiresAt }), async (url) => {
    const response = await post(url, "login", { password: "test-pass" });
    const cookie = response.headers.get("set-cookie");
    assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/); assert.match(cookie, /Path=\/wic_admin/);
    assert.deepEqual(await response.json(), { expiresAt });
    const secure = await post(url, "login", {}, { "x-forwarded-proto": "https" });
    assert.match(secure.headers.get("set-cookie"), /; Secure/);
  });
});
test("삭제의 액션은 URL로 확정하고 쿠키 토큰은 서버 Authorization으로 전달한다", async () => {
  await withProxy((_, options) => {
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.equal(JSON.parse(options.body).action, "delete"); return json({ data: { deleted: 1 } });
  }, async (url) => {
    assert.equal((await post(url, "delete", { action: "login" }, { Cookie: `osca_admin_session=${token}` })).status, 200);
  });
});
test("만료와 로그아웃에는 관리자 쿠키를 삭제한다", async () => {
  await withProxy(() => json({ message: "expired" }, 401), async (url) => {
    const response = await post(url, "dashboard", {}, { Cookie: `osca_admin_session=${token}` });
    assert.equal(response.status, 401); assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
  });
});
test("Vercel의 파싱된 본문에서도 HTTPS 로그인 쿠키와 액션 검증을 유지한다", async () => {
  for (const body of [{ password: "테스트" }, '{"password":"테스트"}', Buffer.from('{"password":"테스트"}')]) {
    const proxy = createAdminProxy({ endpoint: "https://edge.test/admin", fetchImpl: (_, options) => {
      assert.deepEqual(JSON.parse(options.body), { password: "테스트", action: "login" });
      return json({ token, expiresAt });
    } });
    let status, headers, data;
    await proxy({ url: "/api/wic_admin/login", method: "POST", socket: {}, body,
      headers: { "content-type": "application/json", host: "osca.example", origin: "https://osca.example", "x-forwarded-proto": "https" } },
    { writeHead: (code, value) => { status = code; headers = value; }, end: (value) => { data = JSON.parse(value); } });
    assert.equal(status, 200); assert.match(headers["Set-Cookie"], /HttpOnly; SameSite=Strict; Secure/);
    assert.deepEqual(data, { expiresAt });
  }
});
test("Vercel의 파싱된 본문에도 크기·JSON 객체 제한을 적용한다", async () => {
  const proxy = createAdminProxy({ endpoint: "https://edge.test/admin", fetchImpl: () => { throw new Error("unexpected upstream"); } });
  for (const [body, expected] of [[{ password: "한".repeat(3000) }, 413], [[], 400], [null, 400], ["broken", 400]]) {
    let status;
    await proxy({ url: "/api/wic_admin/login", method: "POST", socket: {}, body, headers: { "content-type": "application/json" } },
      { writeHead: (code) => { status = code; }, end: () => {} });
    assert.equal(status, expected);
  }
});
test("Vercel 함수의 직접 비인증 호출은 관리자 데이터에 접근할 수 없다", async () => {
  const { default: run } = await import("./api/wic_admin/[action].mjs");
  let status;
  await run({ url: "/api/wic_admin/dashboard", method: "POST", socket: {}, headers: { "content-type": "application/json" } },
    { writeHead: (code) => { status = code; }, end: () => {} });
  assert.equal(status, 401);
});
