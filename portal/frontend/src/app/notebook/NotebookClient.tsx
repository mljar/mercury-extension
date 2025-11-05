'use client';
import React, { useEffect, useMemo, useState } from 'react';
import API from '@/lib/api';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header';

export default function NotebookClient() {
  const sp = useSearchParams();
  const id = sp.get('id');               // <- czytamy z query

  const [notebookUrl, setNotebookUrl] = useState<string | null>(null);
  const [notebookName, setNotebookName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [showLoadingUI, setShowLoadingUI] = useState(false); // delay the loading box

  const maxRetries = 10;

  // Backoff timing
  const baseDelay = 800; // ms
  const backoff = (n: number) =>
    Math.min(Math.round(baseDelay * Math.pow(1.7, n)), 5000);

  // Tiny "..." animation
  const Dots = () => (
    <span className="inline-flex w-6 justify-between">
      <span className="animate-pulse">.</span>
      <span className="animate-pulse [animation-delay:150ms]">.</span>
      <span className="animate-pulse [animation-delay:300ms]">.</span>
    </span>
  );

  // Friendly copies
  const copies = {
    launching: '🚀 Starting your notebook',
    warming: '⏳ Warming up the server',
    busyShort: '⏳ Notebook is starting up',
    tookTooLong: '⏱️ The notebook took too long to start. Please try again.',
    stillBusy: '🛠️ The notebook is still busy. Please try again later.',
    genericFail: '❌ Failed to launch notebook.',
    notRunning: '🛑 Notebook is not running.',
    retryNetwork: '📡 No connection… retrying',
    retryServer: '🛰️ Server not reachable… retrying',
    retry5xx: '🧰 Server error… retrying',
    tipHeader: '💡 Tips',
    tips: [
      'First start can take 10–30 seconds.',
      'If it keeps failing, try Retry.',
    ],
    retryBtn: '🔄 Retry',
  };

  // Helper to check server readiness
  const waitForServer = async (url: string, tries = 5, delay = 1000) => {
    for (let i = 0; i < tries; i++) {
      console.log('waitForServer', i);
      try {
        await fetch(url, { method: 'GET', mode: 'no-cors' });
        return true;
      } catch {
        await new Promise(res => setTimeout(res, delay));
      }
    }
    return false;
  };

  useEffect(() => {
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let canceled = false;

    const scheduleRetry = (msg: string) => {
      if (retryCount >= maxRetries) return false;
      const delay = backoff(retryCount);
      setError(`${msg} (attempt ${retryCount + 1}/${maxRetries})`);
      retryTimeout = setTimeout(() => {
        if (!canceled) setRetryCount(prev => prev + 1);
      }, delay);
      return true;
    };

    const launch = async () => {
      setLoading(true);
      setError('');
      try {
        // 1) Launch or get running URL
        const res = await API.post(`notebooks/${id}/launch/`);
        const url = res.data.url as string;
        setNotebookUrl(url || '');

        // 2) Load name (best-effort)
        try {
          const details = await API.get(`notebooks/${id}/`);
          setNotebookName(details.data.name || '');
        } catch {
          setNotebookName('');
        }

        // 3) Wait for server to respond
        const notebookBaseUrl = (url || '').split('?')[0];
        const pingUrl = notebookBaseUrl + '?_=' + Date.now();
        const ready = await waitForServer(pingUrl, 10, 500);

        if (!ready) {
          // Treat as retryable (server not ready yet)
          if (!scheduleRetry(copies.warming)) {
            setError(copies.tookTooLong);
            setNotebookUrl(null);
          }
          return;
        }

        // ready!
        setRetryCount(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        // Normalize error cases
        const status = e?.response?.status as number | undefined;

        // Retryable cases:
        // - 423 "busy"
        // - No response / network error / offline
        // - 5xx server errors
        if (status === 423) {
          if (!scheduleRetry(`${copies.busyShort}… we’ll keep trying`)) {
            setError(copies.stillBusy);
            setNotebookUrl(null);
          }
          return;
        }

        if (!e?.response) {
          // Network / offline / DNS / CORS / timeout
          if (!scheduleRetry(copies.retryNetwork)) {
            setError(copies.genericFail);
            setNotebookUrl(null);
          }
          return;
        }

        if (status && status >= 500) {
          if (!scheduleRetry(copies.retry5xx)) {
            setError(copies.genericFail);
            setNotebookUrl(null);
          }
          return;
        }

        // Non-retryable: other 4xx
        if (e?.response?.data?.error) {
          setError(`⚠️ ${e.response.data.error}`);
        } else {
          setError(copies.genericFail);
        }
        setNotebookUrl(null);
      } finally {
        setLoading(false);
      }
    };

    if (retryCount < maxRetries) launch();

    return () => {
      canceled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, retryCount]);

  // Consider retrying states as "loading-like" so we show the friendly box
  const isStartingUp = useMemo(() => {
    return (
      error.startsWith('⏳') ||
      error.includes('keep trying') ||
      error.startsWith('📡') ||
      error.startsWith('🛰️') ||
      error.startsWith('🧰')
    );
  }, [error]);

  // Delay showing the loading UI by 500ms to avoid flicker
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    if (loading || isStartingUp) {
      t = setTimeout(() => setShowLoadingUI(true), 500);
    } else {
      setShowLoadingUI(false);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [loading, isStartingUp]);

  // ---------- Loading / Starting / Retrying ----------
  if (loading || isStartingUp) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header fullWidth />
        <main className="flex-1 flex flex-col items-center justify-center px-4">
          {showLoadingUI && (
            <div
              role="status"
              aria-live="polite"
              className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-sm text-center"
            >
              <div className="text-xl font-semibold text-gray-800">
                {/* Prefer a precise line if we have a retry message; otherwise generic launching/warming */}
                {error
                  ? error.replace(/\s*\(attempt.*\)$/, '') // show clean message, attempts shown below
                  : retryCount > 0
                    ? copies.warming
                    : copies.launching}{' '}
                <Dots />
              </div>

              <p className="mt-2 text-gray-600 text-sm">
                Attempt {Math.min(retryCount + 1, maxRetries)} of {maxRetries}
              </p>

              <div className="mt-4 text-left">
                <p className="text-sm font-medium text-gray-800">
                  {copies.tipHeader}
                </p>
                <ul className="mt-1 list-disc pl-5 text-sm text-gray-600 space-y-1">
                  {copies.tips.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ---------- Error state (only after loading is done and not retrying) ----------
  if (!loading && (error || !notebookUrl)) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header fullWidth />
        <main className="flex-1 flex items-center justify-center px-4">
          <div
            role="alert"
            aria-live="assertive"
            className="w-full max-w-md rounded-2xl border border-red-200 bg-red-50 p-5 text-center"
          >
            <div className="text-red-700 text-lg font-semibold">
              {error || copies.notRunning}
            </div>
            <button
              className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 active:translate-y-px transition"
              onClick={() => {
                setRetryCount(0);
                setError('');
                setLoading(true);
              }}
            >
              {copies.retryBtn}
            </button>

            <div className="mt-4 text-left">
              <p className="text-sm font-medium text-red-800">
                {copies.tipHeader}
              </p>
              <ul className="mt-1 list-disc pl-5 text-sm text-red-700 space-y-1">
                <li>Check your internet connection.</li>
                <li>Try the Retry button once or twice.</li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ---------- Ready ----------
  return (
    <div className="min-h-screen">
      <Header fullWidth />
      <div className="fixed inset-0 top-[46px]">
        <iframe
          src={notebookUrl!}
          title={notebookName || 'Notebook'}
          className="w-full h-full border-none"
        />
      </div>
    </div>
  );
}
