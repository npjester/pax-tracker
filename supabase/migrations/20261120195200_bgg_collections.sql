create table public.bgg_collections (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  games jsonb not null check (
    case when jsonb_typeof(games) = 'array' then jsonb_array_length(games) between 1 and 10000 else false end
  )
);

alter table public.bgg_collections enable row level security;
revoke all on public.bgg_collections from public, anon, authenticated;
grant select, insert, update, delete on public.bgg_collections to authenticated;

create policy own_bgg_collection on public.bgg_collections for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
