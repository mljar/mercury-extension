'use client';
import React, { useEffect, useState } from 'react';
import API from '@/lib/api';
import { Notebook } from '@/types/notebook';
import { useParams } from 'next/navigation';

export default function NotebookViewer() {
  const params = useParams();
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

  if (loading) return <div className="flex-1 flex items-center justify-center">Loading...</div>;
  if (!notebook) return <div className="flex-1 flex items-center justify-center text-red-500">Notebook not found.</div>;

  if (notebook.status !== 'running' || !notebook.port) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white text-red-500 text-lg">
        Notebook is not running.
      </div>
    );
  }

  return (
    <div className="fixed inset-0 top-[90px]">
      <iframe
        src={getNotebookUrl(notebook)}
        title={notebook.name}
        className="w-full h-full border-none"
      />
    </div>
  );
}
