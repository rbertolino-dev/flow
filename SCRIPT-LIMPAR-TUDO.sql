-- ============================================
-- SCRIPT DE LIMPEZA COMPLETA
-- Execute este script ANTES de aplicar qualquer lote
-- Remove TODOS os objetos que podem causar conflito
-- ============================================

-- Google Calendar Configs - Triggers
DROP TRIGGER IF EXISTS trigger_google_calendar_configs_updated_at ON public.google_calendar_configs CASCADE;

-- Google Calendar Configs - Functions
DROP FUNCTION IF EXISTS public.update_google_calendar_configs_updated_at() CASCADE;

-- Calendar Events - Triggers
DROP TRIGGER IF EXISTS trigger_calendar_events_updated_at ON public.calendar_events CASCADE;

-- Calendar Events - Functions
DROP FUNCTION IF EXISTS public.update_calendar_events_updated_at() CASCADE;

-- Google Calendar Configs - Policies (todas)
DROP POLICY IF EXISTS "Configuração do Google Agenda: membros podem selecionar" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Configuração do Google Agenda: membros podem inserir" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Configuração do Google Agenda: membros podem atualizar" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Configuração do Google Agenda: membros podem excluir" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Google Calendar config: members can select" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Google Calendar config: members can insert" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Google Calendar config: members can update" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Google Calendar config: members can delete" ON public.google_calendar_configs;

-- Calendar Events - Policies (todas)
DROP POLICY IF EXISTS "Eventos do calendário: membros podem selecionar" ON public.calendar_events;
DROP POLICY IF EXISTS "Eventos do calendário: membros podem inserir" ON public.calendar_events;
DROP POLICY IF EXISTS "Eventos do calendário: membros podem atualizar" ON public.calendar_events;
DROP POLICY IF EXISTS "Eventos do calendário: membros podem excluir" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar events: members can select" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar events: members can insert" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar events: members can update" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar events: members can delete" ON public.calendar_events;

-- Outras policies conhecidas
DROP POLICY IF EXISTS "Service role can manage metrics" ON public.instance_health_metrics_hourly;
DROP POLICY IF EXISTS "Lead follow-ups: members can select" ON public.lead_follow_ups;
DROP POLICY IF EXISTS "Lead follow-ups: members can update" ON public.lead_follow_ups;

-- ============================================
-- FIM DO SCRIPT DE LIMPEZA
-- ============================================




