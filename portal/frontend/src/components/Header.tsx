'use client';
import React from 'react';
import Link from 'next/link';

export default function Header() {
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/">
            <h1 className="text-3xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors">
              Mercury
            </h1>
          </Link>
        </div>
        <div className="flex items-center space-x-4">
          <button className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors">
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}
