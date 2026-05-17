import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '界门 Portal — Solar System DLC',
  description:
    'A cinematic entrance to the Solar System. 界门 Portal is a network of interactive universes.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-deep text-stardust">{children}</body>
    </html>
  );
}
