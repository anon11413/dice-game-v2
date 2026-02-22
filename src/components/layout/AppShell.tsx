import type { ReactNode } from 'react';
import { Header } from './Header';
import { TabBar } from './TabBar';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex flex-col h-screen bg-[#0a0e17] text-gray-100">
      <Header />
      <TabBar />
      <main className="flex-1 overflow-auto p-2">
        {children}
      </main>
    </div>
  );
}
