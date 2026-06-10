-- Property Documents table for storing document metadata (R&V PDFs, etc.)
CREATE TABLE IF NOT EXISTS public.property_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_ref TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'government-valuation',
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes BIGINT,
  uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_property_documents_property_ref ON public.property_documents(property_ref);
CREATE INDEX IF NOT EXISTS idx_property_documents_document_type ON public.property_documents(document_type);

ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_manage_property_documents" ON public.property_documents;
CREATE POLICY "authenticated_manage_property_documents"
ON public.property_documents
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
