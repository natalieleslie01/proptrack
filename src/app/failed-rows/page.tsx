import AppLayout from '@/components/AppLayout';
import FailedRowsClient from './components/FailedRowsClient';

export default function FailedRowsPage() {
  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <FailedRowsClient />
      </div>
    </AppLayout>
  );
}
