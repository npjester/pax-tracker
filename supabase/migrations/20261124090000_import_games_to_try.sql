create function public.import_game_plans(plan_kind text, titles jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare added integer;
begin
  if plan_kind is null or plan_kind not in ('try', 'buy') then
    raise exception 'Expected a try or buy game list';
  end if;
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
  select plan_kind, btrim(title) from jsonb_array_elements_text(titles) as title
  on conflict do nothing;
  get diagnostics added = row_count;
  return added;
end;
$$;

revoke all on function public.import_game_plans(text, jsonb) from public, anon, authenticated;
grant execute on function public.import_game_plans(text, jsonb) to authenticated;
