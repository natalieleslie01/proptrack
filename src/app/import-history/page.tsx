import ImportHistoryClient from './components/ImportHistoryClient';

export const metadata = {
  title: 'Import History | PropTrack HK',
  description: 'Track all bulk CSV and photo imports — status, errors, record counts, and rollback options.',
};

export default function ImportHistoryPage() {
  return <ImportHistoryClient />;
}
