alter table public.bgg_collections
  add column source_csv text check (octet_length(source_csv) <= 5242880);
