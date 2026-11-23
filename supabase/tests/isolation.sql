-- Run against a development database with the tracker migration installed.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'tracker-test-one@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'tracker-test-two@example.test');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

select public.load_shortlist('[{"id":"test-booth","name":"First booth","booth_number":"100","priority":"must","demo":true,"buy":false,"promo":false,"games":[{"id":"test-game","title":"First game"}]}]');
update public.booths set visited = true, notes = 'Private notes' where id = 'test-booth';
update public.games set checked = true where id = 'test-game';
insert into public.bgg_collections (games) values ('[{"id":"123","title":"Private game","owned":true,"wanted":false,"rating":8}]');
insert into public.game_plans (kind, title) values ('buy', 'Private game');
select public.import_games_to_buy('["Private game", "Another game"]');
insert into public.game_plans (kind, title, checked) values ('try', 'Private game', true);
select public.load_shortlist('[{"id":"test-booth","name":"First booth","booth_number":"100","priority":"must","demo":true,"buy":false,"promo":false,"games":[{"id":"test-game","title":"First game"}]}]');

do $$
begin
  if public.import_games_to_try('[" private game ", "New try", "NEW TRY"]') <> 1
    or public.import_games_to_try('["New try"]') <> 0 then
    raise exception 'Want-to-play import did not deduplicate titles';
  end if;
  if not exists (select from public.game_plans where kind = 'try' and title = 'Private game' and checked)
    or not exists (select from public.game_plans where kind = 'buy' and title = 'Private game') then
    raise exception 'Want-to-play import changed existing entries';
  end if;
  begin
    perform public.import_games_to_try('["Would be new", ""]');
    raise exception 'Want-to-play import accepted an invalid title';
  exception when raise_exception then
    if sqlerrm = 'Want-to-play import accepted an invalid title' then raise; end if;
  end;
  if exists (select from public.game_plans where title = 'Would be new') then
    raise exception 'Invalid import partially added games';
  end if;
  if not exists (select from public.booths where id = 'test-booth' and visited and notes = 'Private notes')
    or not exists (select from public.games where id = 'test-game' and checked) then
    raise exception 'Reloading the shortlist lost progress';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);

do $$
begin
  if exists (select from public.booths) or exists (select from public.games) then
    raise exception 'One account could see another account''s checklist';
  end if;

  if exists (select from public.bgg_collections) then
    raise exception 'One account could see another account''s collection';
  end if;
  if exists (select from public.game_plans) then
    raise exception 'One account could see another account''s game lists';
  end if;
  delete from public.game_plans where title = 'Private game';
  if found then
    raise exception 'One account could delete another account''s game';
  end if;

  delete from public.bgg_collections where owner_id = '00000000-0000-4000-8000-000000000001';
  if found then
    raise exception 'One account could delete another account''s collection';
  end if;

  update public.booths set visited = false where id = 'test-booth';
  if found then
    raise exception 'One account could update another account''s booth';
  end if;

  begin
    insert into public.games (booth_id, title) values ('test-booth', 'Wrong account');
    raise exception 'A game could be added to another account''s booth';
  exception when foreign_key_violation then
    null;
  end;
end;
$$;

select public.import_games_to_try('["Private game"]');
do $$
begin
  if not exists (select from public.game_plans where kind = 'try' and title = 'Private game' and not checked) then
    raise exception 'Want-to-play imports are not independent across accounts';
  end if;
end;
$$;

select public.load_shortlist('[{"id":"test-booth","name":"Second booth","booth_number":"200","priority":"must","demo":true,"buy":false,"promo":false,"games":[{"id":"test-game","title":"Second game"}]}]');

do $$
begin
  if not exists (select from public.booths where id = 'test-booth' and not visited and notes = '')
    or not exists (select from public.games where id = 'test-game' and not checked) then
    raise exception 'Accounts did not get independent copies of the shortlist';
  end if;
end;
$$;

set local role anon;
do $$
begin
  if has_table_privilege('public.booths', 'SELECT')
    or has_table_privilege('public.games', 'SELECT')
    or has_table_privilege('public.bgg_collections', 'SELECT')
    or has_table_privilege('public.game_plans', 'SELECT')
    or has_function_privilege('public.import_games_to_buy(jsonb)', 'EXECUTE')
    or has_function_privilege('public.import_games_to_try(jsonb)', 'EXECUTE')
    or has_function_privilege('public.load_shortlist(jsonb)', 'EXECUTE') then
    raise exception 'Anonymous clients have checklist permissions';
  end if;
end;
$$;

rollback;
