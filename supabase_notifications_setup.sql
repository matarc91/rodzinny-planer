-- ====================================================================
-- INSTRUKCJA DLA SUPABASE: Web Push & Powiadomienia w tle dla Rodzinnego Planera
-- Wklej poniższy kod w: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ====================================================================

-- 1. Tabela do przechowywania subskrypcji Web Push urządzeń użytkowników
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

-- Indeksy dla szybkiego wyszukiwania
CREATE INDEX IF NOT EXISTS idx_push_subs_family ON public.push_subscriptions(family_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);

-- Włączenie RLS dla tabeli subskrypcji
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Polityki dostępu (RLS):
DROP POLICY IF EXISTS "Użytkownicy zarządzają swoimi subskrypcjami push" ON public.push_subscriptions;
CREATE POLICY "Użytkownicy zarządzają swoimi subskrypcjami push" 
ON public.push_subscriptions 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- 3. Tabela do zapobiegania powielaniu przypomnień CRON (de-duplikacja jednorazowych wysyłek)
-- Jeśli tabela istniała ze starą strukturą, czyścimy ją
DROP TABLE IF EXISTS public.sent_push_logs CASCADE;

CREATE TABLE public.sent_push_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    log_key TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sent_push_logs_key ON public.sent_push_logs(log_key);

ALTER TABLE public.sent_push_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Dostęp do logów dla serwisu i zalogowanych" ON public.sent_push_logs;
CREATE POLICY "Dostęp do logów dla serwisu i zalogowanych" ON public.sent_push_logs FOR ALL USING (true) WITH CHECK (true);

