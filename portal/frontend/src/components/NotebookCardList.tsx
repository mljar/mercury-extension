import React, { useEffect, useState } from 'react';
import API from '@/lib/api';
import { Notebook } from '@/types/notebook';
import NotebookCard from './NotebookCard';

const NotebookCardList = () => {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get<Notebook[]>('notebooks/').then(res => {
      setNotebooks(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (notebooks.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8 bg-white rounded-xl border border-gray-200">
        <div className="text-4xl mb-4">📚</div>
        <div className="text-lg font-medium mb-2">No notebooks found</div>
        <div className="text-sm">Create your first notebook to get started</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {notebooks.map(notebook => (
        <NotebookCard
          key={notebook.id}
          notebook={notebook}
        />
      ))}
    </div>
  );
};

export default NotebookCardList;
