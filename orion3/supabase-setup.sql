-- ─────────────────────────────────────────────────────────
-- 0rion — Supabase setup
-- Paste this in: supabase.com → your project → SQL Editor → Run
-- ─────────────────────────────────────────────────────────

-- User profiles
create table if not exists profiles (
  id           uuid references auth.users(id) on delete cascade primary key,
  name         text,
  home_country text    default '',
  watchlist    text[]  default '{}',
  push_enabled boolean default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
alter table profiles enable row level security;
create policy "Own profile only — select" on profiles for select using (auth.uid() = id);
create policy "Own profile only — insert" on profiles for insert with check (auth.uid() = id);
create policy "Own profile only — update" on profiles for update using (auth.uid() = id);

-- Push subscriptions (VAPID endpoint + keys per user)
create table if not exists push_subscriptions (
  id           bigserial primary key,
  user_id      uuid references auth.users(id) on delete cascade,
  subscription jsonb not null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (user_id)
);
alter table push_subscriptions enable row level security;
create policy "Own subscription only — select" on push_subscriptions for select using (auth.uid() = user_id);
create policy "Own subscription only — insert" on push_subscriptions for insert with check (auth.uid() = user_id);
create policy "Own subscription only — upsert" on push_subscriptions for update using (auth.uid() = user_id);
create policy "Own subscription only — delete" on push_subscriptions for delete using (auth.uid() = user_id);

-- Auto-create profile row when user signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Done ✅
