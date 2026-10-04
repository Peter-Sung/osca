-- 임시 사용자와 관리자 세션으로 로그아웃·재로그인·투표 보존을 검사한 뒤 모두 롤백합니다.
begin;
do $$ begin
  assert not exists(select 1 from public.osca_users where phone in('01000009781','01000009782')),'reserved numbers must be unused';
  assert not exists(select 1 from osca_admin.sessions where token_hash=repeat('8',64)),'reserved session must be unused';
end $$;
set local role service_role;
insert into osca_admin.sessions(token_hash,expires_at) values(repeat('8',64),now()+interval '30 minutes');
do $$
declare r jsonb; u uuid; saved jsonb;
begin
  r:=public.osca_dispatch('login','01000009781','로그검증'); u:=(r->'user'->>'id')::uuid;
  assert (r->'user'->>'loginVersion')::integer=0,'initial version';
  r:=public.osca_dispatch('vote','01000009781',null,'O',2,u,0); saved:=r->'votes';
  perform public.osca_dispatch('login','01000009782','다른계정');
  assert public.osca_admin_logout_user(repeat('f',64),u)->>'status'='unauthorized','admin required';
  assert public.osca_admin_logout_user(repeat('8',64),null)->>'status'='invalid','user required';
  assert public.osca_admin_logout_user(repeat('8',64),gen_random_uuid())->>'status'='missing','missing user';
  assert public.osca_dispatch('restore','01000009781',null,null,null,null,0)->>'status'='found','legacy restore';
  assert public.osca_admin_logout_user(repeat('8',64),u)->>'status'='ok','logout';
  r:=public.osca_snapshot(u);
  assert r->'votes'=saved,'votes preserved';
  assert r->'user'->>'nickname'='로그검증','account preserved';
  assert (r->'user'->>'loginVersion')::integer=1,'version increased';
  assert public.osca_dispatch('restore','01000009781',null,null,null,null,0)->>'status'='logged-out','old browser blocked';
  assert public.osca_dispatch('restore','01000009781')->>'status'='logged-out','legacy browser blocked';
  assert public.osca_dispatch('vote','01000009781',null,'S',4,u,0)->>'status'='logged-out','old vote blocked';
  assert public.osca_snapshot(u)->'votes'=saved,'rejected vote unchanged';
  assert public.osca_dispatch('restore','01000009782')->>'status'='found','other user unaffected';
  r:=public.osca_dispatch('login','01000009781','다른이름');
  assert (r->'user'->>'loginVersion')::integer=1 and r->'votes'=saved,'manual login restored';
  assert r->'user'->>'nickname'='로그검증','nickname preserved';
  assert public.osca_dispatch('restore','01000009781',null,null,null,null,1)->>'status'='found','new browser accepted';
  assert public.osca_dispatch('vote','01000009781',null,'S',4,u,1)->>'status'='saved','new vote allowed';
  assert public.osca_admin_logout_user(repeat('8',64),u)->>'status'='ok','repeat logout';
  assert public.osca_dispatch('restore','01000009781',null,null,null,null,1)->>'status'='logged-out','new browser revoked again';
  update osca_admin.sessions set expires_at=now()-interval '1 second' where token_hash=repeat('8',64);
  assert public.osca_admin_logout_user(repeat('8',64),u)->>'status'='unauthorized','expired admin';
  assert not has_function_privilege('anon','public.osca_admin_logout_user(text,uuid)','execute'),'anonymous RPC blocked';
  assert not has_function_privilege('authenticated','public.osca_dispatch(text,text,text,text,integer,uuid,integer)','execute'),'direct RPC blocked';
  assert not has_column_privilege('anon','public.osca_users','login_version','update'),'public version update blocked';
end $$;
rollback;
select (select count(*) from public.osca_users where phone in('01000009781','01000009782')) as remaining_test_users,
       (select count(*) from osca_admin.sessions where token_hash=repeat('8',64)) as remaining_test_sessions;
