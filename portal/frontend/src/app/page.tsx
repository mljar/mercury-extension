'use client';
import React from 'react';

import NotebookCardList from '@/components/NotebookCardList';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Main Content */}
      <div className="max-w-10/12 mx-auto px-4 py-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notebook Portal</h1>
          <p className="text-gray-600 my-4 mb-8">
            Launch and manage your Jupyter notebooks
          </p>
        </div>
        {/* Notebooks Grid */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Available Notebooks
          </h2>
          <NotebookCardList />
        </div>
      </div>
      <Footer />
    </div>
  );
}
