-- Push notifications for chat messages: per-user opt-in, a throttle stamp,
-- and an insert webhook that calls the app's notify route via pg_net.

alter table public.profiles
  add column chat_notifications boolean not null default true,
  add column last_chat_push_at timestamptz;

-- ---------------------------------------------------------------------------
-- Insert webhook
-- ---------------------------------------------------------------------------

create extension if not exists pg_net;

-- The endpoint and shared secret are database settings rather than literals,
-- so the secret never lands in version control. Set them once per environment:
--
--   alter database postgres set app.settings.chat_push_url    = 'https://<host>/api/chat/notify';
--   alter database postgres set app.settings.chat_push_secret = '<CHAT_PUSH_SECRET>';
--
-- Until both are set the trigger quietly does nothing, so a fresh database
-- (or local reset) still works without push configured.
create or replace function public.notify_chat_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  url text := current_setting('app.settings.chat_push_url', true);
  secret text := current_setting('app.settings.chat_push_secret', true);
begin
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

create trigger chat_messages_notify
  after insert on public.chat_messages
  for each row execute function public.notify_chat_message();
