'use client';
import { useState } from 'react';

export default function DeduplicatePropertiesPage() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{
    before?: number;
    after?: number;
    removed?: number;
    uniqueRefs?: number;
    error?: string;
  } | null>(null);

  // Clear All state
  const [clearStatus, setClearStatus] = useState<'idle' | 'confirming' | 'running' | 'done' | 'error'>('idle');
  const [clearResult, setClearResult] = useState<{
    before?: number;
    after?: number;
    deleted?: number;
    error?: string;
  } | null>(null);

  const run = async () => {
    setStatus('running');
    setResult(null);
    try {
      const res = await fetch('/api/admin/deduplicate-properties', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setResult({
          before: data.before,
          after: data.after,
          removed: data.removed,
          uniqueRefs: data.uniqueRefs,
        });
        setStatus('done');
      } else {
        setResult({ error: data.error });
        setStatus('error');
      }
    } catch (err) {
      setResult({ error: String(err) });
      setStatus('error');
    }
  };

  const clearAll = async () => {
    setClearStatus('running');
    setClearResult(null);
    try {
      const res = await fetch('/api/admin/clear-all-properties', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setClearResult({
          before: data.before,
          after: data.after,
          deleted: data.deleted,
        });
        setClearStatus('done');
      } else {
        setClearResult({ error: data.error });
        setClearStatus('error');
      }
    } catch (err) {
      setClearResult({ error: String(err) });
      setClearStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="bg-white rounded-xl shadow-md p-8 max-w-lg w-full space-y-8">

        {/* ── Deduplicate Section ── */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Deduplicate Properties</h1>
              <p className="text-xs text-gray-400">Admin Tool — Service Role Access</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-sm font-semibold text-amber-800 mb-1">⚠️ What this does</p>
            <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
              <li>Scans every row in the <code className="bg-amber-100 px-1 rounded">properties</code> table</li>
              <li>Groups rows by <code className="bg-amber-100 px-1 rounded">property_ref</code></li>
              <li>Keeps the <strong>earliest</strong> record per unique <code className="bg-amber-100 px-1 rounded">property_ref</code></li>
              <li>Permanently deletes all duplicate rows (including rows with no <code className="bg-amber-100 px-1 rounded">property_ref</code>)</li>
              <li>Expected result: <strong>17,210 → 8,606 rows</strong></li>
            </ul>
          </div>

          {status === 'idle' && (
            <button
              onClick={run}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              🗑️ Run Deduplication Now
            </button>
          )}

          {status === 'running' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <svg className="animate-spin h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <div className="text-center">
                <p className="text-gray-700 font-medium">Running deduplication…</p>
                <p className="text-gray-400 text-sm mt-1">Fetching all rows and deleting duplicates. This may take 30–60 seconds.</p>
              </div>
            </div>
          )}

          {status === 'done' && result && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-5">
                <p className="text-green-800 font-semibold text-sm mb-3">✅ Deduplication complete</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-lg p-3 border border-green-100 text-center">
                    <p className="text-2xl font-bold text-gray-800">{result.before?.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">Rows before</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-green-100 text-center">
                    <p className="text-2xl font-bold text-green-700">{result.after?.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">Rows after</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-red-100 text-center">
                    <p className="text-2xl font-bold text-red-600">{result.removed?.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">Duplicates deleted</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-blue-100 text-center">
                    <p className="text-2xl font-bold text-blue-700">{result.uniqueRefs?.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">Unique property_refs</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center">
                Refresh the Property Management page to see the updated count.
              </p>
              <button
                onClick={() => { setStatus('idle'); setResult(null); }}
                className="w-full border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
            </div>
          )}

          {status === 'error' && result && (
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-semibold text-sm mb-1">❌ Error</p>
                <p className="text-red-700 text-sm font-mono break-all">{result.error}</p>
              </div>
              <button
                onClick={() => { setStatus('idle'); setResult(null); }}
                className="w-full border border-red-200 text-red-600 text-sm py-2 rounded-lg hover:bg-red-50 transition-colors"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {/* ── Divider ── */}
        <div className="border-t border-gray-200" />

        {/* ── Clear All Properties Section ── */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Clear All Properties</h2>
              <p className="text-xs text-gray-400">Wipe the table for a fresh CSV import</p>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <p className="text-sm font-semibold text-orange-800 mb-1">🚨 Destructive — cannot be undone</p>
            <ul className="text-sm text-orange-700 space-y-1 list-disc list-inside">
              <li>Permanently deletes <strong>every</strong> row in the <code className="bg-orange-100 px-1 rounded">properties</code> table</li>
              <li>Leaves the table empty so you can import a clean CSV</li>
              <li>Does <strong>not</strong> affect tenancies, documents, or other data</li>
            </ul>
          </div>

          {clearStatus === 'idle' && (
            <button
              onClick={() => setClearStatus('confirming')}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              🗑️ Clear All Properties
            </button>
          )}

          {clearStatus === 'confirming' && (
            <div className="space-y-3">
              <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-4 text-center">
                <p className="text-orange-900 font-bold text-sm mb-1">Are you absolutely sure?</p>
                <p className="text-orange-700 text-xs">This will delete every property record. This action cannot be undone.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setClearStatus('idle')}
                  className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={clearAll}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm py-2 rounded-lg transition-colors"
                >
                  Yes, delete all
                </button>
              </div>
            </div>
          )}

          {clearStatus === 'running' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <svg className="animate-spin h-8 w-8 text-orange-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <div className="text-center">
                <p className="text-gray-700 font-medium">Deleting all properties…</p>
                <p className="text-gray-400 text-sm mt-1">Processing in batches. This may take 30–60 seconds.</p>
              </div>
            </div>
          )}

          {clearStatus === 'done' && clearResult && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-5">
                <p className="text-green-800 font-semibold text-sm mb-3">✅ All properties cleared</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-lg p-3 border border-gray-100 text-center">
                    <p className="text-2xl font-bold text-gray-800">{clearResult.before?.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">Rows before</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-red-100 text-center">
                    <p className="text-2xl font-bold text-red-600">{clearResult.deleted?.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">Deleted</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-green-100 text-center">
                    <p className="text-2xl font-bold text-green-700">{clearResult.after?.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">Rows after</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center">
                The properties table is now empty. You can import your CSV from the Data Import page.
              </p>
              <button
                onClick={() => { setClearStatus('idle'); setClearResult(null); }}
                className="w-full border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
            </div>
          )}

          {clearStatus === 'error' && clearResult && (
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-semibold text-sm mb-1">❌ Error</p>
                <p className="text-red-700 text-sm font-mono break-all">{clearResult.error}</p>
              </div>
              <button
                onClick={() => { setClearStatus('idle'); setClearResult(null); }}
                className="w-full border border-red-200 text-red-600 text-sm py-2 rounded-lg hover:bg-red-50 transition-colors"
              >
                Try again
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
