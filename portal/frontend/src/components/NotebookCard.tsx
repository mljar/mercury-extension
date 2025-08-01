import React, { useState } from 'react';
import { Notebook } from '@/types/notebook';
import { useRouter } from 'next/navigation';
import API from '@/lib/api';

interface Props {
  notebook: Notebook;
  borderColor?: string;
}

const NotebookCard: React.FC<Props> = ({ notebook, borderColor }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  let icon;
  if (notebook.thumbnail_image) {
    icon = (
      <img
        src={notebook.thumbnail_image}
        alt={notebook.name}
        className="w-12 h-12 rounded-xl object-cover bg-gray-100"
      />
    );
  } else {
    icon = (
      <div
        className="w-12 h-12 flex items-center justify-center rounded-xl text-2xl font-bold"
        style={{
          background: notebook.thumbnail_bg || '#38bdf8',
          color: notebook.thumbnail_text_color || '#fff',
        }}
      >
        {notebook.thumbnail_text || '📒'}
      </div>
    );
  }

  const border =
    borderColor ||
    (notebook.thumbnail_bg ? `border-[2.5px]` : `border border-cyan-600`);

  // --- This function launches notebook then navigates ---
  const handleCardClick = async () => {
    setLoading(true);
    try {
      await API.post(`notebooks/${notebook.id}/launch/`);
      router.push(`/notebooks/${notebook.id}`);
    } catch (error) {
      alert('Failed to launch notebook. See console for details.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`flex flex-col bg-[#232837] ${border} rounded-2xl shadow-md p-6 cursor-pointer transition hover:shadow-lg min-h-[230px] border-solid relative`}
      style={{
        borderColor: notebook.thumbnail_bg || '#38bdf8',
        opacity: loading ? 0.6 : 1,
      }}
      onClick={loading ? undefined : handleCardClick}
      role="button"
      tabIndex={0}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-2xl z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-400"></div>
        </div>
      )}
      <div className="flex items-center gap-4 mb-3">
        {icon}
        <span className="font-bold text-2xl text-white">{notebook.name}</span>
      </div>
      <div className="text-gray-300 text-base leading-normal">
        {notebook.description}
      </div>
    </div>
  );
};

export default NotebookCard;
