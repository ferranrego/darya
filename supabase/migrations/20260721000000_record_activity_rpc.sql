-- ---------------------------------------------------------------------------
-- record_activity: server-authoritative daily XP, activity counters, streaks.
--
-- The day boundary is Barcelona midnight (Europe/Madrid; Berlin shares the
-- same clock). Computing `today` here means device clocks and timezones can
-- never write into the wrong day, and the on-conflict increment makes
-- concurrent awards (rapid review grading) atomic instead of read-modify-write.
-- ---------------------------------------------------------------------------

create or replace function public.record_activity(
  xp_delta integer default 0,
  reviews integer default 0,
  texts integer default 0,
  words integer default 0
)
returns public.profiles
language plpgsql
security invoker set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Europe/Madrid')::date;
  p public.profiles;
begin
  if uid is null then
    raise exception 'record_activity requires an authenticated user';
  end if;

  -- Sanity caps: the largest legitimate single award is 15 XP (alphabet unit)
  -- and one counter tick. Generous bounds, but nobody hands themselves 1e9.
  if xp_delta not between 0 and 50
     or reviews not between 0 and 10
     or texts not between 0 and 10
     or words not between 0 and 10 then
    raise exception 'activity delta out of range';
  end if;

  insert into daily_activity as da (user_id, date, xp, reviews_done, texts_read, words_learned)
  values (uid, today, xp_delta, reviews, texts, words)
  on conflict (user_id, date) do update set
    xp = da.xp + excluded.xp,
    reviews_done = da.reviews_done + excluded.reviews_done,
    texts_read = da.texts_read + excluded.texts_read,
    words_learned = da.words_learned + excluded.words_learned;

  -- Lock the profile row so concurrent awards serialize the streak update.
  select * into p from profiles where id = uid for update;

  if p.last_active_date is distinct from today then
    if p.last_active_date = today - 1 then
      p.streak_current := p.streak_current + 1;
    else
      p.streak_current := 1;
    end if;
    p.streak_best := greatest(p.streak_best, p.streak_current);
  end if;

  update profiles set
    xp = profiles.xp + xp_delta,
    streak_current = p.streak_current,
    streak_best = p.streak_best,
    last_active_date = today
  where id = uid
  returning * into p;

  return p;
end;
$$;

revoke execute on function public.record_activity from public, anon;
grant execute on function public.record_activity to authenticated;
