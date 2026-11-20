create table public.booths (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null default gen_random_uuid()::text check (char_length(id) between 1 and 80),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  booth_number text not null default '' check (char_length(booth_number) <= 24),
  priority text not null default 'regular' check (priority in ('must', 'recommended', 'regular')),
  visited boolean not null default false,
  demo boolean not null default false,
  buy boolean not null default false,
  promo boolean not null default false,
  notes text not null default '' check (char_length(notes) <= 4000),
  primary key (owner_id, id)
);

create table public.games (
  owner_id uuid not null default auth.uid(),
  id text not null default gen_random_uuid()::text check (char_length(id) between 1 and 80),
  booth_id text not null,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  checked boolean not null default false,
  primary key (owner_id, id),
  foreign key (owner_id, booth_id) references public.booths(owner_id, id) on delete cascade
);

create index games_by_booth on public.games (owner_id, booth_id);

alter table public.booths enable row level security;
alter table public.games enable row level security;

revoke all on public.booths, public.games from public, anon, authenticated;
grant select, insert, update on public.booths, public.games to authenticated;

create policy own_booths on public.booths for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy own_games on public.games for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create function public.load_shortlist(shortlist jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.booths (id, name, booth_number, priority, demo, buy, promo)
  select b.id, b.name, b.booth_number, b.priority, b.demo, b.buy, b.promo
  from jsonb_to_recordset(shortlist) as b(
    id text, name text, booth_number text, priority text, demo boolean, buy boolean, promo boolean
  )
  on conflict (owner_id, id) do nothing;

  insert into public.games (id, booth_id, title)
  select g.id, b.id, g.title
  from jsonb_to_recordset(shortlist) as b(id text, games jsonb)
  cross join lateral jsonb_to_recordset(b.games) as g(id text, title text)
  on conflict (owner_id, id) do nothing;
end;
$$;

revoke all on function public.load_shortlist(jsonb) from public, anon, authenticated;
grant execute on function public.load_shortlist(jsonb) to authenticated;
