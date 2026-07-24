-- ---------------------------------------------------------------------------
-- Wrong Answer Explanations Table
-- ---------------------------------------------------------------------------

create table public.wrong_answer_explanations (
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  chosen_answer text not null,
  explanation_en text not null,
  created_at timestamptz not null default now(),
  primary key (exercise_id, chosen_answer)
);

-- RLS Policies
alter table public.wrong_answer_explanations enable row level security;

-- Explanations are readable by all authenticated users
create policy "wrong_answer_explanations readable" on public.wrong_answer_explanations
  for select to authenticated using (true);

-- Explanations are only writable by service_role (AI pipeline)
-- No insert policy for authenticated users
