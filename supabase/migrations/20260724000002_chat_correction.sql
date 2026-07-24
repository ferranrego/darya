alter table public.chat_messages
add column correction jsonb;

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
  new.correction := null;
  return new;
end;
$$;
