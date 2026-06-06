
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "categories admin write" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Resources
CREATE TABLE public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  long_description TEXT DEFAULT '',
  version TEXT NOT NULL DEFAULT '1.0.0',
  mc_version TEXT NOT NULL DEFAULT '1.20+',
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  author TEXT NOT NULL DEFAULT 'Cubyn Team',
  thumbnail_url TEXT,
  file_url TEXT,
  external_url TEXT,
  file_size BIGINT DEFAULT 0,
  changelog TEXT DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  download_count BIGINT NOT NULL DEFAULT 0,
  featured BOOLEAN NOT NULL DEFAULT false,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.resources TO anon, authenticated;
GRANT ALL ON public.resources TO service_role;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resources public read" ON public.resources FOR SELECT USING (published = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "resources admin write" ON public.resources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER resources_updated_at BEFORE UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_resources_category ON public.resources(category_id);
CREATE INDEX idx_resources_featured ON public.resources(featured) WHERE featured;
CREATE INDEX idx_resources_created ON public.resources(created_at DESC);

-- Screenshots
CREATE TABLE public.resource_screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.resource_screenshots TO anon, authenticated;
GRANT ALL ON public.resource_screenshots TO service_role;
ALTER TABLE public.resource_screenshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "screenshots public read" ON public.resource_screenshots FOR SELECT USING (true);
CREATE POLICY "screenshots admin write" ON public.resource_screenshots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Site settings (singleton)
CREATE TABLE public.site_settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings public read" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "settings admin write" ON public.site_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Download counter (atomic, callable by anyone)
CREATE OR REPLACE FUNCTION public.increment_download(_resource_id UUID)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_count BIGINT;
BEGIN
  UPDATE public.resources SET download_count = download_count + 1
  WHERE id = _resource_id AND published = true
  RETURNING download_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END; $$;
GRANT EXECUTE ON FUNCTION public.increment_download(UUID) TO anon, authenticated;

-- Seed categories
INSERT INTO public.categories (slug, name, icon, description, sort_order) VALUES
  ('plugins','Plugins','Puzzle','Server plugins and extensions',1),
  ('skripts','Skripts','Code','Skript scripts and addons',2),
  ('configs','Configs','Settings','Ready-to-use configurations',3),
  ('setups','Setups','Layers','Complete server setups',4),
  ('models','Models','Box','3D models and resource items',5),
  ('maps','Maps','Map','Maps and worlds',6),
  ('utilities','Utilities','Wrench','Tools and utilities',7),
  ('other','Other','Sparkles','Everything else',8);

-- Seed settings
INSERT INTO public.site_settings (id, data) VALUES ('main', '{
  "hero": {
    "title": "Cubyn Spigot",
    "subtitle": "The Ultimate Minecraft Resource Library",
    "description": "A modern platform where Minecraft server owners and developers can discover and download plugins, skripts, configurations, maps, setups, and more.",
    "primaryCta": "Browse Resources",
    "secondaryCta": "Latest Uploads"
  },
  "about": {
    "title": "About Cubyn Spigot",
    "body": "Cubyn Spigot is a community-driven hub for Minecraft creators. We curate high-quality plugins, skripts, maps, models and complete server setups — all free, all instant. No paywalls, no accounts, no friction. Just download and build."
  },
  "contact": {
    "email": "contact@cubynspigot.dev",
    "discord": "https://discord.gg/cubyn",
    "twitter": "",
    "github": ""
  },
  "footer": {
    "tagline": "Premium Minecraft resources, free for everyone."
  }
}'::jsonb);
