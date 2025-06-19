-- Insert default subscription plans
INSERT INTO public.subscription_plans (name, price, features, max_transactions) VALUES
('Starter', 9.99, '{"receipt_customization": true, "basic_reports": true, "email_support": true}', 100),
('Professional', 29.99, '{"receipt_customization": true, "advanced_reports": true, "priority_support": true, "export_data": true}', 1000),
('Enterprise', 99.99, '{"receipt_customization": true, "advanced_reports": true, "priority_support": true, "export_data": true, "api_access": true, "custom_integrations": true}', -1);

-- Create a super admin user (you'll need to sign up with this email first)
-- This is just a placeholder - the actual user will be created through Supabase Auth
INSERT INTO public.users (id, email, full_name, role) VALUES
('00000000-0000-0000-0000-000000000000', 'admin@example.com', 'Super Admin', 'super_admin')
ON CONFLICT (id) DO UPDATE SET role = 'super_admin';

-- Create sample notification
INSERT INTO public.notifications (title, message, target_role) VALUES
('Welcome to SalesTracker', 'Thank you for joining our platform! Start by setting up your business profile.', 'business_owner');
