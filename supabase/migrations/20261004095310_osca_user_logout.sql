-- 관리자 로그아웃으로 이전 자동로그인 버전을 해제하고 계정·투표를 보존합니다.
alter table public.osca_users add column login_version integer not null default 0 check(login_version>=0);
grant update(login_version) on public.osca_users to service_role;

create or replace function public.osca_snapshot(p_user_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select jsonb_build_object(
    'user',(select jsonb_build_object('id',u.id,'phone',u.phone,'nickname',u.nickname,'loginVersion',u.login_version)
            from public.osca_users u where u.id=p_user_id),
    'votes',coalesce((select jsonb_object_agg(v.house,jsonb_build_object('candidate',v.candidate,'votedAt',v.voted_at))
                     from public.osca_votes v where v.user_id=p_user_id),'{}'::jsonb)
  );
$$;

alter function public.osca_dispatch(text,text,text,text,integer,uuid) rename to osca_dispatch_base;
create function public.osca_dispatch(
  p_action text,p_phone text,p_nickname text default null,p_house text default null,
  p_candidate integer default null,p_user_id uuid default null,p_login_version integer default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_phone text:=regexp_replace(coalesce(p_phone,''),'[-[:space:]]','','g');
  v_user public.osca_users%rowtype;
begin
  if v_phone !~ '^010[0-9]{8}$' or p_login_version<0 then
    raise exception using errcode='22023',message='invalid request';
  end if;
  -- 로그인 복원·투표·관리자 로그아웃을 같은 전화번호 잠금으로 직렬화합니다.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_phone,0));
  select * into v_user from public.osca_users where phone=v_phone;
  if v_user.id is not null and (p_action='restore' or (p_action='vote' and p_user_id is not null))
      and v_user.login_version<>coalesce(p_login_version,0) then
    return public.osca_snapshot(null) || jsonb_build_object('status','logged-out');
  end if;
  return public.osca_dispatch_base(case when p_action='restore' then 'lookup' else p_action end,
    v_phone,p_nickname,p_house,p_candidate,p_user_id);
end;
$$;
revoke all on function public.osca_dispatch(text,text,text,text,integer,uuid,integer) from public,anon,authenticated;
grant execute on function public.osca_dispatch(text,text,text,text,integer,uuid,integer) to service_role;

create function public.osca_admin_logout_user(p_token_hash text,p_user_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_expires timestamptz; v_phone text;
begin
  select expires_at into v_expires from osca_admin.sessions
    where token_hash=p_token_hash and expires_at>now() for share;
  if v_expires is null then return jsonb_build_object('status','unauthorized'); end if;
  if p_user_id is null then return jsonb_build_object('status','invalid'); end if;
  select phone into v_phone from public.osca_users where id=p_user_id;
  if v_phone is null then return jsonb_build_object('status','missing'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_phone,0));
  update public.osca_users set login_version=login_version+1 where id=p_user_id;
  if not found then return jsonb_build_object('status','missing'); end if;
  return jsonb_build_object('status','ok','data',jsonb_build_object('loggedOut',true),'expiresAt',v_expires);
end;
$$;
revoke all on function public.osca_admin_logout_user(text,uuid) from public,anon,authenticated;
grant execute on function public.osca_admin_logout_user(text,uuid) to service_role;
notify pgrst,'reload schema';
