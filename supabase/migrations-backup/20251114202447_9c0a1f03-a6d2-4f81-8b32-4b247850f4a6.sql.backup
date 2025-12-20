-- Grant permissions so PostgREST exposes the new workflow tables to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_workflows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_workflow_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_workflow_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_workflow_contact_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_workflow_approvals TO authenticated;

-- Future-proof: make new tables in public automatically visible to authenticated users
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- Ask PostgREST to reload the schema cache immediately
NOTIFY pgrst, 'reload schema';