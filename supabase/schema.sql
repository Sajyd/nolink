-- nolink.ai MVP : usage (freemium) + subscriptions (Stripe Pro)
-- Exécuter dans Supabase SQL Editor

create table if not exists usage (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  date date not null,
  count int not null default 0,
  created_at timestamptz default now(),
  unique(user_id, date)
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text,
  price_id text,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table usage enable row level security;
alter table subscriptions enable row level security;
create policy "Allow service role" on usage for all using (true);
create policy "Allow service role" on subscriptions for all using (true);
