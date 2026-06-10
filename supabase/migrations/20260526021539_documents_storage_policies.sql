-- Storage RLS policies for the 'documents' bucket
-- Allows authenticated users to upload, read, and delete property documents

-- SELECT (download / list)
DROP POLICY IF EXISTS "authenticated_read_documents" ON storage.objects;
CREATE POLICY "authenticated_read_documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- INSERT (upload)
DROP POLICY IF EXISTS "authenticated_upload_documents" ON storage.objects;
CREATE POLICY "authenticated_upload_documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- UPDATE (upsert / overwrite)
DROP POLICY IF EXISTS "authenticated_update_documents" ON storage.objects;
CREATE POLICY "authenticated_update_documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');

-- DELETE
DROP POLICY IF EXISTS "authenticated_delete_documents" ON storage.objects;
CREATE POLICY "authenticated_delete_documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'documents');
