import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'AI-Powered CMS Orchestrator',
  description: 'Deterministic backend orchestration for AI CMS changes with Jules, Slack, GitHub & Vercel',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-900 text-slate-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
