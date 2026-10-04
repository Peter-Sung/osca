// Vercel에서 관리자 쿠키를 보호하며 기존 Supabase 관리자 API로 요청을 중계합니다.
import { createAdminProxy } from "../../admin-proxy.mjs";
export default createAdminProxy({ endpoint: "https://cisfvzotckftsyqodxud.supabase.co/functions/v1/osca-admin" });
