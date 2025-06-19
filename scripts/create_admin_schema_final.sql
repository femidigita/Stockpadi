-- Production Admin Panel Database Schema (Final Fix)
-- Handles foreign key constraints properly

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

-- Add missing columns to user_profiles
alter table public.user_profiles add column if not exists is_active boolean default true;
alter table public.user_profiles add column if not exists full_name text;
alter table public.user_profiles add column if not exists company_name text;
alter table public.user_profiles add column if not exists phone text;
alter table public.user_profiles add column if not exists last_login_at timestamp with time zone;
alter table public.user_profiles add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());
alter table public.user_profiles add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now());

-- Create subscription_plans table
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

-- Add missing columns to subscription_plans
alter table public.subscription_plans add column if not exists name text;
alter table public.subscription_plans add column if not exists price numeric(10,2);
alter table public.subscription_plans add column if not exists duration_months integer default 1;
alter table public.subscription_plans add column if not exists features jsonb default '[]'::jsonb;
alter table public.subscription_plans add column if not exists max_sales_entries integer default 1000;
alter table public.subscription_plans add column if not exists is_active boolean default true;
alter table public.subscription_plans add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());
alter table public.subscription_plans add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now());

-- Add missing columns to existing subscriptions table
alter table public.subscriptions add column if not exists plan_id uuid;
alter table public.subscriptions add column if not exists expires_at timestamp with time zone;

-- Create sales_entries table
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

-- Create expenses table
create table if not exists public.expenses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  description text not null,
  amount numeric(10,2) not null,
  category text,
  expense_date date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create notifications table
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

-- Create user_notifications table
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

drop policy if exists "Admin full access to user profiles" on public.user_profiles;
drop policy if exists "Admin full access to subscription plans" on public.subscription_plans;
drop policy if exists "Admin full access to sales entries" on public.sales_entries;
drop policy if exists "Admin full access to expenses" on public.expenses;
drop policy if exists "Admin full access to notifications" on public.notifications;
drop policy if exists "Admin full access to user notifications" on public.user_notifications;

-- Create permissive admin policies
create policy "Admin full access to user profiles" on public.user_profiles for all using (true);
create policy "Admin full access to subscription plans" on public.subscription_plans for all using (true);
create policy "Admin full access to sales entries" on public.sales_entries for all using (true);
create policy "Admin full access to expenses" on public.expenses for all using (true);
create policy "Admin full access to notifications" on public.notifications for all using (true);
create policy "Admin full access to user notifications" on public.user_notifications for all using (true);

-- Clear existing subscription plans to avoid conflicts
delete from public.subscription_plans;

-- Insert default subscription plans
insert into public.subscription_plans (name, price, duration_months, features, max_sales_entries) 
values 
  ('Starter', 9.99, 1, '["Basic sales tracking", "Up to 100 entries", "Email support"]'::jsonb, 100),
  ('Professional', 29.99, 1, '["Advanced analytics", "Up to 1000 entries", "Priority support", "Export features"]'::jsonb, 1000),
  ('Enterprise', 99.99, 1, '["Unlimited entries", "Team collaboration", "API access", "Custom integrations"]'::jsonb, -1);

-- Create admin analytics function
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

-- Create sample data only if there are existing auth users
do $$
declare
  existing_user_ids uuid[];
  user_id uuid;
  i integer;
begin
  -- Get existing auth user IDs
  select array_agg(id) into existing_user_ids from auth.users limit 5;
  
  -- Only create sample data if there are existing users
  if array_length(existing_user_ids, 1) > 0 then
    
    -- Clear existing sample data
    delete from public.sales_entries;
    delete from public.user_profiles;
    
    -- Create user profiles for existing auth users
    for i in 1..least(array_length(existing_user_ids, 1), 5) loop
      user_id := existing_user_ids[i];
      
      insert into public.user_profiles (id, full_name, company_name, is_active)
      values (
        user_id,
        'Sample User ' || i,
        'Company ' || i,
        case when i % 4 = 0 then false else true end
      )
      on conflict (id) do update set
        full_name = excluded.full_name,
        company_name = excluded.company_name,
        is_active = excluded.is_active;
    end loop;
    
    -- Create sample sales entries for the first user
    if array_length(existing_user_ids, 1) > 0 then
      user_id := existing_user_ids[1];
      
      for i in 1..20 loop
        insert into public.sales_entries (user_id, customer_name, amount, product_service, sale_date)
        values (
          user_id,
          'Customer ' || i,
          (random() * 1000 + 100)::numeric(10,2),
          'Product ' || i,
          current_date - (i || ' days')::interval
        );
      end loop;
    end if;
    
    raise notice 'Sample data created for % existing users', array_length(existing_user_ids, 1);
  else
    raise notice 'No existing auth users found. Sample data not created.';
    raise notice 'The admin panel will work but will show zero values until you have real users.';
  end if;
end $$;

-- Test the setup
select 'Database setup completed successfully!' as status;
select 'Auth users count: ' || count(*) as user_info from auth.users;
select 'User profiles count: ' || count(*) as profile_info from public.user_profiles;
select 'Sales entries count: ' || count(*) as sales_info from public.sales_entries;
select public.get_admin_analytics() as analytics_test;
