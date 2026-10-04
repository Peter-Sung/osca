-- 관리자 비밀번호 해시·만료 세션·통계·검색·감사 로그를 서버 전용 권한으로 관리합니다.
create schema osca_admin;
revoke all on schema osca_admin from public, anon, authenticated;
grant usage on schema osca_admin to service_role;
create table osca_admin.credentials (
  singleton boolean primary key default true check(singleton), password_hash text not null
);
create table osca_admin.login_guard (
  singleton boolean primary key default true check(singleton), failures integer not null default 0,
  window_start timestamptz not null default now(), blocked_until timestamptz
);
insert into osca_admin.login_guard default values;
create table osca_admin.sessions (
  token_hash text primary key check(token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(), expires_at timestamptz not null
);
create index on osca_admin.sessions(expires_at);
create table osca_admin.delete_audit (
  id bigint generated always as identity primary key, created_at timestamptz not null default now(),
  session_fingerprint text not null, user_id uuid not null, phone_suffix text not null,
  house text, deleted_votes jsonb not null, reason text not null default ''
);
create index on osca_admin.delete_audit(created_at desc);
create index on public.osca_users(created_at desc, id);
alter table osca_admin.credentials enable row level security;
alter table osca_admin.login_guard enable row level security;
alter table osca_admin.sessions enable row level security;
alter table osca_admin.delete_audit enable row level security;
revoke all on all tables in schema osca_admin from public, anon, authenticated, service_role;
grant select on osca_admin.credentials to service_role;
grant select, update on osca_admin.login_guard to service_role;
grant select, insert, delete on osca_admin.sessions to service_role;
grant select, insert on osca_admin.delete_audit to service_role;
grant usage on sequence osca_admin.delete_audit_id_seq to service_role;
grant delete on public.osca_votes to service_role;

create function public.osca_admin_login(p_password text, p_token_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  g osca_admin.login_guard%rowtype; v_hash text; v_expires timestamptz;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status','invalid');
  end if;
  select * into g from osca_admin.login_guard where singleton for update;
  if g.blocked_until > now() then
    return jsonb_build_object('status','limited','retryAfter',ceil(extract(epoch from g.blocked_until-now())));
  end if;
  if g.window_start < now()-interval '5 minutes' then
    g.failures := 0;
    update osca_admin.login_guard set failures=0,window_start=now(),blocked_until=null where singleton;
  end if;
  select password_hash into v_hash from osca_admin.credentials where singleton;
  if v_hash is null then return jsonb_build_object('status','unconfigured'); end if;
  if p_password is null or octet_length(p_password)>64 or extensions.crypt(p_password,v_hash) <> v_hash then
    update osca_admin.login_guard set failures=g.failures+1,
      blocked_until=case when g.failures+1>=5 then now()+interval '5 minutes' else null end where singleton;
    return jsonb_build_object('status','unauthorized');
  end if;
  update osca_admin.login_guard set failures=0,window_start=now(),blocked_until=null where singleton;
  delete from osca_admin.sessions where expires_at<=now();
  v_expires := now()+interval '30 minutes';
  insert into osca_admin.sessions(token_hash,expires_at) values(p_token_hash,v_expires);
  return jsonb_build_object('status','ok','expiresAt',v_expires);
end;
$$;
revoke all on function public.osca_admin_login(text,text) from public,anon,authenticated;
grant execute on function public.osca_admin_login(text,text) to service_role;

create function public.osca_admin_dispatch(
  p_token_hash text,p_action text,p_search text default '',p_page integer default 1,
  p_user_id uuid default null,p_house text default null,p_expected jsonb default null,p_reason text default ''
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_expires timestamptz; v_data jsonb; v_user public.osca_users%rowtype;
  v_votes jsonb; v_deleted integer;
begin
  select expires_at into v_expires from osca_admin.sessions
    where token_hash=p_token_hash and expires_at>now() for share;
  if v_expires is null then return jsonb_build_object('status','unauthorized'); end if;
  if p_action='logout' then
    delete from osca_admin.sessions where token_hash=p_token_hash;
    return jsonb_build_object('status','ok');
  elsif p_action='session' then
    return jsonb_build_object('status','ok','expiresAt',v_expires);
  elsif p_action='dashboard' then
    with user_counts as (
      select u.id,count(v.house)::integer as n from public.osca_users u
      left join public.osca_votes v on v.user_id=u.id group by u.id
    ), completion as (
      select n,count(*) as users from user_counts group by n
    ), candidate_counts as (
      select house,candidate,count(*) as votes from public.osca_votes group by house,candidate
    ), candidates as (
      select h.house,c.candidate,coalesce(v.votes,0) as votes from (values('O'),('S'),('C'),('A')) h(house)
      cross join lateral generate_series(1,case when h.house='S' then 4 else 3 end) c(candidate)
      left join candidate_counts v using(house,candidate)
    ) select jsonb_build_object(
      'registered',(select count(*) from user_counts),'participants',(select count(*) from user_counts where n>0),
      'totalVotes',(select coalesce(sum(n),0) from user_counts),'completed',(select count(*) from user_counts where n=4),
      'completion',(select jsonb_agg(jsonb_build_object('count',x.n,'users',coalesce(c.users,0)) order by x.n)
                    from generate_series(0,4) x(n) left join completion c using(n)),
      'candidates',(select jsonb_agg(jsonb_build_object('house',house,'candidate',candidate,'votes',votes) order by house,candidate) from candidates)
    ) into v_data;
  elsif p_action='users' then
    if p_page is null or p_page<1 or p_page>100000 or p_search is null or char_length(p_search)>30 then
      return jsonb_build_object('status','invalid');
    end if;
    with matches as (
      select * from public.osca_users u where p_search=''
        or position(lower(p_search) in lower(coalesce(u.nickname,'')))>0
        or (p_search ~ '^[0-9]{1,11}$' and right(u.phone,char_length(p_search))=p_search)
    ), page_users as (
      select * from matches order by created_at desc,id offset (p_page-1)*25 limit 25
    ) select jsonb_build_object('total',(select count(*) from matches),'page',p_page,'pageSize',25,
      'users',coalesce((select jsonb_agg(public.osca_snapshot(u.id) || jsonb_build_object('createdAt',u.created_at) order by u.created_at desc,u.id) from page_users u),'[]'::jsonb)
    ) into v_data;
  elsif p_action='delete' then
    if p_user_id is null or (p_house is not null and p_house not in('O','S','C','A'))
      or p_expected is null or jsonb_typeof(p_expected)<>'object' or p_reason is null or char_length(p_reason)>200 then
      return jsonb_build_object('status','invalid');
    end if;
    select * into v_user from public.osca_users where id=p_user_id;
    if v_user.id is null then return jsonb_build_object('status','missing'); end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user.phone,0));
    select coalesce(jsonb_object_agg(house,jsonb_build_object('candidate',candidate,'votedAt',voted_at)),'{}'::jsonb)
      into v_votes from public.osca_votes where user_id=p_user_id and (p_house is null or house=p_house);
    if v_votes<>p_expected then return jsonb_build_object('status','conflict'); end if;
    if v_votes='{}'::jsonb then return jsonb_build_object('status','empty'); end if;
    delete from public.osca_votes where user_id=p_user_id and (p_house is null or house=p_house);
    get diagnostics v_deleted=row_count;
    insert into osca_admin.delete_audit(session_fingerprint,user_id,phone_suffix,house,deleted_votes,reason)
      values(left(p_token_hash,12),p_user_id,right(v_user.phone,4),p_house,v_votes,p_reason);
    v_data := jsonb_build_object('deleted',v_deleted,'snapshot',public.osca_snapshot(p_user_id));
  else return jsonb_build_object('status','invalid');
  end if;
  return jsonb_build_object('status','ok','data',v_data,'expiresAt',v_expires);
end;
$$;
revoke all on function public.osca_admin_dispatch(text,text,text,integer,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.osca_admin_dispatch(text,text,text,integer,uuid,text,jsonb,text) to service_role;
notify pgrst,'reload schema';
