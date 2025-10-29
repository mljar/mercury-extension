'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Notebook } from '@/types/notebook';
import API from '@/lib/api';

interface Props {
  notebook: Notebook;
}

const NotebookCard = ({ notebook }: Props) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await API.post(`notebooks/${notebook.id}/launch/`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      router.push(`/notebook?id=${notebook.id}`);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      alert('Failed to launch notebook.');
    } finally {
      setLoading(false);
    }
  };

  // --- Dynamic font size (emoji vs text with up to 10 chars) ---
  const text = notebook.thumbnail_text || '📒';
  let fontSize = '2.5rem'; // default big for emoji

  if (typeof text === 'string') {
    const len = text.length;

    if (len > 6) fontSize = '0.9rem';
    else if (len > 4) fontSize = '1.1rem';
    else if (len > 2) fontSize = '1.4rem';
    else fontSize = '2rem'; // 1–2 letters slightly smaller than emoji
  }

  return (
    <div
      onClick={handleClick}
      className={`
        relative cursor-pointer select-none
        rounded-2xl border border-gray-200 bg-white/80 backdrop-blur
        shadow-sm hover:shadow-md hover:border-gray-300
        transition-all duration-200 ease-out
        flex flex-row items-center gap-5 p-5
        min-h-[130px]
      `}
    >
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      )}

      {/* Thumbnail */}
      <div
        className="h-16 w-20 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
        style={{
          backgroundColor: notebook.thumbnail_bg || '#f1f5f9',
          color: notebook.thumbnail_text_color || '#0f172a',
          fontSize,
          fontWeight: 600,
          textAlign: 'center',
          lineHeight: 1.1,
          padding: '4px',
          display: 'flex',
        }}
      >
        {text}
      </div>

      {/* Info */}
      <div className="flex flex-col justify-center">
        <h2 className="text-lg font-semibold text-gray-900 tracking-tight">
          {notebook.name}
        </h2>

        {notebook.description && (
          <p className="text-base text-gray-600 leading-relaxed line-clamp-2 mt-1">
            {notebook.description}
          </p>
        )}
      </div>
    </div>
  );
};

export default NotebookCard;
