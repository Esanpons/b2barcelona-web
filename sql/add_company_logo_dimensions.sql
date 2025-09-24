ALTER TABLE public.company
    ADD COLUMN invoice_logo_max_width integer DEFAULT 220,
    ADD COLUMN invoice_logo_max_height integer DEFAULT 220;
