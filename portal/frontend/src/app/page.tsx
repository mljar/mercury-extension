'use client';
import React from 'react';

import NotebookCardList from '@/components/NotebookCardList';
import Footer from '@/components/Footer';
import Header from '@/components/Header';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Main Content */}
      <Header />
      <main className="flex-1  px-4">
        <div className="max-w-4xl mx-auto py-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Hi there! 👋</h1>
            <p className="text-gray-600 mt-4">
              <b>Welcome to Mercury. </b>
              You&apos;re viewing a notebooks turned into a user-friendly apps.
            </p>
            <p className="text-gray-600 mb-8">
              Feel free to interact and explore - everything is
              designed to be <b>simple and safe</b>.
            </p>
          </div>
          {/* Notebooks Grid */}
          <div className="mb-6">
            <NotebookCardList />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
