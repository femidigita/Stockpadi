-- Complete database setup for SaaS tracking platform
-- This script creates all tables, functions, and sample data

-- First, create the tables
create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid default gen_random_uuid(), -- Allow null user_id for demo
  plan_name text not null,
  status text not null default 'active',
  amount numeric(10,2) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.payments (
  id uuid default gen_random_uuid() primary key,
  subscription_id uuid references public.subscriptions(id) on delete cascade,
  amount numeric(10,2) not null,
  status text not null default 'pending',
  paid_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

-- Create permissive policies for demo (in production, make these more restrictive)
drop policy if exists "Allow all access to subscriptions" on public.subscriptions;
create policy "Allow all access to subscriptions" on public.subscriptions
  for all using (true);

drop policy if exists "Allow all access to payments" on public.payments;
create policy "Allow all access to payments" on public.payments
  for all using (true);

-- Clear existing sample data
delete from public.payments;
delete from public.subscriptions;

-- Insert sample subscriptions
insert into public.subscriptions (plan_name, status, amount) values
  ('Pro Plan', 'active', 29.99),
  ('Basic Plan', 'active', 9.99),
  ('Enterprise', 'active', 99.99),
  ('Pro Plan', 'cancelled', 29.99),
  ('Basic Plan', 'active', 9.99),
  ('Pro Plan', 'active', 29.99),
  ('Enterprise', 'active', 99.99);

-- Insert sample payments for current month
insert into public.payments (subscription_id, amount, status, paid_at)
select 
  s.id,
  s.amount,
  'succeeded',
  timezone('utc'::text, now()) - interval '5 days'
from public.subscriptions s
where s.status = 'active';

-- Insert some payments from last month
insert into public.payments (subscription_id, amount, status, paid_at)
select 
  s.id,
  s.amount,
  'succeeded',
  timezone('utc'::text, now()) - interval '35 days'
from public.subscriptions s
where s.status = 'active'
limit 3;

-- Now create the analytics function
create or replace function public.get_platform_analytics()
returns table (
  user_count           bigint,
  subscription_count   bigint,
  mrr                  numeric
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from auth.users)::bigint as user_count,
    (select count(*) from public.subscriptions where status = 'active')::bigint as subscription_count,
    (select coalesce(sum(amount), 0)
       from public.payments
      where status = 'succeeded'
        and paid_at >= date_trunc('month', current_date)
        and paid_at < date_trunc('month', current_date) + interval '1 month'
    )::numeric as mrr;
$$;

-- Grant permissions
grant execute on function public.get_platform_analytics() to anon, authenticated, service_role;

-- Test the function
select * from public.get_platform_analytics();
