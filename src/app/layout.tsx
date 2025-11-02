import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = {
  title: 'TableHop Character Vault',
  description: 'Build Pathfinder Society legal characters quickly.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-slate-950">
      <body className={cn('min-h-screen bg-slate-950 text-slate-100 antialiased')}>
        <main className="mx-auto max-w-6xl px-6 py-10 space-y-10">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-primary">TableHop</h1>
            <p className="text-slate-300">
              Pathfinder 2e Character Vault with Pathfinder Society legality checks.
            </p>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
