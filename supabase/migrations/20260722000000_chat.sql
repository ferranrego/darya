-- Ephemeral community chat: one global room, messages hard-deleted after 48h.
-- Nothing here is archived: the row is the only copy, and pg_cron drops it.

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Snapshot of the sender's name: realtime payloads carry only this row's
  -- columns, so denormalising avoids a profile lookup per delivered message.
  display_name text not null default '',
  body text not null check (char_length(btrim(body)) between 1 and 500),
  -- AI caches, filled on demand by /api/chat/enrich via the service role.
  translit text,
  translation text,
  created_at timestamptz not null default now()
);

create index chat_messages_created_idx on public.chat_messages (created_at);

-- ---------------------------------------------------------------------------
-- Insert guard: rate limit, name snapshot, and AI cache columns kept clean.
-- ---------------------------------------------------------------------------

create or replace function public.chat_message_before_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  recent integer;
begin
  select count(*) into recent
    from public.chat_messages
    where user_id = new.user_id and created_at > now() - interval '60 seconds';
  if recent >= 10 then
    raise exception 'Slow down a moment, you are sending messages too quickly.';
  end if;

  select display_name into new.display_name from public.profiles where id = new.user_id;
  new.display_name := coalesce(new.display_name, '');
  -- Clients must not pre-seed the shared AI cache.
  new.translit := null;
  new.translation := null;
  return new;
end;
$$;

create trigger chat_messages_before_insert
  before insert on public.chat_messages
  for each row execute function public.chat_message_before_insert();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.chat_messages enable row level security;

-- The 48h window lives in the policy, so expired messages are invisible even
-- between purge runs. Realtime evaluates this policy per subscriber too.
create policy "chat_messages readable (48h)" on public.chat_messages
  for select to authenticated
  using (created_at >= now() - interval '48 hours');

create policy "chat_messages insert own" on public.chat_messages
  for insert to authenticated
  with check (user_id = auth.uid());

-- No update/delete policies: enrichment writes and the purge use the service
-- role, which bypasses RLS.

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

alter publication supabase_realtime add table public.chat_messages;

-- ---------------------------------------------------------------------------
-- Hourly purge (verify with: select jobname, schedule from cron.job;)
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;

select cron.unschedule('chat-purge')
  where exists (select 1 from cron.job where jobname = 'chat-purge');

select cron.schedule(
  'chat-purge',
  '0 * * * *',
  $$delete from public.chat_messages where created_at < now() - interval '48 hours'$$
);
