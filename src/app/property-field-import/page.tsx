import AppLayout from '@/components/AppLayout';
import PropertyFieldImportClient from './components/PropertyFieldImportClient';

export const metadata = {
  title: 'Property Field Import | PropTrack',
  description: 'Update property fields by PID via CSV',
};

export default function PropertyFieldImportPage() {
  return (
    <AppLayout>
      <PropertyFieldImportClient />
    </AppLayout>
  );
}
