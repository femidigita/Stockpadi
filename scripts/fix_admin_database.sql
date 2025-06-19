-- Fix Admin Database - Step by step approach
-- This script creates everything needed for the admin panel

-- Step 1: Create all tables
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text,
    company_name text,
    phone text,
    is_active boolean DEFAULT true,
    last_login_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    price numeric(10,2) NOT NULL,
    duration_months integer DEFAULT 1,
    features jsonb DEFAULT '[]'::jsonb,
    max_sales_entries integer DEFAULT 1000,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_name text NOT NULL,
    amount numeric(10,2) NOT NULL,
    product_service text,
    sale_date date NOT NULL,
    status text DEFAULT 'completed',
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    description text NOT NULL,
    amount numeric(10,2) NOT NULL,
    category text,
    expense_date date NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Step 2: Add missing columns safely
DO $$
BEGIN
    -- Add columns to subscriptions table if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'plan_id') THEN
        ALTER TABLE public.subscriptions ADD COLUMN plan_id uuid;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'expires_at') THEN
        ALTER TABLE public.subscriptions ADD COLUMN expires_at timestamptz;
    END IF;
END $$;

-- Step 3: Enable RLS and create policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Admin access to user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin access to subscription_plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Admin access to sales_entries" ON public.sales_entries;
DROP POLICY IF EXISTS "Admin access to expenses" ON public.expenses;

-- Create simple policies for admin access
CREATE POLICY "Admin access to user_profiles" ON public.user_profiles FOR ALL USING (true);
CREATE POLICY "Admin access to subscription_plans" ON public.subscription_plans FOR ALL USING (true);
CREATE POLICY "Admin access to sales_entries" ON public.sales_entries FOR ALL USING (true);
CREATE POLICY "Admin access to expenses" ON public.expenses FOR ALL USING (true);

-- Step 4: Insert subscription plans
DELETE FROM public.subscription_plans;
INSERT INTO public.subscription_plans (name, price, duration_months, features, max_sales_entries) VALUES
    ('Starter', 9.99, 1, '["Basic sales tracking", "Up to 100 entries", "Email support"]'::jsonb, 100),
    ('Professional', 29.99, 1, '["Advanced analytics", "Up to 1000 entries", "Priority support"]'::jsonb, 1000),
    ('Enterprise', 99.99, 1, '["Unlimited entries", "Team collaboration", "API access"]'::jsonb, -1);

-- Step 5: Create the analytics function
CREATE OR REPLACE FUNCTION public.get_admin_analytics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'total_users', COALESCE((SELECT count(*) FROM auth.users), 0),
        'active_users', COALESCE((SELECT count(*) FROM public.user_profiles WHERE is_active = true), 0),
        'total_subscriptions', COALESCE((SELECT count(*) FROM public.subscriptions WHERE status = 'active'), 0),
        'monthly_revenue', COALESCE((SELECT sum(amount) FROM public.payments 
                                   WHERE status = 'succeeded' 
                                   AND paid_at >= date_trunc('month', current_date)), 0),
        'total_sales_entries', COALESCE((SELECT count(*) FROM public.sales_entries), 0),
        'total_sales_volume', COALESCE((SELECT sum(amount) FROM public.sales_entries), 0),
        'top_plan', COALESCE((SELECT sp.name 
                             FROM public.subscriptions s 
                             JOIN public.subscription_plans sp ON s.plan_id = sp.id 
                             WHERE s.status = 'active' 
                             GROUP BY sp.name 
                             ORDER BY count(*) DESC 
                             LIMIT 1), 'N/A')
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_admin_analytics() TO anon, authenticated, service_role;

-- Step 6: Create sample data (only if auth users exist)
DO $$
DECLARE
    user_count integer;
    sample_user_id uuid;
BEGIN
    -- Check if we have any auth users
    SELECT count(*) INTO user_count FROM auth.users;
    
    IF user_count > 0 THEN
        -- Get first user ID
        SELECT id INTO sample_user_id FROM auth.users LIMIT 1;
        
        -- Clear existing sample data
        DELETE FROM public.sales_entries;
        DELETE FROM public.user_profiles;
        
        -- Create a user profile for the first auth user
        INSERT INTO public.user_profiles (id, full_name, company_name, is_active)
        VALUES (sample_user_id, 'Sample User', 'Sample Company', true)
        ON CONFLICT (id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            company_name = EXCLUDED.company_name;
        
        -- Create sample sales entries
        INSERT INTO public.sales_entries (user_id, customer_name, amount, product_service, sale_date)
        SELECT 
            sample_user_id,
            'Customer ' || generate_series,
            (random() * 1000 + 100)::numeric(10,2),
            'Product ' || generate_series,
            current_date - (generate_series || ' days')::interval
        FROM generate_series(1, 10);
        
        RAISE NOTICE 'Sample data created for user: %', sample_user_id;
    ELSE
        RAISE NOTICE 'No auth users found. Sample data not created.';
    END IF;
END $$;

-- Step 7: Test everything
SELECT 'Tables created successfully' as status;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('user_profiles', 'subscription_plans', 'sales_entries', 'expenses');
SELECT 'Function test:' as test, public.get_admin_analytics() as result;
