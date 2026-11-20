alter table public.booths
  drop constraint booths_booth_number_check,
  add constraint booths_booth_number_check check (char_length(booth_number) <= 96);
