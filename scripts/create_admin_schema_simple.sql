-- Production Admin Panel Database Schema (Simplified)
-- Direct approach to handle existing tables and missing columns

-- Create user_profiles table with all columns
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

-- Add missing columns using ALTER TABLE ADD COLUMN IF NOT EXISTS
alter table public.user_profiles add column if not exists is_active boolean default true;
alter table public.user_profiles add column if not exists full_name text;
alter table public.user_profiles add column if not exists company_name text;
alter table public.user_profiles add column if not exists phone text;

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

-- Add missing columns to subscriptions table
alter table public.subscriptions add column if not exists plan_id uuid references public.subscription_plans(id);
alter table public.subscriptions add column if not exists expires_at timestamp with time zone;

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
  type text default 'info',
  target_type text default 'all',
  target_users uuid[] default '{}',
  cta_text text,
  cta_url text,
  is_active boolean default true,
  created_by uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User notifications table
create table if not exists public.user_notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete cascade,
  is_read boolean default false,
  read_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, notification_id)
);

-- Enable RLS on all tables
alter table public.user_profiles enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.sales_entries enable row level security;
alter table public.expenses enable row level security;
alter table public.notifications enable row level security;
alter table public.user_notifications enable row level security;

-- Drop existing policies to avoid conflicts
drop policy if exists "Service role can manage user profiles" on public.user_profiles;
drop policy if exists "Service role can manage subscription plans" on public.subscription_plans;
drop policy if exists "Service role can manage sales entries" on public.sales_entries;
drop policy if exists "Service role can manage expenses" on public.expenses;
drop policy if exists "Service role can manage notifications" on public.notifications;
drop policy if exists "Service role can manage user notifications" on public.user_notifications;

drop policy if exists "Users can view their own profile" on public.user_profiles;
drop policy if exists "Users can update their own profile" on public.user_profiles;
drop policy if exists "Users can view their own sales" on public.sales_entries;
drop policy if exists "Users can view their own expenses" on public.expenses;
drop policy if exists "Users can view active notifications" on public.notifications;
drop policy if exists "Users can manage their notification status" on public.user_notifications;

-- Create admin policies (allow all operations for service role)
create policy "Admin full access to user profiles" on public.user_profiles for all using (true);
create policy "Admin full access to subscription plans" on public.subscription_plans for all using (true);
create policy "Admin full access to sales entries" on public.sales_entries for all using (true);
create policy "Admin full access to expenses" on public.expenses for all using (true);
create policy "Admin full access to notifications" on public.notifications for all using (true);
create policy "Admin full access to user notifications" on public.user_notifications for all using (true);

-- Insert default subscription plans
insert into public.subscription_plans (name, price, duration_months, features, max_sales_entries) 
values 
  ('Starter', 9.99, 1, '["Basic sales tracking", "Up to 100 entries", "Email support"]'::jsonb, 100),
  ('Professional', 29.99, 1, '["Advanced analytics", "Up to 1000 entries", "Priority support", "Export features"]'::jsonb, 1000),
  ('Enterprise', 99.99, 1, '["Unlimited entries", "Team collaboration", "API access", "Custom integrations"]'::jsonb, -1)
on conflict (name) do nothing;

-- Create simplified admin analytics function
create or replace function public.get_admin_analytics()
returns json
language sql
security definer
as $$
  select json_build_object(
    'total_users', (select count(*) from auth.users),
    'active_users', (select count(*) from public.user_profiles where is_active = true),
    'total_subscriptions', (select count(*) from public.subscriptions where status = 'active'),
    'monthly_revenue', (select coalesce(sum(amount), 0) from public.payments 
                       where status = 'succeeded' 
                       and paid_at >= date_trunc('month', current_date)),
    'total_sales_entries', (select count(*) from public.sales_entries),
    'total_sales_volume', (select coalesce(sum(amount), 0) from public.sales_entries),
    'top_plan', (select coalesce(sp.name, 'N/A') 
                from public.subscriptions s 
                join public.subscription_plans sp on s.plan_id = sp.id 
                where s.status = 'active' 
                group by sp.name 
                order by count(*) desc 
                limit 1)
  );
$$;

-- Grant permissions
grant execute on function public.get_admin_analytics() to anon, authenticated, service_role;

-- Create sample data
insert into public.user_profiles (id, full_name, company_name, is_active)
select 
  gen_random_uuid(),
  'Sample User ' || generate_series,
  'Company ' || generate_series,
  true
from generate_series(1, 5)
on conflict (id) do nothing;

-- Get a sample user ID for sales entries
do $$
declare
  sample_user_id uuid;
begin
  select id into sample_user_id from public.user_profiles limit 1;
  
  if sample_user_id is not null then
    insert into public.sales_entries (user_id, customer_name, amount, product_service, sale_date)
    select 
      sample_user_id,
      'Customer ' || generate_series,
      (random() * 1000 + 100)::numeric(10,2),
      'Product ' || generate_series,
      current_date - (generate_series || ' days')::interval
    from generate_series(1, 20);
  end if;
end $$;

-- Test the analytics function
select 'Setup completed successfully!' as status;
select public.get_admin_analytics() as analytics_test;
