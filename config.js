// 브라우저에는 공개 투표 API 주소만 제공하며 Supabase 비밀 키를 포함하지 않습니다.
window.OSCA_CONFIG = {
  apiUrl: "https://cisfvzotckftsyqodxud.supabase.co/functions/v1/osca-api",
  // 운영 DB·Edge Functions 배포가 승인되어 완료된 뒤 true로 전환합니다.
  votingControlEnabled: false,
};
