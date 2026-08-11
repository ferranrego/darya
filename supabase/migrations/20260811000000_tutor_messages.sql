-- The AI conversation partner's thread: one private thread per learner, kept
-- for 48h exactly like the community room, and purged by pg_cron.
--
-- Unlike `chat_messages` this table has NO client write policy at all. Every
-- insert goes through the service role from /api/tutor/reply, because each
-- learner turn spends a model call from a free-tier quota shared by every user
-- of the deployment. Letting the browser write rows directly would put the
-- number of those calls under the client's control, which is the one thing the
-- cost ceiling cannot survive.

create table public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'tutor')),
  -- Wider than the room's 500 because both roles share the column and only the
  -- learner's half is a composer with a maxlength. The reply is bounded by
  -- `max_tokens`, and 200 tokens of Dari can exceed 500 characters - which the
  -- learner would have seen as "couldn't reply just now" after the call was
  -- already paid for. The route still holds learner input to 500.
  body text not null check (char_length(btrim(body)) between 1 and 800),
  -- AI caches, filled on demand by /api/chat/enrich via the service role.
  translit text,
  translation text,
  correction jsonb,
  created_at timestamptz not null default now()
);

-- Every read is "this learner's recent turns", so the index leads with user_id.
create index tutor_messages_user_created_idx
  on public.tutor_messages (user_id, created_at);

-- ---------------------------------------------------------------------------
-- Insert guard: the spend limits, and AI cache columns kept clean.
-- ---------------------------------------------------------------------------

create or replace function public.tutor_message_before_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  recent integer;
  today integer;
begin
  -- Only 'user' rows are counted. A tutor row exists because a learner row was
  -- already admitted, so charging both would halve the real limit, and a
  -- refusal here would strand a reply the provider has already been paid for.
  if new.role = 'user' then
    select count(*) into recent
      from public.tutor_messages
      where user_id = new.user_id
        and role = 'user'
        and created_at > now() - interval '60 seconds';
    if recent >= 6 then
      raise exception 'tutor_rate_limit_minute';
    end if;

    select count(*) into today
      from public.tutor_messages
      where user_id = new.user_id
        and role = 'user'
        and created_at > now() - interval '24 hours';
    if today >= 40 then
      raise exception 'tutor_rate_limit_day';
    end if;
  end if;

  -- Nothing may pre-seed the caches; /api/chat/enrich fills them on demand.
  new.translit := null;
  new.translation := null;
  new.correction := null;
  return new;
end;
$$;

-- The daily cap is counted over a 24h window rather than reset at midnight,
-- and the count only sees rows inside the 48h retention - which is fine, since
-- the window it needs is half that. If retention is ever shortened below 24h
-- this cap silently stops working; keep them in that order.
create trigger tutor_messages_before_insert
  before insert on public.tutor_messages
  for each row execute function public.tutor_message_before_insert();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.tutor_messages enable row level security;

-- Owner-scoped, and the 48h window lives in the policy so expired turns are
-- invisible between purge runs - the same reason chat_messages does it here.
create policy "tutor_messages readable (own, 48h)" on public.tutor_messages
  for select to authenticated
  using (
    user_id = auth.uid()
    and created_at >= now() - interval '48 hours'
  );

-- No insert/update/delete policies, deliberately: see the header comment. The
-- reply route and the enrichment cache write both use the service role.

-- Not added to `supabase_realtime`: this thread has exactly one reader, on one
-- device, and the client already holds the rows it just sent.

-- ---------------------------------------------------------------------------
-- Hourly purge (verify with: select jobname, schedule from cron.job;)
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;

select cron.unschedule('tutor-purge')
  where exists (select 1 from cron.job where jobname = 'tutor-purge');

select cron.schedule(
  'tutor-purge',
  '20 * * * *',
  $$delete from public.tutor_messages where created_at < now() - interval '48 hours'$$
);
