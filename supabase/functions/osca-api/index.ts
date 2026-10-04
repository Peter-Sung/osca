// Supabase 비밀 키를 서버 안에서만 사용하여 전화번호 로그인 API를 실행합니다.
import { createHandler } from "./handler.mjs";

const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
Deno.serve(createHandler({
  url: Deno.env.get("SUPABASE_URL"),
  secretKey: keys.default || Object.values(keys)[0] || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
}));
