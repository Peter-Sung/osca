// 비밀번호·관리자 세션을 검증한 요청만 조회와 삭제 RPC로 전달합니다.
const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))))
  .map((v) => v.toString(16).padStart(2, "0")).join("");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createAdminHandler({ url, secretKey, fetchImpl = fetch }) {
  const reply = (data, status = 200) => new Response(JSON.stringify(data), { status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  const rpc = async (name, body) => {
    const response = await fetchImpl(`${url}/rest/v1/rpc/${name}`, { method: "POST",
      headers: { "Content-Type": "application/json", apikey: secretKey,
        ...(secretKey.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${secretKey}` }) },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("DB failure");
    return response.json();
  };
  return async (request) => {
    // 브라우저가 직접 연결하지 않고 같은 출처의 중계 서버를 통하도록 제한합니다.
    if (request.headers.has("Origin")) return reply({ message: "허용되지 않은 출처입니다." }, 403);
    if (request.method !== "POST") return reply({ message: "허용되지 않은 요청입니다." }, 405);
    let body;
    try {
      const raw = await request.text();
      if (raw.length > 8192) throw new Error();
      body = JSON.parse(raw);
      if (!body || typeof body !== "object" || Array.isArray(body)
        || !["login", "session", "dashboard", "users", "delete", "logout", "logout-user"].includes(body.action)) throw new Error();
      if (body.action === "logout-user" && !uuid.test(body.userId ?? "")) throw new Error();
      if (body.action === "login" && (typeof body.password !== "string" || !body.password
        || new TextEncoder().encode(body.password).length > 64)) throw new Error();
      if (body.action === "users" && (typeof (body.search ?? "") !== "string" || (body.search ?? "").length > 30
        || !Number.isInteger(body.page ?? 1) || (body.page ?? 1) < 1 || (body.page ?? 1) > 100000)) throw new Error();
      if (body.action === "delete" && (!uuid.test(body.userId ?? "") || ![null, "O", "S", "C", "A"].includes(body.house ?? null)
        || !body.expected || typeof body.expected !== "object" || Array.isArray(body.expected)
        || typeof (body.reason ?? "") !== "string" || (body.reason ?? "").length > 200)) throw new Error();
    } catch { return reply({ message: "입력한 내용을 다시 확인해 주세요." }, 400); }
    if (!url || !secretKey) return reply({ message: "관리자 연결을 준비하고 있습니다." }, 503);
    try {
      let token, result;
      if (body.action === "login") {
        token = Array.from(crypto.getRandomValues(new Uint8Array(32))).map((v) => v.toString(16).padStart(2, "0")).join("");
        result = await rpc("osca_admin_login", { p_password: body.password, p_token_hash: await hash(token) });
      } else {
        token = request.headers.get("Authorization")?.match(/^Bearer ([0-9a-f]{64})$/)?.[1];
        if (!token) return reply({ message: "관리자 로그인이 필요합니다." }, 401);
        result = body.action === "logout-user"
          ? await rpc("osca_admin_logout_user", { p_token_hash: await hash(token), p_user_id: body.userId })
          : await rpc("osca_admin_dispatch", { p_token_hash: await hash(token), p_action: body.action,
          p_search: (body.search ?? "").trim(), p_page: body.page ?? 1, p_user_id: body.userId ?? null,
          p_house: body.house ?? null, p_expected: body.expected ?? null, p_reason: (body.reason ?? "").trim() });
      }
      const errors = { unauthorized: [401, "비밀번호가 맞지 않거나 관리자 로그인이 만료되었습니다."],
        limited: [429, "로그인 시도가 많습니다. 5분 후 다시 시도해 주세요."],
        unconfigured: [503, "관리자 연결을 준비하고 있습니다."], invalid: [400, "입력한 내용을 다시 확인해 주세요."],
        missing: [404, "사용자를 찾을 수 없습니다. 목록을 새로고침해 주세요."],
        conflict: [409, "투표 내역이 변경되었습니다. 새로고침 후 다시 확인해 주세요."],
        empty: [409, "삭제할 투표가 없습니다. 목록을 새로고침해 주세요."] };
      if (result.status !== "ok") {
        const [status, message] = errors[result.status] || [503, "요청을 처리하지 못했습니다. 다시 시도해 주세요."];
        return reply({ message }, status);
      }
      return reply(body.action === "login" ? { token, expiresAt: result.expiresAt } : { data: result.data, expiresAt: result.expiresAt });
    } catch { return reply({ message: "연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요." }, 503); }
  };
}
