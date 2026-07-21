create table public.user_letters (
    user_id uuid not null references auth.users(id) on delete cascade,
    letter_char text not null,
    due timestamptz,
    fsrs jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, letter_char)
);

-- Enable RLS
alter table public.user_letters enable row level security;

-- RLS Policies
create policy "Users can read their own letters"
    on public.user_letters for select
    using (auth.uid() = user_id);

create policy "Users can insert their own letters"
    on public.user_letters for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own letters"
    on public.user_letters for update
    using (auth.uid() = user_id);

-- Updated_at trigger
create trigger set_updated_at
    before update on public.user_letters
    for each row
    execute function public.touch_updated_at();

-- Index for due reviews
create index user_letters_due_idx on public.user_letters(user_id, due);
