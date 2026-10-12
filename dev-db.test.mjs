// 모든 DB와 HTTP 요청은 메모리 PostgreSQL·127.0.0.1에서만 실행합니다.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { createDevelopmentDatabase, developmentPassword } from "./dev-db.mjs";
import { createDevelopmentServer } from "./dev-server.mjs";

test("개발 PostgreSQL에서 실제 마이그레이션과 투표·관리자·로그아웃 SQL을 검증한다", async t => {
  const db = await createDevelopmentDatabase();
  try {
    for (const name of ["voting-control", "admin", "user-logout"]) {
      await t.test(`${name}: 권한·저장·롤백`, async () => {
        await db.exec(await readFile(new URL(`./supabase/tests/${name}.sql`, import.meta.url), "utf8"));
      });
    }
    const { rows: [state] } = await db.query(`select
      (select count(*)::integer from public.osca_users) as users,
      (select count(*)::integer from public.osca_votes) as votes,
      (select count(*)::integer from osca_admin.sessions) as sessions,
      (select enabled from osca_admin.voting_settings where singleton) as enabled`);
    assert.deepEqual(state, { users: 0, votes: 0, sessions: 0, enabled: false });
  } finally { await db.close(); }
});

test("개발 HTTP에서 실제 인증·중계·DB로 On 저장과 Off 거절을 검증한다", async () => {
  const { server, db } = await createDevelopmentServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, cookie) => fetch(base + path, { method: "POST",
    headers: { "Content-Type": "application/json", Origin: base, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body) });
  try {
    const productionWindow = {};
    runInNewContext(await readFile(new URL("./config.js", import.meta.url), "utf8"), { window: productionWindow });
    assert.equal(productionWindow.OSCA_CONFIG.votingControlEnabled, true);
    const config = await (await fetch(base + "/config.js")).text();
    assert.ok(config.includes('"votingControlEnabled":true')); assert.equal(config.includes("supabase.co"), false);
    assert.equal((await post("/wic_admin/api/set-voting", { enabled: true, messageKey: "paused" })).status, 401);
    const login = await post("/wic_admin/api/login", { password: developmentPassword });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    assert.ok(cookie.startsWith("osca_dev_admin_session="));
    assert.equal((await login.text()).includes("token"), false);
    let result = await post("/wic_admin/api/set-voting", { enabled: true, messageKey: "not-started" }, cookie);
    assert.equal(result.status, 200); assert.equal((await result.json()).data.enabled, true);
    const phone = "01000009602";
    result = await post("/api/dev-vote", { action: "vote", phone, house: "O", candidate: 2 });
    assert.equal(result.status, 200); const saved = await result.json(); assert.equal(saved.status, "saved");
    result = await post("/wic_admin/api/set-voting", { enabled: false, messageKey: "paused" }, cookie);
    assert.equal(result.status, 200); const paused = (await result.json()).data;
    assert.equal(paused.message, "운영자에 의해 투표가 종료 되었습니다.");
    result = await post("/api/dev-vote", { action: "vote", phone, house: "S", candidate: 1, userId: saved.user.id, loginVersion: 0 });
    assert.equal(result.status, 409); assert.equal((await result.json()).status, "closed");
    result = await post("/api/dev-vote", { action: "lookup", phone });
    assert.deepEqual(Object.keys((await result.json()).votes), ["O"]);
    result = await post("/api/dev-vote", { action: "voting-status" });
    assert.equal((await result.json()).messageKey, "paused");
    await db.exec("update osca_admin.sessions set expires_at=now()-interval '1 minute'");
    assert.equal((await post("/wic_admin/api/set-voting", { enabled: true, messageKey: "paused" }, cookie)).status, 401);
    assert.equal((await fetch(base + "/dev-db.mjs")).status, 404);
    assert.equal((await fetch(base + "/supabase/tests/voting-control.sql")).status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve)); await db.close();
  }
});
