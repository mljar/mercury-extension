'use client';
import React, { useEffect, useState } from 'react';
import API from '@/lib/api';
import { Notebook } from '@/types/notebook';
import NotebookCard from '@/components/NotebookCard';

export default function Home() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get<Notebook[]>('notebooks/').then(res => {
      setNotebooks(res.data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-emerald-50 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">Notebook Portal</h1>
        {loading ? (
          <div className="text-center">Loading...</div>
        ) : notebooks.length === 0 ? (
          <div className="text-center text-gray-400">No notebooks found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            {notebooks.map(nb => (
              <NotebookCard key={nb.id} notebook={nb} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
