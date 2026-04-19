-- AETHER community catalog for Supabase.
-- This table stores one shared game record per id and is designed for
-- direct browser writes with the public anon key.

create table if not exists public.public_library (
    id text primary key,
    payload jsonb not null,
    public_published_at bigint not null,
    public_updated_at bigint not null
);

create index if not exists public_library_public_updated_at_idx
    on public.public_library (public_updated_at desc);

create index if not exists public_library_public_published_at_idx
    on public.public_library (public_published_at desc);

alter table public.public_library enable row level security;

drop policy if exists "Public read access" on public.public_library;
drop policy if exists "Public insert access" on public.public_library;
drop policy if exists "Public update access" on public.public_library;
drop policy if exists "Public delete access" on public.public_library;

create policy "Public read access"
    on public.public_library
    for select
    to anon, authenticated
    using (true);

create policy "Public insert access"
    on public.public_library
    for insert
    to anon, authenticated
    with check (true);

create policy "Public update access"
    on public.public_library
    for update
    to anon, authenticated
    using (true)
    with check (true);

create policy "Public delete access"
    on public.public_library
    for delete
    to anon, authenticated
    using (true);
