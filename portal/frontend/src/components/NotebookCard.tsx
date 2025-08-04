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
      className="bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-200 p-6 flex flex-col items-center text-center cursor-pointer transition-all duration-200 min-h-[220px] relative hover:border-gray-300"
      onClick={loading ? undefined : handleClick}
    >
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center rounded-xl z-10">
          <div className="animate-spin h-6 w-6 border-2 border-t-transparent border-blue-500 rounded-full" />
        </div>
      )}

      {/* Icon */}
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 shadow-sm"
        style={{
          background: notebook.thumbnail_bg || '#6b7280',
          color: notebook.thumbnail_text_color || '#fff'
        }}
      >
        {notebook.thumbnail_image ? (
          <img
            src={notebook.thumbnail_image}
            alt={notebook.name}
            className="w-full h-full object-cover rounded-xl"
          />
        ) : (
          notebook.thumbnail_text || '📒'
        )}
      </div>

      {/* Title */}
      <h2 className="font-semibold text-lg text-gray-900 mb-2 leading-tight">
        {notebook.name}
      </h2>

      {/* Description */}
      <p className="text-sm text-gray-600 leading-relaxed">
        {notebook.description}
      </p>
    </div>
  );
};
export default NotebookCard;
