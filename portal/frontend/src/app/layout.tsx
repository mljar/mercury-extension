import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header'; 

export const metadata: Metadata = {
  title: 'Mercury Portal',
  description: 'AI Web Apps'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
        
      </body>
    </html>
  );
}
