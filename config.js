// 브라우저에는 공개 투표 API 주소만 제공하며 Supabase 비밀 키를 포함하지 않습니다.
window.OSCA_CONFIG = {
  apiUrl: "https://cisfvzotckftsyqodxud.supabase.co/functions/v1/osca-api",
  // 운영 DB·API 배포 전에는 기존 투표 흐름을 유지합니다.
  votingControlEnabled: false,
};
