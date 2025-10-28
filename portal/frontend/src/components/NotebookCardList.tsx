'use client';

import React, { useEffect, useMemo, useState } from 'react';
import API from '@/lib/api';
import { Notebook } from '@/types/notebook';
import NotebookCard from './NotebookCard';

const NotebookCardList = () => {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await API.get<any>('notebooks/');
        if (!alive) return;
        const data = res?.data;
        const list: Notebook[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : [];
        setNotebooks(list);
      } catch (e: any) {
        if (!alive) return;
        setError(
          e?.response?.data?.detail || e?.message || 'Failed to load notebooks.'
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return notebooks;
    return notebooks.filter(
      n =>
        (n.name || '').toLowerCase().includes(s) ||
        (n.description || '').toLowerCase().includes(s)
    );
  }, [q, notebooks]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 tracking-tight">
          Notebooks
        </h2>
        <div className="w-64">
          <label htmlFor="nb-search" className="sr-only">
            Search notebooks
          </label>
          <div className="relative">
            <input
              id="nb-search"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search notebooks…"
              className="
                w-full rounded-lg border border-gray-200 bg-white/80 backdrop-blur px-3 py-1.5
                text-[13px] text-gray-800 placeholder:text-gray-400
                focus:outline-none focus:ring-2 focus:ring-blue-500/30
              "
            />
            <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M21 21l-4.3-4.3"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <circle
                  cx="11"
                  cy="11"
                  r="6.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {!loading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <li
              key={i}
              className="
                h-[220px] rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur
                shadow-[0_1px_2px_rgba(0,0,0,0.03)] animate-pulse
              "
            >
              <div className="h-full p-6">
                <div className="h-12 w-12 rounded-xl bg-gray-100 mb-4" />
                <div className="h-4 w-40 bg-gray-100 rounded mb-2" />
                <div className="h-3 w-56 bg-gray-100 rounded mb-1.5" />
                <div className="h-3 w-44 bg-gray-100 rounded" />
              </div>
            </li>
          ))}
        </ul>
      )}


      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div
          className="
            rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur
            shadow-[0_1px_2px_rgba(0,0,0,0.03)] px-6 py-10 text-center
          "
        >
          <div className="text-4xl mb-3">📚</div>
          <div className="text-base font-semibold text-gray-900 mb-1">
            No notebooks found
          </div>
          <div className="text-sm text-gray-500">
            Create your first notebook to get started
          </div>
        </div>
      )}

      {/* Notebook grid (3 per row) */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {filtered.map(notebook => (
            <NotebookCard key={notebook.id} notebook={notebook} />
          ))}
        </div>
      )}
    </div>
  );
};

export default NotebookCardList;
