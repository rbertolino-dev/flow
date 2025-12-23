-- Add DELETE policy to allow users to clear their own call queue
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'call_queue' AND policyname = 'Users can delete their call queue'
  ) THEN
    CREATE POLICY "Users can delete their call queue"
    ON public.call_queue
    FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = call_queue.lead_id AND l.user_id = auth.uid()
      )
    );
  END IF;
END $$;