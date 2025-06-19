-- Production Admin Panel Database Schema (Fixed Syntax)
-- Handles existing tables and missing columns

-- First, ensure user_profiles table exists with all required columns
create table if not exists public.user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  company_name text,
  phone text,
  last_login_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add missing columns to user_profiles if they don't exist
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'user_profiles' and column_name = 'is_active') then
    alter table public.user_profiles add column is_active boolean default true;
  end if;
end $$;

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

-- Add missing columns to subscriptions table if they don't exist
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'subscriptions' and column_name = 'plan_id') then
    alter table public.subscriptions add column plan_id uuid references public.subscription_plans(id);
  end if;
  
  if not exists (select 1 from information_schema.columns where table_name = 'subscriptions' and column_name = 'expires_at') then
    alter table public.subscriptions add column expires_at timestamp with time zone;
  end if;
end $$;

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
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add unique constraint if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'user_notifications_user_id_notification_id_key'
  ) then
    alter table public.user_notifications add constraint user_notifications_user_id_notification_id_key unique(user_id, notification_id);
  end if;
end $$;

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

-- Create admin policies (service_role can do everything)
create policy "Service role can manage user profiles" on public.user_profiles for all using (auth.jwt() ->> 'role' = 'service_role');
create policy "Service role can manage subscription plans" on public.subscription_plans for all using (auth.jwt() ->> 'role' = 'service_role');
create policy "Service role can manage sales entries" on public.sales_entries for all using (auth.jwt() ->> 'role' = 'service_role');
create policy "Service role can manage expenses" on public.expenses for all using (auth.jwt() ->> 'role' = 'service_role');
create policy "Service role can manage notifications" on public.notifications for all using (auth.jwt() ->> 'role' = 'service_role');
create policy "Service role can manage user notifications" on public.user_notifications for all using (auth.jwt() ->> 'role' = 'service_role');

-- Create user policies
create policy "Users can view their own profile" on public.user_profiles for select using (auth.uid() = id);
create policy "Users can update their own profile" on public.user_profiles for update using (auth.uid() = id);
create policy "Users can view their own sales" on public.sales_entries for all using (auth.uid() = user_id);
create policy "Users can view their own expenses" on public.expenses for all using (auth.uid() = user_id);
create policy "Users can view active notifications" on public.notifications for select using (is_active = true);
create policy "Users can manage their notification status" on public.user_notifications for all using (auth.uid() = user_id);

-- Insert default subscription plans (only if they don't exist)
insert into public.subscription_plans (name, price, duration_months, features, max_sales_entries) 
select 'Starter', 9.99, 1, '["Basic sales tracking", "Up to 100 entries", "Email support"]'::jsonb, 100
where not exists (select 1 from public.subscription_plans where name = 'Starter');

insert into public.subscription_plans (name, price, duration_months, features, max_sales_entries) 
select 'Professional', 29.99, 1, '["Advanced analytics", "Up to 1000 entries", "Priority support", "Export features"]'::jsonb, 1000
where not exists (select 1 from public.subscription_plans where name = 'Professional');

insert into public.subscription_plans (name, price, duration_months, features, max_sales_entries) 
select 'Enterprise', 99.99, 1, '["Unlimited entries", "Team collaboration", "API access", "Custom integrations"]'::jsonb, -1
where not exists (select 1 from public.subscription_plans where name = 'Enterprise');

-- Create or replace admin analytics function
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
    (select coalesce(sp.name, 'N/A') from public.subscriptions s 
     join public.subscription_plans sp on s.plan_id = sp.id 
     where s.status = 'active' 
     group by sp.name 
     order by count(*) desc 
     limit 1) as top_plan;
$$;

-- Grant permissions
grant execute on function public.get_admin_analytics() to service_role;

-- Create some sample data for testing (only if tables are empty)
do $$
declare
  sample_user_id uuid;
begin
  -- Add sample user profiles if none exist
  if not exists (select 1 from public.user_profiles limit 1) then
    -- Create sample user profiles with random UUIDs
    for i in 1..5 loop
      sample_user_id := gen_random_uuid();
      insert into public.user_profiles (id, full_name, company_name, is_active)
      values (
        sample_user_id,
        'Sample User ' || i,
        'Company ' || i,
        true
      );
    end loop;
  end if;

  -- Add sample sales entries if none exist
  if not exists (select 1 from public.sales_entries limit 1) then
    select id into sample_user_id from public.user_profiles limit 1;
    
    if sample_user_id is not null then
      for i in 1..20 loop
        insert into public.sales_entries (user_id, customer_name, amount, product_service, sale_date)
        values (
          sample_user_id,
          'Customer ' || i,
          (random() * 1000 + 100)::numeric(10,2),
          'Product ' || i,
          current_date - (i || ' days')::interval
        );
      end loop;
    end if;
  end if;
end $$;

-- Test the function
select 'Analytics function test completed successfully' as status;
select * from public.get_admin_analytics();
