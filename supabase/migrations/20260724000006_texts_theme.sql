alter table public.texts add column theme text;
create index texts_level_theme_idx on public.texts (level, theme);
