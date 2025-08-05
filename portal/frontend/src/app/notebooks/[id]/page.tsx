'use client';
import React, { useEffect, useState } from 'react';
import API from '@/lib/api';
import { useParams } from 'next/navigation';

export default function NotebookViewer() {
  const params = useParams();
  const { id } = params;
  const [notebookUrl, setNotebookUrl] = useState<string | null>(null);
  const [notebookName, setNotebookName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const maxRetries = 10;

  // Helper to check server
  const waitForServer = async (url: string, tries = 5, delay = 1000) => {
    for (let i = 0; i < tries; i++) {
      try {
        // Use GET; mode: 'no-cors' avoids CORS issues
        await fetch(url, { method: 'GET', mode: 'no-cors' });
        return true;
      } catch {
        await new Promise(res => setTimeout(res, delay));
      }
    }
    return false;
  };

  useEffect(() => {
    let retryTimeout: NodeJS.Timeout | null = null;

    const launch = async () => {
      setLoading(true);
      setError('');
      try {
        // 1. Launch (start server or return running)
        const res = await API.post(`notebooks/${id}/launch/`);
        const url = res.data.url;
        setNotebookUrl(url || '');

        // 2. Optionally fetch notebook details for name
        try {
          const details = await API.get(`notebooks/${id}/`);
          setNotebookName(details.data.name || '');
        } catch {
          setNotebookName('');
        }

        // 3. Wait for server to respond
        const notebookBaseUrl = url.split('?')[0];
        const pingUrl = notebookBaseUrl + '?_=' + Date.now();
        const ready = await waitForServer(pingUrl, 5, 1000);

        if (!ready) {
          setError('Notebook server did not start in time. Please try again.');
          setNotebookUrl(null);
        } else {
          setRetryCount(0);
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        // Backend busy? Auto-retry, up to maxRetries
        if (e.response && e.response.status === 423 && retryCount < maxRetries) {
          setError('Notebook is starting up. Waiting for server…');
          retryTimeout = setTimeout(() => setRetryCount(retryCount + 1), 1200);
          return;
        } else if (e.response && e.response.status === 423) {
          setError('Notebook is still busy. Please try again later.');
        } else if (e.response && e.response.data && e.response.data.error) {
          setError(e.response.data.error);
        } else {
          setError('Failed to launch notebook.');
        }
        setNotebookUrl(null);
      } finally {
        setLoading(false);
      }
    };

    if (retryCount < maxRetries) {
      launch();
    }

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [id, retryCount]);

  if (loading || error === 'Notebook is starting up. Waiting for server…') {
    return (
      <div className="flex-1 flex items-center justify-center text-lg text-gray-700">
        {error || 'Launching notebook server...'}
      </div>
    );
  }

  if (error || !notebookUrl) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-red-500 text-lg">
        {error || 'Notebook is not running.'}
        <button
          className="mt-4 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          onClick={() => {
            setRetryCount(0);
            setError('');
            setLoading(true);
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 top-[65px]">
      <iframe
        src={notebookUrl}
        title={notebookName || 'Notebook'}
        className="w-full h-full border-none"
      />
    </div>
  );
}
