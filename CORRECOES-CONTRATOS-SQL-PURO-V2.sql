DROP POLICY IF EXISTS "Users can view contracts from their organization" ON public.contracts;
DROP POLICY IF EXISTS "Users can create contracts in their organization" ON public.contracts;
DROP POLICY IF EXISTS "Users can update contracts in their organization" ON public.contracts;
DROP POLICY IF EXISTS "Admins can delete contracts" ON public.contracts;

CREATE POLICY "Users can view contracts from their organization"
ON public.contracts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create contracts in their organization"
ON public.contracts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update contracts in their organization"
ON public.contracts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete contracts"
ON public.contracts FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Users can view templates from their organization" ON public.contract_templates;
DROP POLICY IF EXISTS "Users can create templates in their organization" ON public.contract_templates;
DROP POLICY IF EXISTS "Users can update templates in their organization" ON public.contract_templates;
DROP POLICY IF EXISTS "Admins can delete templates" ON public.contract_templates;

CREATE POLICY "Users can view templates from their organization"
ON public.contract_templates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create templates in their organization"
ON public.contract_templates FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update templates in their organization"
ON public.contract_templates FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete templates"
ON public.contract_templates FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Users can view signatures from their organization" ON public.contract_signatures;
DROP POLICY IF EXISTS "Users can create signatures for contracts in their organization" ON public.contract_signatures;

CREATE POLICY "Users can view signatures from their organization"
ON public.contract_signatures FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_signatures.contract_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create signatures for contracts in their organization"
ON public.contract_signatures FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_signatures.contract_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE TABLE IF NOT EXISTS public.contract_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('signature_due', 'expiration_approaching', 'follow_up', 'custom', 'expiration_warning', 'unsigned_reminder')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  message TEXT,
  sent_via TEXT CHECK (sent_via IN ('whatsapp', 'email', 'sms', 'system', 'both')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_reminders_contract ON public.contract_reminders(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_reminders_scheduled ON public.contract_reminders(scheduled_at) WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contract_reminders_type ON public.contract_reminders(reminder_type);

ALTER TABLE public.contract_reminders 
DROP CONSTRAINT IF EXISTS contract_reminders_reminder_type_check;

ALTER TABLE public.contract_reminders 
ADD CONSTRAINT contract_reminders_reminder_type_check 
CHECK (reminder_type IN ('signature_due', 'expiration_approaching', 'follow_up', 'custom', 'expiration_warning', 'unsigned_reminder'));

ALTER TABLE public.contract_reminders 
DROP CONSTRAINT IF EXISTS contract_reminders_sent_via_check;

ALTER TABLE public.contract_reminders 
ADD CONSTRAINT contract_reminders_sent_via_check 
CHECK (sent_via IN ('whatsapp', 'email', 'sms', 'system', 'both'));

ALTER TABLE public.contract_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view reminders of contracts in their organization" ON public.contract_reminders;
DROP POLICY IF EXISTS "Users can create reminders for contracts in their organization" ON public.contract_reminders;
DROP POLICY IF EXISTS "Users can update reminders of contracts in their organization" ON public.contract_reminders;
DROP POLICY IF EXISTS "Users can delete reminders of contracts in their organization" ON public.contract_reminders;

CREATE POLICY "Users can view reminders of contracts in their organization"
ON public.contract_reminders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_reminders.contract_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create reminders for contracts in their organization"
ON public.contract_reminders FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_reminders.contract_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update reminders of contracts in their organization"
ON public.contract_reminders FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_reminders.contract_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can delete reminders of contracts in their organization"
ON public.contract_reminders FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_reminders.contract_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE TABLE IF NOT EXISTS public.contract_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  icon TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.contract_categories(id) ON DELETE SET NULL;

ALTER TABLE public.contract_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view categories from their organization" ON public.contract_categories;
DROP POLICY IF EXISTS "Users can create categories in their organization" ON public.contract_categories;
DROP POLICY IF EXISTS "Users can update categories in their organization" ON public.contract_categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON public.contract_categories;

CREATE POLICY "Users can view categories from their organization"
ON public.contract_categories FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_categories.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create categories in their organization"
ON public.contract_categories FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_categories.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update categories in their organization"
ON public.contract_categories FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_categories.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete categories"
ON public.contract_categories FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_categories.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE INDEX IF NOT EXISTS idx_contract_categories_org ON public.contract_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_contract_categories_active ON public.contract_categories(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_contracts_category ON public.contracts(category_id) WHERE category_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_pubdigital_user(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members om
    INNER JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = user_id
      AND LOWER(o.name) = 'pubdigital'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_role(user_id UUID, role_name app_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = user_id
      AND ur.role = role_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS public.contract_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN (
    'created', 'updated', 'deleted', 'sent', 'signed', 'cancelled', 
    'expired', 'viewed', 'downloaded', 'pdf_generated', 'reminder_sent',
    'category_changed', 'status_changed', 'expiration_warning', 'unsigned_reminder'
  )),
  details JSONB DEFAULT '{}'::jsonb,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_audit_log_contract ON public.contract_audit_log(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_audit_log_user ON public.contract_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_contract_audit_log_action ON public.contract_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_contract_audit_log_timestamp ON public.contract_audit_log(timestamp DESC);

ALTER TABLE public.contract_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view audit logs of contracts in their organization" ON public.contract_audit_log;
DROP POLICY IF EXISTS "Authenticated users can create audit logs" ON public.contract_audit_log;

CREATE POLICY "Users can view audit logs of contracts in their organization"
ON public.contract_audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_audit_log.contract_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Authenticated users can create audit logs"
ON public.contract_audit_log FOR INSERT
TO authenticated
WITH CHECK (true);




DROP POLICY IF EXISTS "Users can update contracts in their organization" ON public.contracts;
DROP POLICY IF EXISTS "Admins can delete contracts" ON public.contracts;

CREATE POLICY "Users can view contracts from their organization"
ON public.contracts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create contracts in their organization"
ON public.contracts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update contracts in their organization"
ON public.contracts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete contracts"
ON public.contracts FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Users can view templates from their organization" ON public.contract_templates;
DROP POLICY IF EXISTS "Users can create templates in their organization" ON public.contract_templates;
DROP POLICY IF EXISTS "Users can update templates in their organization" ON public.contract_templates;
DROP POLICY IF EXISTS "Admins can delete templates" ON public.contract_templates;

CREATE POLICY "Users can view templates from their organization"
ON public.contract_templates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create templates in their organization"
ON public.contract_templates FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update templates in their organization"
ON public.contract_templates FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete templates"
ON public.contract_templates FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Users can view signatures from their organization" ON public.contract_signatures;
DROP POLICY IF EXISTS "Users can create signatures for contracts in their organization" ON public.contract_signatures;

CREATE POLICY "Users can view signatures from their organization"
ON public.contract_signatures FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_signatures.contract_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create signatures for contracts in their organization"
ON public.contract_signatures FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_signatures.contract_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE TABLE IF NOT EXISTS public.contract_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('signature_due', 'expiration_approaching', 'follow_up', 'custom', 'expiration_warning', 'unsigned_reminder')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  message TEXT,
  sent_via TEXT CHECK (sent_via IN ('whatsapp', 'email', 'sms', 'system', 'both')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_reminders_contract ON public.contract_reminders(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_reminders_scheduled ON public.contract_reminders(scheduled_at) WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contract_reminders_type ON public.contract_reminders(reminder_type);

ALTER TABLE public.contract_reminders 
DROP CONSTRAINT IF EXISTS contract_reminders_reminder_type_check;

ALTER TABLE public.contract_reminders 
ADD CONSTRAINT contract_reminders_reminder_type_check 
CHECK (reminder_type IN ('signature_due', 'expiration_approaching', 'follow_up', 'custom', 'expiration_warning', 'unsigned_reminder'));

ALTER TABLE public.contract_reminders 
DROP CONSTRAINT IF EXISTS contract_reminders_sent_via_check;

ALTER TABLE public.contract_reminders 
ADD CONSTRAINT contract_reminders_sent_via_check 
CHECK (sent_via IN ('whatsapp', 'email', 'sms', 'system', 'both'));

ALTER TABLE public.contract_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view reminders of contracts in their organization" ON public.contract_reminders;
DROP POLICY IF EXISTS "Users can create reminders for contracts in their organization" ON public.contract_reminders;
DROP POLICY IF EXISTS "Users can update reminders of contracts in their organization" ON public.contract_reminders;
DROP POLICY IF EXISTS "Users can delete reminders of contracts in their organization" ON public.contract_reminders;

CREATE POLICY "Users can view reminders of contracts in their organization"
ON public.contract_reminders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_reminders.contract_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create reminders for contracts in their organization"
ON public.contract_reminders FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_reminders.contract_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update reminders of contracts in their organization"
ON public.contract_reminders FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_reminders.contract_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can delete reminders of contracts in their organization"
ON public.contract_reminders FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_reminders.contract_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE TABLE IF NOT EXISTS public.contract_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  icon TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.contract_categories(id) ON DELETE SET NULL;

ALTER TABLE public.contract_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view categories from their organization" ON public.contract_categories;
DROP POLICY IF EXISTS "Users can create categories in their organization" ON public.contract_categories;
DROP POLICY IF EXISTS "Users can update categories in their organization" ON public.contract_categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON public.contract_categories;

CREATE POLICY "Users can view categories from their organization"
ON public.contract_categories FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_categories.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create categories in their organization"
ON public.contract_categories FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_categories.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update categories in their organization"
ON public.contract_categories FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_categories.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete categories"
ON public.contract_categories FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_categories.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE INDEX IF NOT EXISTS idx_contract_categories_org ON public.contract_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_contract_categories_active ON public.contract_categories(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_contracts_category ON public.contracts(category_id) WHERE category_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_pubdigital_user(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members om
    INNER JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = user_id
      AND LOWER(o.name) = 'pubdigital'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_role(user_id UUID, role_name app_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = user_id
      AND ur.role = role_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS public.contract_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN (
    'created', 'updated', 'deleted', 'sent', 'signed', 'cancelled', 
    'expired', 'viewed', 'downloaded', 'pdf_generated', 'reminder_sent',
    'category_changed', 'status_changed', 'expiration_warning', 'unsigned_reminder'
  )),
  details JSONB DEFAULT '{}'::jsonb,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_audit_log_contract ON public.contract_audit_log(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_audit_log_user ON public.contract_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_contract_audit_log_action ON public.contract_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_contract_audit_log_timestamp ON public.contract_audit_log(timestamp DESC);

ALTER TABLE public.contract_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view audit logs of contracts in their organization" ON public.contract_audit_log;
DROP POLICY IF EXISTS "Authenticated users can create audit logs" ON public.contract_audit_log;

CREATE POLICY "Users can view audit logs of contracts in their organization"
ON public.contract_audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_audit_log.contract_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Authenticated users can create audit logs"
ON public.contract_audit_log FOR INSERT
TO authenticated
WITH CHECK (true);

