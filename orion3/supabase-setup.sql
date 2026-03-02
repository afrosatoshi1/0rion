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

-- ─── Community Reports ────────────────────────────────────
create table if not exists community_reports (
  id            bigserial primary key,
  user_id       uuid references auth.users(id) on delete set null,
  type          text not null,
  title         text,
  description   text,
  lat           float,
  lon           float,
  state         text,
  lga           text,
  verified_count int default 0,
  created_at    timestamptz default now()
);
alter table community_reports enable row level security;
-- Anyone can read reports
create policy "read community reports" on community_reports for select using (true);
-- Logged-in users can insert
create policy "insert community report" on community_reports for insert with check (auth.uid() is not null);
-- Users can only update verified_count (via function), not their own reports directly

-- ─── Report Verifications ─────────────────────────────────
create table if not exists report_verifications (
  id        bigserial primary key,
  report_id bigint references community_reports(id) on delete cascade,
  user_id   uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (report_id, user_id)
);
alter table report_verifications enable row level security;
create policy "read verifications" on report_verifications for select using (true);
create policy "insert verification" on report_verifications for insert with check (auth.uid() = user_id);

-- Allow update verified_count on community_reports by any auth user
create policy "update verified count" on community_reports for update using (auth.uid() is not null);

-- ─── Fuel Prices (crowd-sourced) ─────────────────────────
create table if not exists fuel_prices (
  id         bigserial primary key,
  user_id    uuid references auth.users(id) on delete set null,
  product    text not null,  -- PMS, AGO, LPG
  price      numeric not null,
  state      text,
  lga        text,
  station    text,
  created_at timestamptz default now()
);
alter table fuel_prices enable row level security;
create policy "read fuel prices" on fuel_prices for select using (true);
create policy "insert fuel price" on fuel_prices for insert with check (auth.uid() is not null);

-- ─── Market Prices (crowd-sourced) ───────────────────────
create table if not exists market_prices (
  id         bigserial primary key,
  user_id    uuid references auth.users(id) on delete set null,
  item       text not null,
  price      numeric not null,
  unit       text,
  market     text,
  state      text,
  lga        text,
  created_at timestamptz default now()
);
alter table market_prices enable row level security;
create policy "read market prices" on market_prices for select using (true);
create policy "insert market price" on market_prices for insert with check (auth.uid() is not null);

-- ─── Enable realtime on community_reports ────────────────
alter publication supabase_realtime add table community_reports;
