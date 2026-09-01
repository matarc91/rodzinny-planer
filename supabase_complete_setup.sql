-- ====================================================================
-- RODZINNY PLANER - KOMPLEKSOWA KONFIGURACJA BAZY SUPABASE Z RLS
-- ====================================================================
-- Ten skrypt jest w 100% bezpieczny (idempotentny) – naprawia brakujące
-- kolumny w istniejących tabelach, włącza Row-Level Security (RLS),
-- tworzy polityki bezpieczeństwa oraz konfiguruje trigger i Realtime.
--
-- INSTRUKCJA:
-- Wklej poniższy kod w: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ====================================================================

-- 0. USUNIĘCIE ARCHIWALNYCH TABEL (likwiduje ostrzeżenia RLS dla starych tabel)
DROP TABLE IF EXISTS public.family_data CASCADE;

-- 1. TABELA: families (Gospodarstwa domowe / grupy rodzinne)
CREATE TABLE IF NOT EXISTS public.families (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    join_code TEXT UNIQUE NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Zapewnienie istnienia wszystkich kolumn w families (gdy tabela już istniała)
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS join_code TEXT;
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_families_join_code ON public.families(join_code);


-- 2. TABELA: profiles (Profile użytkowników połączone z kontami Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
    person_id TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Zapewnienie istnienia wszystkich kolumn w profiles (naprawia błąd: column "email" does not exist)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.families(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS person_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Uzupełnienie brakujących adresów email z auth.users
UPDATE public.profiles p
SET email = LOWER(u.email)
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

CREATE INDEX IF NOT EXISTS idx_profiles_family_id ON public.profiles(family_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);


-- 3. TABELA: family_state (Współdzielony stan rodziny: zadania, kalendarz, budżet, posiłki)
CREATE TABLE IF NOT EXISTS public.family_state (
    family_id UUID PRIMARY KEY REFERENCES public.families(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Zapewnienie istnienia wszystkich kolumn w family_state
ALTER TABLE public.family_state ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.family_state ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();


-- 4. TABELA: push_subscriptions (Tokeny Web Push urządzeń użytkowników)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Zapewnienie istnienia wszystkich kolumn w push_subscriptions
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.families(id) ON DELETE CASCADE;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS endpoint TEXT;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS p256dh TEXT;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS auth TEXT;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_push_subs_family ON public.push_subscriptions(family_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);


-- 5. TABELA: sent_push_logs (De-duplikacja powiadomień w tle / CRON)
CREATE TABLE IF NOT EXISTS public.sent_push_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    log_key TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sent_push_logs_key ON public.sent_push_logs(log_key);


-- ====================================================================
-- FUNKCJA POMOCNICZA DLA RLS (Zapobiega nieskończonej rekurencji w RLS)
-- ====================================================================

CREATE OR REPLACE FUNCTION public.get_current_user_family_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_id FROM public.profiles WHERE id = auth.uid();
$$;


-- ====================================================================
-- WŁĄCZENIE ROW LEVEL SECURITY (RLS) NA WSZYSTKICH TABELACH
-- ====================================================================

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_push_logs ENABLE ROW LEVEL SECURITY;


-- ====================================================================
-- POLITYKI BEZPIECZEŃSTWA (RLS POLICIES)
-- ====================================================================

-- --------------------------------------------------------------------
-- A. TABELA: profiles
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Użytkownicy mogą odczytywać swój profil lub profil z tej samej rodziny" ON public.profiles;
CREATE POLICY "Użytkownicy mogą odczytywać swój profil lub profil z tej samej rodziny"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    id = auth.uid()
    OR (family_id IS NOT NULL AND family_id = public.get_current_user_family_id())
);

DROP POLICY IF EXISTS "Użytkownicy mogą tworzyć swój profil" ON public.profiles;
CREATE POLICY "Użytkownicy mogą tworzyć swój profil"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
    id = auth.uid()
);

DROP POLICY IF EXISTS "Użytkownicy mogą aktualizować swój profil lub odpiąć profil w rodzinie" ON public.profiles;
CREATE POLICY "Użytkownicy mogą aktualizować swój profil lub odpiąć profil w rodzinie"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    id = auth.uid()
    OR (family_id IS NOT NULL AND family_id = public.get_current_user_family_id())
)
WITH CHECK (
    id = auth.uid()
    OR (family_id IS NOT NULL AND family_id = public.get_current_user_family_id())
);

DROP POLICY IF EXISTS "Użytkownicy mogą usuwać swój profil" ON public.profiles;
CREATE POLICY "Użytkownicy mogą usuwać swój profil"
ON public.profiles
FOR DELETE
TO authenticated
USING (
    id = auth.uid()
);

-- --------------------------------------------------------------------
-- B. TABELA: families
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Zalogowani mogą wyszukiwać rodziny kodem lub odczytywać swoją rodzinę" ON public.families;
CREATE POLICY "Zalogowani mogą wyszukiwać rodziny kodem lub odczytywać swoją rodzinę"
ON public.families
FOR SELECT
TO authenticated
USING (
    id = public.get_current_user_family_id()
    OR join_code IS NOT NULL
);

DROP POLICY IF EXISTS "Zalogowani mogą zakładać nowe rodziny" ON public.families;
CREATE POLICY "Zalogowani mogą zakładać nowe rodziny"
ON public.families
FOR INSERT
TO authenticated
WITH CHECK (
    auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Członkowie rodziny mogą ją aktualizować" ON public.families;
CREATE POLICY "Członkowie rodziny mogą ją aktualizować"
ON public.families
FOR UPDATE
TO authenticated
USING (
    id = public.get_current_user_family_id()
)
WITH CHECK (
    id = public.get_current_user_family_id()
);

DROP POLICY IF EXISTS "Członkowie lub założyciel mogą usunąć rodzinę" ON public.families;
CREATE POLICY "Członkowie lub założyciel mogą usunąć rodzinę"
ON public.families
FOR DELETE
TO authenticated
USING (
    id = public.get_current_user_family_id()
    OR created_by = auth.uid()
);

-- --------------------------------------------------------------------
-- C. TABELA: family_state
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Członkowie rodziny mogą odczytywać stan rodziny" ON public.family_state;
CREATE POLICY "Członkowie rodziny mogą odczytywać stan rodziny"
ON public.family_state
FOR SELECT
TO authenticated
USING (
    family_id = public.get_current_user_family_id()
);

DROP POLICY IF EXISTS "Zalogowani mogą inicjalizować stan rodziny" ON public.family_state;
CREATE POLICY "Zalogowani mogą inicjalizować stan rodziny"
ON public.family_state
FOR INSERT
TO authenticated
WITH CHECK (
    auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Członkowie rodziny mogą aktualizować stan rodziny" ON public.family_state;
CREATE POLICY "Członkowie rodziny mogą aktualizować stan rodziny"
ON public.family_state
FOR UPDATE
TO authenticated
USING (
    family_id = public.get_current_user_family_id()
)
WITH CHECK (
    family_id = public.get_current_user_family_id()
);

DROP POLICY IF EXISTS "Członkowie rodziny mogą usuwać stan rodziny" ON public.family_state;
CREATE POLICY "Członkowie rodziny mogą usuwać stan rodziny"
ON public.family_state
FOR DELETE
TO authenticated
USING (
    family_id = public.get_current_user_family_id()
);

-- --------------------------------------------------------------------
-- D. TABELA: push_subscriptions
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Użytkownicy zarządzają swoimi subskrypcjami push" ON public.push_subscriptions;
CREATE POLICY "Użytkownicy zarządzają swoimi subskrypcjami push"
ON public.push_subscriptions
FOR ALL
TO authenticated
USING (
    auth.uid() = user_id
)
WITH CHECK (
    auth.uid() = user_id
);

-- --------------------------------------------------------------------
-- E. TABELA: sent_push_logs
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Dostęp do logów dla serwisu i zalogowanych" ON public.sent_push_logs;
CREATE POLICY "Dostęp do logów dla serwisu i zalogowanych"
ON public.sent_push_logs
FOR ALL
USING (true)
WITH CHECK (true);


-- ====================================================================
-- AUTOMATYCZNY TRIGGER TWORZENIA PROFILU PO REJESTRACJI W AUTH
-- ====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, family_id, person_id)
  VALUES (NEW.id, LOWER(NEW.email), NULL, NULL)
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ====================================================================
-- KONFIGURACJA SUPABASE REALTIME (Synchronizacja WebSocket w czasie rzeczywistym)
-- ====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'family_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.family_state;
  END IF;
END $$;
