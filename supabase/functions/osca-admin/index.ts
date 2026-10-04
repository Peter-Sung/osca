// 서버 전용 키로 관리자 인증과 보호된 DB 작업을 실행합니다.
import { createAdminHandler } from "./handler.mjs";
const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
Deno.serve(createAdminHandler({ url: Deno.env.get("SUPABASE_URL"),
  secretKey: keys.default || Object.values(keys)[0] || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") }));
