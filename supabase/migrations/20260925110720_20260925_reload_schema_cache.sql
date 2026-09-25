-- Ensure the clans table has the description column
ALTER TABLE public.clans ADD COLUMN IF NOT EXISTS description text DEFAULT '';

-- Reload the PostgREST schema cache to ensure the API recognizes the new column
NOTIFY pgrst, 'reload schema';
