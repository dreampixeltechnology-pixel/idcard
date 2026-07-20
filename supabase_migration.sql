-- Supabase SQL Migrations for SaaS ID Card Generator
-- Run this in your Supabase SQL Editor.

-- 1. Enable Auth (handled by Supabase automatically, but let's make sure the trigger handles profiles creation)

-- 2. Create Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger to automatically create profiles when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 3. Create Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure code is unique per user (or globally if preferred, the prompt says "code TEXT UNIQUE NOT NULL" and "code must be unique per user")
-- We'll add a unique constraint on code globally or unique per user. The prompt says "code TEXT UNIQUE NOT NULL" in the database outline, and "code must be unique per user" in the Org outline. Let's make it UNIQUE.
ALTER TABLE public.organizations ADD CONSTRAINT organizations_code_unique UNIQUE (code);

-- Enable RLS for organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own organizations"
  ON public.organizations FOR ALL
  USING (auth.uid() = user_id);


-- 4. Create Departments table
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  expected_count INTEGER NOT NULL DEFAULT 0,
  fields_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT departments_org_code_unique UNIQUE (org_id, code)
);

-- Enable RLS for departments
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD departments of their organizations"
  ON public.departments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organizations org
      WHERE org.id = departments.org_id AND org.user_id = auth.uid()
    )
  );


-- 5. Create Records table
CREATE TABLE IF NOT EXISTS public.records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dept_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
  serial_number INTEGER NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  photo_url TEXT,
  photo_uploaded BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT records_dept_serial_unique UNIQUE (dept_id, serial_number)
);

-- Enable RLS for records
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD records of their departments"
  ON public.records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.departments dept
      JOIN public.organizations org ON org.id = dept.org_id
      WHERE dept.id = records.dept_id AND org.user_id = auth.uid()
    )
  );


-- 6. Create Card Designs table
CREATE TABLE IF NOT EXISTS public.card_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dept_id UUID UNIQUE REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
  orientation TEXT NOT NULL DEFAULT 'horizontal' CHECK(orientation IN ('horizontal','vertical')),
  background_url TEXT,
  fields_config JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for card_designs
ALTER TABLE public.card_designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD card designs of their departments"
  ON public.card_designs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.departments dept
      JOIN public.organizations org ON org.id = dept.org_id
      WHERE dept.id = card_designs.dept_id AND org.user_id = auth.uid()
    )
  );


-- 7. Storage bucket config (or manual setup instructions):
-- Make sure to create a public storage bucket named "org-images" in your Supabase Dashboard under Storage.
-- Set up Storage Policies for "org-images" bucket:
-- Allow authenticated users to upload, update, and delete images in "org-images" bucket.


-- 8. Organization Address and Contact details for renewal reminders
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS seal_url TEXT;

