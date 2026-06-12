'use client';

import React, { useState } from 'react';

interface MigrationResult {
  success: boolean;
  message?: string;
  total?: number;
  updated?: number;
  failed?: number;
  errors?: string[];
  error?: string;
}

export default function MigrateAgentCommentsPage() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<MigrationResult | null>(null);

  const runMigration = async () => {
    setStatus('running');
    setResult(null);
    try {
      const res = await fetch('/api/migrate-agent-comments', { method: 'POST' });
      const data: MigrationResult = await res.json();
      setResult(data);
      setStatus(data.success ? 'done' : 'error');
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : String(err) });
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-md border border-gray-200 max-w-lg w-full p-8">
        <h1 className="text-xl font-semibold text-gray-800 mb-2">Migrate Agent Comments → Advertising Remarks</h1>
        <p className="text-sm text-gray-500 mb-6">
          This will copy all content from the <strong>Agent Comments</strong> (notes) field into the{' '}
          <strong>Advertising Remarks</strong> (p_english) field for every property that has agent comments, then clear
          the agent comments field. This action cannot be undone.
        </p>

        {status === 'idle' && (
          <button
            onClick={runMigration}
            className="w-full bg-[#8B1A2B] hover:bg-[#7a1625] text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Run Migration
          </button>
        )}

        {status === 'running' && (
          <div className="flex items-center justify-center gap-3 py-4 text-gray-600">
            <svg className="animate-spin h-5 w-5 text-[#8B1A2B]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>Running migration, please wait…</span>
          </div>
        )}

        {status === 'done' && result && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-emerald-700 font-medium">✓ Migration complete</p>
              <p className="text-emerald-600 text-sm mt-1">{result.message}</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-gray-800">{result.total ?? 0}</p>
                <p className="text-xs text-gray-500 mt-1">Total found</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-emerald-700">{result.updated ?? 0}</p>
                <p className="text-xs text-gray-500 mt-1">Updated</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-red-600">{result.failed ?? 0}</p>
                <p className="text-xs text-gray-500 mt-1">Failed</p>
              </div>
            </div>
            {result.errors && result.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                <p className="text-red-700 text-xs font-medium mb-1">Errors:</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-red-600 text-xs">{e}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {status === 'error' && result && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 font-medium">Migration failed</p>
            <p className="text-red-600 text-sm mt-1">{result.error ?? result.message}</p>
            <button
              onClick={() => setStatus('idle')}
              className="mt-3 text-sm text-red-700 underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
