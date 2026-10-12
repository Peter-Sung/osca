-- 투표 접수 여부와 안내 문구를 관리자 세션으로 변경하고 DB에서도 접수를 제한합니다.
create table osca_admin.voting_settings (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  message_key text not null default 'not-started' check(message_key in ('not-started','paused')),
  updated_at timestamptz not null default clock_timestamp()
);
insert into osca_admin.voting_settings default values;
alter table osca_admin.voting_settings enable row level security;
revoke all on osca_admin.voting_settings from public,anon,authenticated,service_role;
grant select,update on osca_admin.voting_settings to service_role;

create function public.osca_voting_status()
returns jsonb language sql security invoker set search_path='' as $$
  select jsonb_build_object('enabled',enabled,'messageKey',message_key,'updatedAt',updated_at,
    'message',case when message_key='paused' then E'운영자에 의해 투표가 잠시 닫혔습니다.\n잠시만 기다려 주세요.'
                   else '아직 투표기간이 아닙니다.' end)
  from osca_admin.voting_settings where singleton;
$$;
revoke all on function public.osca_voting_status() from public,anon,authenticated;
grant execute on function public.osca_voting_status() to service_role;

create function public.osca_admin_voting(p_token_hash text,p_enabled boolean default null,p_message_key text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_expires timestamptz;
begin
  select expires_at into v_expires from osca_admin.sessions
    where token_hash=p_token_hash and expires_at>now() for share;
  if v_expires is null then return jsonb_build_object('status','unauthorized'); end if;
  if p_enabled is not null or p_message_key is not null then
    if p_enabled is null or p_message_key is null or p_message_key not in ('not-started','paused') then
      return jsonb_build_object('status','invalid');
    end if;
    update osca_admin.voting_settings
      set enabled=p_enabled,message_key=p_message_key,updated_at=clock_timestamp() where singleton;
  end if;
  return jsonb_build_object('status','ok','data',public.osca_voting_status(),'expiresAt',v_expires);
end;
$$;
revoke all on function public.osca_admin_voting(text,boolean,text) from public,anon,authenticated;
grant execute on function public.osca_admin_voting(text,boolean,text) to service_role;

create or replace function public.osca_dispatch(
  p_action text,p_phone text,p_nickname text default null,p_house text default null,
  p_candidate integer default null,p_user_id uuid default null,p_login_version integer default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_phone text:=regexp_replace(coalesce(p_phone,''),'[-[:space:]]','','g');
  v_user public.osca_users%rowtype; v_enabled boolean;
begin
  if v_phone !~ '^010[0-9]{8}$' or p_login_version<0 then
    raise exception using errcode='22023',message='invalid request';
  end if;
  if p_action='vote' then
    -- 저장이 끝날 때까지 공유 잠금을 유지해 Off 완료 이후 새 투표가 저장되지 않게 합니다.
    select enabled into v_enabled from osca_admin.voting_settings where singleton for share;
    if v_enabled is distinct from true then
      return jsonb_build_object('status','closed','voting',public.osca_voting_status());
    end if;
  end if;
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
notify pgrst,'reload schema';
