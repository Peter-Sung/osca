// 운영 프로젝트에 연결하지 않는 메모리 PostgreSQL 개발 DB입니다. 배포 빌드에 포함하지 않습니다.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile, readdir } from "node:fs/promises";

export const developmentPassword = "dev-admin-test";

export async function createDevelopmentDatabase() {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema extensions; create extension pgcrypto with schema extensions;
      grant usage on schema extensions to service_role;
    `);
    const directory = new URL("./supabase/migrations/", import.meta.url);
    for (const file of (await readdir(directory)).filter(name => name.endsWith(".sql")).sort()) {
      await db.exec(await readFile(new URL(file, directory), "utf8"));
    }
    await db.query("insert into osca_admin.credentials(password_hash) values(extensions.crypt($1,extensions.gen_salt('bf',12)))", [developmentPassword]);
    return db;
  } catch (error) { await db.close(); throw error; }
}

export function createDevelopmentRpc(db) {
  const signatures = {
    osca_dispatch: ["p_action", "p_phone", "p_nickname", "p_house", "p_candidate", "p_user_id", "p_login_version"],
    osca_voting_status: [],
    osca_admin_login: ["p_password", "p_token_hash"],
    osca_admin_voting: ["p_token_hash", "p_enabled", "p_message_key"],
    osca_admin_logout_user: ["p_token_hash", "p_user_id"],
    osca_admin_dispatch: ["p_token_hash", "p_action", "p_search", "p_page", "p_user_id", "p_house", "p_expected", "p_reason"],
  };
  return async (url, options) => {
    const name = new URL(url).pathname.split("/").at(-1);
    if (!Object.hasOwn(signatures, name)) throw new Error("Unknown development RPC");
    const body = JSON.parse(options.body);
    const values = signatures[name].map(key => key === "p_expected" && body[key] != null ? JSON.stringify(body[key]) : body[key] ?? null);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(",");
    try {
      // PGlite는 단일 연결이므로 역할 설정과 RPC를 같은 트랜잭션에서 실행합니다.
      const data = await db.transaction(async tx => {
        await tx.exec("set local role service_role");
        const result = await tx.query(`select public.${name}(${placeholders}) as data`, values);
        return result.rows[0].data;
      });
      return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    } catch (error) {
      console.error("Development RPC failed:", name, error.code);
      return new Response(JSON.stringify({ code: error.code || "dev_error" }), { status: 500 });
    }
  };
}
