-- Production Admin Panel Database Schema
-- Run this to set up all required tables for admin functionality

-- Subscription plans table
create table if not exists public.subscription_plans (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  price numeric(10,2) not null,
  duration_months integer not null default 1,
  features jsonb default '[]'::jsonb,
  max_sales_entries integer default 1000,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Update subscriptions table to reference plans
alter table public.subscriptions 
add column if not exists plan_id uuid references public.subscription_plans(id),
add column if not exists expires_at timestamp with time zone;

-- User profiles table (extends auth.users)
create table if not exists public.user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  company_name text,
  phone text,
  is_active boolean default true,
  last_login_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Sales entries table
create table if not exists public.sales_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  customer_name text not null,
  amount numeric(10,2) not null,
  product_service text,
  sale_date date not null,
  status text default 'completed',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Expenses table
create table if not exists public.expenses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  description text not null,
  amount numeric(10,2) not null,
  category text,
  expense_date date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Notifications table
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  message text not null,
  type text default 'info', -- info, warning, alert
  target_type text default 'all', -- all, specific, filtered
  target_users uuid[] default '{}',
  cta_text text,
  cta_url text,
  is_active boolean default true,
  created_by uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User notifications (tracking read status)
create table if not exists public.user_notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete cascade,
  is_read boolean default false,
  read_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, notification_id)
);

-- Enable RLS
alter table public.subscription_plans enable row level security;
alter table public.user_profiles enable row level security;
alter table public.sales_entries enable row level security;
alter table public.expenses enable row level security;
alter table public.notifications enable row level security;
alter table public.user_notifications enable row level security;

-- Admin policies (service_role can do everything)
create policy "Service role can manage subscription plans" on public.subscription_plans for all using (auth.jwt() ->> 'role' = 'service_role');
create policy "Service role can manage user profiles" on public.user_profiles for all using (auth.jwt() ->> 'role' = 'service_role');
create policy "Service role can manage sales entries" on public.sales_entries for all using (auth.jwt() ->> 'role' = 'service_role');
create policy "Service role can manage expenses" on public.expenses for all using (auth.jwt() ->> 'role' = 'service_role');
create policy "Service role can manage notifications" on public.notifications for all using (auth.jwt() ->> 'role' = 'service_role');
create policy "Service role can manage user notifications" on public.user_notifications for all using (auth.jwt() ->> 'role' = 'service_role');

-- User policies
create policy "Users can view their own profile" on public.user_profiles for select using (auth.uid() = id);
create policy "Users can update their own profile" on public.user_profiles for update using (auth.uid() = id);
create policy "Users can view their own sales" on public.sales_entries for all using (auth.uid() = user_id);
create policy "Users can view their own expenses" on public.expenses for all using (auth.uid() = user_id);
create policy "Users can view active notifications" on public.notifications for select using (is_active = true);
create policy "Users can manage their notification status" on public.user_notifications for all using (auth.uid() = user_id);

-- Insert default subscription plans
insert into public.subscription_plans (name, price, duration_months, features, max_sales_entries) values
  ('Starter', 9.99, 1, '["Basic sales tracking", "Up to 100 entries", "Email support"]', 100),
  ('Professional', 29.99, 1, '["Advanced analytics", "Up to 1000 entries", "Priority support", "Export features"]', 1000),
  ('Enterprise', 99.99, 1, '["Unlimited entries", "Team collaboration", "API access", "Custom integrations"]', -1)
on conflict do nothing;

-- Admin analytics function
create or replace function public.get_admin_analytics()
returns table (
  total_users bigint,
  active_users bigint,
  total_subscriptions bigint,
  monthly_revenue numeric,
  total_sales_entries bigint,
  total_sales_volume numeric,
  top_plan text
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from auth.users) as total_users,
    (select count(*) from public.user_profiles where is_active = true) as active_users,
    (select count(*) from public.subscriptions where status = 'active') as total_subscriptions,
    (select coalesce(sum(amount), 0) from public.payments 
     where status = 'succeeded' and paid_at >= date_trunc('month', current_date)) as monthly_revenue,
    (select count(*) from public.sales_entries) as total_sales_entries,
    (select coalesce(sum(amount), 0) from public.sales_entries) as total_sales_volume,
    (select sp.name from public.subscriptions s 
     join public.subscription_plans sp on s.plan_id = sp.id 
     where s.status = 'active' 
     group by sp.name 
     order by count(*) desc 
     limit 1) as top_plan;
$$;

grant execute on function public.get_admin_analytics() to service_role;
