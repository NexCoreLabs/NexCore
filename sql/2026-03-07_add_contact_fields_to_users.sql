-- Adds public contact fields for creator contact info.
-- Run in Supabase SQL Editor.

alter table public.users
  add column if not exists contact_email text,
  add column if not exists phone_number text;

-- Optional: enforce basic phone length at DB level (keeps format flexible).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_phone_number_length_check'
  ) then
    alter table public.users
      add constraint users_phone_number_length_check
      check (phone_number is null or char_length(trim(phone_number)) between 6 and 20);
  end if;
end
$$;
