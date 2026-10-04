-- 관리자 세션 행 잠금에 필요한 만료 시각 열의 권한만 서버 역할에 부여합니다.
grant update(expires_at) on osca_admin.sessions to service_role;
