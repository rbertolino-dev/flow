-- Add commission columns to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS commission_percentage numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS commission_fixed numeric DEFAULT NULL;