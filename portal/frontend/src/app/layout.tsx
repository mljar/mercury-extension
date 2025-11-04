import type { Metadata } from 'next';
import './globals.css';

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
      <body className="flex flex-col bg-gray-50">
        
        <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
        
      </body>
    </html>
  );
}
