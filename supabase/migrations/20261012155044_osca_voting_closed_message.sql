-- 종료 안내를 한 줄 문구로 변경하며 기존 설정 키와 접수 상태를 보존합니다.
create or replace function public.osca_voting_status()
returns jsonb language sql security invoker set search_path='' as $$
  select jsonb_build_object('enabled',enabled,'messageKey',message_key,'updatedAt',updated_at,
    'message',case when message_key='paused' then '운영자에 의해 투표가 종료 되었습니다.'
                   else '아직 투표기간이 아닙니다.' end)
  from osca_admin.voting_settings where singleton;
$$;
revoke all on function public.osca_voting_status() from public,anon,authenticated;
grant execute on function public.osca_voting_status() to service_role;
notify pgrst,'reload schema';
