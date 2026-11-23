import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LabLink — Intelligent Campus Laboratory Resource Sharing',
  description:
    'GenAI-powered cross-department laboratory equipment discovery, accessible slot booking, faculty approvals, and fair deterministic conflict resolution.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}

