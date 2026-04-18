create table if not exists public.public_games (
  id text primary key,
  payload jsonb not null,
  public_published_at bigint not null default ((extract(epoch from now()) * 1000)::bigint),
  public_updated_at bigint not null default ((extract(epoch from now()) * 1000)::bigint)
);

create index if not exists public_games_public_updated_at_idx
  on public.public_games (public_updated_at desc);

alter table public.public_games enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'public_games'
      and policyname = 'Public read access'
  ) then
    create policy "Public read access"
      on public.public_games
      for select
      using (true);
  end if;
end $$;

create table if not exists public.launcher_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme_id text not null default 'unicorn',
  safe_mode_enabled boolean not null default false,
  system_notifications_enabled boolean not null default false,
  updated_at bigint not null default ((extract(epoch from now()) * 1000)::bigint)
);

create index if not exists launcher_preferences_updated_at_idx
  on public.launcher_preferences (updated_at desc);

alter table public.launcher_preferences enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'launcher_preferences'
      and policyname = 'Own preference read access'
  ) then
    create policy "Own preference read access"
      on public.launcher_preferences
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'launcher_preferences'
      and policyname = 'Own preference write access'
  ) then
    create policy "Own preference write access"
      on public.launcher_preferences
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'launcher_preferences'
      and policyname = 'Own preference update access'
  ) then
    create policy "Own preference update access"
      on public.launcher_preferences
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
