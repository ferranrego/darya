-- Supabase does not grant superuser, so `alter database ... set` is unavailable
-- for the webhook config. Keep it in a private table instead: the schema is not
-- exposed to PostgREST and carries no grants, so only the service role and
-- security-definer functions can read it.

create schema if not exists private;

create table if not exists private.app_config (
  key text primary key,
  value text not null
);

revoke all on schema private from anon, authenticated;
revoke all on private.app_config from anon, authenticated;

-- Populate per environment (values are secrets, so they are not in this file):
--   insert into private.app_config (key, value) values
--     ('chat_push_url', 'https://<host>/api/chat/notify'),
--     ('chat_push_secret', '<CHAT_PUSH_SECRET>')
--   on conflict (key) do update set value = excluded.value;

create or replace function public.notify_chat_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  url text;
  secret text;
begin
  select value into url from private.app_config where key = 'chat_push_url';
  select value into secret from private.app_config where key = 'chat_push_secret';

  -- Unconfigured environments (fresh database, local reset) simply skip push.
  if url is null or url = '' or secret is null or secret = '' then
    return null;
  end if;

  -- pg_net queues the request, so the sender's insert does not wait on it.
  perform net.http_post(
    url := url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || secret
    ),
    body := jsonb_build_object('messageId', new.id)
  );
  return null;
end;
$$;
