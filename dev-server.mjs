// 개발 전용 메모리 DB와 실제 화면·Node 중계·Edge 처리 코드를 같은 로컬 서버에서 테스트합니다.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createPreviewServer } from "./server.mjs";
import { createAdminProxy } from "./admin-proxy.mjs";
import { createHandler } from "./supabase/functions/osca-api/handler.mjs";
import { createAdminHandler } from "./supabase/functions/osca-admin/handler.mjs";
import { createDevelopmentDatabase, createDevelopmentRpc, developmentPassword } from "./dev-db.mjs";

export async function createDevelopmentServer() {
  const db = await createDevelopmentDatabase();
  const options = { url: "http://development.invalid", secretKey: "sb_secret_development", fetchImpl: createDevelopmentRpc(db) };
  const publicHandler = createHandler(options), adminHandler = createAdminHandler(options);
  const adminProxy = createAdminProxy({ endpoint: "http://development.invalid/osca-admin",
    fetchImpl: (url, init) => adminHandler(new Request(url, init)) });
  const server = createPreviewServer({ adminProxy,
    config: { apiUrl: "/api/dev-vote", votingControlEnabled: true },
    voteHandler: async (request, response) => {
      try {
        let body = "";
        for await (const chunk of request) {
          body += chunk;
          if (body.length > 2048) { response.writeHead(413).end(); return; }
        }
        const reply = await publicHandler(new Request("http://development.invalid/osca-api", {
          method: request.method, ...(["GET", "HEAD"].includes(request.method) ? {} : { body }),
        }));
        response.writeHead(reply.status, Object.fromEntries(reply.headers));
        response.end(await reply.text());
      } catch { response.writeHead(503).end(); }
    },
  });
  return { server, db };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const { server, db } = await createDevelopmentServer();
  server.listen(5174, "127.0.0.1", () => {
    console.log("격리된 개발 서버: http://127.0.0.1:5174 · 관리자: /wic_admin");
    console.log(`개발 전용 관리자 비밀번호: ${developmentPassword} (운영 비밀번호와 무관)`);
  });
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
    server.closeAllConnections(); server.close(async () => { await db.close(); process.exit(0); });
  });
}
