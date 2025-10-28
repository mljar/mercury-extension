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
      router.push(`/notebooks/${notebook.id}`);
    } catch (err) {
      alert('Failed to launch notebook.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`
        relative cursor-pointer select-none
        rounded-2xl border border-gray-200/70 bg-white/80 backdrop-blur
        shadow-[0_1px_2px_rgba(0,0,0,0.03)]
        hover:shadow-[0_6px_20px_rgba(0,0,0,0.05)]
        hover:border-gray-300 transition-all duration-200 ease-out
        flex flex-col items-center justify-start text-center p-6
        min-h-[220px]
      `}
    >
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      )}

      {/* Thumbnail (text icon only) */}
      <div
        className={`
          flex items-center justify-center mb-4
          h-12 w-12 rounded-xl
          shadow-[0_1px_2px_rgba(0,0,0,0.04)]
          text-2xl font-medium
        `}
        style={{
          backgroundColor: '#f8fafc', // soft neutral background
          color: notebook.thumbnail_text_color || '#0f172a',
        }}
      >
        {notebook.thumbnail_text || '📒'}
      </div>

      {/* Title */}
      <h2 className="mb-1 text-base font-semibold text-gray-900 tracking-tight">
        {notebook.name}
      </h2>

      {/* Description */}
      {notebook.description ? (
        <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
          {notebook.description}
        </p>
      ) : (
        <p className="text-sm text-gray-400 italic">No description</p>
      )}
    </div>
  );
};

export default NotebookCard;
