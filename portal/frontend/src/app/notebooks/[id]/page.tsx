'use client';
import React, { useEffect, useState } from 'react';
import API from '@/lib/api';
import { Notebook } from '@/types/notebook';
import { useParams, useRouter } from 'next/navigation';

export default function NotebookViewer() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get<Notebook>(`notebooks/${id}/`).then(res => {
      setNotebook(res.data);
      setLoading(false);
    });
  }, [id]);

  const getNotebookUrl = (notebook: Notebook) =>
    notebook.port ? `http://localhost:${notebook.port}` : '';

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!notebook)
    return (
      <div className="p-8 text-center text-red-500">Notebook not found.</div>
    );

  return (
    <div className="min-h-screen bg-emerald-50 flex flex-col items-center py-8">
      <button
        className="mb-4 px-4 py-1 rounded-xl bg-gray-200 hover:bg-gray-300"
        onClick={() => router.push('/')}
      >
        ← Back
      </button>
      <div className="bg-white rounded-xl shadow p-6 mb-4 w-full max-w-3xl">
        <h2 className="text-2xl font-bold mb-2">{notebook.name}</h2>
        <div className="text-gray-600 mb-2">{notebook.description}</div>
        {notebook.thumbnail_image ? (
          <img
            src={notebook.thumbnail_image}
            alt={notebook.name}
            className="w-20 h-20 object-cover rounded-xl mb-2"
          />
        ) : notebook.thumbnail_bg && notebook.thumbnail_text ? (
          <div
            className="w-20 h-20 flex items-center justify-center rounded-xl shadow text-3xl font-bold mb-2"
            style={{
              background: notebook.thumbnail_bg,
              color: notebook.thumbnail_text_color || '#fff'
            }}
          >
            {notebook.thumbnail_text}
          </div>
        ) : null}
      </div>
      <div className="w-full max-w-4xl flex-1 flex items-center justify-center">
        {notebook.status === 'running' && notebook.port ? (
          <iframe
            src={getNotebookUrl(notebook)}
            title={notebook.name}
            className="w-full h-[70vh] border rounded-xl"
          />
        ) : (
          <div className="text-center text-red-500 text-lg bg-white rounded-xl p-8 shadow">
            Notebook is not running.
            <br />
            Please launch it from the main page.
          </div>
        )}
      </div>
    </div>
  );
}
