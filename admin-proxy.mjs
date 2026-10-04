// 관리자 토큰을 HttpOnly 쿠키 안에 보관하고 동일 출처 요청만 Supabase로 중계합니다.
const cookieName = "osca_admin_session";
export function createAdminProxy({ endpoint, fetchImpl = fetch }) {
  return async (request, response) => {
    const action = new URL(request.url, "http://localhost").pathname.split("/").at(-1);
    const send = (data, status = 200, cookie) => {
      response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff", ...(cookie ? { "Set-Cookie": cookie } : {}) });
      response.end(JSON.stringify(data));
    };
    const secure = request.socket.encrypted || request.headers["x-forwarded-proto"] === "https";
    const cookie = (value, age) => `${cookieName}=${value}; Path=/wic_admin; Max-Age=${age}; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
    if (request.method !== "POST" || !["login", "session", "dashboard", "users", "delete", "logout"].includes(action)) {
      send({ message: "허용되지 않은 요청입니다." }, 405); return;
    }
    if (!request.headers["content-type"]?.startsWith("application/json")) { send({ message: "허용되지 않은 요청입니다." }, 415); return; }
    if (request.headers.origin) {
      try {
        if (new URL(request.headers.origin).origin !== `${secure ? "https" : "http"}://${request.headers.host}`) throw new Error();
      } catch { send({ message: "허용되지 않은 출처입니다." }, 403); return; }
    }
    const token = request.headers.cookie?.split(/;\s*/).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (action !== "login" && !/^[0-9a-f]{64}$/.test(token ?? "")) { send({ message: "관리자 로그인이 필요합니다." }, 401); return; }
    let body;
    try {
      let size = 0; const chunks = [];
      for await (const chunk of request) { size += chunk.length; if (size <= 8192) chunks.push(chunk); }
      if (size > 8192) { send({ message: "요청 내용이 너무 큽니다." }, 413); return; }
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    } catch { send({ message: "입력한 내용을 다시 확인해 주세요." }, 400); return; }
    try {
      const upstream = await fetchImpl(endpoint, { method: "POST", headers: { "Content-Type": "application/json",
        ...(action === "login" ? {} : { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ ...body, action }), signal: AbortSignal.timeout(20000) });
      const data = await upstream.json();
      if (action === "login" && upstream.ok) {
        if (!/^[0-9a-f]{64}$/.test(data.token ?? "") || !Number.isFinite(Date.parse(data.expiresAt))) throw new Error();
        send({ expiresAt: data.expiresAt }, 200, cookie(data.token, 1800));
      } else {
        send(data, upstream.status, action === "logout" || upstream.status === 401 ? cookie("", 0) : undefined);
      }
    } catch { send({ message: "연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요." }, 503,
      action === "logout" ? cookie("", 0) : undefined); }
  };
}
