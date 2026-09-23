-- Cada item do checklist pode ser checkpoint (marcar) ou texto (escrever)

ALTER TABLE public.service_order_checklist_items
  ADD COLUMN IF NOT EXISTS response_type TEXT NOT NULL DEFAULT 'checkpoint',
  ADD COLUMN IF NOT EXISTS answer TEXT;

ALTER TABLE public.service_order_checklist_items
  DROP CONSTRAINT IF EXISTS service_order_checklist_items_response_type_check;

ALTER TABLE public.service_order_checklist_items
  ADD CONSTRAINT service_order_checklist_items_response_type_check
  CHECK (response_type IN ('checkpoint', 'text'));
