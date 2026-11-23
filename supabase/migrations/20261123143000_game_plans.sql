create table public.game_plans (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  kind text not null check (kind in ('try', 'buy')),
  title text not null check (char_length(btrim(title)) between 1 and 300),
  checked boolean not null default false,
  primary key (owner_id, id)
);

create unique index game_plans_unique_title on public.game_plans (owner_id, kind, lower(btrim(title)));
alter table public.game_plans enable row level security;
revoke all on public.game_plans from public, anon, authenticated;
grant select, insert, update, delete on public.game_plans to authenticated;

create policy own_game_plans on public.game_plans for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create function public.import_games_to_buy(titles jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare added integer;
begin
  if jsonb_typeof(titles) is distinct from 'array' or jsonb_array_length(titles) > 10000 then
    raise exception 'Expected an array of up to 10000 game titles';
  end if;
  if exists (
    select from jsonb_array_elements(titles) as item
    where jsonb_typeof(item) <> 'string'
      or char_length(btrim(item #>> '{}')) not between 1 and 300
  ) then
    raise exception 'Each game title must contain 1 to 300 characters';
  end if;
  insert into public.game_plans (kind, title)
  select 'buy', btrim(title) from jsonb_array_elements_text(titles) as title
  on conflict do nothing;
  get diagnostics added = row_count;
  return added;
end;
$$;

revoke all on function public.import_games_to_buy(jsonb) from public, anon, authenticated;
grant execute on function public.import_games_to_buy(jsonb) to authenticated;
