// 전화번호에 해당하는 사용자와 투표만 다루는 전용 API를 처리합니다.
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export function createHandler({ url, secretKey, fetchImpl = fetch }) {
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
  return async (request) => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return reply({ message: "이 요청은 처리할 수 없습니다." }, 405);
    let body;
    try {
      const raw = await request.text();
      if (raw.length > 2048) throw new Error("body too large");
      body = JSON.parse(raw);
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid body");
      if (!['lookup', 'restore', 'login', 'vote'].includes(body.action)) throw new Error("invalid action");
      if (body.loginVersion != null && (!Number.isInteger(body.loginVersion) || body.loginVersion < 0 || body.loginVersion > 2147483647)) throw new Error("invalid login version");
      if (typeof body.phone !== "string") throw new Error("invalid phone");
      body.phone = body.phone.replace(/[-\s]/g, "");
      if (!/^010\d{8}$/.test(body.phone)) throw new Error("invalid phone");
      if (body.nickname != null && typeof body.nickname !== "string") throw new Error("invalid nickname");
      body.nickname = (body.nickname ?? "").trim().normalize("NFC") || null;
      if (body.nickname && !/^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]{1,6}$/.test(body.nickname)) throw new Error("invalid nickname");
      if (body.action === "vote" && (!['O', 'S', 'C', 'A'].includes(body.house) || !Number.isInteger(body.candidate)
          || body.candidate < 1 || body.candidate > (body.house === "S" ? 4 : 3))) throw new Error("invalid vote");
      if (body.userId != null && (typeof body.userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.userId))) throw new Error("invalid user");
    } catch {
      return reply({ message: "전화번호, 닉네임 또는 투표할 후보를 다시 확인해 주세요." }, 400);
    }
    if (!url || !secretKey) return reply({ message: "연결을 준비하고 있습니다. 잠시 후 다시 시도해 주세요." }, 503);
    try {
      const result = await fetchImpl(`${url}/rest/v1/rpc/osca_dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: secretKey,
          ...(secretKey.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${secretKey}` }) },
        body: JSON.stringify({ p_action: body.action, p_phone: body.phone, p_nickname: body.nickname,
          p_house: body.action === "vote" ? body.house : null,
          p_candidate: body.action === "vote" ? body.candidate : null,
          p_user_id: body.action === "vote" ? body.userId ?? null : null,
          p_login_version: ['restore', 'vote'].includes(body.action) ? body.loginVersion ?? 0 : null }),
        signal: AbortSignal.timeout(10000),
      });
      if (!result.ok) {
        const error = await result.json().catch(() => ({}));
        console.error("OSCA DB 요청 실패", result.status, error.code ?? "unknown");
        return reply({ message: "저장하거나 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }, 503);
      }
      return reply(await result.json());
    } catch {
      return reply({ message: "연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요." }, 503);
    }
  };
}
