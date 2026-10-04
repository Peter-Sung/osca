-- 전화번호별 사용자와 하우스별 최초 투표를 전용 API에서 원자적으로 관리합니다.
create table public.osca_users (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique check (phone ~ '^010[0-9]{8}$'),
  nickname text check (nickname is null or (char_length(nickname) between 1 and 6 and nickname ~ '^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]+$')),
  created_at timestamptz not null default now()
);

create table public.osca_votes (
  user_id uuid not null references public.osca_users(id) on delete cascade,
  house text not null check (house in ('O', 'S', 'C', 'A')),
  candidate integer not null check (candidate between 1 and 3 or (house = 'S' and candidate = 4)),
  voted_at timestamptz not null default now(),
  primary key (user_id, house)
);

alter table public.osca_users enable row level security;
alter table public.osca_votes enable row level security;
revoke all on public.osca_users, public.osca_votes from public, anon, authenticated, service_role;
grant select, insert on public.osca_users, public.osca_votes to service_role;

create function public.osca_snapshot(p_user_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select jsonb_build_object(
    'user', (select jsonb_build_object('id', u.id, 'phone', u.phone, 'nickname', u.nickname)
             from public.osca_users u where u.id = p_user_id),
    'votes', coalesce((select jsonb_object_agg(v.house, jsonb_build_object('candidate', v.candidate, 'votedAt', v.voted_at))
                        from public.osca_votes v where v.user_id = p_user_id), '{}'::jsonb)
  );
$$;
revoke all on function public.osca_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.osca_snapshot(uuid) to service_role;

create function public.osca_dispatch(
  p_action text, p_phone text, p_nickname text default null,
  p_house text default null, p_candidate integer default null, p_user_id uuid default null
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[-[:space:]]', '', 'g');
  v_nickname text := nullif(btrim(coalesce(p_nickname, '')), '');
  v_user public.osca_users%rowtype;
  v_saved boolean := false;
  v_status text;
begin
  if p_action is null or p_action not in ('lookup', 'login', 'vote') or v_phone !~ '^010[0-9]{8}$' then
    raise exception using errcode = '22023', message = 'invalid request';
  end if;
  if v_nickname is not null and (char_length(v_nickname) > 6 or v_nickname !~ '^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]+$') then
    raise exception using errcode = '22023', message = 'invalid nickname';
  end if;
  if p_action = 'vote' and (p_house is null or p_house not in ('O', 'S', 'C', 'A') or p_candidate is null
      or p_candidate < 1 or p_candidate > case when p_house = 'S' then 4 else 3 end) then
    raise exception using errcode = '22023', message = 'invalid candidate';
  end if;

  -- 같은 번호의 동시 가입·투표를 직렬화하고 최초 기록을 유지합니다.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_phone, 0));
  select * into v_user from public.osca_users where phone = v_phone;

  if p_action = 'lookup' then
    return public.osca_snapshot(v_user.id) || jsonb_build_object('status', case when v_user.id is null then 'missing' else 'found' end);
  end if;
  if p_action = 'vote' and p_user_id is not null and (v_user.id is null or v_user.id <> p_user_id) then
    return public.osca_snapshot(null) || jsonb_build_object('status', 'missing');
  end if;

  if v_user.id is null then
    insert into public.osca_users(phone, nickname) values (v_phone, v_nickname) returning * into v_user;
    v_status := 'new';
  else
    v_status := 'found';
  end if;
  if p_action = 'vote' then
    insert into public.osca_votes(user_id, house, candidate) values (v_user.id, p_house, p_candidate)
      on conflict (user_id, house) do nothing returning true into v_saved;
    v_status := case when coalesce(v_saved, false) then 'saved' else 'duplicate' end;
  end if;
  return public.osca_snapshot(v_user.id) || jsonb_build_object('status', v_status);
end;
$$;
revoke all on function public.osca_dispatch(text, text, text, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.osca_dispatch(text, text, text, text, integer, uuid) to service_role;
notify pgrst, 'reload schema';
