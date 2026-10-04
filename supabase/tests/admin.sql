-- 관리자 인증·집계·검색·삭제·재투표·감사 실패의 원자성을 임시 트랜잭션 안에서 검증합니다.
begin;
update osca_admin.credentials set password_hash=extensions.crypt('temporary-admin-test',extensions.gen_salt('bf',12)) where singleton;
update osca_admin.login_guard set failures=0,blocked_until=null,window_start=now() where singleton;
set local role service_role;
do $$
declare
  r jsonb; base jsonb; v_user_id uuid; votes jsonb; i integer; j integer;
  houses text[]:=array['O','S','C','A'];
begin
  assert not exists(select 1 from public.osca_users where phone between '01000009800' and '01000009804'),'reserved test numbers must be unused';
  assert public.osca_admin_dispatch(repeat('f',64),'dashboard')->>'status'='unauthorized','anonymous admin access';
  for i in 1..5 loop
    assert public.osca_admin_login('wrong-password',repeat('b',64))->>'status'='unauthorized','invalid password';
  end loop;
  assert public.osca_admin_login('temporary-admin-test',repeat('b',64))->>'status'='limited','login limit';
  update osca_admin.login_guard set failures=0,blocked_until=null,window_start=now() where singleton;
  assert public.osca_admin_login('temporary-admin-test',repeat('b',64))->>'status'='ok','valid password';
  base:=public.osca_admin_dispatch(repeat('b',64),'dashboard')->'data';
  for i in 0..4 loop
    r:=public.osca_dispatch('login','0100000980'||i::text,'검증'||i::text);
    for j in 1..i loop
      r:=public.osca_dispatch('vote','0100000980'||i::text,null,houses[j],1,(r->'user'->>'id')::uuid);
    end loop;
  end loop;
  r:=public.osca_admin_dispatch(repeat('b',64),'dashboard')->'data';
  assert (r->>'registered')::integer=(base->>'registered')::integer+5,'registered count';
  assert (r->>'participants')::integer=(base->>'participants')::integer+4,'participants count';
  assert (r->>'completed')::integer=(base->>'completed')::integer+1,'completed count';
  assert (r->>'totalVotes')::integer=(base->>'totalVotes')::integer+10,'vote count';
  for i in 0..4 loop
    assert (r->'completion'->i->>'users')::integer=(base->'completion'->i->>'users')::integer+1,'completion bucket';
  end loop;
  assert jsonb_array_length(r->'candidates')=13,'all candidates including zero votes';
  for j in 1..4 loop
    assert (select (e->>'votes')::integer from jsonb_array_elements(r->'candidates') e where e->>'house'=houses[j] and e->>'candidate'='1')
      =(select (e->>'votes')::integer from jsonb_array_elements(base->'candidates') e where e->>'house'=houses[j] and e->>'candidate'='1')+5-j,'candidate counts';
  end loop;
  r:=public.osca_admin_dispatch(repeat('b',64),'users','9803',1)->'data';
  assert (r->>'total')::integer=1,'phone suffix search';
  v_user_id:=(r->'users'->0->'user'->>'id')::uuid; votes:=r->'users'->0->'votes';
  assert (public.osca_admin_dispatch(repeat('b',64),'users','검증3',1)->'data'->>'total')::integer=1,'nickname search';
  assert (public.osca_admin_dispatch(repeat('b',64),'users','%',1)->'data'->>'total')::integer=0,'literal search';
  assert public.osca_admin_dispatch(repeat('b',64),'delete','',1,v_user_id,'O','{}'::jsonb)->>'status'='conflict','stale deletion';
  r:=public.osca_admin_dispatch(repeat('b',64),'delete','',1,v_user_id,'O',jsonb_build_object('O',votes->'O'),'test house delete');
  assert r->>'status'='ok' and (r->'data'->>'deleted')::integer=1,'house deletion';
  assert r->'data'->'snapshot'->'votes'->'S' is not null,'other house retained';
  r:=public.osca_dispatch('vote','01000009803',null,'O',3,v_user_id);
  assert r->>'status'='saved' and (r->'votes'->'O'->>'candidate')::integer=3,'revote allowed';
  r:=public.osca_admin_dispatch(repeat('b',64),'delete','',1,v_user_id,null,r->'votes','test all delete');
  assert r->>'status'='ok' and (r->'data'->>'deleted')::integer=3,'all deletion';
  assert r->'data'->'snapshot'->'user'->>'id'=v_user_id::text,'user retained';
  assert r->'data'->'snapshot'->'votes'='{}'::jsonb,'votes empty';
  assert (select count(*) from osca_admin.delete_audit where user_id=v_user_id)=2,'audit recorded';
  insert into osca_admin.sessions(token_hash,expires_at) values(repeat('c',64),now()-interval '1 minute');
  assert public.osca_admin_dispatch(repeat('c',64),'dashboard')->>'status'='unauthorized','expiry checked';
  assert not has_function_privilege('anon','public.osca_admin_login(text,text)','execute'),'public login RPC blocked';
  assert not has_function_privilege('authenticated','public.osca_admin_dispatch(text,text,text,integer,uuid,text,jsonb,text)','execute'),'public admin RPC blocked';
  assert public.osca_admin_dispatch(repeat('b',64),'logout')->>'status'='ok','logout';
  assert public.osca_admin_dispatch(repeat('b',64),'dashboard')->>'status'='unauthorized','logout revocation';
end;
$$ language plpgsql;
rollback;

begin;
revoke insert on osca_admin.delete_audit from service_role;
set local role service_role;
do $$
declare r jsonb; v_id uuid; failed boolean:=false;
begin
  assert not exists(select 1 from public.osca_users where phone='01000009899'),'reserved test number must be unused';
  insert into osca_admin.sessions(token_hash,expires_at) values(repeat('d',64),now()+interval '1 minute');
  r:=public.osca_dispatch('vote','01000009899','원자검증','O',2);
  v_id:=(r->'user'->>'id')::uuid;
  begin
    perform public.osca_admin_dispatch(repeat('d',64),'delete','',1,v_id,null,r->'votes','audit failure');
  exception when insufficient_privilege then failed:=true;
  end;
  assert failed,'audit failure required';
  assert (public.osca_snapshot(v_id)->'votes'->'O'->>'candidate')::integer=2,'failed audit rolls back deletion';
end;
$$;
rollback;

begin;
set local role service_role;
do $$
declare first_page jsonb; second_page jsonb; i integer;
begin
  assert not exists(select 1 from public.osca_users where phone between '01000009700' and '01000009729'),'reserved pagination test numbers must be unused';
  insert into osca_admin.sessions(token_hash,expires_at) values(repeat('e',64),now()+interval '1 minute');
  for i in 0..29 loop
    perform public.osca_dispatch('login','010000097'||lpad(i::text,2,'0'),'분할검증');
  end loop;
  first_page:=public.osca_admin_dispatch(repeat('e',64),'users','분할검증',1)->'data';
  second_page:=public.osca_admin_dispatch(repeat('e',64),'users','분할검증',2)->'data';
  assert (first_page->>'total')::integer=30 and jsonb_array_length(first_page->'users')=25,'first page';
  assert jsonb_array_length(second_page->'users')=5,'second page';
  assert not exists(select 1 from jsonb_array_elements(first_page->'users') a
    join jsonb_array_elements(second_page->'users') b on a->'user'->>'id'=b->'user'->>'id'),'pagination has no overlap';
end;
$$;
rollback;
