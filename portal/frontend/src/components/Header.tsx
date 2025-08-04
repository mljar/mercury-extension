'use client';
import React from 'react';

export default function Header() {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Notebook Portal
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <button className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors">
              Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
